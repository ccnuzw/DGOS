# Production-optimized Dockerfile for DGOS Web Service
# Multi-stage build to minimize final image size

FROM node:22-bookworm-slim AS base
WORKDIR /workspace
RUN corepack enable && \
    apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

# Build stage: install dependencies and build web assets
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/app-shell/package.json ./packages/app-shell/
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/dgos-ui/package.json ./packages/dgos-ui/
COPY packages/host-adapter/web/package.json ./packages/host-adapter/web/
# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile
# Copy source code
COPY apps/web ./apps/web
COPY packages ./packages
# Build web assets
RUN cd apps/web && pnpm build && test -f dist/index.html

# Production dependencies stage (minimal runtime for serving static files)
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
# Install only production dependencies (none for serving static files)
RUN pnpm install --frozen-lockfile --prod --filter @dgos/web

# Final production stage
FROM node:22-bookworm-slim AS production
WORKDIR /workspace

# Install security updates
RUN apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/* /root/.cache /tmp/*

# Copy minimal runtime dependencies
COPY --from=prod-deps --chown=node:node /workspace/node_modules ./node_modules

# Copy built web assets and serve script
COPY --from=build --chown=node:node /workspace/apps/web/dist ./apps/web/dist
COPY --from=build --chown=node:node /workspace/apps/web/scripts/serve.mjs ./apps/web/scripts/serve.mjs

# Set production environment
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173

# Run as non-root user
USER node

# Expose web server port
EXPOSE 4173

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:4173/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Start the web server
CMD ["node", "apps/web/scripts/serve.mjs"]
