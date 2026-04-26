import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { prisma } from '../config/database';
import { minioClient } from '../config/minio';
import { env } from '../config/env';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SCRIPTS_DIR = path.resolve(__dirname, '../../../../scripts/video');

function runPython(scriptPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [scriptPath, ...args], { cwd: SCRIPTS_DIR });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `Python exited with code ${code}`));
    });
    proc.on('error', (err) => reject(err));
  });
}

async function uploadFileToMinio(filePath: string, mimetype: string): Promise<string> {
  const ext = path.extname(filePath).slice(1) || 'bin';
  const key = `video-clips/${randomUUID()}.${ext}`;
  const buffer = fs.readFileSync(filePath);

  await minioClient.putObject(env.MINIO_BUCKET, key, buffer, buffer.length, {
    'Content-Type': mimetype,
  });

  const { buildPublicUrl } = await import('../services/storage.service');
  return buildPublicUrl(key);
}

async function handleAnalyze(data: any) {
  const { videoClipId, whisperModel = 'tiny', maxMoments = 10, language } = data;

  await prisma.videoClip.update({ where: { id: videoClipId }, data: { status: 'ANALYZING' } });

  const workDir = path.join(os.tmpdir(), 'instapost-videos', videoClipId);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    const clip = await prisma.videoClip.findUnique({ where: { id: videoClipId } });
    if (!clip) throw new Error('VideoClip not found');

    const args = [
      '--url', clip.sourceUrl,
      '--output', workDir,
      '--whisper-model', whisperModel,
      '--max-moments', String(maxMoments),
    ];
    if (language) args.push('--language', language);

    const { stdout } = await runPython(path.join(SCRIPTS_DIR, 'analyze.py'), args);

    // Read moments.json
    const momentsPath = path.join(workDir, 'moments.json');
    let moments: any = null;
    let videoInfo: any = null;

    if (fs.existsSync(momentsPath)) {
      const raw = JSON.parse(fs.readFileSync(momentsPath, 'utf-8'));
      moments = raw.moments || [];
      videoInfo = raw.video || {};
    } else {
      // Try parsing stdout
      try {
        const parsed = JSON.parse(stdout);
        moments = parsed.moments || [];
        videoInfo = parsed.video || {};
      } catch {
        throw new Error('Could not parse analysis output');
      }
    }

    await prisma.videoClip.update({
      where: { id: videoClipId },
      data: {
        status: 'ANALYZED',
        title: videoInfo.title || clip.title,
        language: videoInfo.language || language,
        duration: videoInfo.duration || null,
        moments: moments as any,
        workDir,
      },
    });
  } catch (err: any) {
    await prisma.videoClip.update({
      where: { id: videoClipId },
      data: { status: 'FAILED', error: err.message?.slice(0, 500) },
    });
    throw err;
  }
}

async function handleClip(data: any) {
  const { videoClipId, clips, format = 'vertical', burnSubs = false, whisperModel = 'tiny', language } = data;

  await prisma.videoClip.update({ where: { id: videoClipId }, data: { status: 'CLIPPING' } });

  try {
    const clip = await prisma.videoClip.findUnique({ where: { id: videoClipId } });
    if (!clip) throw new Error('VideoClip not found');

    const workDir = clip.workDir || path.join(os.tmpdir(), 'instapost-videos', videoClipId);
    const clipsDir = path.join(workDir, 'clips');
    fs.mkdirSync(clipsDir, { recursive: true });

    const args = [
      '--url', clip.sourceUrl,
      '--output', clipsDir,
      '--clips', JSON.stringify(clips),
      '--format', format,
      '--whisper-model', whisperModel,
    ];
    if (burnSubs) args.push('--burn-subs');
    if (language) args.push('--language', language);

    await runPython(path.join(SCRIPTS_DIR, 'clipper.py'), args);

    // Read result and upload to MinIO
    const resultPath = path.join(clipsDir, 'clips-result.json');
    let clipsResult: any[] = [];

    if (fs.existsSync(resultPath)) {
      const raw = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
      clipsResult = raw.clips || [];
    }

    // Upload each clip to MinIO
    const uploadedClips = [];
    for (const c of clipsResult) {
      const uploaded: any = {
        index: c.index,
        title: c.title,
        start: c.start,
        end: c.end,
        duration: c.duration,
      };

      if (c.video && fs.existsSync(c.video)) {
        uploaded.url = await uploadFileToMinio(c.video, 'video/mp4');
      }
      if (c.srt && fs.existsSync(c.srt)) {
        uploaded.srtUrl = await uploadFileToMinio(c.srt, 'text/plain');
      }
      if (c.ass && fs.existsSync(c.ass)) {
        uploaded.assUrl = await uploadFileToMinio(c.ass, 'text/plain');
      }

      uploadedClips.push(uploaded);
    }

    await prisma.videoClip.update({
      where: { id: videoClipId },
      data: { status: 'READY', clips: uploadedClips as any },
    });
  } catch (err: any) {
    await prisma.videoClip.update({
      where: { id: videoClipId },
      data: { status: 'FAILED', error: err.message?.slice(0, 500) },
    });
    throw err;
  }
}

export const videoWorker = new Worker(
  'video-queue',
  async (job) => {
    if (job.name === 'analyze') {
      await handleAnalyze(job.data);
    } else if (job.name === 'clip') {
      await handleClip(job.data);
    }
  },
  { connection: redis, concurrency: 1 },
);
