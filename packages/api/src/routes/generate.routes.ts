import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { generateImageController, generateCaptionController } from '../controllers/generate.controller';
import { renderTemplateToImage, renderHtmlToImage } from '../services/template-renderer.service';
import { TEMPLATES } from '../services/templates';

const router = Router();

const imageSchema = z.object({
  prompt: z.string().min(1),
  style: z.string().optional(),
  aspectRatio: z.enum(['1:1', '9:16', '4:5']).optional(),
});

const captionSchema = z.object({
  topic: z.string().min(1),
  tone: z.enum(['educativo', 'inspirador', 'humor', 'noticia']).optional(),
  hashtagsCount: z.number().min(1).max(30).optional(),
  language: z.string().optional(),
  maxLength: z.number().max(2200).optional(),
});

router.use(authMiddleware);

router.post('/image', validate(imageSchema), generateImageController);
router.post('/caption', validate(captionSchema), generateCaptionController);

// Template-based image generation (no AI needed)
const templateSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  accent: z.string().optional(),
  template: z.string().optional().default('bold-gradient'),
  aspectRatio: z.enum(['1:1', '9:16', '4:5']).optional(),
});

router.post('/template', validate(templateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await renderTemplateToImage(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to render template' });
  }
});

// List available templates
router.get('/templates', (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: TEMPLATES });
});

// Render raw HTML/CSS/Tailwind to image (used by MCP from IDEs)
const htmlSchema = z.object({
  html: z.string().min(1),
  width: z.number().optional().default(1080),
  height: z.number().optional().default(1080),
});

router.post('/html', validate(htmlSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { html, width, height } = req.body;
    const result = await renderHtmlToImage(html, width, height);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to render HTML' });
  }
});

export default router;
