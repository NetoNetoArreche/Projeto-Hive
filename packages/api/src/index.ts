import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { initMinio } from './config/minio';
import { apiLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import generateRoutes from './routes/generate.routes';
import uploadRoutes from './routes/upload.routes';
import taskRoutes from './routes/task.routes';
import projectRoutes from './routes/project.routes';
import teamRoutes from './routes/team.routes';
import funnelRoutes from './routes/funnel.routes';
import videoRoutes from './routes/video.routes';
import { publishWorker } from './jobs/publish.worker';
import { tokenRefreshWorker, initTokenRefreshJob } from './jobs/token-refresh.worker';
import { taskReminderWorker } from './jobs/task-reminder.worker';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/funnels', funnelRoutes);
app.use('/api/videos', videoRoutes);

// Health check with env diagnostics
app.get('/api/health', (_req, res) => {
  const mask = (v?: string) => v ? `${v.slice(0, 6)}...${v.slice(-4)} (${v.length} chars)` : 'NOT SET';
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      NANO_BANANA_API_KEY: mask(env.NANO_BANANA_API_KEY),
      MINIO_ENDPOINT: env.MINIO_ENDPOINT,
      MINIO_PORT: env.MINIO_PORT,
      MINIO_ACCESS_KEY: env.MINIO_ACCESS_KEY,
      MINIO_SECRET_KEY: env.MINIO_SECRET_KEY,
      MINIO_USE_SSL: env.MINIO_USE_SSL,
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

// Instagram profile + recent media (tries Business API first, then Instagram API)
app.get('/api/instagram/profile', async (_req, res) => {
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = env.INSTAGRAM_USER_ID;
  if (!token) {
    res.json({ success: false, error: 'Instagram not configured' });
    return;
  }
  try {
    // Try Business API first (graph.facebook.com) - works with EAA tokens
    if (igUserId) {
      const fbBase = 'https://graph.facebook.com/v21.0';
      const profileRes = await fetch(`${fbBase}/${igUserId}?fields=id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,website&access_token=${token}`);
      const profile = await profileRes.json() as any;
      if (!profile.error) {
        const mediaRes = await fetch(`${fbBase}/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=12&access_token=${token}`);
        const media = await mediaRes.json() as any;
        const normalizedMedia = (media.data || []).map((m: any) => ({
          ...m,
          like_count: m.like_count ?? 0,
          comments_count: m.comments_count ?? 0,
          media_url: m.media_url || m.thumbnail_url || null,
        }));
        console.log('[Instagram] Business API - Media count:', normalizedMedia.length);
        res.json({ success: true, data: { profile, recentMedia: normalizedMedia } });
        return;
      }
      console.log('[Instagram] Business API failed, trying Instagram API:', profile.error.message);
    }

    // Fallback: Instagram API (graph.instagram.com) - works with IGAA tokens
    const igBase = 'https://graph.instagram.com/v21.0';
    const [profileRes, mediaRes] = await Promise.all([
      fetch(`${igBase}/me?fields=id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count,biography,website&access_token=${token}`),
      fetch(`${igBase}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=12&access_token=${token}`),
    ]);
    const profile = await profileRes.json() as any;
    const media = await mediaRes.json() as any;
    if (profile.error) {
      console.error('[Instagram] Both APIs failed:', profile.error.message);
      res.json({ success: false, error: profile.error.message });
      return;
    }

    // Normalize media data: ensure like_count/comments_count exist, fix media_url for carousels
    const normalizedMedia = (media.data || []).map((m: any) => ({
      ...m,
      like_count: m.like_count ?? 0,
      comments_count: m.comments_count ?? 0,
      // CAROUSEL_ALBUM doesn't return media_url, use thumbnail_url as fallback
      media_url: m.media_url || m.thumbnail_url || null,
    }));

    console.log('[Instagram] Profile:', JSON.stringify({ id: profile.id, username: profile.username, followers: profile.followers_count, media_count: profile.media_count }));
    console.log('[Instagram] Media count returned:', normalizedMedia.length);
    normalizedMedia.slice(0, 3).forEach((m: any) => {
      console.log(`[Instagram] Media ${m.id}: type=${m.media_type}, likes=${m.like_count}, comments=${m.comments_count}, has_url=${!!m.media_url}`);
    });

    res.json({ success: true, data: { profile, recentMedia: normalizedMedia } });
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

  taskReminderWorker.on('failed', (job, err) => {
    console.error(`Task reminder job ${job?.id} failed:`, err.message);
  });

  app.listen(env.PORT, () => {
    console.log(`InstaPost API running on port ${env.PORT}`);
  });
}

start();
