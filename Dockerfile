# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=20-alpine

# ─── deps ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ─── builder ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js needs some envs at build time; provide safe placeholders.
# Real values come at runtime via docker-compose.
ENV DATABASE_URL=postgres://placeholder:placeholder@localhost/placeholder
ENV ADMIN_JWT_SECRET=build-placeholder
ENV STOCK_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
RUN npm run build

# ─── runner ──────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# public/ may not exist — create an empty dir so runtime doesn't complain
RUN mkdir -p ./public && chown -R nextjs:nodejs ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
