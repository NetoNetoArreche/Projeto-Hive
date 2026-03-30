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
COPY packages/bot ./packages/bot
RUN npx turbo build --filter=@instapost/bot

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/bot/dist ./dist
COPY --from=builder /app/packages/bot/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production

ARG API_TOKEN
ARG API_URL
ARG TELEGRAM_BOT_TOKEN
ARG TELEGRAM_ALLOWED_CHAT_IDS
ENV API_TOKEN=${API_TOKEN:-changeme}
ENV API_URL=${API_URL:-http://api:3001}
ENV TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
ENV TELEGRAM_ALLOWED_CHAT_IDS=${TELEGRAM_ALLOWED_CHAT_IDS}

HEALTHCHECK --interval=60s --timeout=5s CMD node -e "process.exit(0)"
CMD ["node", "dist/index.js"]
