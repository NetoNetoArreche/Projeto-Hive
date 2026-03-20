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

# Internal Docker network config (matches docker-compose.prod.yml)
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL=postgresql://instapost:changeme@postgres:5432/instapost
ENV REDIS_URL=redis://:changeme@redis:6379
ENV MINIO_ENDPOINT=minio
ENV MINIO_PORT=9000
ENV MINIO_USE_SSL=false
ENV MINIO_ACCESS_KEY=minioadmin
ENV MINIO_SECRET_KEY=minioadmin
ENV MINIO_BUCKET=instapost-images
ENV NANO_BANANA_PROVIDER=google
ENV JWT_EXPIRES_IN=7d
ENV INTERNAL_SERVICE_TOKEN=instapost_service_2026

# External config from Coolify build args
ARG INSTAGRAM_ACCESS_TOKEN
ARG INSTAGRAM_USER_ID
ARG NANO_BANANA_API_KEY
ARG JWT_SECRET
ARG FRONTEND_URL
ARG MINIO_PUBLIC_URL
ENV INSTAGRAM_ACCESS_TOKEN=${INSTAGRAM_ACCESS_TOKEN:-IGAAYbW9T4MHNBZAGE4LVdUX1liVUd1alk2enJsUzcyT3RjNXkyVTViYmFTTHFBdWRmeEY1OGg4MHZAVRVV2WlVFNWZA1aF9teXBNMk01QlZA0cmRNNUt1UksycHFISnpPanBTS1dtVUpPSURkRHBibkVHMEZAJT1FUUHdYaElGeVRhcwZDZD}
ENV INSTAGRAM_USER_ID=${INSTAGRAM_USER_ID:-26182080638113769}
ENV NANO_BANANA_API_KEY=${NANO_BANANA_API_KEY:-AIzaSyCcxoV8xT_7O2uPNB6cOqaajKQgH98dziE}
ENV JWT_SECRET=${JWT_SECRET:-dev_secret_instapost_ai_2026}
ENV FRONTEND_URL=${FRONTEND_URL:-http://72.60.148.203:3000}
ENV MINIO_PUBLIC_URL=${MINIO_PUBLIC_URL:-http://72.60.148.203:9000}

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3001/api/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
