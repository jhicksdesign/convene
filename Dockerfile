# syntax=docker/dockerfile:1.7

# ----- 1) deps: install with cache-friendly layering -----
FROM node:22-alpine AS deps
WORKDIR /app

# Prisma needs openssl on alpine.
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Postinstall runs `prisma generate` automatically (see package.json).
RUN npm ci --no-audit --no-fund

# ----- 2) builder: produce .next/standalone -----
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client must be generated for the target platform.
RUN npx prisma generate

# Build-time public env vars. Next.js inlines NEXT_PUBLIC_* into the client
# bundle at `next build` time, so they must be in the environment BEFORE
# `npm run build` runs. Railway passes these in via --build-arg when the
# matching variables exist in the service's Variables tab.
ARG NEXT_PUBLIC_MAPBOX_TOKEN=""
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ARG NEXT_PUBLIC_DEFAULT_MAP_CENTER_LAT=""
ARG NEXT_PUBLIC_DEFAULT_MAP_CENTER_LNG=""
ARG NEXT_PUBLIC_DEFAULT_MAP_ZOOM=""
# Hostname for R2-served uploads (when behind a Cloudflare custom domain).
# Read by next.config.ts at build time to whitelist for next/image.
ARG R2_PUBLIC_HOSTNAME=""
ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_PUBLIC_DEFAULT_MAP_CENTER_LAT=$NEXT_PUBLIC_DEFAULT_MAP_CENTER_LAT \
    NEXT_PUBLIC_DEFAULT_MAP_CENTER_LNG=$NEXT_PUBLIC_DEFAULT_MAP_CENTER_LNG \
    NEXT_PUBLIC_DEFAULT_MAP_ZOOM=$NEXT_PUBLIC_DEFAULT_MAP_ZOOM \
    R2_PUBLIC_HOSTNAME=$R2_PUBLIC_HOSTNAME

# Next.js standalone build — drops a self-contained server in .next/standalone.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ----- 3) runner: minimal runtime image -----
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

# Pin must match prisma in package.json. The CLI is invoked at container start
# via `prisma migrate deploy` in railway.json's startCommand.
RUN npm install -g prisma@6.19.3

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user to run the app.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy public assets and the standalone server output.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma client + schema needed at runtime; the CLI is installed below.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

# server.js is the standalone entry that Next.js generated.
CMD ["node", "server.js"]
