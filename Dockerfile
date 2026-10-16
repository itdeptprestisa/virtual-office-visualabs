# Satu image: server (WebSocket + lampiran) sekaligus menyajikan hasil build client. LiveKit jalan di container terpisah
# (lihat docker-compose.yml). Debian slim, bukan Alpine: TypeScript 7 & Vite 8 memakai binary native glibc.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY shared shared
COPY client client
COPY server server
RUN npm run build

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
# Hanya dependency produksi milik server (ws, livekit-server-sdk) — paket client sudah ter-bundle di client/dist.
RUN npm ci --omit=dev --workspace=server --ignore-scripts

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=2567 DATA_FILE=/data/db.json
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/package.json ./
COPY --from=build /app/server/package.json server/
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/server
VOLUME /data
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:2567/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server/src/index.js"]
