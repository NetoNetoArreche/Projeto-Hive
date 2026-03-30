import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  analyzeVideo,
  getVideoClip,
  listVideoClips,
  cutClips,
  deleteVideoClip,
} from '../controllers/video.controller';
import { prisma } from '../config/database';
import { resolveOwnerId } from '../helpers/resolveOwnerId';
import { queueAnalysis } from '../services/video.service';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const router = Router();

const analyzeSchema = z.object({
  url: z.string().url(),
  whisperModel: z.enum(['tiny', 'base', 'small', 'medium', 'large']).optional().default('tiny'),
  maxMoments: z.number().int().min(1).max(50).optional().default(10),
  language: z.string().max(5).optional(),
});

const cutSchema = z.object({
  clips: z.array(z.object({
    start: z.number(),
    end: z.number(),
    title: z.string().optional(),
  })).min(1),
  format: z.enum(['vertical', 'square', 'horizontal']).optional().default('vertical'),
  burnSubs: z.boolean().optional().default(false),
  whisperModel: z.enum(['tiny', 'base', 'small', 'medium', 'large']).optional().default('tiny'),
  language: z.string().max(5).optional(),
});

router.use(authMiddleware);

router.post('/', validate(analyzeSchema), analyzeVideo);
router.get('/', listVideoClips);
router.get('/:id', getVideoClip);
router.post('/:id/cut', validate(cutSchema), cutClips);
router.delete('/:id', deleteVideoClip);

// Upload video file directly (no YouTube needed)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(os.tmpdir(), 'instapost-uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage: diskStorage, limits: { fileSize: 500 * 1024 * 1024 } });
router.post('/upload', upload.single('video'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No video file uploaded' });
      return;
    }

    const userId = await resolveOwnerId(req.userId!);
    const title = (req.body?.title as string) || req.file.originalname || 'Uploaded video';

    const videoClip = await prisma.videoClip.create({
      data: { sourceUrl: 'upload://' + req.file.originalname, title, userId },
    });

    // Move uploaded file to work directory
    const workDir = path.join(os.tmpdir(), 'instapost-videos', videoClip.id);
    fs.mkdirSync(workDir, { recursive: true });
    const videoPath = path.join(workDir, 'video.mp4');
    fs.renameSync(req.file.path, videoPath);

    // Update workDir in DB
    await prisma.videoClip.update({ where: { id: videoClip.id }, data: { workDir } });

    // Queue analysis (will skip download since video.mp4 already exists)
    await queueAnalysis(videoClip.id, {
      whisperModel: (req.body?.whisperModel as string) || 'tiny',
      maxMoments: parseInt(req.body?.maxMoments as string) || 10,
      language: req.body?.language as string,
    });

    res.json({
      success: true,
      data: { id: videoClip.id, status: 'PENDING', message: 'Video enviado, analise iniciada' },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

export default router;
