import { publishToInstagram } from './instagram.service';
import { publishToFacebook } from './facebook.service';
import { publishToLinkedIn } from './linkedin.service';
import { publishToX } from './x.service';
import { adaptCaptionForPlatforms } from './caption-adapter';
import { prisma } from '../config/database';
import type { SocialPlatform } from '@prisma/client';

type PublishResult = { id: string };
type PublisherFn = (postId: string, accountId?: string) => Promise<PublishResult>;

const PUBLISHERS: Record<SocialPlatform, PublisherFn> = {
  INSTAGRAM: publishToInstagram,
  FACEBOOK: publishToFacebook,
  LINKEDIN: publishToLinkedIn,
  X: publishToX,
};

export async function publishToPlatforms(
  postId: string,
  platforms: SocialPlatform[],
  accountId?: string,
): Promise<Record<string, { id?: string; error?: string }>> {
  const results: Record<string, { id?: string; error?: string }> = {};

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error('Post not found');

  const brand = post.brandId ? await prisma.brand.findUnique({ where: { id: post.brandId } }) : null;
  const originalCaption = post.caption || '';

  const adapted = adaptCaptionForPlatforms(originalCaption, platforms, brand);
  const captionMap = new Map(adapted.map((c) => [c.platform, c.caption]));

  for (const platform of platforms) {
    const publisher = PUBLISHERS[platform];
    if (!publisher) {
      console.warn(`[SocialPublisher] No publisher for platform: ${platform}`);
      results[platform] = { error: `No publisher for ${platform}` };
      continue;
    }

    let captionChanged = false;
    try {
      const adaptedCaption = captionMap.get(platform);
      if (adaptedCaption && adaptedCaption !== originalCaption) {
        await prisma.post.update({
          where: { id: postId },
          data: { caption: adaptedCaption },
        });
        captionChanged = true;
      }

      console.log(`[SocialPublisher] Publishing to ${platform}...`);
      const result = await publisher(postId, accountId);
      results[platform] = { id: result.id };
      console.log(`[SocialPublisher] ${platform} published: ${result.id}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[SocialPublisher] ${platform} failed: ${errorMsg}`);
      results[platform] = { error: errorMsg.slice(0, 1000) };
    } finally {
      if (captionChanged) {
        await prisma.post.update({
          where: { id: postId },
          data: { caption: originalCaption },
        }).catch(() => {});
      }
    }
  }

  return results;
}
