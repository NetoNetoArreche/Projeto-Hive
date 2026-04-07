import { prisma } from '../config/database';
import { env } from '../config/env';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Retry a function on transient Instagram API errors (code 2, is_transient: true).
 * Uses exponential backoff: 5s, 15s, 30s
 */
async function withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 3): Promise<T> {
  const delays = [5000, 15000, 30000];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isTransient = err.message?.includes('"is_transient":true') || err.message?.includes('"code":2');
      if (isTransient && attempt < maxRetries) {
        const delay = delays[attempt] || 30000;
        console.log(`[Instagram] ${label} transient error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${label} failed after ${maxRetries} retries`);
}

/**
 * If imageUrl is localhost (MinIO local), upload to a public host
 * so Instagram can download it.
 */
async function getPublicImageUrl(imageUrl: string): Promise<string> {
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\//.test(imageUrl);
  if (!isLocal) return imageUrl;

  console.log('[Instagram] Image is localhost, uploading to public host...');
  console.log('[Instagram] Local URL:', imageUrl);

  // Download from local MinIO
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download local image: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  // Upload to catbox.moe (free, no API key needed, 200MB limit)
  const formData = new FormData();
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  formData.append('reqtype', 'fileupload');
  formData.append('fileToUpload', blob, 'image.jpg');

  const uploadRes = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Catbox upload failed: ${uploadRes.status} ${errText}`);
  }

  const publicUrl = await uploadRes.text();
  if (!publicUrl.startsWith('http')) {
    throw new Error(`Catbox upload returned invalid URL: ${publicUrl}`);
  }

  console.log('[Instagram] Public URL:', publicUrl);
  return publicUrl;
}

async function pollContainerStatus(containerId: string, token: string, maxAttempts = 20, intervalMs = 3000) {
  console.log(`[Instagram] Polling container ${containerId}...`);
  let status = 'IN_PROGRESS';
  let attempts = 0;
  while (status !== 'FINISHED' && attempts < maxAttempts) {
    await sleep(intervalMs);
    const check = await fetch(
      `https://graph.instagram.com/v21.0/${containerId}?fields=status_code&access_token=${token}`,
    );
    const checkData = (await check.json()) as any;
    status = checkData.status_code;
    console.log(`[Instagram] Poll #${attempts + 1}: ${status}`);
    if (status === 'ERROR') {
      throw new Error(`Media processing failed: ${JSON.stringify(checkData)}`);
    }
    attempts++;
  }
  if (status !== 'FINISHED') throw new Error(`Media processing timeout after ${(maxAttempts * intervalMs) / 1000}s`);
}

async function publishContainer(containerId: string, token: string, igUserId: string) {
  console.log('[Instagram] Publishing media...');
  const publishRes = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: token,
    }),
  });
  const result = (await publishRes.json()) as any;

  console.log('[Instagram] Publish response:', JSON.stringify(result));

  if (!result.id) {
    throw new Error(`Failed to publish post: ${JSON.stringify(result)}`);
  }

  return { id: result.id };
}

async function createChildContainer(publicUrl: string, token: string, igUserId: string): Promise<string> {
  const res = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media`, {
    method: 'POST',
    body: new URLSearchParams({
      image_url: publicUrl,
      is_carousel_item: 'true',
      access_token: token,
    }),
  });
  const data = (await res.json()) as any;

  if (!data.id) {
    throw new Error(`Failed to create child container: ${JSON.stringify(data)}`);
  }

  return data.id;
}

async function publishSingleImage(imageUrl: string, caption: string, token: string, igUserId: string) {
  const publicImageUrl = await getPublicImageUrl(imageUrl);

  console.log('[Instagram] Creating single image container...');
  console.log('[Instagram] User ID:', igUserId);
  console.log('[Instagram] Image URL:', publicImageUrl);

  const createData = await withRetry(async () => {
    const createRes = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media`, {
      method: 'POST',
      body: new URLSearchParams({
        image_url: publicImageUrl,
        caption,
        access_token: token,
      }),
    });
    const data = (await createRes.json()) as any;
    console.log('[Instagram] Create container response:', JSON.stringify(data));
    if (!data.id) {
      throw new Error(`Failed to create media container: ${JSON.stringify(data)}`);
    }
    return data;
  }, 'Create single container');

  await pollContainerStatus(createData.id, token);
  return await publishContainer(createData.id, token, igUserId);
}

