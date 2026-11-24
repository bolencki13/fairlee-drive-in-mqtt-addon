import mqtt from "mqtt";
import { DEVICE_ID, topics } from "./homeassistant.js";

export type MqttConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
};

export function createMqttClient(config: MqttConfig) {
  return mqtt.connect({
    host: config.host,
    port: config.port,
    username: config.username || undefined,
    password: config.password || undefined,
    clientId: `${DEVICE_ID}_${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    connectTimeout: 10_000,
    reconnectPeriod: 5_000,
    // Broker marks the device unavailable if we drop off without saying goodbye
    will: {
      topic: topics.availability,
      payload: Buffer.from("offline"),
      retain: true,
      qos: 1,
    },
  });
}
