import { startApp } from "./app.js";
import container from "./container.js";
import { makeConfig } from "./providers/config.js";
import { makeMqttClient } from "./providers/mqtt.js";
import { fetchNowShowingHtml } from "./scraper.js";

const config = makeConfig(container);
const client = makeMqttClient(container);

console.log(
  `Fairlee drive-in v${config.version} connecting to mqtt://${config.mqtt.host}:${config.mqtt.port}`,
);

client.on("error", (error) => console.error("MQTT error:", error.message));
client.on("reconnect", () => console.log("Reconnecting to MQTT broker..."));

const app = startApp({
  client,
  fetchHtml: () => fetchNowShowingHtml(),
  refreshIntervalMs: config.refreshIntervalMs,
  version: config.version,
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, async () => {
    console.log(`Received ${signal}, shutting down`);
    await app.stop();
    process.exit(0);
  });
}
