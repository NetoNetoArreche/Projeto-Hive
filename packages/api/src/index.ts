import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { initMinio } from './config/minio';
import { apiLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import generateRoutes from './routes/generate.routes';
import uploadRoutes from './routes/upload.routes';
import { publishWorker } from './jobs/publish.worker';
import { tokenRefreshWorker, initTokenRefreshJob } from './jobs/token-refresh.worker';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/upload', uploadRoutes);

// Health check with env diagnostics
app.get('/api/health', (_req, res) => {
  const mask = (v?: string) => v ? `${v.slice(0, 6)}...${v.slice(-4)} (${v.length} chars)` : 'NOT SET';
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      NANO_BANANA_API_KEY: mask(env.NANO_BANANA_API_KEY),
      MINIO_ENDPOINT: env.MINIO_ENDPOINT,
      MINIO_PUBLIC_URL: env.MINIO_PUBLIC_URL,
      DATABASE_URL: env.DATABASE_URL ? 'SET' : 'NOT SET',
      REDIS_URL: env.REDIS_URL ? 'SET' : 'NOT SET',
      INSTAGRAM_ACCESS_TOKEN: mask(env.INSTAGRAM_ACCESS_TOKEN),
      JWT_SECRET: env.JWT_SECRET ? 'SET' : 'NOT SET',
      INTERNAL_SERVICE_TOKEN: env.INTERNAL_SERVICE_TOKEN ? 'SET' : 'NOT SET',
    },
  });
});

// Diagnostic: test Gemini API key from this server
app.get('/api/diag/gemini', async (_req, res) => {
  const key = env.NANO_BANANA_API_KEY;
  if (!key) {
    res.json({ success: false, error: 'NANO_BANANA_API_KEY not set' });
    return;
  }
  try {
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const r = await fetch(testUrl);
    const data = await r.json();
    if (!r.ok) {
      res.json({ success: false, status: r.status, error: data, keyPrefix: key.slice(0, 8) });
    } else {
      res.json({ success: true, modelsCount: (data as any).models?.length || 0, keyPrefix: key.slice(0, 8) });
    }
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// Instagram status
app.get('/api/instagram/status', (_req, res) => {
  const configured = !!(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_USER_ID);
  res.json({ success: true, data: { connected: configured } });
});

// Instagram profile + recent media
app.get('/api/instagram/profile', async (_req, res) => {
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    res.json({ success: false, error: 'Instagram not configured' });
    return;
  }
  try {
    const [profileRes, mediaRes] = await Promise.all([
      fetch(`https://graph.instagram.com/v21.0/me?fields=id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,website&access_token=${token}`),
      fetch(`https://graph.instagram.com/v21.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=6&access_token=${token}`),
    ]);
    const profile = await profileRes.json();
    const media = await mediaRes.json();
    res.json({ success: true, data: { profile, recentMedia: (media as any).data || [] } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch Instagram data' });
  }
});

function logConfig() {
  const mask = (v?: string) => v ? `${v.slice(0, 6)}...${v.slice(-4)}` : 'NOT SET';
  console.log('=== InstaPost API Config ===');
  console.log('NANO_BANANA_API_KEY:', mask(env.NANO_BANANA_API_KEY));
  console.log('MINIO_ENDPOINT:', env.MINIO_ENDPOINT);
  console.log('MINIO_PUBLIC_URL:', env.MINIO_PUBLIC_URL);
  console.log('NANO_BANANA_PROVIDER:', env.NANO_BANANA_PROVIDER);
  console.log('============================');
}

async function start() {
  logConfig();
  try {
    await initMinio();
    console.log('MinIO initialized');
  } catch (err) {
    console.warn('MinIO initialization failed (uploads will not work):', (err as Error).message);
  }

  try {
    await initTokenRefreshJob();
    console.log('Token refresh job scheduled');
  } catch (err) {
    console.warn('Token refresh job failed to start:', (err as Error).message);
  }

  publishWorker.on('failed', (job, err) => {
    console.error(`Publish job ${job?.id} failed:`, err.message);
  });

  tokenRefreshWorker.on('failed', (job, err) => {
    console.error(`Token refresh job ${job?.id} failed:`, err.message);
  });

  app.listen(env.PORT, () => {
    console.log(`InstaPost API running on port ${env.PORT}`);
  });
}

start();
