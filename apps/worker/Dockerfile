# Production-optimized Dockerfile for DGOS Worker Service
# Multi-stage build to minimize final image size

FROM node:22-bookworm-slim AS base
WORKDIR /workspace
RUN corepack enable && \
    apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

# Build stage: install dependencies and build
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY apps/api/package.json ./apps/api/
COPY packages/sdk/package.json ./packages/sdk/
# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile
# Copy source code
COPY apps/worker ./apps/worker
COPY apps/extension-runner ./apps/extension-runner
COPY packages/sdk ./packages/sdk
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
COPY deployment/mcp-canary.mjs ./deployment/mcp-canary.mjs
# Verify build (syntax check)
RUN cd apps/worker && pnpm build

# Production dependencies stage
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/sdk/package.json ./packages/sdk/
# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Install Playwright and dependencies for worker
FROM build AS playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN printf 'Acquire::Retries "3";\n' > /etc/apt/apt.conf.d/80-dgos-retries && \
    apt-get update && \
    apt-get install -y --no-install-recommends bubblewrap && \
    ./node_modules/.bin/playwright install-deps chromium && \
    ./node_modules/.bin/playwright install chromium --only-shell && \
    apt-get purge -y xvfb xserver-common && \
    rm -rf /var/lib/apt/lists/* /root/.cache /tmp/* && \
    chmod -R a+rX /ms-playwright

# Final production stage
FROM node:22-bookworm-slim AS production
WORKDIR /workspace

# Install bubblewrap for sandboxing
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends bubblewrap && \
    rm -rf /var/lib/apt/lists/* /root/.cache /tmp/*

# Set Playwright environment
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_ENV=production

# Copy Playwright browsers and dependencies
COPY --from=playwright /ms-playwright /ms-playwright

# Copy production dependencies
COPY --from=prod-deps --chown=node:node /workspace/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /workspace/apps/worker/node_modules ./apps/worker/node_modules

# Copy application code
COPY --from=build --chown=node:node /workspace/apps/worker ./apps/worker
COPY --from=build --chown=node:node /workspace/apps/extension-runner ./apps/extension-runner
COPY --from=build --chown=node:node /workspace/packages/sdk ./packages/sdk
COPY --from=build --chown=node:node /workspace/src ./src
COPY --from=build --chown=node:node /workspace/scripts/v1-ops-worker.mjs ./scripts/v1-ops-worker.mjs
COPY --from=build --chown=node:node /workspace/migrations ./migrations
COPY --from=build --chown=node:node /workspace/deployment/mcp-canary.mjs ./deployment/ops-canary/approved/mcp-canary.mjs

# Run as non-root user
USER node

# Health check (worker doesn't expose HTTP, check process)
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD pgrep -f "node.*v1-ops-worker" || exit 1

# Start the Worker service
CMD ["node", "scripts/v1-ops-worker.mjs"]
