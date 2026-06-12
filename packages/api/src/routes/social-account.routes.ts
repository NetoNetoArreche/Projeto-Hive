import { Router } from 'express';
import { z } from 'zod';
import { Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { prisma } from '../config/database';
import { resolveOwnerId } from '../helpers/resolveOwnerId';
import { env } from '../config/env';
import { getLinkedInAuthUrl, exchangeLinkedInCode } from '../services/linkedin.service';
import { getXAuthUrl, exchangeXCode } from '../services/x.service';
import crypto from 'crypto';

const API_BASE = process.env.API_BASE_URL || `http://localhost:${env.PORT}`;
const X_CALLBACK_BASE = process.env.X_TUNNEL_URL || API_BASE;
const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

const router = Router();

// ============================================================
// PUBLIC ROUTES — OAuth callbacks (no auth required)
// These are reached via browser redirect from LinkedIn/X,
// which does NOT include an Authorization header.
// ============================================================

// Helper: parse userId from state (format: "userId:randomHex" or "userId:codeVerifier:randomHex")
function parseState(state: string): { userId: string; codeVerifier?: string } {
  const parts = state.split(':');
  if (parts.length < 2) throw new Error('Invalid state parameter');
  const userId = parts[0];
  const codeVerifier = parts.length === 3 ? parts[1] : undefined;
  return { userId, codeVerifier };
}

const SUCCESS_HTML = '<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#fff"><div style="text-align:center"><h2 style="color:#22c55e">✅ Conta conectada com sucesso!</h2><p style="color:#999">Você pode fechar esta aba.</p><script>window.close()</script></div></body></html>';

const ERROR_HTML = (msg: string) => `<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#fff"><div style="text-align:center"><h2 style="color:#ef4444">❌ Erro ao conectar</h2><p style="color:#999">${msg}</p></div></body></html>`;

// GET /api/social-accounts/linkedin/callback — LinkedIn OAuth callback (PUBLIC)
router.get('/linkedin/callback', async (req, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query as Record<string, string>;
    if (error) {
      console.error('[LinkedIn] OAuth error:', error, error_description);
      res.status(400).send(ERROR_HTML(`${error}: ${error_description || 'Authorization denied'}`));
      return;
    }
    if (!code || !state) { res.status(400).send(ERROR_HTML('Missing authorization code')); return; }

    const { userId } = parseState(state);
    const ownerId = await resolveOwnerId(userId);

    const clientIdSetting = await prisma.setting.findUnique({ where: { userId_key: { userId: ownerId, key: 'LINKEDIN_CLIENT_ID' } } });
    const clientSecretSetting = await prisma.setting.findUnique({ where: { userId_key: { userId: ownerId, key: 'LINKEDIN_CLIENT_SECRET' } } });

    const clientId = clientIdSetting?.value;
    const clientSecret = clientSecretSetting?.value;
    if (!clientId || !clientSecret) { res.status(400).send(ERROR_HTML('LinkedIn credentials not configured')); return; }

    const redirectUri = `${API_BASE}/api/social-accounts/linkedin/callback`;
    console.log('[LinkedIn] Callback redirect_uri:', redirectUri);
    const tokens = await exchangeLinkedInCode(code, clientId, clientSecret, redirectUri);

    // Try OpenID Connect /userinfo first (for openid profile scopes)
    let personId = 'unknown';
    let displayName = '';
    try {
      const oidcRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (oidcRes.ok) {
        const oidcProfile = await oidcRes.json() as { sub?: string; name?: string; given_name?: string; family_name?: string; email?: string };
        personId = oidcProfile.sub || 'unknown';
        displayName = oidcProfile.name || [oidcProfile.given_name, oidcProfile.family_name].filter(Boolean).join(' ');
        console.log(`[LinkedIn] OpenID Connect profile: sub=${personId}, name=${displayName}`);
      } else {
        console.warn('[LinkedIn] OpenID Connect failed, trying v2/me fallback');
        const profileRes = await fetch('https://api.linkedin.com/v2/me', {
          headers: { Authorization: `Bearer ${tokens.access_token}`, 'X-Restli-Protocol-Version': '2.0.0' },
        });
        const profile = await profileRes.json() as { id?: string; localizedFirstName?: string; localizedLastName?: string };
        personId = profile.id || 'unknown';
        displayName = [profile.localizedFirstName, profile.localizedLastName].filter(Boolean).join(' ');
      }
    } catch (profileErr: any) {
      console.warn('[LinkedIn] Profile fetch failed:', profileErr.message);
    }

    const existing = await prisma.socialAccount.findFirst({ where: { userId: ownerId, platform: 'LINKEDIN', platformUserId: personId } });

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          displayName,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          refreshedAt: new Date(),
        },
      });
    } else {
      const count = await prisma.socialAccount.count({ where: { userId: ownerId, platform: 'LINKEDIN' } });
      await prisma.socialAccount.create({
        data: {
          platform: 'LINKEDIN',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          platformUserId: personId,
          displayName,
          isDefault: count === 0,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          userId: ownerId,
        },
      });
    }

    console.log(`[LinkedIn] Account saved for user ${ownerId}, person ${personId}`);
    res.send(SUCCESS_HTML);
  } catch (err: any) {
    console.error('[LinkedIn] Callback error:', err.message);
    res.status(500).send(ERROR_HTML(err.message));
  }
});

