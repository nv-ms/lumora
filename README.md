# Lumora

![Lumora Logo](./src/assets/logo.png)

Lumora is a local media web app with a local API server for browsing, organizing, and streaming your media library.

## What it does
- Serves a React frontend (`Vite`) and an Express API.
- Uses the Lumora app shell with PWA manifest + service worker registration.
- Supports movie and series library management (create, update, delete).
- Streams media with HTTP range support (`206 Partial Content`).
- Saves per-item playback progress.
- Supports subtitle discovery/serving (`.srt` converted to `.vtt` on the fly).
- Supports thumbnail retrieval and custom thumbnail upload.
- Provides local filesystem browsing APIs for picker-style UI flows.
- Supports media uploads into `data/uploads/*`.
- Includes DPAD/remote-friendly keyboard navigation for TV-style usage.

## Stack
- Frontend: React 19, React Router, Tailwind, Vite
- Backend: Express (Node.js)
- Storage: JSON file DB (`data/catalog-db.json`)

## Requirements
- Node.js 18+
- npm

## Install dependencies
```bash
npm install
```

## Run in development
Use two terminals.

Terminal 1 (API):
```bash
npm run server
```
Runs at `http://localhost:8787` by default.

Terminal 2 (frontend):
```bash
npm run dev
```
Runs at `http://localhost:5173`.

## Build frontend
```bash
npm run build
```

## Serve built frontend from backend
When `dist/index.html` exists, `server/app.js` serves:
- static files from `dist/`
- SPA fallback for non-`/api` routes

## Windows service commands
From the repository root:
- `npm run server` to run backend normally
- `node server/windows-service/install.service.js` to install service
- `node server/windows-service/uninstall.service.js` to uninstall service

## API overview
Base URL: `http://localhost:8787/api`

### Health and catalog
- `GET /health`
- `GET /catalog`

### Sources and playback
- `GET /sources`
- `POST /sources/add` body: `{ "path": "C:/path/to/media" }`
- `POST /sources/delete` body: `{ "path": "C:/path/to/media" }`
- `GET /playback/:id`
- `POST /playback/:id` body: `{ "progress": 0.45, "currentTime": 123, "duration": 2700 }`

### Library management
- `POST /library/movie`
- `POST /library/movie/:movieId/update`
- `POST /library/movie/:movieId/delete`
- `POST /library/series`
- `POST /library/series/:seriesId/update`
- `POST /library/series/:seriesId/delete`
- `POST /library/series/:seriesId/season`
- `POST /library/series/:seriesId/season/:seasonNumber/episode`

### Media and filesystem
- `GET /media/:id`
- `GET /files?mode=video|subtitle|image|all`
- `POST /upload?category=media|subtitle|image|trailer` (multipart)
- `GET /folders` (currently returns an empty list)
- `GET /fs/roots`
- `GET /fs/list?path=C:/...&mode=all|video|subtitle|image|trailer`

### Assets
- `GET /thumbnail/:id`
- `POST /thumbnail/:id` body: `{ "dataUrl": "data:image/png;base64,..." }`
- `GET /subtitles/:mediaId`
- `GET /subtitles/:mediaId/:trackId`

## Frontend routes
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

## Storage and generated files
- DB/state: `data/catalog-db.json`
- Uploaded assets: `data/uploads/`
- Thumbnails: `data/thumbnails/` and `data/thumbnails/auto/`

## Notes
- Episode auto-detection works best with filenames containing patterns like `S01E01`.
- CORS is enabled as `*` in backend for local/dev usage.

## Future additions
- TV app polish
  - Bigger focus states and stronger DPAD-first layouts across all pages.
  - Optional "lean-back" mode with simplified navigation and fewer clicks.
- Metadata enrichment
  - Optional fetchers for movie/series summaries, year, genres, and cast.
  - Manual metadata override UI for locally curated libraries.
- Better subtitle workflows
  - Subtitle search/import from configured providers.
  - Per-profile subtitle defaults (language, styling, offset).
- Library indexing improvements
  - Background/incremental indexing instead of full rebuild on every catalog request.
  - File-watch based refresh for faster update detection.
- Playback experience
  - Intro/outro skip markers and quick replay actions.
  - "Continue watching" tuning with smarter resume thresholds.
- Multi-user support
  - Local profiles with separate history, progress, and preferences.
  - Optional profile PIN lock.
- Admin and diagnostics
  - Basic admin dashboard for source health, scan logs, and failed file entries.
  - Export/import backup for `data/catalog-db.json` and related settings.
