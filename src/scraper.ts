import { NOW_SHOWING_URL } from "./homeassistant.js";

export async function fetchNowShowingHtml(
  url: string = NOW_SHOWING_URL,
  timeoutMs = 30_000,
): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": "fairlee-drive-in-mqtt-addon" },
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  return response.text();
}
