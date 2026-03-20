FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/bot/package.json ./packages/bot/
COPY packages/mcp/package.json ./packages/mcp/
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/
RUN npm ci
COPY packages/shared ./packages/shared
COPY packages/mcp ./packages/mcp
RUN npx turbo build --filter=@instapost/mcp

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/mcp/dist ./dist
COPY --from=builder /app/packages/mcp/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV API_URL=http://api:3001
ENV API_TOKEN=instapost_service_2026

# External config from Coolify build args
ARG MCP_AUTH_TOKEN
ENV MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN:-dev_mcp_token}

RUN apk add --no-cache wget
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3002/health || exit 1
CMD ["node", "dist/index.js"]
