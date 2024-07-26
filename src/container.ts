import { Container } from "@halliganjs/service-container";
import { provider as configProvider } from "./providers/config.js";
import { provider as mqttClientProvider } from "./providers/mqtt.js";

const container = new Container();

container.provider(configProvider).provider(mqttClientProvider);

export default container;
