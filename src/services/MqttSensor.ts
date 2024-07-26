import { EventEmitter } from "node:events";
import { type MqttClient } from "./MqttClient.js";
import { makeMqttClient } from "../providers/mqtt.js";
import container from "../container.js";
import type { ISubscriptionGrant } from "mqtt";

export abstract class MqttSensor extends EventEmitter {
  static getTopicBase(unique_id: string) {
    return `homeassistant/sensor/${unique_id}`;
  }

  protected mqtt: MqttClient = makeMqttClient(container);

  constructor(
    readonly id: string,
    readonly name: string,
  ) {
    super();

    this.mqtt.connection.subscribe(
      [MqttSensor.getTopicBase(this.id), "state"].join("/"),
      this.handleState,
    );
    this.mqtt.connection.subscribe(
      [MqttSensor.getTopicBase(this.id), "available"].join("/"),
      this.handleState,
    );

    this.mqtt.connection.publish(
      [MqttSensor.getTopicBase(this.id), "config"].join("/"),
      JSON.stringify(this.getConfig()),
    );
  }

  getConfig() {
    return {
      name: this.name,
      state_topic: [MqttSensor.getTopicBase(this.id), "state"].join("/"),
      json_attributes_topic: [
        MqttSensor.getTopicBase(this.id),
        "attributes",
      ].join("/"),
      availability_topic: [MqttSensor.getTopicBase(this.id), "available"].join(
        "/",
      ),
      unique_id: this.id,
      optimistic: false,
      qos: 0,
      retain: true,
    };
  }

  /**
   * Handlers
   */
  handleState = (
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
  handleAvailable = (
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
