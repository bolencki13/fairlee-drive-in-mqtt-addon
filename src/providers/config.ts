import { readFileSync } from "node:fs";
import type {
  ContainerInterface,
  Provider,
} from "@halliganjs/service-container";
import type { MqttConfig } from "../mqtt.js";

export type AppConfig = {
  version: string;
  refreshIntervalMs: number;
  mqtt: MqttConfig;
};

const ONE_HOUR = 60 * 60 * 1000;

function readVersion() {
  try {
    const pkg = readFileSync(new URL("../../package.json", import.meta.url));
    return (JSON.parse(pkg.toString()) as { version: string }).version;
  } catch {
    return "unknown";
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number.parseInt(env.MQTT_PORT ?? "", 10);

  return {
    version: readVersion(),
    refreshIntervalMs: ONE_HOUR,
    mqtt: {
      host: env.MQTT_HOST || "core-mosquitto",
      port: Number.isFinite(port) ? port : 1883,
      username: env.MQTT_USERNAME ?? "",
      password: env.MQTT_PASSWORD ?? "",
    },
  };
}

export const provider: Provider = (container) => {
  container.instance("config", loadConfig());
};

export const makeConfig = (container: ContainerInterface) =>
  container.make<AppConfig>("config");
