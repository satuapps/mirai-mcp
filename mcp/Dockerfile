# Mirai MCP server image for Glama automated safety and quality checks.
#
# Build from this directory (mcp):
#   docker build -t mirai-mcp .
#
# The process starts over stdio with no credentials. It advertises tools on
# initialize and tools/list. Guest quota may work until exhausted. Do not bake
# secret values into this file.

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine

WORKDIR /app

RUN addgroup -S mcp && adduser -S mcp -G mcp

# Names only. Empty means unset. Never a default key or a fake placeholder.
ENV MIRAI_API_KEY=""
ENV MIRAI_BASE_URL=""

COPY --from=build --chown=mcp:mcp /app/package.json ./
COPY --from=build --chown=mcp:mcp /app/node_modules ./node_modules
COPY --from=build --chown=mcp:mcp /app/dist ./dist

USER mcp

ENTRYPOINT ["node", "dist/index.js"]
