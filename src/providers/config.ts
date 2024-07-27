import type {
  ContainerInterface,
  Provider,
} from "@halliganjs/service-container";

export type AppConfig = {
  mqtt: {
    host: string;
    port: number;
    username: string;
    password: string;
  };
};

export const provider: Provider = (container) => {
  container.instance("config", {
    mqtt: {
      host: process.env.MQTT_HOST ?? "",
      port: 1883,
      username: process.env.MQTT_USERNAME ?? "",
      password: process.env.MQTT_PASSWORD ?? "",
    },
  } satisfies AppConfig);
};

export const makeConfig = (container: ContainerInterface) =>
  container.make<AppConfig>("config");
