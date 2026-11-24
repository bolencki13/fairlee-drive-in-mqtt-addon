/**
 * Home Assistant MQTT discovery for the Fairlee Drive-In device.
 * See https://www.home-assistant.io/integrations/mqtt/#mqtt-discovery
 *
 * All entities read from a single retained JSON state topic and pick out their
 * value with a `value_template`, so one publish updates every entity at once.
 */
import type { Movie, NowShowing } from "./parser.js";

export const DEVICE_ID = "fairlee_drive_in";
export const DISCOVERY_PREFIX = "homeassistant";
export const NOW_SHOWING_URL = "https://fairleedrivein.com/now-showing/";

export const topics = {
  state: `${DEVICE_ID}/state`,
  availability: `${DEVICE_ID}/availability`,
  /** Home Assistant's birth/last-will topic ("online" / "offline") */
  homeAssistantStatus: `${DISCOVERY_PREFIX}/status`,
  discovery: (key: string) =>
    `${DISCOVERY_PREFIX}/sensor/${DEVICE_ID}/${key}/config`,
  /** Single sensor published by v1.0.x; cleared so the stale entity is removed */
  legacyDiscovery: `${DISCOVERY_PREFIX}/sensor/${DEVICE_ID}/config`,
};

/** Home Assistant rejects sensor states longer than 255 characters. */
const MAX_STATE_LENGTH = 255;

export type StatePayload = {
  status: "open" | "closed";
  notice: string | null;
  dates: string | null;
  start_time: string | null;
  feature_1: Movie | null;
  feature_2: Movie | null;
  movies: Movie[];
  refreshed_at: string;
};

function truncate<T extends string | null>(value: T): T {
  if (value === null || value.length <= MAX_STATE_LENGTH) return value;
  return `${value.slice(0, MAX_STATE_LENGTH - 1)}…` as T;
}

export function buildStatePayload(
  nowShowing: NowShowing,
  refreshedAt: Date,
): StatePayload {
  const movies = nowShowing.movies.map((movie) => ({
    ...movie,
    title: truncate(movie.title),
  }));

  return {
    status: nowShowing.open ? "open" : "closed",
    notice: nowShowing.notice,
    dates: truncate(nowShowing.dates),
    start_time: truncate(nowShowing.start_time),
    feature_1: movies[0] ?? null,
    feature_2: movies[1] ?? null,
    movies,
    refreshed_at: refreshedAt.toISOString(),
  };
}

type SensorConfig = {
  name: string;
  value_template: string;
  icon?: string;
  device_class?: string;
  options?: string[];
  entity_category?: "diagnostic";
  json_attributes_template?: string;
};

// Templates return the string 'None' for "no value", which HA maps to the "unknown" state.
const featureSensor = (key: "feature_1" | "feature_2", name: string) =>
  ({
    name,
    icon: "mdi:movie-open",
    value_template: `{{ value_json.${key}.title if value_json.${key} else 'None' }}`,
    json_attributes_template: `{{ (value_json.${key} or {}) | tojson }}`,
  }) satisfies SensorConfig;

export const SENSORS: Record<string, SensorConfig> = {
  status: {
    name: "Status",
    icon: "mdi:theater",
    device_class: "enum",
    options: ["open", "closed"],
    value_template: "{{ value_json.status }}",
    json_attributes_template:
      "{{ {'notice': value_json.notice, 'movies': value_json.movies} | tojson }}",
  },
  feature_1: featureSensor("feature_1", "Feature 1"),
  feature_2: featureSensor("feature_2", "Feature 2"),
  dates: {
    name: "Show dates",
    icon: "mdi:calendar",
    value_template: "{{ value_json.dates or 'None' }}",
  },
  start_time: {
    name: "Start time",
    icon: "mdi:clock-outline",
    value_template: "{{ value_json.start_time or 'None' }}",
  },
  last_refreshed: {
    name: "Last refreshed",
    device_class: "timestamp",
    entity_category: "diagnostic",
    value_template: "{{ value_json.refreshed_at }}",
  },
};

export function buildDiscoveryConfigs(version: string) {
  const device = {
    identifiers: [DEVICE_ID],
    name: "Fairlee Drive-In",
    manufacturer: "Fairlee Drive-In Theater",
    model: "Now Showing",
    sw_version: version,
    configuration_url: NOW_SHOWING_URL,
  };
  const origin = {
    name: "fairlee-drive-in-mqtt-addon",
    sw_version: version,
    support_url: "https://github.com/bolencki13/fairlee-drive-in-mqtt-addon",
  };

  return Object.entries(SENSORS).map(([key, sensor]) => ({
    topic: topics.discovery(key),
    config: {
      ...sensor,
      unique_id: `${DEVICE_ID}_${key}`,
      state_topic: topics.state,
      ...(sensor.json_attributes_template
        ? { json_attributes_topic: topics.state }
        : {}),
      availability_topic: topics.availability,
      device,
      origin,
    },
  }));
}
