# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Skip Chromium download — only needed at runtime, not for compiling TS
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN npm ci

COPY tsconfig.json .
COPY src ./src
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-slim

# ---------------------------------------------------------------------------
# Install Debian's chromium package (pulls all its own dependencies) and
# FFmpeg. Using the distro-packaged Chromium is far more reliable in Docker
# than wiring up the Google APT repo, and works on amd64 and arm64 alike.
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-liberation \
    fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium — skip the bundled download
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

# Install production deps only (no typescript / ts-node-dev)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Healthcheck for orchestration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>{if(!r.ok)throw r.status}).catch(()=>process.exit(1))"

EXPOSE 3001

CMD ["node", "dist/index.js"]
