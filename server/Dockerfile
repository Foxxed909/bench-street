# Bench Street API — Fly.io / production image
# better-sqlite3 needs native build tools
FROM node:22-bookworm-slim AS base

WORKDIR /app

# Install build deps for better-sqlite3, then prune later
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src

# Ensure data dir exists (volume will mount over it in production)
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PORT=8080

EXPOSE 8080

USER node

CMD ["node", "src/index.js"]
