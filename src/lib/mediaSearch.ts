// Server-side title search for the Entertainment list: matches with a poster, type,
// year and, where a source knows it, the platform. Each source is free:
//   TV       TVMaze (no key): poster, and the service that made the show
//   Movies   TMDB when TMDB_API_KEY is set: poster and where it streams in the US now.
//            Without a key, Wikipedia: title and year only (its posters aren't free to use).
//   Books    Open Library (no key): cover and author
//   Podcasts iTunes (no key): artwork and publisher
// A source that fails or times out is skipped, so the others still show.

import { ALL_PLATFORMS } from "@/config/entertainment";
import type { MediaKind } from "@/config/entertainment";

export type MediaMatch = {
  id: string; // source and its id, for React keys
  title: string;
  kind: MediaKind;
  year: number | null;
  byline: string | null; // author, publisher or network
  platform: string | null; // one of ALL_PLATFORMS, or null when unknown
  image_url: string | null;
};

const TIMEOUT_MS = 5000;
// Wikipedia asks API clients to say who they are.
const HEADERS = { "User-Agent": "Friday/0.1 (personal home organizer)" };

const getJson = async (url: string, init: RequestInit = {}) => {
  const res = await fetch(url, {
    ...init,
    headers: { ...HEADERS, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).hostname}`);
  return res.json();
};

const yearOf = (date: unknown) => {
  const year = typeof date === "string" ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(year) && year > 1800 ? year : null;
};

const https = (url: unknown) => (typeof url === "string" ? url.replace(/^http:\/\//, "https://") : null);

// Maps a source's name for a service ("Apple TV", "HBO", "Amazon Prime Video") onto
// the list's platforms. Anything else, like a cable network, counts as unknown.
export const toPlatform = (name: unknown): string | null => {
  if (typeof name !== "string") return null;
  const n = name.toLowerCase();
  const match =
    n.includes("netflix") ? "Netflix"
    : n.includes("apple tv") ? "Apple TV+"
    : n.includes("hbo") || n === "max" ? "HBO Max"
    : n.includes("hulu") ? "Hulu"
    : n.includes("prime video") || n.startsWith("amazon") ? "Prime Video"
    : n.includes("disney") ? "Disney+"
    : n.includes("peacock") ? "Peacock"
    : n.includes("paramount") ? "Paramount+"
    : n.includes("youtube") ? "YouTube"
    : null;
  return match && ALL_PLATFORMS.includes(match) ? match : null;
};

type TvMazeShow = {
  id: number;
  name: string;
  premiered: string | null;
  network: { name: string } | null;
  webChannel: { name: string } | null;
  image: { medium: string } | null;
};

const searchTv = async (query: string, limit: number): Promise<MediaMatch[]> => {
  const results: { show: TvMazeShow }[] = await getJson(
    `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`
  );
  return results.slice(0, limit).map(({ show }) => {
    const channel = show.webChannel?.name ?? show.network?.name ?? null;
    return {
      id: `tvmaze-${show.id}`,
      title: show.name,
      kind: "tv",
      year: yearOf(show.premiered),
      byline: channel,
      platform: toPlatform(channel),
      image_url: https(show.image?.medium),
    };
  });
};

// TMDB takes either a v3 API key or a v4 read access token (the long one starting "eyJ").
const tmdb = (path: string, key: string) => {
  const bearer = key.startsWith("eyJ");
  const url = `https://api.themoviedb.org/3${path}${bearer ? "" : `${path.includes("?") ? "&" : "?"}api_key=${key}`}`;
  return getJson(url, bearer ? { headers: { Authorization: `Bearer ${key}` } } : {});
};

const searchMoviesTmdb = async (query: string, limit: number, key: string): Promise<MediaMatch[]> => {
  const data = await tmdb(`/search/movie?query=${encodeURIComponent(query)}&include_adult=false&region=US`, key);
  const movies: { id: number; title: string; release_date?: string; poster_path?: string | null }[] =
    (data.results ?? []).slice(0, limit);
  return Promise.all(
    movies.map(async (m) => {
      // Streaming first; a service you'd have to rent from doesn't count.
      let platform: string | null = null;
      try {
        const providers = await tmdb(`/movie/${m.id}/watch/providers`, key);
        const flatrate: { provider_name: string }[] = providers.results?.US?.flatrate ?? [];
        platform = flatrate.map((p) => toPlatform(p.provider_name)).find(Boolean) ?? null;
        if (!platform && (providers.results?.US?.rent || providers.results?.US?.buy)) platform = "Rent or buy";
      } catch {
        // Keep the match without a platform.
      }
      return {
        id: `tmdb-${m.id}`,
        title: m.title,
        kind: "movie" as const,
        year: yearOf(m.release_date),
        byline: null,
        platform,
        image_url: m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : null,
      };
    })
  );
};

// No poster, but enough to pick the right film: "2023 film by Christopher Nolan".
const searchMoviesWikipedia = async (query: string, limit: number): Promise<MediaMatch[]> => {
  const data = await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=8&prop=description&gsrsearch=${encodeURIComponent(`${query} film`)}`
  );
  const pages: { pageid: number; title: string; index: number; description?: string }[] = Object.values(
    data.query?.pages ?? {}
  );
  // Film pages are described like "2023 film by Christopher Nolan" or "2004 American
  // animated film"; people and soundtracks aren't.
  return pages
    .filter((p) => /^(\d{4}|upcoming)\b[^,;]*\bfilm\b/i.test(p.description ?? ""))
    .sort((a, b) => a.index - b.index)
    .slice(0, limit)
    .map((p) => ({
      id: `wikipedia-${p.pageid}`,
      title: p.title.replace(/\s*\((\d{4} )?(American |British )?film\)$/i, ""),
      kind: "movie" as const,
      year: yearOf(p.description?.match(/\b(19|20)\d{2}\b/)?.[0]),
      byline: p.description?.replace(/^\d{4}\s+/, "") ?? null,
      platform: null,
      image_url: null,
    }));
};

const searchBooks = async (query: string, limit: number): Promise<MediaMatch[]> => {
  const data = await getJson(
    `https://openlibrary.org/search.json?limit=12&fields=key,title,author_name,first_publish_year,cover_i&q=${encodeURIComponent(query)}`
  );
  type Doc = { key: string; title: string; author_name?: string[]; first_publish_year?: number; cover_i?: number };
  // Drops study guides and summaries of the book, and puts ones with a cover first.
  const docs: Doc[] = (data.docs ?? [])
    .filter((d: Doc) => !/\b(summary|review|study guide|workbook|analysis)\b/i.test(d.title))
    .map((d: Doc, i: number) => ({ d, i }))
    .sort((a: { d: Doc; i: number }, b: { d: Doc; i: number }) => Number(!a.d.cover_i) - Number(!b.d.cover_i) || a.i - b.i)
    .map(({ d }: { d: Doc }) => d)
    .slice(0, limit);
  return docs.map(
    (d: { key: string; title: string; author_name?: string[]; first_publish_year?: number; cover_i?: number }) => ({
      id: `openlibrary-${d.key}`,
      title: d.title,
      kind: "book" as const,
      year: d.first_publish_year ?? null,
      byline: d.author_name?.[0] ?? null,
      platform: null,
      image_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
    })
  );
};

