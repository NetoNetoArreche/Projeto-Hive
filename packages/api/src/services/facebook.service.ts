import { prisma } from '../config/database';
import { ensureMetaCompatibleUrl, verifyPublicUrl } from './instagram.service';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

async function getAccount(userId: string, accountId?: string, brandId?: string) {
  if (accountId) {
    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (account && account.platform === 'FACEBOOK') return account;
  }

  if (brandId) {
    const brandAccount = await prisma.socialAccount.findFirst({
      where: { userId, platform: 'FACEBOOK', brandId },
    });
    if (brandAccount) return brandAccount;
  }

  const defaultAccount = await prisma.socialAccount.findFirst({
    where: { userId, platform: 'FACEBOOK', isDefault: true },
  });
  if (defaultAccount) return defaultAccount;

  return prisma.socialAccount.findFirst({ where: { userId, platform: 'FACEBOOK' } });
}

async function publishSingleImage(pageId: string, imageUrl: string, caption: string, token: string) {
  const cdnUrl = await ensureMetaCompatibleUrl(imageUrl);
  await verifyPublicUrl(cdnUrl, 'Facebook image');

  console.log(`[Facebook] Publishing single image to page ${pageId}`);

  const res = await fetch(`${GRAPH_BASE}/${pageId}/photos`, {
    method: 'POST',
    body: new URLSearchParams({
      message: caption,
      url: cdnUrl,
      access_token: token,
    }),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };
  console.log('[Facebook] Single image response:', JSON.stringify(data));

  if (!data.id) {
    throw new Error(`Facebook single image failed: ${data.error?.message || JSON.stringify(data)}`);
  }

  return { id: data.id };
}

async function publishCarousel(pageId: string, images: Array<{ imageUrl: string }>, caption: string, token: string) {
  console.log(`[Facebook] Publishing carousel with ${images.length} images to page ${pageId}`);

  const unpublishedIds: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const cdnUrl = await ensureMetaCompatibleUrl(images[i].imageUrl);
    await verifyPublicUrl(cdnUrl, `Carousel image ${i + 1}`);

    const res = await fetch(`${GRAPH_BASE}/${pageId}/photos`, {
      method: 'POST',
      body: new URLSearchParams({
        published: 'false',
        url: cdnUrl,
        access_token: token,
      }),
    });

    const data = await res.json() as { id?: string; error?: { message: string } };
    console.log(`[Facebook] Unpublished photo ${i + 1}/${images.length}:`, JSON.stringify(data));

    if (!data.id) {
      throw new Error(`Facebook carousel upload failed for image ${i + 1}: ${data.error?.message || JSON.stringify(data)}`);
    }

    unpublishedIds.push(data.id);
  }

  const params = new URLSearchParams();
  params.append('message', caption);
  params.append('access_token', token);

  unpublishedIds.forEach((fbId, idx) => {
    params.append(`attached_media[${idx}]`, JSON.stringify({ media_fbid: fbId }));
  });

  const postRes = await fetch(`${GRAPH_BASE}/${pageId}/feed`, {
    method: 'POST',
    body: params,
  });

  const postData = await postRes.json() as { id?: string; error?: { message: string } };
  console.log('[Facebook] Carousel post response:', JSON.stringify(postData));

  if (!postData.id) {
    throw new Error(`Facebook carousel post failed: ${postData.error?.message || JSON.stringify(postData)}`);
  }

  return { id: postData.id };
}

async function publishVideo(pageId: string, videoUrl: string, caption: string, token: string) {
  await verifyPublicUrl(videoUrl, 'Facebook video');

  console.log(`[Facebook] Publishing video to page ${pageId}`);

  const res = await fetch(`${GRAPH_BASE}/${pageId}/videos`, {
    method: 'POST',
    body: new URLSearchParams({
      description: caption,
      file_url: videoUrl,
      access_token: token,
    }),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };
  console.log('[Facebook] Video response:', JSON.stringify(data));

  if (!data.id) {
    throw new Error(`Facebook video upload failed: ${data.error?.message || JSON.stringify(data)}`);
  }

  return { id: data.id };
}

export async function publishToFacebook(postId: string, accountId?: string) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { images: { orderBy: { order: 'asc' } } },
  });

  const account = await getAccount(post.userId, accountId, post.brandId ?? undefined);
  if (!account) throw new Error('Facebook account not configured. Add one in Settings.');

  const { accessToken, platformUserId: pageId } = account;
  if (!pageId) throw new Error('Facebook account missing Page ID.');

  const caption = [post.caption, post.hashtags.map((h) => `#${h}`).join(' ')]
    .filter(Boolean)
    .join('\n\n');

  if (post.mediaType === 'VIDEO') {
    if (!post.videoUrl) throw new Error('Video post has no videoUrl');
    return publishVideo(pageId, post.videoUrl, caption, accessToken);
  }

  if (post.isCarousel && post.images && post.images.length >= 2) {
    return publishCarousel(pageId, post.images, caption, accessToken);
  }

  if (!post.imageUrl) throw new Error('Post has no image');
  return publishSingleImage(pageId, post.imageUrl, caption, accessToken);
}
