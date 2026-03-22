# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

# API_URL is a build-time arg used by next.config.mjs rewrites.
# Default points to the Docker internal backend service name.
ARG API_URL=http://backend:3001
ENV API_URL=${API_URL}

COPY . .
RUN npm run build

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# next/standalone output includes its own server.js and node_modules subset
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
