/**
 * Parses the Fairlee Drive-In "Now Showing" page (https://fairleedrivein.com/now-showing/).
 *
 * The page is a hand-edited WordPress page. The relevant markup lives in
 * `<div id="bannercontent">`:
 *
 *   <div id="datebox">  Either "Showing:<br />{days}<br />{dates}:" or a free-text notice
 *                       (e.g. "Closed For The Season"), followed by "1st Movie Starts: {time}"
 *   <div class="box">   One per feature: poster <img>, title in a 15pt <span>, "Rated: X",
 *                       and an IMDb link. Off-season the title is the placeholder "Title".
 */

export type Movie = {
  title: string;
  rating: string | null;
  imdb_url: string | null;
  poster_url: string | null;
};

export type NowShowing = {
  /** True when at least one real feature is listed. */
  open: boolean;
  /** Free-text announcement shown instead of show dates (e.g. closed for the season). */
  notice: string | null;
  /** e.g. "Friday, Saturday & Sunday - August 2, 3, 4" */
  dates: string | null;
  /** e.g. "8:30 / Dusk" */
  start_time: string | null;
  movies: Movie[];
};

export class ParseError extends Error {
  override name = "ParseError";
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, code: string) => {
      if (code[0] === "#") {
        const n =
          code[1].toLowerCase() === "x"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : match;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? match;
    },
  );
}

/** Converts an HTML fragment to plain-text lines (one per <br>, <p>, <hr> or <div>). */
function toLines(html: string): string[] {
  return decodeEntities(
    html
      .replace(/<(br|hr)\b[^>]*>/gi, "\n")
      .replace(/<\/?(p|div)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function stripQuotes(text: string): string {
  return text.replace(/^["“”]+|["“”]+$/g, "").trim();
}

/** Returns the inner HTML of the first element with the given id, matching nested divs. */
function innerHtmlById(html: string, id: string): string | null {
  const open = new RegExp(`<div\\b[^>]*\\bid=["']${id}["'][^>]*>`, "i").exec(
    html,
  );
  if (!open) return null;

  const start = open.index + open[0].length;
  const tags = /<(\/?)div\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 1;
  for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
    depth += tag[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, tag.index);
  }
  return html.slice(start);
}

const START_TIME_PATTERN = /^1st Movie Starts:\s*(.*)$/i;
const SHOWING_PATTERN = /^Showing:\s*(.*)$/i;

function parseDatebox(html: string) {
  const lines = toLines(html);

  let startTime: string | null = null;
  const rest: string[] = [];
  for (const line of lines) {
    const match = START_TIME_PATTERN.exec(line);
    if (match) startTime = match[1].trim() || null;
    else rest.push(line);
  }

  const showing = rest.length ? SHOWING_PATTERN.exec(rest[0]) : null;
  if (showing) {
    const dates = [showing[1], ...rest.slice(1)]
      .join(" ")
      .replace(/\s*-\s*/g, " - ")
      .replace(/[\s:]+$/, "")
      .replace(/^[\s-]+/, "")
      .trim();
    return { dates: dates || null, notice: null, startTime };
  }

  const notice = rest
    .map(stripQuotes)
    .filter(Boolean)
    .map((line) => (/[.!?]$/.test(line) ? line : `${line}.`))
    .join(" ");
  return { dates: null, notice: notice || null, startTime };
}

const PLACEHOLDER_TITLES = new Set(["title", "tba", "tbd"]);

function parseBox(html: string): Movie | null {
  const titleHtml =
    /<span\b[^>]*font-size:\s*15pt[^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1];
  const title = titleHtml ? stripQuotes(toLines(titleHtml).join(" ")) : "";
  if (!title || PLACEHOLDER_TITLES.has(title.toLowerCase())) return null;

  const rating =
    /Rated:\s*([^<\n]*)/i.exec(decodeEntities(html))?.[1].trim() || null;

  const imdbHref = /href=["']([^"']*imdb\.com[^"']*)["']/i.exec(html)?.[1];
  const imdbUrl =
    imdbHref && !/imdb\.com\/?$/i.test(imdbHref)
      ? decodeEntities(imdbHref)
      : null;

  const posterSrc = /<img\b[^>]*\bsrc=["']([^"']+)["']/i.exec(html)?.[1];
  const posterUrl =
    posterSrc && !/offseason/i.test(posterSrc)
      ? decodeEntities(posterSrc)
      : null;

  return {
    title,
    rating,
    imdb_url: imdbUrl,
    poster_url: posterUrl,
  };
}

export function parseNowShowing(html: string): NowShowing {
  const banner = innerHtmlById(html, "bannercontent");
  if (banner === null) {
    throw new ParseError(
      'Could not find <div id="bannercontent"> - the page layout may have changed',
    );
  }

  const datebox = innerHtmlById(banner, "datebox") ?? "";
  const { dates, notice, startTime } = parseDatebox(datebox);

  const movies = banner
    .split(/<div\b[^>]*\bclass=["'][^"']*\bbox\b[^"']*["'][^>]*>/i)
    .slice(1)
    .map(parseBox)
    .filter((movie): movie is Movie => movie !== null);

  const open = movies.length > 0;

  return {
    open,
    notice,
    dates,
    // "1st Movie Starts:" is left in place but empty when closed
    start_time: open ? startTime : null,
    movies,
  };
}
