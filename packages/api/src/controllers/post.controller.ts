import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { schedulePost, cancelScheduledPost, publishQueue } from '../services/scheduler.service';
import { resolveOwnerId } from '../helpers/resolveOwnerId';

function paramId(req: AuthRequest): string {
  return req.params.id as string;
}

export async function createPost(req: AuthRequest, res: Response) {
  try {
    const userId = await resolveOwnerId(req.userId!);
    let { images, ...postData } = req.body;

    // Auto-detect comma-separated URLs in imageUrl (MCP clients may concatenate URLs)
    if (!images && postData.imageUrl && postData.imageUrl.includes(',http')) {
      const urls = postData.imageUrl.split(',').map((u: string) => u.trim()).filter(Boolean);
      if (urls.length >= 2) {
        images = urls.map((url: string, idx: number) => ({
          imageUrl: url,
          order: idx,
        }));
        postData.imageUrl = urls[0]; // keep first as cover
        console.log(`[createPost] Auto-converted ${urls.length} comma-separated URLs to carousel images`);
      }
    }

    const isCarousel = !!(images && images.length >= 2);

    const post = await prisma.post.create({
      data: {
        ...postData,
        userId,
        isCarousel,
        imageUrl: isCarousel ? images[0].imageUrl : postData.imageUrl,
        ...(isCarousel && {
          images: {
            create: images.map((img: any, idx: number) => ({
              imageUrl: img.imageUrl,
              minioKey: img.minioKey || null,
              order: img.order ?? idx,
              source: img.source || postData.imageSource || 'NANOBANA',
              prompt: img.prompt || null,
            })),
          },
        }),
      },
      include: { images: { orderBy: { order: 'asc' } } },
    });
    res.status(201).json({ success: true, data: post });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to create post' });
  }
}

export async function listPosts(req: AuthRequest, res: Response) {
  try {
    const status = req.query.status as string | undefined;
    const source = req.query.source as string | undefined;
    const page = Number(req.query.page) || 1;
    const take = Number(req.query.limit) || 20;
    const userId = await resolveOwnerId(req.userId!);
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    if (source) where.source = source;

    const skip = (page - 1) * take;
    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { images: { orderBy: { order: 'asc' } } },
      }),
      prisma.post.count({ where }),
    ]);

    // Auto-repair posts with comma-separated URLs in imageUrl but no PostImage records
    for (const post of items) {
      if (post.imageUrl && post.imageUrl.includes(',http') && (!post.images || post.images.length === 0)) {
        const urls = post.imageUrl.split(',').map((u: string) => u.trim()).filter(Boolean);
        if (urls.length >= 2) {
          try {
            await prisma.$transaction([
              ...urls.map((url: string, idx: number) =>
                prisma.postImage.create({
                  data: {
                    postId: post.id,
                    imageUrl: url,
                    order: idx,
                    source: post.imageSource || 'NANOBANA',
                  },
                })
              ),
              prisma.post.update({
                where: { id: post.id },
                data: { isCarousel: true, imageUrl: urls[0] },
              }),
            ]);
            // Update the in-memory post for this response
            post.isCarousel = true;
            post.imageUrl = urls[0];
            post.images = urls.map((url: string, idx: number) => ({
              id: `auto-${idx}`,
              imageUrl: url,
              order: idx,
              postId: post.id,
              source: post.imageSource || 'NANOBANA',
              prompt: null,
              minioKey: null,
              createdAt: post.createdAt,
            }));
            console.log(`[listPosts] Auto-repaired carousel post ${post.id} with ${urls.length} images`);
          } catch (repairErr) {
            console.error(`[listPosts] Failed to auto-repair post ${post.id}:`, repairErr);
          }
        }
      }
    }

    res.json({ success: true, data: { items, total, page, limit: take } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list posts' });
  }
}

export async function getPost(req: AuthRequest, res: Response) {
  try {
    const id = paramId(req);
    const userId = await resolveOwnerId(req.userId!);
    const post = await prisma.post.findFirst({
      where: { id, userId },
      include: { images: { orderBy: { order: 'asc' } } },
    });
    if (!post) { res.status(404).json({ success: false, error: 'Post not found' }); return; }
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get post' });
  }
}

