import type { MqttClient } from "mqtt";
import {
  buildDiscoveryConfigs,
  buildStatePayload,
  topics,
  type StatePayload,
} from "./homeassistant.js";
import { parseNowShowing } from "./parser.js";

export type Logger = Pick<Console, "log" | "error">;

export type AppOptions = {
  client: MqttClient;
  fetchHtml: () => Promise<string>;
  refreshIntervalMs: number;
  version: string;
  now?: () => Date;
  logger?: Logger;
};

export type App = {
  /** Fetches and parses the page, then publishes it if connected. Never rejects. */
  refresh: () => Promise<void>;
  /** Resolves once the first refresh has finished (successfully or not). */
  ready: Promise<void>;
  /** Marks the device unavailable, stops refreshing and disconnects. */
  stop: () => Promise<void>;
  /** Most recently published state, or null before the first successful refresh. */
  latest: () => StatePayload | null;
};

const RETAINED = { retain: true, qos: 1 } as const;

export function startApp({
  client,
  fetchHtml,
  refreshIntervalMs,
  version,
  now = () => new Date(),
  logger = console,
}: AppOptions): App {
  let latest: StatePayload | null = null;
  const discovery = buildDiscoveryConfigs(version);

  const publishState = async () => {
    if (latest && client.connected) {
      await client.publishAsync(topics.state, JSON.stringify(latest), RETAINED);
    }
  };

  /** Publishes everything Home Assistant needs to (re)build the device. */
  const announce = async () => {
    // Remove the single sensor created by v1.0.x
    await client.publishAsync(topics.legacyDiscovery, "", RETAINED);
    for (const { topic, config } of discovery) {
      await client.publishAsync(topic, JSON.stringify(config), RETAINED);
    }
    await client.publishAsync(topics.availability, "online", RETAINED);
    await publishState();
  };

  const announceSafely = () =>
    announce().catch((error) =>
      logger.error("Failed to publish discovery", error),
    );

  client.on("connect", () => {
    logger.log("Connected to MQTT broker");
    client
      .subscribeAsync(topics.homeAssistantStatus)
      .catch((error) => logger.error("Failed to subscribe", error));
    announceSafely();
  });

  client.on("message", (topic, message) => {
    if (
      topic === topics.homeAssistantStatus &&
      message.toString() === "online"
    ) {
      logger.log("Home Assistant came online; republishing discovery");
      announceSafely();
    }
  });

  const refresh = async () => {
    try {
      latest = buildStatePayload(parseNowShowing(await fetchHtml()), now());
      logger.log(
        `Refreshed: ${latest.status}` +
          (latest.movies.length
            ? ` - ${latest.movies.map((m) => m.title).join(", ")}`
            : ""),
      );
    } catch (error) {
      logger.error("Refresh failed; keeping previous data", error);
      return;
    }

    try {
      await publishState();
    } catch (error) {
      logger.error("Failed to publish state", error);
    }
  };

  const timer = setInterval(refresh, refreshIntervalMs);
  const ready = refresh();

  return {
    refresh,
    ready,
    latest: () => latest,
    stop: async () => {
      clearInterval(timer);
      if (client.connected) {
        await client
          .publishAsync(topics.availability, "offline", RETAINED)
          .catch(() => undefined);
      }
      await client.endAsync();
    },
  };
}