async function publishCarousel(
  images: Array<{ imageUrl: string }>,
  caption: string,
  token: string,
  igUserId: string,
) {
  console.log(`[Instagram] Creating carousel with ${images.length} images...`);

  // Step 1: Upload all images to public URLs first
  const publicUrls: string[] = [];
  for (const img of images) {
    const publicUrl = await getPublicImageUrl(img.imageUrl);
    publicUrls.push(publicUrl);
  }

  // Step 2: Create individual container for each image with retry
  const childContainerIds: string[] = [];

  for (let i = 0; i < publicUrls.length; i++) {
    const publicUrl = publicUrls[i];
    console.log(`[Instagram] Creating child container ${i + 1}/${publicUrls.length}: ${publicUrl}`);

    const childId = await withRetry(
      () => createChildContainer(publicUrl, token, igUserId),
      `Child container ${i + 1}`,
    );

    childContainerIds.push(childId);
    // Delay between child creations to avoid rate limiting (2s for carousels with many images)
    if (i < publicUrls.length - 1) {
      await sleep(2000);
    }
  }

  // Step 3: Poll all child containers until FINISHED
  for (const childId of childContainerIds) {
    await pollContainerStatus(childId, token);
  }

  // Step 4: Create carousel container (children must be comma-separated)
  console.log('[Instagram] Creating carousel container...');
  console.log('[Instagram] Children IDs:', childContainerIds);

  const carouselData = await withRetry(async () => {
    const params = new URLSearchParams({
      media_type: 'CAROUSEL',
      children: childContainerIds.join(','),
      caption,
      access_token: token,
    });
    const carouselRes = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media`, {
      method: 'POST',
      body: params,
    });
    const data = (await carouselRes.json()) as any;
    console.log('[Instagram] Carousel container response:', JSON.stringify(data));
    if (!data.id) {
      throw new Error(`Failed to create carousel container: ${JSON.stringify(data)}`);
    }
    return data;
  }, 'Carousel container');

  // Step 5: Poll carousel container
  await pollContainerStatus(carouselData.id, token);

  // Step 6: Publish
  return await publishContainer(carouselData.id, token, igUserId);
}

async function publishReel(videoUrl: string, caption: string, token: string, igUserId: string) {
  console.log('[Instagram] Creating Reels container...');
  console.log('[Instagram] User ID:', igUserId);
  console.log('[Instagram] Video URL:', videoUrl);

  // Step 1: Create media container with VIDEO/REELS
  const createData = await withRetry(async () => {
    const createRes = await fetch(`https://graph.instagram.com/v21.0/${igUserId}/media`, {
      method: 'POST',
      body: new URLSearchParams({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        access_token: token,
      }),
    });
    const data = (await createRes.json()) as any;
    console.log('[Instagram] Create Reels container response:', JSON.stringify(data));
    if (!data.id) {
      throw new Error(`Failed to create Reels container: ${JSON.stringify(data)}`);
    }
    return data;
  }, 'Create Reels container');

  // Step 2: Poll for processing (videos take longer than images, ~30-90s)
  // 40 attempts x 5s = 200s (3min 20s) max
  await pollContainerStatus(createData.id, token, 40, 5000);

  // Step 3: Publish
  return await publishContainer(createData.id, token, igUserId);
}

export async function publishToInstagram(postId: string, accountId?: string) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { images: { orderBy: { order: 'asc' } } },
  });

  // Try to get token from database first (supports multiple accounts)
  let token: string | undefined;
  let igUserId: string | undefined;

  if (accountId) {
    // Specific account requested
    const account = await prisma.instagramToken.findUnique({ where: { id: accountId } });
    if (account) { token = account.accessToken; igUserId = account.instagramUserId; }
  }

  if (!token) {
    // Try default account for this user
    const userId = post.userId;
    const defaultAccount = await prisma.instagramToken.findFirst({
      where: { userId, isDefault: true },
    });
    if (defaultAccount) { token = defaultAccount.accessToken; igUserId = defaultAccount.instagramUserId; }
  }

  if (!token) {
    // Try any account for this user
    const userId = post.userId;
    const anyAccount = await prisma.instagramToken.findFirst({ where: { userId } });
    if (anyAccount) { token = anyAccount.accessToken; igUserId = anyAccount.instagramUserId; }
  }

  if (!token) {
    // Fallback to env vars
    token = env.INSTAGRAM_ACCESS_TOKEN;
    igUserId = env.INSTAGRAM_USER_ID;
  }

  if (!token || !igUserId) {
    throw new Error('Instagram credentials not configured. Add an account in Settings.');
  }

  const caption = [post.caption, post.hashtags.map((h) => `#${h}`).join(' ')]
    .filter(Boolean)
    .join('\n\n');

  // Video (Reels)
  if (post.mediaType === 'VIDEO') {
    if (!post.videoUrl) throw new Error('Video post has no videoUrl');
    return await publishReel(post.videoUrl, caption, token, igUserId);
  }

  // Carousel or single image?
  if (post.isCarousel && post.images && post.images.length >= 2) {
    return await publishCarousel(post.images, caption, token, igUserId);
  } else {
    if (!post.imageUrl) throw new Error('Post has no image');
    return await publishSingleImage(post.imageUrl, caption, token, igUserId);
  }
}
