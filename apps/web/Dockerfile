# ── Stage 1: prune the monorepo down to only what web needs ──────────────────
FROM node:22-alpine AS pruner
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN pnpm add -g turbo@^2

WORKDIR /app
COPY . .
RUN turbo prune @autarch/web --docker

# ── Stage 2: install + build (single stage so pnpm virtual store stays intact)
FROM node:22-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Install deps against the pruned lockfile
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Overlay full source files (pnpm store stays intact — no cross-stage copy)
COPY --from=pruner /app/out/full/ .

# Accept build-time public env vars
ARG NEXT_PUBLIC_LLM_URL
ARG NEXT_PUBLIC_LLM_MODEL
ENV NEXT_PUBLIC_LLM_URL=$NEXT_PUBLIC_LLM_URL
ENV NEXT_PUBLIC_LLM_MODEL=$NEXT_PUBLIC_LLM_MODEL

RUN pnpm turbo run build --filter=@autarch/web

# ── Stage 3: minimal production image ────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
