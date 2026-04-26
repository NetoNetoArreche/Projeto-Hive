import { prisma } from '../config/database';
import { env } from '../config/env';

const ENV_MAP: Record<string, () => string | undefined> = {
  NANO_BANANA_API_KEY: () => env.NANO_BANANA_API_KEY,
  INSTAGRAM_ACCESS_TOKEN: () => env.INSTAGRAM_ACCESS_TOKEN,
  INSTAGRAM_USER_ID: () => env.INSTAGRAM_USER_ID,
  TELEGRAM_BOT_TOKEN: () => env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_ALLOWED_CHAT_IDS: () => env.TELEGRAM_ALLOWED_CHAT_IDS,
  FACEBOOK_APP_ID: () => env.FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET: () => env.FACEBOOK_APP_SECRET,
  MCP_AUTH_TOKEN: () => env.MCP_AUTH_TOKEN,
  INTERNAL_SERVICE_TOKEN: () => env.INTERNAL_SERVICE_TOKEN,
  CLOUDINARY_CLOUD_NAME: () => env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: () => env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: () => env.CLOUDINARY_API_SECRET,
};

/**
 * Get a setting value. Checks database first (user-configured via web UI),
 * then falls back to environment variable.
 */
export async function getSetting(key: string, userId?: string): Promise<string | undefined> {
  // Try database first (settings saved via web UI)
  try {
    if (userId) {
      const setting = await prisma.setting.findUnique({
        where: { userId_key: { userId, key } },
      });
      if (setting?.value) return setting.value;
    } else {
      // Get from first owner's settings
      const setting = await prisma.setting.findFirst({
        where: { key },
        orderBy: { createdAt: 'asc' },
      });
      if (setting?.value) return setting.value;
    }
  } catch {
    // DB not available, fall through to env
  }

  // Fallback to environment variable
  const envGetter = ENV_MAP[key];
  return envGetter ? envGetter() : undefined;
}
