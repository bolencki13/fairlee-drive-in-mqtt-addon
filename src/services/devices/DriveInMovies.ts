import { MqttSensor } from "../MqttSensor.js";

export class DriveInMovies extends MqttSensor {
  protected refreshedAt: Date | null = null;
  protected html: string | null = null;

  constructor() {
    super("fairlee_drive_in", "Fairlee drive-in");
  }

  publishState() {
    if (!this.refreshedAt) {
      throw new Error("No data found. Call fetch first.");
    }
    this.mqtt.connection.publish(
      [DriveInMovies.getTopicBase(this.id), "state"].join("/"),
      this.refreshedAt.getTime().toString(),
    );
  }

  publishAttributes() {
    this.mqtt.connection.publish(
      [DriveInMovies.getTopicBase(this.id), "attributes"].join("/"),
      JSON.stringify({
        refreshedAt: this.refreshedAt?.toISOString() ?? null,
        showingAt: this.getMovieDatetime(),
        movies: this.getMovies(),
      }),
    );
  }

  publishAvailabililty() {
    this.mqtt.connection.publish(
      [DriveInMovies.getTopicBase(this.id), "available"].join("/"),
      "online",
    );
  }

  async fetch() {
    try {
      const response = await fetch("https://fairleedrivein.com/now-showing/");
      if (!response.ok) {
        throw new Error(`Request failed with status [${response.status}]`);
      }
      this.refreshedAt = new Date();

      this.html = await response.text();
    } catch (ex) {
      console.error(ex);
    }

    return this;
  }

  getMovieDatetime() {
    if (!this.html) {
      throw new Error("No data found. Call fetch first.");
    }

    const targetHtml = this.html
      .split('id="datebox">')?.[1]
      ?.split("</span>")?.[0];
    if (!targetHtml) {
      return { dates: null, time: null };
    }

    const startIndex = targetHtml.indexOf("Showing:");
    if (startIndex < 0) {
      return { dates: null, time: null };
    }

    const dateTimeParts = targetHtml.substring(startIndex)?.split("<br />");

    return {
      dates:
        `${dateTimeParts[1].substring(0, dateTimeParts[1].length - 1)} - ${dateTimeParts[2].substring(0, dateTimeParts[2].length - 1)}`.replaceAll(
          "#038;",
          "",
        ),
      time: dateTimeParts.at(-1)?.split('">')?.[1] ?? "",
    };
  }

  getMovies() {
    if (!this.html) {
      throw new Error("No data found. Call fetch first.");
    }

    const targetHtml = this.html.split("&#8220;");
    if (!targetHtml) {
      return [];
    }

    const movie1Html = targetHtml?.[1]?.split("</div>")[0];
    const movie2Html = targetHtml?.[2]?.split("</div>")[0];

    function getFormattedMovieName(movieHtml: string) {
      return movieHtml
        ?.split("&#8221;")?.[0]
        ?.split("</span>")?.[0]
        .replaceAll("#038;", "");
    }
    function getFormattedImdbLink(movieHtml: string) {
      return movieHtml.split('href="')?.[1]?.split('"')[0];
    }

    return [
      {
        title: getFormattedMovieName(movie1Html),
        imdb_link: getFormattedImdbLink(movie1Html),
      },
      {
        title: getFormattedMovieName(movie2Html),
        imdb_link: getFormattedImdbLink(movie2Html),
      },
    ];
  }
}
