<p align="center">
  <img src="web/src/assets/logo.png" alt="Lumora" width="140">
</p>

# Lumora

Lumora is a self-hosted media library for the web, Android, and Android TV. It organizes local movies and series and provides playback across devices on the same network.

## Features

- Movie and series libraries
- Web, Android, and Android TV clients
- TV remote navigation
- Playback progress and continue watching
- Artwork and generated thumbnails
- Audio-track and subtitle selection
- External and embedded subtitles
- Direct play and HLS conversion for incompatible media
- Persistent rendition cache
- Read-only access to original media

## Setup

Requires Node.js 18 or newer.

```bash
npm install
npm run build
npm start
```

Lumora runs at `http://localhost:8787`. Other devices should use the server computer's LAN address with the same port.

## Android

The Android project supports phones and Android TV.

```powershell
cd apps/android
.\gradlew.bat :mobile:assembleDebug
```

Release build:

```powershell
.\gradlew.bat :mobile:assembleRelease
```

Install an APK with ADB:

```bash
adb install -r path/to/app.apk
```

Set the Lumora server address in the app to the server computer's LAN URL.

## Development

Run the server and web development environment separately:

```bash
npm run server
npm run dev
```

| Command | Description |
| --- | --- |
| `npm start` | Start the server and production web app |
| `npm run server` | Start the API server |
| `npm run dev` | Start the web development server |
| `npm run build` | Build the web app into `server/frontend/` |
| `npm run preview` | Preview the production web build |
| `npm run lint` | Lint the web app |
| `npm test` | Run server tests |

## Project structure

```text
apps/android/   Android and Android TV app
server/         API, media services, and built web app
web/            React web app
data/           User library, artwork, progress, and generated media
```

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8787` | Server port |
| `FFMPEG_PATH` | Bundled | FFmpeg executable override |
| `FFPROBE_PATH` | Bundled | FFprobe executable override |
| `MEDIA_CACHE_LIMIT_BYTES` | `53687091200` | Generated-media cache limit |

## Server API

Base URL: `http://localhost:8787/api`

Health and catalog:

- `GET /health`
- `GET /catalog`
- `GET /media-cache`
- `POST /media-cache/limit`
- `POST /media-cache/clear`

Sources and playback:

- `GET /sources`
- `POST /sources/add` with `{ "path": "C:/path/to/media" }`
- `POST /sources/delete` with `{ "path": "C:/path/to/media" }`
- `GET /playback/:id`
- `POST /playback/:id` with `{ "progress": 0.45, "currentTime": 123, "duration": 2700 }`
- `GET /media/:id/playback`
- `POST /media/:id/playback`
- `GET /media/:id/playback/:renditionId`
- `GET /media/:id/renditions/:renditionId/:fileName`

Library management:

- `POST /library/movie`
- `POST /library/movie/:movieId/update`
- `POST /library/movie/:movieId/delete`
- `POST /library/series`
- `POST /library/series/:seriesId/update`
- `POST /library/series/:seriesId/delete`
- `POST /library/series/:seriesId/season`
- `POST /library/series/:seriesId/season/:seasonNumber/episode`

Media and filesystem:

- `GET /media/:id`
- `GET /files?mode=video|subtitle|image|all`
- `POST /upload?category=media|subtitle|image|trailer`
- `GET /folders`
- `GET /fs/roots`
- `GET /fs/list?path=C:/...&mode=all|video|subtitle|image|trailer`

Assets:

- `GET /thumbnail/:id`
- `POST /thumbnail/:id` with `{ "dataUrl": "data:image/png;base64,..." }`
- `GET /subtitles/:mediaId`
- `GET /subtitles/:mediaId/:trackId`
- `GET /media/:id/embedded-subtitles/:streamIndex.vtt`

## Frontend Routes

- `/`
- `/movies`
- `/series`
- `/series/:id`
- `/catalog`
- `/catalog/:type/:id`
- `/search`
- `/history`
- `/settings`
- `/watch/:id`

## User data

All installation-specific data is stored under `data/`, including the catalog, playback progress, artwork, uploads, probe results, and generated renditions. Back up this directory to preserve the library.

Source media remains in its original location and is never modified by Lumora.

Episode auto-detection works best with filenames containing patterns such as `S01E01`.

## Future Additions

Metadata enrichment:

- Optional fetchers for movie and series summaries, years, genres, cast, ratings, and posters.
- Manual metadata override UI for locally curated libraries.
- Matching and correction tools for files with incomplete or inconsistent names.
- Bulk edit flows for repeated fixes across seasons or collections.

Better subtitle workflows:
- Subtitle search/import from configured providers.
- Per-profile subtitle defaults for language, styling, and offset.
- Better handling for unsupported embedded subtitle formats.
- Subtitle timing adjustment tools during playback.

Library indexing improvements:
- Background and incremental indexing instead of full rebuilds on every catalog request.
- File-watch based source refresh for faster update detection.
- Clearer scan status, failed-file reporting, and retry controls.
- Scheduled scans for sources that are not always mounted.

Playback experience:
- Intro/outro skip markers and quick replay actions.
- Continue watching tuning with smarter resume thresholds.
- Optional adaptive renditions for lower-bandwidth devices.
- Hardware-accelerated transcoding behind the existing playback policy.

Multi-user support:
- Local profiles with separate history, progress, and preferences.
- Optional profile PIN lock.
- Profile-specific subtitle, audio, and playback defaults.
- Per-profile continue watching, favorites, and hidden items.

Admin and diagnostics:
- Basic admin dashboard for source health, scan logs, and failed file entries.
- Export/import backup for `data/catalog-db.json` and related settings.
- Cache and transcoding diagnostics for troubleshooting playback issues.
- One-click cleanup for orphaned generated assets.