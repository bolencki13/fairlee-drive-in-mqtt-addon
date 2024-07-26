import mqtt, { type ISubscriptionGrant } from "mqtt";
import { makeConfig } from "../providers/config.js";
import container from "../container.js";

export class MqttClient {
  static getConnectionURI() {
    const config = makeConfig(container);

    return `mqtt://${config.mqtt.host}:${config.mqtt.port}`;
  }
  static getConnectionOptions() {
    const config = makeConfig(container);

    return {
      clean: true,
      connectTimeout: 4000,
      // Authentication
      username: config.mqtt.username,
      password: config.mqtt.password,
    } satisfies mqtt.IClientOptions;
  }

  connection: mqtt.MqttClient;

  constructor() {
    this.connection = mqtt.connect(
      MqttClient.getConnectionURI(),
      MqttClient.getConnectionOptions(),
    );

    this.connection.on("connect", this.handleConnect);
    this.connection.on("error", this.handleError);
    this.connection.on("message", this.handleMessage);
  }

  /**
   * Event handling
   */
  handleConnect = () => {
    console.log("Connected");

    this.connection.subscribe("homeassistant/status", this.handleStatus);
  };
  handleError = (error: Error) => {
    console.error(error);
  };
  handleMessage = (topic: string, message: Buffer) => {
    console.log({
      topic,
      message: message.toString(),
    });
  };
  handleStatus = (
    error: Error | null,
    granted: ISubscriptionGrant[] | undefined,
  ) => {
    if (error) {
      console.log(`Failed to subscribe to topic [${granted?.[0].topic}]`);
      console.error(error);
      return;
    }

    console.log(`Subscribed to topic [${granted?.[0].topic}]`);
  };
}
