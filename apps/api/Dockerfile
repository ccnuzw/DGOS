# Production-optimized Dockerfile for DGOS API Service
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
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/sdk/package.json ./packages/sdk/
# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile
# Copy source code
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker
COPY apps/extension-runner ./apps/extension-runner
COPY packages/sdk ./packages/sdk
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
# Verify build (syntax check)
RUN cd apps/api && pnpm build

# Production dependencies stage
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/sdk/package.json ./packages/sdk/
# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Final production stage
FROM node:22-bookworm-slim AS production
WORKDIR /workspace

# Install security updates and required runtime dependencies
RUN apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/* /root/.cache /tmp/*

# Copy production dependencies
COPY --from=prod-deps --chown=node:node /workspace/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /workspace/apps/api/node_modules ./apps/api/node_modules

# Copy application code
COPY --from=build --chown=node:node /workspace/apps/api ./apps/api
COPY --from=build --chown=node:node /workspace/apps/worker ./apps/worker
COPY --from=build --chown=node:node /workspace/apps/extension-runner ./apps/extension-runner
COPY --from=build --chown=node:node /workspace/packages/sdk ./packages/sdk
COPY --from=build --chown=node:node /workspace/src ./src
COPY --from=build --chown=node:node /workspace/scripts/v1-ops-api.mjs ./scripts/v1-ops-api.mjs
COPY --from=build --chown=node:node /workspace/migrations ./migrations

# Set production environment
ENV NODE_ENV=production \
    PORT=3000

# Run as non-root user
USER node

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Start the API service
CMD ["node", "scripts/v1-ops-api.mjs"]
