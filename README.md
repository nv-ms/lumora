# Stream Weaver

Local media web app + local media API server.

## What this does
- Scans local folders for video files (`.mp4`, `.mkv`, `.avi`, `.mov`, `.m4v`, `.webm`, `.wmv`, `.flv`)
- Auto-groups:
  - movies (single files)
  - series (folder-based, season/episode inferred from `SxxExx` when present)
- Streams media with HTTP byte-range support (`206 Partial Content`) to preserve original quality and extension/container
- Saves playback progress in a simple JSON DB

## Default media source
`C:/Users/kipto/Downloads/utorrent`

Configured in:
- `data/catalog-db.json`

## Requirements
- Node.js 18+
- npm

## Install
```bash
npm install
```

## Run
Open two terminals.

Terminal 1 (API server):
```bash
npm run server
```
Server runs at `http://localhost:8787`.

Terminal 2 (frontend):
```bash
npm run dev
```
Vite runs at `http://localhost:5173` and proxies `/api` to `http://localhost:8787`.

## Build
```bash
npm run build
```

## Media source management
From **Settings** in the app:
- Add folder path
- Remove folder path
- Rescan catalog

The source list and playback state are persisted in:
- `data/catalog-db.json`

## API (local)
- `GET /api/health`
- `GET /api/catalog`
- `GET /api/sources`
- `POST /api/sources` body: `{ "path": "C:/path/to/media" }`
- `DELETE /api/sources?path=C:/path/to/media`
- `PATCH /api/playback/:id` body: `{ "progress": 0.45, "currentTime": 123, "duration": 2700 }`
- `GET /api/media/:id` (supports `Range` header)

## Notes
- Series are expected in folders; episode parsing is best when filenames include `S01E01` pattern.
- Catalog is dynamic: it rescans sources when `/api/catalog` is requested.