const searchPodcasts = async (query: string, limit: number): Promise<MediaMatch[]> => {
  const data = await getJson(
    `https://itunes.apple.com/search?media=podcast&country=US&limit=${limit}&term=${encodeURIComponent(query)}`
  );
  return (data.results ?? []).map(
    (r: { collectionId: number; collectionName: string; artistName?: string; releaseDate?: string; artworkUrl600?: string; artworkUrl100?: string }) => ({
      id: `itunes-${r.collectionId}`,
      title: r.collectionName,
      kind: "podcast" as const,
      year: null,
      byline: r.artistName ?? null,
      platform: null,
      image_url: https(r.artworkUrl600 ?? r.artworkUrl100),
    })
  );
};

const searchMovies = (query: string, limit: number) => {
  const key = process.env.TMDB_API_KEY?.trim();
  return key ? searchMoviesTmdb(query, limit, key) : searchMoviesWikipedia(query, limit);
};

const SOURCES: Record<MediaKind, (query: string, limit: number) => Promise<MediaMatch[]>> = {
  tv: searchTv,
  movie: searchMovies,
  book: searchBooks,
  podcast: searchPodcasts,
};

// Recent searches, so typing back and forth doesn't ask the sources again.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; matches: MediaMatch[] }>();

// With no type picked, looks for TV shows and movies, the usual case.
export const searchMedia = async (query: string, kind: MediaKind | null): Promise<MediaMatch[]> => {
  const cacheKey = `${kind ?? "any"}|${query.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.matches;

  const searches = kind ? [SOURCES[kind](query, 4)] : [searchTv(query, 2), searchMovies(query, 2)];
  const settled = await Promise.allSettled(searches);
  const lists = settled.map((s) => (s.status === "fulfilled" ? s.value : []));
  // Alternate between sources so the best of each comes first.
  const matches: MediaMatch[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) {
    for (const list of lists) if (list[i]) matches.push(list[i]);
  }

  if (settled.some((s) => s.status === "fulfilled")) {
    if (cache.size > 200) cache.clear();
    cache.set(cacheKey, { at: Date.now(), matches });
  }
  return matches;
};
