// Options for the Entertainment list (/entertainment): what kind of thing it is, where
// to find it, and what it feels like. Entertainment is its own list (WatchItem in
// src/api/client.ts), never a task.

export const MEDIA_KINDS = [
  { id: "movie", label: "Movie", plural: "Movies", doneLabel: "Watched" },
  { id: "tv", label: "TV show", plural: "TV shows", doneLabel: "Watched" },
  { id: "book", label: "Book", plural: "Books", doneLabel: "Read" },
  { id: "podcast", label: "Podcast", plural: "Podcasts", doneLabel: "Listened" },
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number]["id"];

export const isMediaKind = (value: unknown): value is MediaKind =>
  MEDIA_KINDS.some((k) => k.id === value);

export const mediaKind = (id: MediaKind | null | undefined) => MEDIA_KINDS.find((k) => k.id === id);

const SCREEN_PLATFORMS = [
  "Netflix",
  "HBO Max",
  "Apple TV+",
  "Prime Video",
  "Hulu",
  "Disney+",
  "Peacock",
  "Paramount+",
  "YouTube",
  "In theaters",
  "Rent or buy",
];

// Where each kind can be found, in the order they're offered. No platform means unknown.
export const PLATFORMS: Record<MediaKind, string[]> = {
  movie: SCREEN_PLATFORMS,
  tv: SCREEN_PLATFORMS.filter((p) => p !== "In theaters"),
  book: ["Kindle", "Audible", "Library", "Own it", "Buy it"],
  podcast: ["Spotify", "Apple Podcasts", "YouTube"],
};

export const ALL_PLATFORMS = [...new Set(Object.values(PLATFORMS).flat())];

export const platformsFor = (kind: MediaKind | null | undefined) => (kind ? PLATFORMS[kind] : ALL_PLATFORMS);

export const UNKNOWN_PLATFORM = "Unknown";

// What you're in the mood for. Kept short so it's quick to tag.
export const VIBES = [
  "Light",
  "Funny",
  "Feel-good",
  "Gripping",
  "Dark",
  "Thought-provoking",
  "True story",
  "Date night",
  "Family",
  "Background",
] as const;

export type Vibe = (typeof VIBES)[number];

export const isVibe = (value: unknown): value is Vibe => VIBES.includes(value as Vibe);

// Posters only come from the search sources (lib/mediaSearch.ts).
const IMAGE_HOSTS = [
  "static.tvmaze.com",
  "image.tmdb.org",
  "covers.openlibrary.org",
];

export const isPosterUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (IMAGE_HOSTS.includes(url.hostname) || url.hostname.endsWith(".mzstatic.com")) // iTunes artwork
    );
  } catch {
    return false;
  }
};
