import { describe, expect, it } from "vitest";
import {
  buildDiscoveryConfigs,
  buildStatePayload,
  SENSORS,
} from "../src/homeassistant.js";
import type { NowShowing } from "../src/parser.js";

const movie = (title: string) => ({
  title,
  rating: "PG",
  imdb_url: null,
  poster_url: null,
});

const nowShowing = (overrides: Partial<NowShowing> = {}): NowShowing => ({
  open: true,
  notice: null,
  dates: "Friday - August 2",
  start_time: "8:30",
  movies: [movie("A"), movie("B")],
  ...overrides,
});

describe("buildStatePayload", () => {
  const at = new Date("2024-08-02T12:00:00Z");

  it("maps features and status", () => {
    expect(buildStatePayload(nowShowing(), at)).toMatchObject({
      status: "open",
      feature_1: { title: "A" },
      feature_2: { title: "B" },
      refreshed_at: "2024-08-02T12:00:00.000Z",
    });
  });

  it("uses null features when closed", () => {
    expect(
      buildStatePayload(nowShowing({ open: false, movies: [] }), at),
    ).toMatchObject({ status: "closed", feature_1: null, feature_2: null });
  });

  it("keeps every state value within Home Assistant's 255 character limit", () => {
    const long = "x".repeat(400);
    const payload = buildStatePayload(
      nowShowing({ dates: long, start_time: long, movies: [movie(long)] }),
      at,
    );

    for (const value of [
      payload.dates,
      payload.start_time,
      payload.feature_1?.title,
    ]) {
      expect(value!.length).toBeLessThanOrEqual(255);
    }
  });
});

describe("buildDiscoveryConfigs", () => {
  it("only references fields that exist in the state payload", () => {
    const payloadKeys = Object.keys(
      buildStatePayload(nowShowing(), new Date()),
    );
    for (const { config } of buildDiscoveryConfigs("test")) {
      const templates = [
        config.value_template,
        config.json_attributes_template ?? "",
      ].join(" ");
      for (const [, key] of templates.matchAll(/value_json\.(\w+)/g)) {
        expect(payloadKeys, config.unique_id).toContain(key);
      }
    }
  });

  it("produces one entity per sensor, all on the same device", () => {
    const configs = buildDiscoveryConfigs("1.2.3");
    expect(configs).toHaveLength(Object.keys(SENSORS).length);
    expect(new Set(configs.map((c) => c.config.unique_id)).size).toBe(
      configs.length,
    );
    for (const { topic, config } of configs) {
      expect(topic).toMatch(
        /^homeassistant\/sensor\/fairlee_drive_in\/\w+\/config$/,
      );
      expect(config.device).toMatchObject({
        identifiers: ["fairlee_drive_in"],
        sw_version: "1.2.3",
      });
    }
  });
});
