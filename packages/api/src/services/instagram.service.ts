import { prisma } from '../config/database';
import { env } from '../config/env';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Detect which Instagram API endpoint to use based on token format.
 * - Tokens starting with "EAA" are Facebook Business tokens -> use graph.facebook.com
 * - Other tokens (typically starting with "IGAA") are Instagram Login tokens -> use graph.instagram.com
 *
 * Both APIs expose the same /media, /media_publish, and /{container-id} endpoints,
 * but they only accept their own token format.
 */
function getGraphBase(token: string): string {
  if (token.startsWith('EAA')) {
    return 'https://graph.facebook.com/v21.0';
  }
  return 'https://graph.instagram.com/v21.0';
}

/**
 * For IGAA tokens (Instagram Login API), the safest user identifier is the
 * literal string "me" - the API resolves it from the token itself, so we
 * don't need to worry about whether the stored igUserId is the correct one
 * (Facebook Page ID, IG Business Account ID, or IG App-scoped ID).
 *
 * For EAA tokens (Facebook Business), we must use the actual IG Business
 * Account ID linked to the Facebook Page.
 */
function resolveUserIdForToken(token: string, storedUserId: string): string {
  if (token.startsWith('EAA')) {
    return storedUserId; // Business token requires real IG Business Account ID
  }
  return 'me'; // Instagram Login token: use 'me' alias
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
  const base = getGraphBase(token);
  console.log(`[Instagram] Polling container ${containerId} via ${base}...`);
  let status = 'IN_PROGRESS';
  let attempts = 0;
  while (status !== 'FINISHED' && attempts < maxAttempts) {
    await sleep(intervalMs);
    // Request all useful fields - status_code is the simple state, status has detailed message
    const check = await fetch(
      `${base}/${containerId}?fields=status_code,status&access_token=${token}`,
    );
    const checkData = (await check.json()) as any;
    status = checkData.status_code;
    console.log(`[Instagram] Poll #${attempts + 1}: ${status} | full:`, JSON.stringify(checkData));
    if (status === 'ERROR') {
      const detail = checkData.status || JSON.stringify(checkData);
      throw new Error(`Media processing failed (Instagram error): ${detail}`);
    }
    if (status === 'EXPIRED') {
      throw new Error(`Media container expired before publish: ${JSON.stringify(checkData)}`);
    }
    attempts++;
  }
  if (status !== 'FINISHED') throw new Error(`Media processing timeout after ${(maxAttempts * intervalMs) / 1000}s`);
}

/**
 * Verify that a URL is publicly accessible (HEAD request, expects 200).
 * This catches problems early before sending to Instagram, which gives
 * cryptic ERROR responses when it can't fetch a media URL.
 */
async function verifyPublicUrl(url: string, label: string): Promise<void> {
  console.log(`[Instagram] Verifying ${label} URL is public: ${url}`);
  try {
    const res = await fetch(url, { method: 'HEAD' });
    console.log(`[Instagram] ${label} URL HEAD response: ${res.status} ${res.statusText}, content-type: ${res.headers.get('content-type')}, content-length: ${res.headers.get('content-length')}`);
    if (!res.ok) {
      throw new Error(`${label} URL not publicly accessible (HTTP ${res.status} ${res.statusText}). Instagram needs to download from this URL.`);
    }
  } catch (err: any) {
    if (err.message?.includes('not publicly accessible')) throw err;
    throw new Error(`${label} URL fetch failed: ${err.message}. Check that MinIO_PUBLIC_URL is reachable from the internet.`);
  }
}