// GET /api/social-accounts/x/callback — X OAuth 2.0 callback (PUBLIC)
router.get('/x/callback', async (req, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query as Record<string, string>;
    if (error) {
      console.error('[X] OAuth error:', error, error_description);
      res.status(400).send(ERROR_HTML(`${error}: ${error_description || 'Authorization denied'}`));
      return;
    }
    if (!code || !state) { res.status(400).send(ERROR_HTML('Missing authorization code')); return; }

    const { userId, codeVerifier } = parseState(state);
    if (!codeVerifier) { res.status(400).send(ERROR_HTML('Missing code verifier in state')); return; }

    const ownerId = await resolveOwnerId(userId);

    const clientIdSetting = await prisma.setting.findUnique({ where: { userId_key: { userId: ownerId, key: 'X_CLIENT_ID' } } });
    const clientSecretSetting = await prisma.setting.findUnique({ where: { userId_key: { userId: ownerId, key: 'X_CLIENT_SECRET' } } });

    const clientId = clientIdSetting?.value;
    const clientSecret = clientSecretSetting?.value;
    if (!clientId || !clientSecret) { res.status(400).send(ERROR_HTML('X credentials not configured')); return; }

    const redirectUri = `${X_CALLBACK_BASE}/api/social-accounts/x/callback`;
    console.log('[X] Callback redirect_uri:', redirectUri);
    const tokens = await exchangeXCode(code, clientId, clientSecret, redirectUri, codeVerifier);

    const userRes = await fetch('https://api.x.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userData = await userRes.json() as { data?: { id: string; username: string; name: string } };
    const xUserId = userData.data?.id || 'unknown';
    const xUsername = userData.data?.username;
    const xDisplayName = userData.data?.name;

    const existing = await prisma.socialAccount.findFirst({ where: { userId: ownerId, platform: 'X', platformUserId: xUserId } });

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          username: xUsername,
          displayName: xDisplayName,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          refreshedAt: new Date(),
        },
      });
    } else {
      const count = await prisma.socialAccount.count({ where: { userId: ownerId, platform: 'X' } });
      await prisma.socialAccount.create({
        data: {
          platform: 'X',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          platformUserId: xUserId,
          username: xUsername,
          displayName: xDisplayName,
          isDefault: count === 0,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          userId: ownerId,
        },
      });
    }

    console.log(`[X] Account saved for user ${ownerId}, @${xUsername}`);
    res.send(SUCCESS_HTML);
  } catch (err: any) {
    console.error('[X] Callback error:', err.message);
    res.status(500).send(ERROR_HTML(err.message));
  }
});

// ============================================================
// AUTHENTICATED ROUTES — require Bearer token
// ============================================================
router.use(authMiddleware);

