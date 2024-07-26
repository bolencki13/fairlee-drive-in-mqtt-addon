import type {
  ContainerInterface,
  Provider,
} from "@halliganjs/service-container";
import { MqttClient } from "../services/MqttClient.js";

export const provider: Provider = (container) => {
  container.singleton("mqtt", () => new MqttClient());
};

export const makeMqttClient = (container: ContainerInterface) =>
  container.make<MqttClient>("mqtt");
