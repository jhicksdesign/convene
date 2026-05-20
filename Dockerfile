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

# Next.js standalone build — drops a self-contained server in .next/standalone.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ----- 3) runner: minimal runtime image -----
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

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

# Prisma client + schema are needed at runtime for migrate-deploy and the engine.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

# server.js is the standalone entry that Next.js generated.
CMD ["node", "server.js"]