// GET /api/social-accounts — list all social accounts
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = await resolveOwnerId(req.userId!);
    const accounts = await prisma.socialAccount.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        username: true,
        displayName: true,
        isDefault: true,
        expiresAt: true,
        refreshedAt: true,
        brandId: true,
      },
      orderBy: [{ platform: 'asc' }, { refreshedAt: 'desc' }],
    });
    res.json({ success: true, data: accounts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

const addAccountSchema = z.object({
  platform: z.enum(['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X']),
  accessToken: z.string().min(10),
  refreshToken: z.string().optional(),
  platformUserId: z.string().min(1),
  username: z.string().optional(),
  displayName: z.string().optional(),
  pageId: z.string().optional(),
  expiresAt: z.string().optional(),
});

// POST /api/social-accounts — add or update a social account
router.post('/', validate(addAccountSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = await resolveOwnerId(req.userId!);
    const { platform, accessToken, refreshToken, platformUserId, username, displayName, pageId, expiresAt } = req.body;

    const existing = await prisma.socialAccount.findFirst({
      where: { userId, platform, platformUserId },
    });

    if (existing) {
      const updated = await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accessToken,
          refreshToken: refreshToken || existing.refreshToken,
          username: username || existing.username,
          displayName: displayName || existing.displayName,
          pageId: pageId || existing.pageId,
          expiresAt: expiresAt ? new Date(expiresAt) : existing.expiresAt,
          refreshedAt: new Date(),
        },
      });
      res.json({ success: true, data: { id: updated.id, platform, updated: true } });
      return;
    }

    const count = await prisma.socialAccount.count({ where: { userId, platform } });
    const account = await prisma.socialAccount.create({
      data: {
        platform,
        accessToken,
        refreshToken,
        platformUserId,
        username,
        displayName,
        pageId,
        isDefault: count === 0,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        userId,
      },
    });

    res.json({ success: true, data: { id: account.id, platform, isDefault: account.isDefault } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// PUT /api/social-accounts/:id/default — set as default for its platform
router.put('/:id/default', async (req: AuthRequest, res: Response) => {
  try {
    const userId = await resolveOwnerId(req.userId!);
    const { id } = req.params;

    const account = await prisma.socialAccount.findFirst({ where: { id, userId } });
    if (!account) { res.status(404).json({ success: false, error: 'Account not found' }); return; }

    await prisma.socialAccount.updateMany({
      where: { userId, platform: account.platform },
      data: { isDefault: false },
    });

    await prisma.socialAccount.update({
      where: { id },
      data: { isDefault: true },
    });

    res.json({ success: true, data: { id, isDefault: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// DELETE /api/social-accounts/:id — remove a social account
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = await resolveOwnerId(req.userId!);
    const { id } = req.params;

    const account = await prisma.socialAccount.findFirst({ where: { id, userId } });
    if (!account) { res.status(404).json({ success: false, error: 'Account not found' }); return; }

    await prisma.socialAccount.delete({ where: { id } });

    if (account.isDefault) {
      const next = await prisma.socialAccount.findFirst({
        where: { userId, platform: account.platform },
      });
      if (next) await prisma.socialAccount.update({ where: { id: next.id }, data: { isDefault: true } });
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/social-accounts/linkedin/auth-url — start LinkedIn OAuth (authenticated)
router.get('/linkedin/auth-url', async (req: AuthRequest, res: Response) => {
  try {
    const userId = await resolveOwnerId(req.userId!);
    const clientIdSetting = await prisma.setting.findUnique({ where: { userId_key: { userId, key: 'LINKEDIN_CLIENT_ID' } } });
    const clientId = clientIdSetting?.value;
    if (!clientId) { res.status(400).json({ success: false, error: 'LINKEDIN_CLIENT_ID not set in Settings' }); return; }

    const redirectUri = `${API_BASE}/api/social-accounts/linkedin/callback`;
    // Encode userId in state so the public callback can identify the user
    const randomPart = crypto.randomBytes(16).toString('hex');
    const state = `${userId}:${randomPart}`;
    const authUrl = getLinkedInAuthUrl(clientId, redirectUri, state);

    console.log('[LinkedIn] Auth URL generated, redirect_uri:', redirectUri);
    res.json({ success: true, data: { authUrl, state, redirectUri } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/social-accounts/x/auth-url — start X OAuth 2.0 (authenticated)
router.get('/x/auth-url', async (req: AuthRequest, res: Response) => {
  try {
    const userId = await resolveOwnerId(req.userId!);
    const clientIdSetting = await prisma.setting.findUnique({ where: { userId_key: { userId, key: 'X_CLIENT_ID' } } });
    const clientId = clientIdSetting?.value;
    if (!clientId) { res.status(400).json({ success: false, error: 'X_CLIENT_ID not set in Settings' }); return; }

    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const redirectUri = `${X_CALLBACK_BASE}/api/social-accounts/x/callback`;
    const randomPart = crypto.randomBytes(16).toString('hex');
    const state = `${userId}:${codeVerifier}:${randomPart}`;
    const authUrl = getXAuthUrl(clientId, redirectUri, state, codeChallenge);

    console.log('[X] Auth URL generated, redirect_uri:', redirectUri);
    res.json({ success: true, data: { authUrl, state, redirectUri } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/social-accounts/facebook/profile — Facebook page profile + recent posts
router.get('/facebook/profile', async (req: AuthRequest, res: Response) => {
  try {
    const userId = await resolveOwnerId(req.userId!);
    const accountId = req.query.accountId as string | undefined;
    let account;
    if (accountId) {
      account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
    }
    if (!account || account.platform !== 'FACEBOOK') {
      account = await prisma.socialAccount.findFirst({
        where: { userId, platform: 'FACEBOOK' },
        orderBy: { isDefault: 'desc' },
      });
    }
    if (!account) { res.json({ success: true, data: null }); return; }

    const pageId = account.platformUserId;
    const token = account.accessToken;

    const profileRes = await fetch(
      `${GRAPH_BASE}/${pageId}?fields=name,about,picture{url},fan_count,link&access_token=${token}`
    );
    const profile = await profileRes.json() as any;

    const postsRes = await fetch(
      `${GRAPH_BASE}/${pageId}/posts?fields=id,message,full_picture,created_time,likes.limit(1).summary(true),comments.limit(1).summary(true),permalink_url&limit=6&access_token=${token}`
    );
    const postsData = await postsRes.json() as any;

    res.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          name: profile.name,
          about: profile.about || '',
          picture: profile.picture?.data?.url || null,
          fanCount: profile.fan_count || 0,
          link: profile.link || '',
        },
        recentPosts: (postsData.data || []).map((p: any) => ({
          id: p.id,
          message: (p.message || '').slice(0, 200),
          imageUrl: p.full_picture || null,
          createdAt: p.created_time,
          likes: p.likes?.summary?.total_count || 0,
          comments: p.comments?.summary?.total_count || 0,
          permalink: p.permalink_url || '',
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/social-accounts/facebook/profiles — ALL Facebook page profiles
router.get('/facebook/profiles', async (req: AuthRequest, res: Response) => {
  try {
    const userId = await resolveOwnerId(req.userId!);
    const accounts = await prisma.socialAccount.findMany({
      where: { userId, platform: 'FACEBOOK' },
      orderBy: { isDefault: 'desc' },
    });

    const results = await Promise.all(accounts.map(async (account) => {
      try {
        const pageId = account.platformUserId;
        const token = account.accessToken;
        const profileRes = await fetch(
          `${GRAPH_BASE}/${pageId}?fields=name,about,picture{url},fan_count,link&access_token=${token}`
        );
        const profile = await profileRes.json() as any;

        const postsRes = await fetch(
          `${GRAPH_BASE}/${pageId}/posts?fields=id,message,full_picture,created_time,likes.limit(1).summary(true),comments.limit(1).summary(true),permalink_url&limit=4&access_token=${token}`
        );
        const postsData = await postsRes.json() as any;

        return {
          accountId: account.id,
          brandId: account.brandId,
          isDefault: account.isDefault,
          profile: {
            id: profile.id,
            name: profile.name,
            about: profile.about || '',
            picture: profile.picture?.data?.url || null,
            fanCount: profile.fan_count || 0,
            link: profile.link || '',
          },
          recentPosts: (postsData.data || []).map((p: any) => ({
            id: p.id,
            message: (p.message || '').slice(0, 200),
            imageUrl: p.full_picture || null,
            createdAt: p.created_time,
            likes: p.likes?.summary?.total_count || 0,
            comments: p.comments?.summary?.total_count || 0,
            permalink: p.permalink_url || '',
          })),
        };
      } catch {
        return {
          accountId: account.id,
          brandId: account.brandId,
          isDefault: account.isDefault,
          profile: { id: account.platformUserId, name: account.displayName || account.username || 'Facebook' },
          recentPosts: [],
        };
      }
    }));

    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/social-accounts/linkedin/profile — LinkedIn profile + recent posts
router.get('/linkedin/profile', async (req: AuthRequest, res: Response) => {
  try {
    const userId = await resolveOwnerId(req.userId!);
    const account = await prisma.socialAccount.findFirst({
      where: { userId, platform: 'LINKEDIN' },
      orderBy: { isDefault: 'desc' },
    });
    if (!account) { res.json({ success: true, data: null }); return; }

    // Try OpenID Connect /userinfo first (works with openid scope)
    let profileName = account.displayName || 'LinkedIn';
    let profilePicture: string | null = null;
    let profileId = account.platformUserId || '';

    const oidcRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });
    if (oidcRes.ok) {
      const oidcData = await oidcRes.json() as any;
      if (oidcData.name) profileName = oidcData.name;
      if (oidcData.picture) profilePicture = oidcData.picture;
      if (oidcData.sub) profileId = oidcData.sub;
    } else {
      // Fallback to /v2/me (requires r_liteprofile)
      const profileRes = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))', {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json() as any;
        profileName = `${profile.localizedFirstName || ''} ${profile.localizedLastName || ''}`.trim() || profileName;
        profileId = profile.id || profileId;
        profilePicture = profile.profilePicture?.['displayImage~']?.elements?.find(
          (e: any) => e.authorizationMethod === 'PUBLIC'
        )?.identifiers?.[0]?.identifier || profilePicture;
      }
    }

    let recentPosts: any[] = [];
    try {
      const postsRes = await fetch(
        `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(urn%3Ali%3Aperson%3A${account.platformUserId})&sortBy=LAST_MODIFIED&count=6&projection=(elements*(id,specificContent(com.linkedin.ugc.ShareContent(shareCommentary,shareMediaCategory,media*(title,originalUrl))),(createdTime,attributes*))`,
        { headers: { Authorization: `Bearer ${account.accessToken}` } }
      );
      const postsData = await postsRes.json() as any;
      recentPosts = (postsData.elements || []).map((p: any) => ({
        id: p.id,
        message: p.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '',
        imageUrl: null,
        createdAt: new Date(p.createdTime).toISOString(),
        likes: 0,
        comments: 0,
        permalink: `https://www.linkedin.com/feed/update/${p.id}`,
      }));
    } catch { /* posts may fail, return empty */ }

    res.json({
      success: true,
      data: {
        profile: {
          id: profileId,
          name: profileName,
          picture: profilePicture,
        },
        recentPosts,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/social-accounts/x/profile — X/Twitter profile + recent tweets
router.get('/x/profile', async (req: AuthRequest, res: Response) => {
  try {
    const userId = await resolveOwnerId(req.userId!);
    const account = await prisma.socialAccount.findFirst({
      where: { userId, platform: 'X' },
      orderBy: { isDefault: 'desc' },
    });
    if (!account) { res.json({ success: true, data: null }); return; }

    const profileRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics,name,username', {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });
    if (!profileRes.ok) {
      res.json({ success: true, data: { profile: { id: '', name: account.displayName || account.username || 'X', username: account.username || '', picture: null, metrics: {} }, recentPosts: [] } });
      return;
    }
    const profileData = await profileRes.json() as any;
    const user = profileData.data;

    let recentPosts: any[] = [];
    try {
      const tweetsRes = await fetch(
        `https://api.twitter.com/2/users/${user.id}/tweets?max_results=6&tweet.fields=created_at,public_metrics,attachments&expansions=attachments.media_keys&media.fields=url,preview_image_url`,
        { headers: { Authorization: `Bearer ${account.accessToken}` } }
      );
      const tweetsData = await tweetsRes.json() as any;
      const mediaMap: Record<string, string> = {};
      (tweetsData.includes?.media || []).forEach((m: any) => {
        mediaMap[m.media_key] = m.url || m.preview_image_url || '';
      });
      recentPosts = (tweetsData.data || []).map((t: any) => ({
        id: t.id,
        message: t.text,
        imageUrl: t.attachments?.media_keys?.[0] ? mediaMap[t.attachments.media_keys[0]] || null : null,
        createdAt: t.created_at,
        likes: t.public_metrics?.like_count || 0,
        comments: t.public_metrics?.reply_count || 0,
        retweets: t.public_metrics?.retweet_count || 0,
        permalink: `https://x.com/${user.username}/status/${t.id}`,
      }));
    } catch { /* tweets may fail */ }

    res.json({
      success: true,
      data: {
        profile: {
          id: user.id,
          name: user.name,
          username: user.username,
          picture: user.profile_image_url?.replace('_normal', '') || null,
          metrics: user.public_metrics || {},
        },
        recentPosts,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

export default router;