async function publishContainer(containerId: string, token: string, igUserId: string) {
  const base = getGraphBase(token);
  const userPath = resolveUserIdForToken(token, igUserId);
  console.log(`[Instagram] Publishing media via ${base}/${userPath}...`);
  const publishRes = await fetch(`${base}/${userPath}/media_publish`, {
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
  const base = getGraphBase(token);
  const userPath = resolveUserIdForToken(token, igUserId);

  // Use query params in URL (official Meta docs approach) to avoid URLSearchParams encoding issues
  const qs = new URLSearchParams({
    image_url: publicUrl,
    is_carousel_item: 'true',
    media_type: 'IMAGE',
    access_token: token,
  });
  const url = `${base}/${userPath}/media?${qs.toString()}`;

  console.log(`[Instagram] Child container request URL (without token): ${url.replace(token, 'TOKEN_HIDDEN')}`);

  const res = await fetch(url, { method: 'POST' });
  const data = (await res.json()) as any;

  console.log(`[Instagram] Child container response:`, JSON.stringify(data));

  if (!data.id) {
    throw new Error(`Failed to create child container: ${JSON.stringify(data)}`);
  }

  return data.id;
}

async function publishSingleImage(imageUrl: string, caption: string, token: string, igUserId: string) {
  const publicImageUrl = await getPublicImageUrl(imageUrl);
  const base = getGraphBase(token);
  const userPath = resolveUserIdForToken(token, igUserId);

  console.log('[Instagram] Creating single image container...');
  console.log('[Instagram] Endpoint:', `${base}/${userPath}`);
  console.log('[Instagram] Stored User ID:', igUserId, '(using:', userPath, ')');
  console.log('[Instagram] Image URL:', publicImageUrl);

  // Verify that the image URL is publicly accessible BEFORE asking Instagram to download it
  await verifyPublicUrl(publicImageUrl, 'Image');

  const createData = await withRetry(async () => {
    const createRes = await fetch(`${base}/${userPath}/media`, {
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

  // Verify each carousel image URL is publicly accessible
  for (let i = 0; i < publicUrls.length; i++) {
    await verifyPublicUrl(publicUrls[i], `Carousel image ${i + 1}`);
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
  const base = getGraphBase(token);
  const userPath = resolveUserIdForToken(token, igUserId);
  console.log('[Instagram] Creating carousel container...');
  console.log('[Instagram] Endpoint:', `${base}/${userPath}`);
  console.log('[Instagram] Children IDs:', childContainerIds);

  const carouselData = await withRetry(async () => {
    const params = new URLSearchParams({
      media_type: 'CAROUSEL',
      children: childContainerIds.join(','),
      caption,
      access_token: token,
    });
    const carouselRes = await fetch(`${base}/${userPath}/media`, {
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

type VideoPublishMode = 'REELS' | 'STORIES' | 'FEED';

async function publishVideoMedia(
  videoUrl: string,
  caption: string,
  token: string,
  igUserId: string,
  mode: VideoPublishMode = 'REELS',
) {
  const base = getGraphBase(token);
  const userPath = resolveUserIdForToken(token, igUserId);
  console.log(`[Instagram] Publishing video as ${mode}...`);
  console.log('[Instagram] Endpoint:', `${base}/${userPath}`);
  console.log('[Instagram] Token type:', token.startsWith('EAA') ? 'EAA (Facebook Business)' : 'IGAA (Instagram Login)');
  console.log('[Instagram] Stored User ID:', igUserId, '(using:', userPath, ')');
  console.log('[Instagram] Video URL:', videoUrl);

  // Verify that the video URL is publicly accessible BEFORE asking Instagram to download it
  await verifyPublicUrl(videoUrl, 'Video');

  // Step 1: Create media container - params differ per mode
  const createData = await withRetry(async () => {
    const params = new URLSearchParams();
    params.append('access_token', token);
    params.append('video_url', videoUrl);

    if (mode === 'REELS') {
      params.append('media_type', 'REELS');
      if (caption) params.append('caption', caption);
    } else if (mode === 'STORIES') {
      params.append('media_type', 'STORIES');
      // Stories don't accept caption text via the API
    } else {
      // FEED video (deprecated by Instagram in favor of REELS, but still works)
      params.append('media_type', 'VIDEO');
      if (caption) params.append('caption', caption);
    }

    console.log('[Instagram] Create container params:', Array.from(params.keys()).join(', '));

    const createRes = await fetch(`${base}/${userPath}/media`, {
      method: 'POST',
      body: params,
    });
    const data = (await createRes.json()) as any;
    console.log(`[Instagram] Create ${mode} container response:`, JSON.stringify(data));
    if (!data.id) {
      throw new Error(`Failed to create ${mode} container: ${JSON.stringify(data)}`);
    }
    return data;
  }, `Create ${mode} container`);

  // Step 2: Poll for processing (videos take longer than images, ~30-90s)
  // 60 attempts x 5s = 300s (5min) max
  await pollContainerStatus(createData.id, token, 60, 5000);

  // Step 3: Publish
  return await publishContainer(createData.id, token, igUserId);
}

// Backwards-compat wrapper
async function publishReel(videoUrl: string, caption: string, token: string, igUserId: string) {
  return publishVideoMedia(videoUrl, caption, token, igUserId, 'REELS');
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

  // Video (Reels / Stories / Feed)
  if (post.mediaType === 'VIDEO') {
    if (!post.videoUrl) throw new Error('Video post has no videoUrl');
    // publishMode field defines where to post (defaults to REELS for videos)
    const mode = (post.publishMode === 'FEED' ? 'FEED' : post.publishMode === 'STORIES' ? 'STORIES' : 'REELS') as VideoPublishMode;
    return await publishVideoMedia(post.videoUrl, caption, token, igUserId, mode);
  }

  // Carousel or single image?
  if (post.isCarousel && post.images && post.images.length >= 2) {
    return await publishCarousel(post.images, caption, token, igUserId);
  } else {
    if (!post.imageUrl) throw new Error('Post has no image');
    return await publishSingleImage(post.imageUrl, caption, token, igUserId);
  }
}
