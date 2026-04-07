import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { prisma } from '../config/database';
import { publishToInstagram } from '../services/instagram.service';
import { deleteObject } from '../services/storage.service';

export const publishWorker = new Worker(
  'publish-queue',
  async (job) => {
    const { postId, accountId } = job.data;

    await prisma.post.update({
      where: { id: postId },
      data: { status: 'PUBLISHING' },
    });

    try {
      const result = await publishToInstagram(postId, accountId);
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'PUBLISHED', publishedAt: new Date(), instagramId: result.id },
      });

      // Auto-cleanup video from MinIO after successful publish (unless keepMedia=true)
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { mediaType: true, videoMinioKey: true, keepMedia: true },
      });
      if (post?.mediaType === 'VIDEO' && post.videoMinioKey && !post.keepMedia) {
        try {
          await deleteObject(post.videoMinioKey);
          await prisma.post.update({
            where: { id: postId },
            data: { videoUrl: null, videoMinioKey: null },
          });
          console.log(`[publish.worker] Deleted video from MinIO: ${post.videoMinioKey}`);
        } catch (cleanupErr) {
          console.error(`[publish.worker] Failed to cleanup video for post ${postId}:`, cleanupErr);
          // Don't fail the job - the post was already published
        }
      }
    } catch (error) {
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  },
  {
    connection: redis,
    limiter: { max: 10, duration: 60000 },
  },
);
