const hues = [212, 18, 142, 268, 38, 4, 190, 320, 80, 250, 350, 110];

function poster(seed) {
  return `${hues[seed % hues.length]}`;
}

export const movies = [
  {
    id: "m1",
    kind: "movie",
    title: "Quiet Frontier",
    year: 2024,
    runtime: 124,
    genres: ["Drama", "Sci-Fi"],
    rating: "PG-13",
    poster: poster(0),
    backdrop: poster(0),
    overview:
      "A cartographer mapping a forgotten coastline begins to receive transmissions that should not exist.",
    path: "D:/Media/Movies/Quiet.Frontier.2024.mkv",
    progress: 0.62,
    lastWatchedAt: "2026-05-15T20:14:00Z",
  },
  {
    id: "m2",
    kind: "movie",
    title: "Glass Divide",
    year: 2023,
    runtime: 108,
    genres: ["Thriller"],
    rating: "R",
    poster: poster(1),
    backdrop: poster(1),
    overview: "Two estranged siblings inherit a house with one rule: never open the east wing.",
    path: "D:/Media/Movies/Glass.Divide.2023.mkv",
  },
  {
    id: "m3",
    kind: "movie",
    title: "Void Runner",
    year: 2023,
    runtime: 142,
    genres: ["Sci-Fi", "Action"],
    rating: "PG-13",
    poster: poster(2),
    backdrop: poster(2),
    overview: "A salvage pilot takes a contract that asks her to forget what she finds.",
    path: "D:/Media/Movies/Void.Runner.2023.mkv",
    progress: 0.18,
    lastWatchedAt: "2026-05-12T22:01:00Z",
  },
  {
    id: "m4",
    kind: "movie",
    title: "Wilder Shores",
    year: 2024,
    runtime: 98,
    genres: ["Documentary"],
    rating: "G",
    poster: poster(3),
    backdrop: poster(3),
    overview: "A year on a coastline most people don't know exists.",
    path: "D:/Media/Movies/Wilder.Shores.2024.mkv",
  },
  {
    id: "m5",
    kind: "movie",
    title: "Signal Lost",
    year: 2022,
    runtime: 110,
    genres: ["Mystery"],
    rating: "PG-13",
    poster: poster(4),
    backdrop: poster(4),
    overview: "A radio operator at a remote station picks up a voice from the next valley over.",
    path: "D:/Media/Movies/Signal.Lost.2022.mkv",
  },
  {
    id: "m6",
    kind: "movie",
    title: "Northern Hours",
    year: 2021,
    runtime: 131,
    genres: ["Drama"],
    rating: "R",
    poster: poster(5),
    backdrop: poster(5),
    overview: "A chef returns to a town she swore she'd never visit again.",
    path: "D:/Media/Movies/Northern.Hours.2021.mkv",
  },
  {
    id: "m7",
    kind: "movie",
    title: "Paper Cities",
    year: 2024,
    runtime: 119,
    genres: ["Drama", "Romance"],
    rating: "PG",
    poster: poster(6),
    backdrop: poster(6),
    overview: "An architect and a tour guide map a city that keeps rearranging itself.",
    path: "D:/Media/Movies/Paper.Cities.2024.mkv",
  },
  {
    id: "m8",
    kind: "movie",
    title: "Slow Tide",
    year: 2020,
    runtime: 95,
    genres: ["Indie"],
    rating: "R",
    poster: poster(7),
    backdrop: poster(7),
    overview: "Three friends spend a summer doing nothing in particular.",
    path: "D:/Media/Movies/Slow.Tide.2020.mkv",
  },
];

function makeSeason(season, count, watchedThrough = 0, currentProgress = 0) {
  const titles = [
    "Departure", "Echoes", "The Long Night", "Static", "Foreign Coast",
    "Inheritance", "Glass", "Crossing", "The Quiet Morning", "Threshold",
  ];
  return {
    number: season,
    episodes: Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      return {
        id: `s${season}e${n}`,
        number: n,
        title: titles[i % titles.length],
        runtime: 42 + (i % 4) * 3,
        overview: "Episode synopsis goes here. Real metadata loads from your library scan.",
        watched: n <= watchedThrough,
        progress: n === watchedThrough + 1 ? currentProgress : undefined,
      };
    }),
  };
}

