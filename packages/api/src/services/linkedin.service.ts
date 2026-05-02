import { prisma } from '../config/database';
import { ensureMetaCompatibleUrl } from './instagram.service';

const LINKEDIN_API = 'https://api.linkedin.com/v2';
const LINKEDIN_AUTH = 'https://www.linkedin.com/oauth/v2';

const LINKEDIN_HEADERS = {
  'Content-Type': 'application/json',
  'X-Restli-Protocol-Version': '2.0.0',
};

async function getAccount(userId: string, accountId?: string) {
  if (accountId) {
    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (account && account.platform === 'LINKEDIN') return account;
  }

  const defaultAccount = await prisma.socialAccount.findFirst({
    where: { userId, platform: 'LINKEDIN', isDefault: true },
  });
  if (defaultAccount) return defaultAccount;

  return prisma.socialAccount.findFirst({ where: { userId, platform: 'LINKEDIN' } });
}

export function getLinkedInAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile w_member_social',
    state,
  });
  return `${LINKEDIN_AUTH}/authorization?${params.toString()}`;
}

export async function exchangeLinkedInCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(`${LINKEDIN_AUTH}/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`LinkedIn token exchange failed: ${data.error_description || data.error || JSON.stringify(data)}`);
  }

  console.log(`[LinkedIn] Token exchanged successfully, expires in ${data.expires_in}s`);
  return data as { access_token: string; refresh_token: string; expires_in: number };
}

export async function refreshLinkedInToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(`${LINKEDIN_AUTH}/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`LinkedIn token refresh failed: ${data.error_description || data.error || JSON.stringify(data)}`);
  }

  console.log(`[LinkedIn] Token refreshed, expires in ${data.expires_in}s`);
  return data as { access_token: string; refresh_token: string; expires_in: number };
}

async function getPersonId(token: string): Promise<string> {
  // Try OpenID Connect /userinfo endpoint (works with w_member_social scope)
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as { sub?: string; error?: string; error_description?: string };
  if (data.sub) {
    return data.sub;
  }
  // Fallback to /v2/me (requires r_liteprofile)
  const meRes = await fetch(`${LINKEDIN_API}/me`, {
    headers: { ...LINKEDIN_HEADERS, Authorization: `Bearer ${token}` },
  });
  const meData = await meRes.json() as { id?: string; error?: { message: string } };
  if (!meData.id) {
    throw new Error(`Failed to get LinkedIn profile: ${meData.error?.message || data.error_description || JSON.stringify(data)}`);
  }
  return meData.id;
}

async function uploadImage(token: string, imageUrl: string): Promise<string> {
  console.log('[LinkedIn] Uploading image...');

  const cdnUrl = await ensureMetaCompatibleUrl(imageUrl);
  const imgRes = await fetch(cdnUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

  // Step 1: Register upload
  const registerRes = await fetch(`${LINKEDIN_API}/assets?action=registerUpload`, {
    method: 'POST',
    headers: { ...LINKEDIN_HEADERS, Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: 'urn:li:person:PLACEHOLDER',
        serviceRelationships: [{
          relationshipType: 'MEMBER',
          identifier: 'urn:li:userGeneratedContent',
        }],
      },
    }),
  });

  const registerData = await registerRes.json() as {
    value?: {
      asset?: string;
      uploadMechanism?: { ['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?: { uploadUrl?: string; headers?: Record<string, string> } };
    };
    error?: { message: string };
  };

  const asset = registerData.value?.asset;
  const uploadUrl = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;

  if (!asset || !uploadUrl) {
    throw new Error(`LinkedIn image register failed: ${registerData.error?.message || JSON.stringify(registerData)}`);
  }

  console.log(`[LinkedIn] Asset: ${asset}, uploading to ${uploadUrl.substring(0, 80)}...`);

  // Step 2: Upload binary
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      ...(registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.headers || {}),
    },
    body: imgBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`LinkedIn image upload failed: ${uploadRes.status} ${errText}`);
  }

  console.log(`[LinkedIn] Image uploaded: ${asset}`);
  return asset;
}

async function publishTextPost(token: string, personUrn: string, caption: string) {
  console.log('[LinkedIn] Publishing text post...');

  const res = await fetch(`${LINKEDIN_API}/ugcPosts`, {
    method: 'POST',
    headers: { ...LINKEDIN_HEADERS, Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      author: `urn:li:person:${personUrn}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: caption },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };
  console.log('[LinkedIn] Text post response:', JSON.stringify(data));

  if (!data.id) {
    throw new Error(`LinkedIn text post failed: ${data.error?.message || JSON.stringify(data)}`);
  }

  return { id: data.id };
}

async function publishImagePost(token: string, personUrn: string, caption: string, assetUrn: string) {
  console.log('[LinkedIn] Publishing image post...');

  const res = await fetch(`${LINKEDIN_API}/ugcPosts`, {
    method: 'POST',
    headers: { ...LINKEDIN_HEADERS, Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      author: `urn:li:person:${personUrn}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: caption },
          shareMediaCategory: 'IMAGE',
          media: [{
            status: 'READY',
            media: assetUrn,
            title: { text: caption.substring(0, 200) },
          }],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };
  console.log('[LinkedIn] Image post response:', JSON.stringify(data));

  if (!data.id) {
    throw new Error(`LinkedIn image post failed: ${data.error?.message || JSON.stringify(data)}`);
  }

  return { id: data.id };
}

export async function publishToLinkedIn(postId: string, accountId?: string) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { images: { orderBy: { order: 'asc' } } },
  });

  const account = await getAccount(post.userId, accountId);
  if (!account) throw new Error('LinkedIn account not configured. Add one in Settings.');

  const { accessToken, platformUserId } = account;
  const personUrn = platformUserId || await getPersonId(accessToken);

  const caption = [post.caption, post.hashtags.map((h) => `#${h}`).join(' ')]
    .filter(Boolean)
    .join('\n\n');

  // Text-only post (no image or explicit text mode)
  if (!post.imageUrl && !post.isCarousel) {
    return publishTextPost(accessToken, personUrn, caption);
  }

  // Image post (single image)
  if (post.imageUrl && !post.isCarousel) {
    const assetUrn = await uploadImage(accessToken, post.imageUrl);
    return publishImagePost(accessToken, personUrn, caption, assetUrn);
  }

  // Carousel — upload first image as LinkedIn doesn't support native carousels via personal profile API
  // Use first image as the post image
  if (post.images && post.images.length > 0) {
    const assetUrn = await uploadImage(accessToken, post.images[0].imageUrl);
    return publishImagePost(accessToken, personUrn, caption, assetUrn);
  }

  return publishTextPost(accessToken, personUrn, caption);
}
