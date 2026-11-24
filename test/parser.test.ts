import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeEntities, ParseError, parseNowShowing } from "../src/parser.js";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8");

describe("parseNowShowing", () => {
  it("parses an in-season page with the dates on one line (Jun 2024)", () => {
    expect(
      parseNowShowing(fixture("showing-2024-06-single-line-date")),
    ).toEqual({
      open: true,
      notice: null,
      dates: "Friday, Saturday & Sunday - June 14, 15, 16",
      start_time: "8:40 / Dusk",
      movies: [
        {
          title: "Inside Out 2",
          rating: "PG",
          imdb_url: "https://www.imdb.com/title/tt22022452/",
          poster_url: "https://lakehosting.com/capz2024/inside.jpg",
        },
        {
          title: "Kingdom of the Planet of the Apes",
          rating: "PG13",
          imdb_url: "https://www.imdb.com/title/tt11389872/",
          poster_url: "https://lakehosting.com/capz2024/kingdom.jpg",
        },
      ],
    });
  });

  it("parses an in-season page with the dates split over two lines (Aug 2024)", () => {
    expect(parseNowShowing(fixture("showing-2024-08-multi-line-date"))).toEqual(
      {
        open: true,
        notice: null,
        dates: "Friday, Saturday & Sunday - August 2, 3, 4",
        start_time: "8:30 / Dusk",
        movies: [
          {
            title: "Deadpool & Wolverine",
            rating: "R",
            imdb_url: "https://www.imdb.com/title/tt6263850/",
            poster_url: "https://lakehosting.com/capz2024/deadpool.jpg",
          },
          {
            // The page is missing the closing quote for this title
            title: "Bad Boys: Ride or Die",
            rating: "R",
            imdb_url: "https://www.imdb.com/title/tt4919268/",
            poster_url: "https://lakehosting.com/capz2024/bad.jpg",
          },
        ],
      },
    );
  });

  it("reports closed with the notice when off-season placeholders are shown (Nov 2024)", () => {
    expect(parseNowShowing(fixture("closed-2024-11-off-season"))).toEqual({
      open: false,
      notice: "Closed For The Season. See Everyone Spring 2025. Thank you!",
      dates: null,
      start_time: null,
      movies: [],
    });
  });

  it("does not treat a quoted notice in the datebox as a movie (2025 season)", () => {
    const result = parseNowShowing(fixture("closed-2025-notice"));

    expect(result).toEqual({
      open: false,
      notice:
        "Our Drive-In Theater will be closed for 2025 Season due to a family member in need of our attention. The motel will remain open during this time.",
      dates: null,
      start_time: null,
      movies: [],
    });
    expect(result.notice).not.toMatch(/[<>]/);
  });

  it("returns only real features when one box is a placeholder", () => {
    const html = fixture("showing-2024-06-single-line-date").replace(
      "&#8220;Kingdom of the Planet of the Apes&#8221;",
      "&#8220;Title&#8221;",
    );

    const result = parseNowShowing(html);
    expect(result.open).toBe(true);
    expect(result.movies.map((m) => m.title)).toEqual(["Inside Out 2"]);
  });

  it("handles more than two features", () => {
    const html = fixture("showing-2024-06-single-line-date");
    const box = /<div class="box">[\s\S]*?<\/div>/.exec(html)![0];
    const result = parseNowShowing(
      html.replace(box, box + box.replace("Inside Out 2", "Twisters")),
    );

    expect(result.movies.map((m) => m.title)).toEqual([
      "Inside Out 2",
      "Twisters",
      "Kingdom of the Planet of the Apes",
    ]);
  });

  it("throws a ParseError when the page layout is unrecognised", () => {
    expect(() =>
      parseNowShowing("<html><body>Maintenance</body></html>"),
    ).toThrow(ParseError);
  });
});

describe("decodeEntities", () => {
  it("decodes numeric, hex and named entities", () => {
    expect(
      decodeEntities("&#8220;A &#038; B&#8221; &amp; &#x2019;s&nbsp;"),
    ).toBe("“A & B” & ’s ");
  });

  it("leaves unknown entities untouched", () => {
    expect(decodeEntities("&bogus;")).toBe("&bogus;");
  });
});
