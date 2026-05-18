const movies = [
  { id: "m1", kind: "movie", title: "Quiet Frontier", year: 2024, runtime: 124, genres: ["Drama", "Sci-Fi"], rating: "PG-13", poster: "212", overview: "A cartographer mapping a forgotten coastline begins to receive transmissions that should not exist.", path: "D:/Media/Movies/Quiet.Frontier.2024.mkv", progress: 0.62, lastWatchedAt: "2026-05-15T20:14:00Z" },
  { id: "m2", kind: "movie", title: "Glass Divide", year: 2023, runtime: 108, genres: ["Thriller"], rating: "R", poster: "18", overview: "Two estranged siblings inherit a house with one rule: never open the east wing.", path: "D:/Media/Movies/Glass.Divide.2023.mkv" },
  { id: "m3", kind: "movie", title: "Void Runner", year: 2023, runtime: 142, genres: ["Sci-Fi", "Action"], rating: "PG-13", poster: "142", overview: "A salvage pilot takes a contract that asks her to forget what she finds.", path: "D:/Media/Movies/Void.Runner.2023.mkv", progress: 0.18, lastWatchedAt: "2026-05-12T22:01:00Z" }
];

const series = [
  { id: "s1", kind: "series", title: "Chronicle of Echoes", year: 2022, genres: ["Drama", "Mystery"], rating: "TV-MA", poster: "80", overview: "A small town keeps replaying the same week.", path: "E:/Vault/Shows/Chronicle_of_Echoes", seasons: [{ number: 1, episodes: [{ id: "s1e1", number: 1, title: "Departure", runtime: 44, overview: "Episode synopsis.", watched: true }, { id: "s1e2", number: 2, title: "Echoes", runtime: 45, overview: "Episode synopsis.", progress: 0.35 }] }], currentSeason: 1, currentEpisode: 2, progress: 0.35, lastWatchedAt: "2026-05-16T21:45:00Z" },
  { id: "s2", kind: "series", title: "Northbound", year: 2024, genres: ["Thriller"], rating: "TV-MA", poster: "250", overview: "A train. A passenger list that doesn't match the manifest.", path: "E:/Vault/Shows/Northbound", seasons: [{ number: 1, episodes: [{ id: "s2e1", number: 1, title: "Departure", runtime: 43, overview: "Episode synopsis.", watched: true }] }], currentSeason: 1, currentEpisode: 1, progress: 0.7, lastWatchedAt: "2026-05-14T19:12:00Z" }
];

const library = [...movies, ...series];

function history() {
  return library.filter((item) => item.lastWatchedAt).sort((a, b) => (b.lastWatchedAt < a.lastWatchedAt ? -1 : 1));
}

function continueWatching() {
  return library.filter((item) => item.lastWatchedAt && (item.progress ?? 0) > 0 && (item.progress ?? 0) < 1).sort((a, b) => (b.lastWatchedAt < a.lastWatchedAt ? -1 : 1));
}

function recentlyAdded(kind) {
  return library.filter((item) => !kind || item.kind === kind).slice().reverse();
}

function getItem(id) {
  return library.find((item) => item.id === id);
}

const sampleSubtitles = [
  { index: 1, start: 12, end: 15, text: "I told you not to come here at night." },
  { index: 2, start: 16, end: 19, text: "The warning was clear enough." },
  { index: 3, start: 20, end: 23, text: "We have to leave before dawn." }
];

export { movies, series, history, continueWatching, recentlyAdded, getItem, sampleSubtitles };