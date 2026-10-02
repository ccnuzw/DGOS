FROM node:22-trixie-slim AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @dgos/web build && test -f apps/web/dist/index.html

FROM node:22-trixie-slim
WORKDIR /workspace
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api ./apps/api
COPY --from=build /workspace/apps/worker ./apps/worker
COPY --from=build /workspace/packages/sdk ./packages/sdk
COPY apps/extension-runner ./apps/extension-runner
COPY apps/web/scripts/serve.mjs ./apps/web/scripts/serve.mjs
COPY --from=build /workspace/apps/web/dist ./apps/web/dist
COPY src ./src
COPY scripts/migrate.mjs scripts/v1-ops-api.mjs scripts/v1-ops-worker.mjs scripts/v1-ops-migrate.mjs ./scripts/
COPY migrations ./migrations
COPY deployment/mcp-canary.mjs ./deployment/ops-canary/approved/mcp-canary.mjs
RUN printf 'Acquire::Retries "3";\n' > /etc/apt/apt.conf.d/80-dgos-retries && apt-get update && apt-get upgrade -y && node_modules/.bin/playwright install-deps chromium && node_modules/.bin/playwright install chromium --only-shell && apt-get install -y --no-install-recommends bubblewrap && apt-get purge -y xvfb xserver-common && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /root/.cache/node /var/lib/apt/lists/* && chmod -R a+rX /ms-playwright
USER node
