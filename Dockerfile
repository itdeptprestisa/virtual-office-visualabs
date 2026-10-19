# Satu image: server (WebSocket + lampiran) sekaligus menyajikan hasil build client. LiveKit jalan di container terpisah
# (lihat docker-compose.yml). Semua lewat Bun: install, build client, dan server dijalankan langsung dari TypeScript
# (tanpa langkah kompilasi). Debian slim, bukan Alpine: TypeScript 7 & Vite 8 memakai binary native glibc.

FROM oven/bun:1.3.10-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY client/package.json client/
COPY server/package.json server/
RUN bun install --frozen-lockfile
COPY shared shared
COPY client client
COPY server server
RUN bun run build

FROM oven/bun:1.3.10-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY client/package.json client/
COPY server/package.json server/
# Hanya dependency produksi milik server (ws, livekit-server-sdk) — paket client sudah ter-bundle di client/dist.
RUN bun install --frozen-lockfile --production --filter server --ignore-scripts

FROM oven/bun:1.3.10-slim
ENV NODE_ENV=production PORT=2567 DATA_FILE=/data/db.json
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY package.json ./
COPY server/package.json server/
COPY shared shared
COPY server/src server/src
COPY --from=build /app/client/dist client/dist
RUN mkdir -p /data && chown bun:bun /data
USER bun
WORKDIR /app/server
VOLUME /data
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD bun -e "fetch('http://127.0.0.1:2567/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "src/index.ts"]
