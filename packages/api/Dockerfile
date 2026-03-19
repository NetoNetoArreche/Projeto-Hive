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
COPY packages/api ./packages/api
RUN cd packages/api && npx prisma generate
RUN npx turbo build --filter=@instapost/api

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/package.json ./
COPY --from=builder /app/packages/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3001/api/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
