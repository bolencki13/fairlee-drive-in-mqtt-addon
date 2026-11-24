import { readFileSync } from "node:fs";
import { createServer, type AddressInfo, type Server } from "node:net";
import { Aedes } from "aedes";
import mqtt, { type MqttClient } from "mqtt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startApp, type App } from "../src/app.js";
import { SENSORS, topics, type StatePayload } from "../src/homeassistant.js";
import { createMqttClient } from "../src/mqtt.js";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8");

const silentLogger = { log: () => {}, error: () => {} };
const NOW = new Date("2024-08-02T12:00:00.000Z");

type Message = { topic: string; payload: string; retain: boolean };

/** In-process MQTT broker plus a client that records everything it sees. */
async function startBroker() {
  const broker = await Aedes.createBroker();
  const server: Server = createServer(broker.handle);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    port,
    async close() {
      await new Promise<void>((resolve) => broker.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** Connects a fresh observer (like Home Assistant would) and collects messages, including retained ones. */
async function observe(port: number) {
  const client = await mqtt.connectAsync({ host: "127.0.0.1", port });
  const messages: Message[] = [];
  client.on("message", (topic, payload, packet) =>
    messages.push({
      topic,
      payload: payload.toString(),
      retain: packet.retain,
    }),
  );
  await client.subscribeAsync("#");

  const last = (topic: string) =>
    messages.filter((m) => m.topic === topic).at(-1);

  return {
    client,
    messages,
    last,
    state: () => JSON.parse(last(topics.state)!.payload) as StatePayload,
    waitFor: (predicate: (messages: Message[]) => boolean) =>
      vi.waitFor(() => expect(predicate(messages)).toBe(true), {
        timeout: 3000,
      }),
  };
}

describe("app (against a real MQTT broker)", () => {
  let broker: Awaited<ReturnType<typeof startBroker>>;
  let client: MqttClient;
  let app: App | undefined;
  const others: MqttClient[] = [];

  const start = (fetchHtml: () => Promise<string>) => {
    client = createMqttClient({
      host: "127.0.0.1",
      port: broker.port,
      username: "",
      password: "",
    });
    app = startApp({
      client,
      fetchHtml,
      refreshIntervalMs: 60 * 60 * 1000,
      version: "test",
      now: () => NOW,
      logger: silentLogger,
    });
    return app;
  };

  const connectedObserver = async () => {
    const observer = await observe(broker.port);
    others.push(observer.client);
    return observer;
  };

  beforeEach(async () => {
    broker = await startBroker();
  });

  afterEach(async () => {
    await app?.stop();
    app = undefined;
    await Promise.all(others.splice(0).map((c) => c.endAsync()));
    await broker.close();
  });

  it("publishes retained discovery, availability and state that a late subscriber (HA restart) receives", async () => {
    const running = start(async () =>
      fixture("showing-2024-08-multi-line-date"),
    );
    await running.ready;
    await vi.waitFor(() => expect(client.connected).toBe(true));

    // Subscribe only after everything was published: retained messages must be replayed
    const ha = await connectedObserver();
    await ha.waitFor((m) => m.some((x) => x.topic === topics.state));

    for (const key of Object.keys(SENSORS)) {
      const message = ha.last(topics.discovery(key));
      expect(message?.retain, key).toBe(true);
      const config = JSON.parse(message!.payload);
      expect(config).toMatchObject({
        unique_id: `fairlee_drive_in_${key}`,
        state_topic: topics.state,
        availability_topic: topics.availability,
        device: { identifiers: ["fairlee_drive_in"] },
      });
      // Options that are not valid for MQTT sensors must not be sent
      expect(config).not.toHaveProperty("retain");
      expect(config).not.toHaveProperty("optimistic");
    }

    expect(ha.last(topics.availability)).toEqual({
      topic: topics.availability,
      payload: "online",
      retain: true,
    });
    expect(ha.last(topics.state)?.retain).toBe(true);
    expect(ha.state()).toEqual({
      status: "open",
      notice: null,
      dates: "Friday, Saturday & Sunday - August 2, 3, 4",
      start_time: "8:30 / Dusk",
      feature_1: expect.objectContaining({ title: "Deadpool & Wolverine" }),
      feature_2: expect.objectContaining({ title: "Bad Boys: Ride or Die" }),
      movies: [
        expect.objectContaining({ title: "Deadpool & Wolverine" }),
        expect.objectContaining({ title: "Bad Boys: Ride or Die" }),
      ],
      refreshed_at: NOW.toISOString(),
    });
  });

  it("publishes a closed status with the notice when the theater is closed", async () => {
    const ha = await connectedObserver();
    await start(async () => fixture("closed-2025-notice")).ready;
    await ha.waitFor((m) => m.some((x) => x.topic === topics.state));

    expect(ha.state()).toMatchObject({
      status: "closed",
      notice: expect.stringContaining("closed for 2025 Season"),
      feature_1: null,
      feature_2: null,
      movies: [],
    });
  });

  it("publishes new data on each refresh", async () => {
    const pages = [
      fixture("showing-2024-06-single-line-date"),
      fixture("showing-2024-08-multi-line-date"),
    ];
    const ha = await connectedObserver();
    const running = start(async () => pages.shift()!);
    await running.ready;
    await ha.waitFor((m) => m.some((x) => x.topic === topics.state));
    expect(ha.state().feature_1?.title).toBe("Inside Out 2");

    await running.refresh();
    await ha.waitFor(
      () => ha.state().feature_1?.title === "Deadpool & Wolverine",
    );
  });

  it("keeps the last good data and stays up when a refresh fails", async () => {
    const fetchHtml = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce(fixture("showing-2024-08-multi-line-date"))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce("<html>layout changed</html>");

    const ha = await connectedObserver();
    const running = start(fetchHtml);
    await running.ready;
    await ha.waitFor((m) => m.some((x) => x.topic === topics.state));
    const before = ha.messages.filter((m) => m.topic === topics.state).length;

    await expect(running.refresh()).resolves.toBeUndefined();
    await expect(running.refresh()).resolves.toBeUndefined();

    expect(running.latest()?.feature_1?.title).toBe("Deadpool & Wolverine");
    expect(ha.messages.filter((m) => m.topic === topics.state)).toHaveLength(
      before,
    );
    expect(ha.last(topics.availability)?.payload).toBe("online");
  });

  it("does not crash when the very first fetch fails, and publishes once one succeeds", async () => {
    const fetchHtml = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(fixture("showing-2024-06-single-line-date"));

    const ha = await connectedObserver();
    const running = start(fetchHtml);
    await running.ready;
    await ha.waitFor((m) => m.some((x) => x.topic === topics.availability));
    expect(ha.last(topics.state)).toBeUndefined();

    await running.refresh();
    await ha.waitFor((m) => m.some((x) => x.topic === topics.state));
    expect(ha.state().feature_1?.title).toBe("Inside Out 2");
  });

  it("refreshes on an interval", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      const fetchHtml = vi.fn(async () =>
        fixture("showing-2024-08-multi-line-date"),
      );
      client = createMqttClient({
        host: "127.0.0.1",
        port: broker.port,
        username: "",
        password: "",
      });
      app = startApp({
        client,
        fetchHtml,
        refreshIntervalMs: 1000,
        version: "test",
        logger: silentLogger,
      });
      await app.ready;
      expect(fetchHtml).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(3000);
      expect(fetchHtml).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("republishes discovery when Home Assistant announces it is online", async () => {
    const ha = await connectedObserver();
    await start(async () => fixture("showing-2024-08-multi-line-date")).ready;
    const statusTopic = topics.discovery("status");
    await ha.waitFor((m) => m.some((x) => x.topic === statusTopic));
    const before = ha.messages.filter((m) => m.topic === statusTopic).length;

    await ha.client.publishAsync(topics.homeAssistantStatus, "online");

    await ha.waitFor(
      (m) => m.filter((x) => x.topic === statusTopic).length > before,
    );
  });

  it("clears the v1.0 single-sensor discovery topic", async () => {
    // Simulate a retained config left behind by the old version
    const legacy = await mqtt.connectAsync({
      host: "127.0.0.1",
      port: broker.port,
    });
    others.push(legacy);
    await legacy.publishAsync(topics.legacyDiscovery, '{"name":"old"}', {
      retain: true,
    });

    const ha = await connectedObserver();
    await start(async () => fixture("showing-2024-08-multi-line-date")).ready;
    await ha.waitFor((m) =>
      m.some((x) => x.topic === topics.legacyDiscovery && x.payload === ""),
    );
  });

  it("marks the device offline on a clean shutdown", async () => {
    const ha = await connectedObserver();
    const running = start(async () => fixture("closed-2025-notice"));
    await ha.waitFor((m) =>
      m.some((x) => x.topic === topics.availability && x.payload === "online"),
    );

    await running.stop();
    app = undefined;

    await ha.waitFor(() => ha.last(topics.availability)?.payload === "offline");
  });

  it("marks the device offline via last will when the connection drops", async () => {
    const ha = await connectedObserver();
    start(async () => fixture("closed-2025-notice"));
    await ha.waitFor((m) =>
      m.some((x) => x.topic === topics.availability && x.payload === "online"),
    );

    // Kill the socket without a DISCONNECT packet, as a crash would
    client.options.reconnectPeriod = 0;
    client.stream.destroy();

    await ha.waitFor(() => ha.last(topics.availability)?.payload === "offline");

    // The will is retained, so Home Assistant sees "offline" even if it subscribes later
    const lateSubscriber = await connectedObserver();
    await lateSubscriber.waitFor(
      () => lateSubscriber.last(topics.availability)?.payload === "offline",
    );
    expect(lateSubscriber.last(topics.availability)?.retain).toBe(true);
  });
});
