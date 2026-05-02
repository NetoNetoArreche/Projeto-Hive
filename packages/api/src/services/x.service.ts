import { prisma } from '../config/database';

const X_API = 'https://api.x.com/2';
const X_AUTH = 'https://api.x.com/2/oauth2';

async function getAccount(userId: string, accountId?: string) {
  if (accountId) {
    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (account && account.platform === 'X') return account;
  }

  const defaultAccount = await prisma.socialAccount.findFirst({
    where: { userId, platform: 'X', isDefault: true },
  });
  if (defaultAccount) return defaultAccount;

  return prisma.socialAccount.findFirst({ where: { userId, platform: 'X' } });
}

export function getXAuthUrl(clientId: string, redirectUri: string, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

export async function exchangeXCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${X_AUTH}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`X token exchange failed: ${data.error_description || data.error || JSON.stringify(data)}`);
  }

  console.log(`[X] Token exchanged, expires in ${data.expires_in}s`);
  return data as { access_token: string; refresh_token: string; expires_in: number };
}

export async function refreshXToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${X_AUTH}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`X token refresh failed: ${data.error_description || data.error || JSON.stringify(data)}`);
  }

  console.log(`[X] Token refreshed, expires in ${data.expires_in}s`);
  return data as { access_token: string; refresh_token: string; expires_in: number };
}

export async function publishToX(postId: string, accountId?: string) {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });

  const account = await getAccount(post.userId, accountId);
  if (!account) throw new Error('X/Twitter account not configured. Add one in Settings.');

  const { accessToken } = account;

  const parts = [post.caption, post.hashtags.map((h) => `#${h}`).join(' ')].filter(Boolean);
  let text = parts.join('\n\n');

  if (text.length > 280) {
    const truncateAt = 280 - 3;
    text = text.substring(0, truncateAt) + '...';
    console.log(`[X] Caption truncated from ${parts.join('\n\n').length} to 280 chars`);
  }

  console.log(`[X] Posting tweet (${text.length} chars): ${text.substring(0, 60)}...`);

  const res = await fetch(`${X_API}/tweets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text }),
  });

  const data = await res.json() as { data?: { id: string; text: string }; errors?: Array<{ message: string }> };
  console.log('[X] Tweet response:', JSON.stringify(data));

  if (!data.data?.id) {
    const errMsg = data.errors?.map((e) => e.message).join('; ') || JSON.stringify(data);
    throw new Error(`X tweet failed: ${errMsg}`);
  }

  return { id: data.data.id };
}
