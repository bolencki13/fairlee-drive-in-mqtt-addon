import type {
  ContainerInterface,
  Provider,
} from "@halliganjs/service-container";
import type { MqttClient } from "mqtt";
import { createMqttClient } from "../mqtt.js";
import { makeConfig } from "./config.js";

export const provider: Provider = (container) => {
  container.singleton("mqtt", () =>
    createMqttClient(makeConfig(container).mqtt),
  );
};

export const makeMqttClient = (container: ContainerInterface) =>
  container.make<MqttClient>("mqtt");