export async function updatePost(req: AuthRequest, res: Response) {
  try {
    const id = paramId(req);
    const userId = await resolveOwnerId(req.userId!);
    const post = await prisma.post.updateMany({ where: { id, userId }, data: req.body });
    if (post.count === 0) { res.status(404).json({ success: false, error: 'Post not found' }); return; }
    const updated = await prisma.post.findUnique({ where: { id }, include: { images: { orderBy: { order: 'asc' } } } });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update post' });
  }
}

export async function deletePost(req: AuthRequest, res: Response) {
  try {
    const id = paramId(req);
    const userId = await resolveOwnerId(req.userId!);
    await cancelScheduledPost(id);
    const result = await prisma.post.deleteMany({ where: { id, userId } });
    if (result.count === 0) { res.status(404).json({ success: false, error: 'Post not found' }); return; }
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete post' });
  }
}

export async function publishPost(req: AuthRequest, res: Response) {
  try {
    const id = paramId(req);
    const accountId = (req.body?.accountId || req.query?.accountId || undefined) as string | undefined;
    await prisma.post.update({ where: { id }, data: { status: 'PUBLISHING' } });
    await publishQueue.add('publish', { postId: id, accountId }, { jobId: `publish-${id}-${Date.now()}` });
    res.json({ success: true, data: { status: 'PUBLISHING', message: 'Publicacao iniciada em background' } });
  } catch (err: any) {
    console.error('[Publish Error]', err?.message || err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to publish' });
  }
}

export async function schedulePostController(req: AuthRequest, res: Response) {
  try {
    const id = paramId(req);
    const { scheduledAt } = req.body;
    const date = new Date(scheduledAt);
    await schedulePost(id, date);
    const post = await prisma.post.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt: date },
    });
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to schedule post' });
  }
}

export async function addImageToPost(req: AuthRequest, res: Response) {
  try {
    const postId = paramId(req);
    const userId = await resolveOwnerId(req.userId!);
    const post = await prisma.post.findFirst({ where: { id: postId, userId } });
    if (!post) { res.status(404).json({ success: false, error: 'Post not found' }); return; }

    const imageCount = await prisma.postImage.count({ where: { postId } });
    if (imageCount >= 10) {
      res.status(400).json({ success: false, error: 'Maximo de 10 imagens por carrossel' });
      return;
    }

    const order = req.body.order ?? imageCount;

    const image = await prisma.postImage.create({
      data: {
        postId,
        imageUrl: req.body.imageUrl,
        minioKey: req.body.minioKey || null,
        order,
        source: req.body.source || 'NANOBANA',
        prompt: req.body.prompt || null,
      },
    });

    const newCount = imageCount + 1;
    if (newCount >= 2 && !post.isCarousel) {
      await prisma.post.update({ where: { id: postId }, data: { isCarousel: true } });
    }
    if (order === 0 || imageCount === 0) {
      await prisma.post.update({ where: { id: postId }, data: { imageUrl: req.body.imageUrl } });
    }

    res.status(201).json({ success: true, data: image });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to add image' });
  }
}

export async function removeImageFromPost(req: AuthRequest, res: Response) {
  try {
    const postId = paramId(req);
    const imageId = req.params.imageId as string;
    const userId = await resolveOwnerId(req.userId!);

    const post = await prisma.post.findFirst({ where: { id: postId, userId } });
    if (!post) { res.status(404).json({ success: false, error: 'Post not found' }); return; }

    const image = await prisma.postImage.findFirst({ where: { id: imageId, postId } });
    if (!image) { res.status(404).json({ success: false, error: 'Image not found' }); return; }

    await prisma.postImage.delete({ where: { id: imageId } });

    const remaining = await prisma.postImage.count({ where: { postId } });
    if (remaining < 2) {
      await prisma.post.update({ where: { id: postId }, data: { isCarousel: false } });
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to remove image' });
  }
}
