# ---- Dockerfile for zijing-payroll (Next.js standalone + Prisma + SQLite) ----
# Multi-stage: deps -> build (incl. db init) -> minimal runtime.

# ============ 1. Deps ============
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install

# ============ 2. Build ============
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Generate Prisma client + build Next.js standalone.
RUN npx prisma generate && npm run build

# ============ 3. Runtime ============
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tzdata
ENV TZ=Asia/Shanghai
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/app/data/payroll.db"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone server bundle + static assets + public.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# For migrate/seed at startup we need the full prisma toolchain + tsx.
# Copy the entire node_modules from deps (has all prisma deps incl. effect).
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Entrypoint script.
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

RUN mkdir -p /app/data

# Run as root: the mounted data volume is owned by the host user and a non-root
# container user would lack write permission for the SQLite db. Acceptable for
# an intranet deployment behind no public exposure.
EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
