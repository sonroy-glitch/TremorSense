# TremorSense API — built for Northflank (or any container host).
#
#   docker build -t tremorsense-api backend/
#   docker run -p 3004:3004 --env-file backend/.env tremorsense-api
#
# Two stages so the published image carries no dev dependencies or TypeScript.

# ---- build ------------------------------------------------------------------
FROM node:22-slim AS build

WORKDIR /app

# Prisma's generator needs openssl present even with driver adapters.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY index.ts ./
COPY src ./src
# `npm run build` runs `prisma generate` (emitting ./generated/prisma as
# TypeScript) and then compiles everything, generated client included, to dist/.
RUN npm run build

# ---- runtime ----------------------------------------------------------------
FROM node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
# `prisma migrate deploy` at startup needs the schema, migrations and config.
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Northflank injects PORT; the app falls back to 3004.
ENV PORT=3004
EXPOSE 3004

# Don't run as root.
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3004)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
