import type {
  ContainerInterface,
  Provider,
} from "@halliganjs/service-container";
import fs from "node:fs";
import path from "node:path";

export type AppConfig = {
  mqtt: {
    host: string;
    port: number;
    username: string;
    password: string;
  };
};

export const provider: Provider = (container) => {
  let configEnv = {
    host: process.env.MQTT_HOST ?? "",
    username: process.env.MQTT_USERNAME ?? "",
    password: process.env.MQTT_PASSWORD ?? "",
  };
  try {
    const files = fs.readdirSync(path.resolve("."));
    console.log({ files });
    const strConfig = fs.readFileSync(path.resolve("/options.json"), {
      encoding: "utf8",
    });
    console.log({ strConfig });
    configEnv = JSON.parse(strConfig);
  } catch (ex) {
    console.error(ex);
  }

  console.log({ configEnv });

  container.instance("config", {
    mqtt: {
      host: configEnv.host,
      port: 1883,
      username: configEnv.username,
      password: configEnv.password,
    },
  } satisfies AppConfig);
};

export const makeConfig = (container: ContainerInterface) =>
  container.make<AppConfig>("config");
