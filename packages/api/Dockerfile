FROM node:22-alpine AS builder
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
RUN cd packages/shared && npx tsc && cd /app/packages/api && npx tsc

FROM node:22-slim
WORKDIR /app

# Install Python, ffmpeg, wget
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip python3-venv ffmpeg wget && \
    rm -rf /var/lib/apt/lists/*

# Python dependencies (video clipper)
COPY scripts/video/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt
ENV PATH="/opt/venv/bin:$PATH"

# Copy built API
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/package.json ./
COPY --from=builder /app/packages/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Copy video scripts + install worker Node dependencies
COPY scripts/video/ ./scripts/video/
COPY scripts/video/package.json /tmp/video-pkg/package.json
RUN cd /tmp/video-pkg && npm install --omit=dev && cp -r node_modules /app/scripts/video/
# Link the API's generated Prisma client into the video worker
RUN cp -r /app/node_modules/.prisma /app/scripts/video/node_modules/.prisma && \
    cp -r /app/node_modules/@prisma /app/scripts/video/node_modules/@prisma

# Internal Docker network config
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
ENV SCRIPTS_DIR=/app/scripts/video

# External config from Coolify env vars
ARG INSTAGRAM_ACCESS_TOKEN
ARG INSTAGRAM_USER_ID
ARG NANO_BANANA_API_KEY
ARG JWT_SECRET
ARG FRONTEND_URL
ARG MINIO_PUBLIC_URL
ENV INSTAGRAM_ACCESS_TOKEN=${INSTAGRAM_ACCESS_TOKEN}
ENV INSTAGRAM_USER_ID=${INSTAGRAM_USER_ID}
ENV NANO_BANANA_API_KEY=${NANO_BANANA_API_KEY}
ENV JWT_SECRET=${JWT_SECRET:-dev_secret_change_me}
ENV FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}
ENV MINIO_PUBLIC_URL=${MINIO_PUBLIC_URL:-http://localhost:9000}

EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=8 CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy 2>&1 || true; node /app/scripts/video/worker.mjs 2>&1 & exec node /app/dist/index.js"]
