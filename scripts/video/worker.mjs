/**
 * Video Worker - Runs inside Docker container with Python + ffmpeg.
 * Connects to Redis, processes video-queue jobs by spawning Python scripts.
 * Uploads results to MinIO and updates Postgres via Prisma.
 */
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { Client as MinioClient } from 'minio';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config from env ──
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DATABASE_URL = process.env.DATABASE_URL;
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin_secret';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'instapost-images';
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || 'http://localhost:9000';
const SCRIPTS_DIR = process.env.SCRIPTS_DIR || __dirname;

// ── Clients ──
const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const prisma = new PrismaClient();
const minio = new MinioClient({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

function runPython(script, args) {
  return new Promise((resolve, reject) => {
    console.log(`[video-worker] Running: python ${script} ${args.join(' ').slice(0, 200)}...`);
    const proc = spawn('python', [script, ...args], { cwd: SCRIPTS_DIR });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); process.stdout.write(d); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); process.stderr.write(d); });
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.slice(-500) || `Python exited with code ${code}`));
    });
    proc.on('error', (err) => reject(err));
  });
}

async function uploadToMinio(filePath, mimetype) {
  const ext = path.extname(filePath).slice(1) || 'bin';
  const key = `video-clips/${randomUUID()}.${ext}`;
  const buffer = fs.readFileSync(filePath);
  await minio.putObject(MINIO_BUCKET, key, buffer, buffer.length, { 'Content-Type': mimetype });
  return `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/${key}`;
}

async function handleAnalyze(data) {
  const { videoClipId, whisperModel = 'tiny', maxMoments = 10, language } = data;
  console.log(`[video-worker] Analyzing video ${videoClipId}...`);

  await prisma.videoClip.update({ where: { id: videoClipId }, data: { status: 'ANALYZING' } });

  const workDir = `/tmp/instapost-videos/${videoClipId}`;
  fs.mkdirSync(workDir, { recursive: true });

  try {
    const clip = await prisma.videoClip.findUnique({ where: { id: videoClipId } });
    if (!clip) throw new Error('VideoClip not found');

    const args = ['--url', clip.sourceUrl, '--output', workDir, '--whisper-model', whisperModel, '--max-moments', String(maxMoments)];
    if (language) args.push('--language', language);

    const { stdout } = await runPython(path.join(SCRIPTS_DIR, 'analyze.py'), args);

    const momentsPath = path.join(workDir, 'moments.json');
    let moments = null, videoInfo = {};

    if (fs.existsSync(momentsPath)) {
      const raw = JSON.parse(fs.readFileSync(momentsPath, 'utf-8'));
      moments = raw.moments || [];
      videoInfo = raw.video || {};
    } else {
      const parsed = JSON.parse(stdout);
      moments = parsed.moments || [];
      videoInfo = parsed.video || {};
    }

    await prisma.videoClip.update({
      where: { id: videoClipId },
      data: {
        status: 'ANALYZED',
        title: videoInfo.title || clip.title,
        language: videoInfo.language || language,
        duration: videoInfo.duration || null,
        moments,
        workDir,
      },
    });
    console.log(`[video-worker] Video ${videoClipId} analyzed: ${moments.length} moments found`);
  } catch (err) {
    await prisma.videoClip.update({ where: { id: videoClipId }, data: { status: 'FAILED', error: String(err.message).slice(0, 500) } });
    throw err;
  }
}

async function handleClip(data) {
  const { videoClipId, clips, format = 'vertical', burnSubs = false, whisperModel = 'tiny', language } = data;
  console.log(`[video-worker] Clipping video ${videoClipId} (${clips.length} clips)...`);

  await prisma.videoClip.update({ where: { id: videoClipId }, data: { status: 'CLIPPING' } });

  try {
    const clip = await prisma.videoClip.findUnique({ where: { id: videoClipId } });
    if (!clip) throw new Error('VideoClip not found');

    const workDir = clip.workDir || `/tmp/instapost-videos/${videoClipId}`;
    const clipsDir = path.join(workDir, 'clips');
    fs.mkdirSync(clipsDir, { recursive: true });

    const args = ['--url', clip.sourceUrl, '--output', clipsDir, '--clips', JSON.stringify(clips), '--format', format, '--whisper-model', whisperModel];
    if (burnSubs) args.push('--burn-subs');
    if (language) args.push('--language', language);

    await runPython(path.join(SCRIPTS_DIR, 'clipper.py'), args);

    const resultPath = path.join(clipsDir, 'clips-result.json');
    let clipsResult = [];
    if (fs.existsSync(resultPath)) {
      clipsResult = JSON.parse(fs.readFileSync(resultPath, 'utf-8')).clips || [];
    }

    const uploadedClips = [];
    for (const c of clipsResult) {
      const uploaded = { index: c.index, title: c.title, start: c.start, end: c.end, duration: c.duration };
      if (c.video && fs.existsSync(c.video)) uploaded.url = await uploadToMinio(c.video, 'video/mp4');
      if (c.srt && fs.existsSync(c.srt)) uploaded.srtUrl = await uploadToMinio(c.srt, 'text/plain');
      if (c.ass && fs.existsSync(c.ass)) uploaded.assUrl = await uploadToMinio(c.ass, 'text/plain');
      uploadedClips.push(uploaded);
    }

    await prisma.videoClip.update({ where: { id: videoClipId }, data: { status: 'READY', clips: uploadedClips } });
    console.log(`[video-worker] Video ${videoClipId} ready: ${uploadedClips.length} clips uploaded`);
  } catch (err) {
    await prisma.videoClip.update({ where: { id: videoClipId }, data: { status: 'FAILED', error: String(err.message).slice(0, 500) } });
    throw err;
  }
}

// ── Start Worker ──
const worker = new Worker(
  'video-queue',
  async (job) => {
    if (job.name === 'analyze') await handleAnalyze(job.data);
    else if (job.name === 'clip') await handleClip(job.data);
  },
  { connection: redis, concurrency: 1 },
);

worker.on('completed', (job) => console.log(`[video-worker] Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[video-worker] Job ${job?.id} failed:`, err.message));

console.log('[video-worker] Video worker started, waiting for jobs...');
