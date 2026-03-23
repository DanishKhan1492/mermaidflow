<p align="center">
  <img src="https://mermaid.js.org/favicon.ico" width="64" alt="MermaidFlow" />
</p>

<h1 align="center">MermaidFlow</h1>

<p align="center">
  <strong>Turn Mermaid.js diagrams into animated GIFs - right from your browser.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#docker-deployment">Docker</a> •
  <a href="#api-reference">API</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Overview

MermaidFlow is a full-stack web application that lets you write [Mermaid.js](https://mermaid.js.org/) diagram code in a VS Code-like editor, see a live animated preview, and export it as an animated GIF, SVG, or PNG — all from a single UI.

The backend captures progressive diagram frames via Puppeteer and stitches them into a high-quality GIF using a two-pass FFmpeg palette pipeline. The frontend provides a split-pane editor + preview layout with real-time SSE progress updates.

---

## Features

| Category | Details |
|---|---|
| **Monaco Editor** | Full Mermaid syntax editing with VS Code keybindings, undo/redo, and drag-drop `.mmd` import |
| **Live Preview** | Debounced (500 ms) SVG re-render with step-through controls (Play / Pause / Next / Previous) |
| **Animated GIF Export** | Two-pass FFmpeg `palettegen` → `paletteuse` for crisp, professional GIFs |
| **SVG / PNG Export** | Static export of any diagram via a single API call |
| **Real-time Progress** | Server-Sent Events stream frame-capture and stitching progress to the UI |
| **Animation Speed** | 0.5×, 1×, 2× playback speed for the step-through preview |
| **Loop Toggle** | Auto-loop the animated preview continuously |
| **Shareable URLs** | LZ-string compressed diagram state encoded in the URL for instant sharing |
| **Diagram Library** | IndexedDB-backed save / load / favorite / delete — your diagrams persist locally |
| **Template Gallery** | Pre-built Mermaid templates (flowchart, sequence, class, state, ER, pie, gantt, git) |
| **Light & Dark Mode** | Toggle between themes; preference persisted via Zustand + localStorage |
| **GIF Size Predictor** | Estimated file size shown before export |
| **Mobile Responsive** | Tab-based layout on small screens; resizable split-panes on desktop |
| **Keyboard Shortcuts** | `Ctrl/⌘+S` save, `Ctrl/⌘+E` export, `Ctrl/⌘+Z/Y` undo/redo, `Ctrl/⌘+K` share |
| **Drag & Drop** | Drop `.mmd`, `.mermaid`, `.md`, or `.txt` files onto the editor to load them |
| **Accessibility** | Skip-to-content link, `aria-labels`, focus-visible outlines |
| **Copy to Clipboard** | One-click copy of the generated GIF |

---

## Quick Start

### Prerequisites

- **Node.js** 20+
- **npm** 9+
- **FFmpeg** installed and on your `PATH` (for local dev)
- **Chromium / Chrome** (Puppeteer will download one automatically for local dev)

### Local Development

```bash
# Clone the repository
git clone https://github.com/<your-org>/mermaid-code-to-gif.git
cd mermaid-code-to-gif

# ── Backend ──────────────────────────────────────────
cd backend
npm install
npm run dev          # Starts on http://localhost:3001

# ── Frontend (new terminal) ──────────────────────────
cd frontend
npm install
npm run dev          # Starts on http://localhost:3000
```

The Next.js development server proxies `/api/*` requests to the backend at `http://localhost:3001` via the rewrite rules in `next.config.mjs`.

---

## Docker Deployment

The recommended way to run MermaidFlow in production.

### Build & Run

```bash
docker compose up --build -d
```

| Service | Container | Port | Base Image |
|---|---|---|---|
| Backend | `mermaidflow-backend` | `3001` | `node:20-slim` (Chromium + FFmpeg installed via apt) |
| Frontend | `mermaidflow-frontend` | `3000` | `node:20-alpine` (multi-stage standalone build) |

Both services include healthchecks. The frontend waits for the backend to be healthy before starting (`depends_on: condition: service_healthy`).

### Production Checklist

| Concern | How It's Handled |
|---|---|
| **Chromium sandbox** | Runs inside Docker with `--no-sandbox` and an enlarged `/dev/shm` (`shm_size: 1gb`) |
| **Resource limits** | Backend capped at 2 GB memory / 2 CPUs via `deploy.resources.limits` |
| **Healthchecks** | Both containers expose health endpoints, checked every 30 s |
| **Restart policy** | `unless-stopped` ensures containers recover from crashes |
| **Build context** | `.dockerignore` files exclude `node_modules`, `.next`, `dist`, `.env` |
| **Multi-stage builds** | Frontend ships only the standalone Next.js output; backend ships only compiled JS + production deps |
| **Chromium in builder** | Skipped via `PUPPETEER_SKIP_DOWNLOAD=true` — only installed in the runtime stage |

### Environment Variables

| Variable | Service | Default | Description |
|---|---|---|---|
| `PORT` | Backend | `3001` | HTTP listen port |
| `NODE_ENV` | Both | `production` | Enables production optimisations |
| `FRONTEND_URL` | Backend | `http://localhost:3000` | CORS origin for the frontend |
| `PUPPETEER_EXECUTABLE_PATH` | Backend | `/usr/bin/chromium` | Path to the system Chromium binary |
| `PUPPETEER_SKIP_DOWNLOAD` | Backend | `true` | Prevents Puppeteer from downloading Chromium |
| `API_URL` | Frontend | `http://backend:3001` | Backend URL used by Next.js rewrites (server-side only) |
| `HOSTNAME` | Frontend | `0.0.0.0` | Next.js standalone listen address |

### Reverse Proxy (Nginx)

For production deployments behind a reverse proxy:

```nginx
server {
    listen 80;
    server_name mermaidflow.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # SSE requires these headers for streaming
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }
}
```

---

## API Reference

### `POST /api/generate-gif`

Generate an animated GIF from Mermaid code.

**Request Body:**

```json
{
  "mermaidCode": "graph TD\n  A-->B",
  "frames": 10,
  "delay": 500
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `mermaidCode` | `string` | Yes | Valid Mermaid diagram source |
| `frames` | `number` | No | Number of animation frames (default: 10) |
| `delay` | `number` | No | Delay between frames in ms (default: 500) |

**Response Modes:**

- **SSE** (when `Accept: text/event-stream`): Streams `progress`, `complete`, and `error` events.
- **Classic**: Returns `{ success: true, gif: "<base64>" }`.

### `POST /api/export-static`

Export a diagram as SVG or PNG.

**Request Body:**

```json
{
  "mermaidCode": "graph TD\n  A-->B",
  "format": "svg"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `mermaidCode` | `string` | Yes | Valid Mermaid diagram source |
| `format` | `"svg"` \| `"png"` | Yes | Output format |

**Response:** The raw SVG string or base64-encoded PNG.

### `GET /health`

Returns `{ "status": "ok", "timestamp": "..." }`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Browser                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Monaco       │  │ Mermaid SVG  │  │ Export          │  │
│  │ Editor       │  │ Preview      │  │ Sidebar         │  │
│  └──────┬───── ┘  └──────────────┘  └───────┬────────┘  │
│         │          Next.js 14 (App Router)   │           │
│         └──────────── /api/* rewrite ────────┘           │
└────────────────────────┬─────────────────────────────────┘
                         │  HTTP / SSE
┌────────────────────────▼─────────────────────────────────┐
│                Express.js Backend                        │
│  ┌─────────────────┐  ┌──────────────────────────────┐   │
│  │ Zod Validation  │  │ Puppeteer: Frame Capture     │   │
│  │ + Sanitisation  │  │  → Progressive re-rendering  │   │
│  └─────────────────┘  │  → page.screenshot() per     │   │
│                        │    step                      │   │
│                        └──────────────┬───────────────┘   │
│                                       │                   │
│  ┌────────────────────────────────────▼───────────────┐   │
│  │ FFmpeg: Two-pass palettegen → GIF encode           │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Pipeline

1. **Editor** → User writes Mermaid code
2. **Live Preview** → Frontend renders SVG with 500 ms debounce
3. **Export** → Frontend calls `/api/generate-gif` (SSE mode)
4. **Frame Capture** → Puppeteer injects Mermaid, progressively shows diagram elements, screenshots each step
5. **Stitching** → FFmpeg combines PNGs into GIF with optimised palette
6. **Delivery** → GIF streamed back via SSE `complete` event as base64

---

## Project Structure

```
mermaid-code-to-gif/
├── backend/
│   ├── src/
│   │   ├── index.ts                  # Express server, CORS, health endpoint
│   │   ├── middleware/
│   │   │   └── validation.ts         # Zod request validation
│   │   ├── routes/
│   │   │   └── generate.ts           # /api/generate-gif & /api/export-static
│   │   └── services/
│   │       ├── ffmpegService.ts       # Two-pass FFmpeg GIF encoding
│   │       └── puppeteerService.ts    # Frame capture & parseMermaidSteps
│   ├── Dockerfile                     # Multi-stage: build TS → runtime w/ Chromium + FFmpeg
│   ├── .dockerignore
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── app/
│   │   ├── globals.css                # Tailwind base + light/dark theme overrides
│   │   ├── layout.tsx                 # Root layout, OG metadata, fonts
│   │   └── page.tsx                   # Main split-pane page
│   ├── components/
│   │   ├── DiagramLibrary.tsx         # IndexedDB-backed diagram save/load modal
│   │   ├── EditorPane.tsx             # Monaco editor + drag-drop + undo/redo
│   │   ├── ExportSidebar.tsx          # GIF/SVG/PNG export with SSE progress
│   │   └── PreviewPane.tsx            # Animated SVG preview with step-through
│   ├── data/
│   │   └── templates.ts              # Pre-built Mermaid diagram templates
│   ├── hooks/
│   │   ├── useKeyboardShortcuts.ts   # Global keyboard shortcut handler
│   │   └── useMermaidRenderer.ts     # Debounced Mermaid → SVG rendering
│   ├── store/
│   │   └── useEditorStore.ts         # Zustand store (code, theme, settings, persisted)
│   ├── utils/
│   │   ├── diagramHistory.ts         # IndexedDB CRUD for diagram library
│   │   ├── estimateGifSize.ts        # GIF file size estimator
│   │   └── shareUrl.ts              # LZ-string URL encode/decode
│   ├── Dockerfile                    # Multi-stage: build Next.js → standalone runner
│   ├── .dockerignore
│   ├── next.config.mjs               # Standalone output + /api/* rewrite
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml                 # Orchestrates backend + frontend
├── .gitignore
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | Next.js 14 (App Router, standalone output) |
| **UI Library** | React 18 |
| **Styling** | Tailwind CSS 3.4 |
| **Code Editor** | Monaco Editor (`@monaco-editor/react`) |
| **Diagram Renderer** | Mermaid.js 10.9 |
| **State Management** | Zustand 4.5 (with localStorage persist) |
| **Layout** | `react-resizable-panels` |
| **Icons** | Lucide React |
| **Notifications** | React Hot Toast |
| **URL Sharing** | LZ-String compression |
| **Backend Runtime** | Node.js 20, Express 4.18 |
| **Frame Capture** | Puppeteer 21.11 |
| **GIF Encoding** | FFmpeg via `fluent-ffmpeg` |
| **Validation** | Zod 3.22 |
| **Concurrency** | `p-limit` (worker pool for Puppeteer instances) |
| **Containerisation** | Docker, Docker Compose |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/⌘ + S` | Save diagram to library |
| `Ctrl/⌘ + E` | Export GIF / SVG / PNG |
| `Ctrl/⌘ + K` | Copy shareable URL |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Shift + Z` / `Ctrl/⌘ + Y` | Redo |

---

## Troubleshooting

### Puppeteer fails to launch in Docker

Make sure `shm_size: '1gb'` is set in `docker-compose.yml` and `PUPPETEER_EXECUTABLE_PATH` points to the system-installed Chromium (`/usr/bin/chromium`).

### FFmpeg not found

The backend Dockerfile installs FFmpeg via `apt-get`. For local development, install it with:

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt-get install ffmpeg
```

### Port conflicts

Change the mapped ports in `docker-compose.yml`:

```yaml
ports:
  - '8080:3001'   # backend
  - '8081:3000'   # frontend
```

### CORS errors in development

The backend reads `FRONTEND_URL` for CORS. Make sure it matches your frontend origin:

```bash
FRONTEND_URL=http://localhost:3000 npm run dev
```

---

## Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feat/my-feature`
3. **Commit** with clear messages: `git commit -m "feat: add X"`
4. **Push** to your fork: `git push origin feat/my-feature`
5. **Open** a Pull Request

Please follow the existing code style and include tests where applicable.

---

## License

This project is provided as-is under the [MIT License](LICENSE).
