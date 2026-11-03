# syntax=docker/dockerfile:1

# ---- deps: install node_modules (native build toolchain for better-sqlite3) ----
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- builder: produce the standalone Next.js server ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: minimal non-root runtime ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data

RUN addgroup -S -g 1001 credzo && adduser -S -u 1001 -G credzo credzo

COPY --from=builder --chown=credzo:credzo /app/public ./public
COPY --from=builder --chown=credzo:credzo /app/.next/standalone ./
COPY --from=builder --chown=credzo:credzo /app/.next/static ./.next/static

RUN mkdir -p /app/data && chown credzo:credzo /app/data && chmod 700 /app/data
VOLUME ["/app/data"]

USER credzo
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
