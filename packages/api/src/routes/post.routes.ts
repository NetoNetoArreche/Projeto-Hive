import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  createPost,
  listPosts,
  getPost,
  updatePost,
  deletePost,
  publishPost,
  schedulePostController,
  addImageToPost,
  removeImageFromPost,
} from '../controllers/post.controller';

const router = Router();

const postImageSchema = z.object({
  imageUrl: z.string().url(),
  minioKey: z.string().optional(),
  order: z.number().int().min(0).max(9).optional(),
  source: z.enum(['NANOBANA', 'UPLOAD', 'URL']).optional(),
  prompt: z.string().optional(),
});

const createPostSchema = z.object({
  caption: z.string().max(2200).optional(),
  imageUrl: z.string().optional(), // Allow comma-separated URLs from MCP clients
  imageSource: z.enum(['NANOBANA', 'UPLOAD', 'URL']).optional(),
  nanoPrompt: z.string().optional(),
  source: z.enum(['WEB', 'TELEGRAM', 'MCP']).optional(),
  hashtags: z.array(z.string()).optional(),
  aspectRatio: z.string().optional(),
  isCarousel: z.boolean().optional(),
  images: z.array(postImageSchema).min(2).max(10).optional(),
  // Video fields
  mediaType: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL']).optional(),
  videoUrl: z.string().url().optional(),
  videoMinioKey: z.string().optional(),
  videoDurationSec: z.number().int().optional(),
  videoSizeBytes: z.number().int().optional(),
  keepMedia: z.boolean().optional(),
});

const scheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
});

const addImageSchema = z.object({
  imageUrl: z.string().url(),
  minioKey: z.string().optional(),
  order: z.number().int().min(0).max(9).optional(),
  source: z.enum(['NANOBANA', 'UPLOAD', 'URL']).optional(),
  prompt: z.string().optional(),
});

router.use(authMiddleware);

router.post('/', validate(createPostSchema), createPost);
router.get('/', listPosts);
router.get('/:id', getPost);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);
router.post('/:id/publish', publishPost);
router.post('/:id/schedule', validate(scheduleSchema), schedulePostController);
router.post('/:id/images', validate(addImageSchema), addImageToPost);
router.delete('/:id/images/:imageId', removeImageFromPost);

export default router;