export const series = [
  {
    id: "s1",
    kind: "series",
    title: "Chronicle of Echoes",
    year: 2022,
    genres: ["Drama", "Mystery"],
    rating: "TV-MA",
    poster: poster(8),
    backdrop: poster(8),
    overview:
      "A small town keeps replaying the same week. A librarian decides to write down what changes.",
    path: "E:/Vault/Shows/Chronicle_of_Echoes",
    seasons: [makeSeason(1, 8, 8), makeSeason(2, 8, 3, 0.35)],
    currentSeason: 2,
    currentEpisode: 4,
    progress: 0.35,
    lastWatchedAt: "2026-05-16T21:45:00Z",
  },
  {
    id: "s2",
    kind: "series",
    title: "Northbound",
    year: 2024,
    genres: ["Thriller"],
    rating: "TV-MA",
    poster: poster(9),
    backdrop: poster(9),
    overview: "A train. A passenger list that doesn't match the manifest.",
    path: "E:/Vault/Shows/Northbound",
    seasons: [makeSeason(1, 6, 2, 0.7)],
    currentSeason: 1,
    currentEpisode: 3,
    progress: 0.7,
    lastWatchedAt: "2026-05-14T19:12:00Z",
  },
  {
    id: "s3",
    kind: "series",
    title: "Halcyon Days",
    year: 2021,
    genres: ["Comedy"],
    rating: "TV-14",
    poster: poster(10),
    backdrop: poster(10),
    overview: "Four roommates, one unreasonably good kitchen.",
    path: "E:/Vault/Shows/Halcyon_Days",
    seasons: [makeSeason(1, 10, 10), makeSeason(2, 10, 10), makeSeason(3, 10, 6, 0.1)],
    currentSeason: 3,
    currentEpisode: 7,
    progress: 0.1,
    lastWatchedAt: "2026-05-10T18:00:00Z",
  },
  {
    id: "s4",
    kind: "series",
    title: "The Atlas Office",
    year: 2023,
    genres: ["Drama"],
    rating: "TV-MA",
    poster: poster(11),
    backdrop: poster(11),
    overview: "Three cartographers, two unsolved maps, one missing colleague.",
    path: "E:/Vault/Shows/The_Atlas_Office",
    seasons: [makeSeason(1, 8, 0)],
  },
  {
    id: "s5",
    kind: "series",
    title: "Coastline",
    year: 2020,
    genres: ["Documentary"],
    rating: "TV-G",
    poster: poster(0),
    backdrop: poster(0),
    overview: "A walking series. One coast, one season, one foot in front of the other.",
    path: "E:/Vault/Shows/Coastline",
    seasons: [makeSeason(1, 6, 6), makeSeason(2, 6, 6)],
  },
];

export const library = [...movies, ...series];

export function continueWatching() {
  return library
    .filter((i) => i.lastWatchedAt && (i.progress ?? 0) > 0 && (i.progress ?? 0) < 1)
    .sort((a, b) => (b.lastWatchedAt < a.lastWatchedAt ? -1 : 1));
}

export function recentlyAdded(kind) {
  return library
    .filter((i) => !kind || i.kind === kind)
    .slice()
    .reverse();
}

export function history() {
  return library
    .filter((i) => i.lastWatchedAt)
    .sort((a, b) => (b.lastWatchedAt < a.lastWatchedAt ? -1 : 1));
}

export function getItem(id) {
  return library.find((i) => i.id === id);
}

export const sampleSubtitles = [
  { index: 1, start: 12, end: 15, text: "I told you not to come here at night." },
  { index: 2, start: 15.5, end: 18, text: "The warning was clear enough." },
  { index: 3, start: 19, end: 22, text: "We have to leave before dawn." },
  { index: 4, start: 24, end: 27, text: "The road south is washed out." },
  { index: 5, start: 28, end: 32, text: "Then we take the long way around." },
  { index: 6, start: 33, end: 36, text: "There is no long way around." },
];
