import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_USER_ID: z.string().optional(),

  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),

  NANO_BANANA_API_KEY: z.string().optional(),
  NANO_BANANA_PROVIDER: z.enum(['google', 'nanobananaapi', 'fal']).default('google'),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ALLOWED_CHAT_IDS: z.string().optional(),

  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  MINIO_ACCESS_KEY: z.string().transform(v => v || 'minioadmin').default('minioadmin'),
  MINIO_SECRET_KEY: z.string().transform(v => v || 'minioadmin').default('minioadmin'),
  MINIO_PUBLIC_URL: z.string().default('http://localhost:9000'),
  MINIO_BUCKET: z.string().default('instapost-images'),

  // URL pattern: MinIO uses {PUBLIC_URL}/{BUCKET}/{key}, R2 dev URL uses {PUBLIC_URL}/{key}.
  // Set to 'false' for R2 (pub-xxx.r2.dev URLs don't include the bucket name).
  STORAGE_PUBLIC_URL_INCLUDES_BUCKET: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),

  // Cloudinary — used as the public-facing host for images sent to Meta.
  // Meta has tightened its allowlist for image_url hostnames; self-hosted
  // domains (sslip.io, R2, custom Let's Encrypt etc.) get rejected with
  // error_subcode 2207052 even when the URL is publicly reachable.
  // res.cloudinary.com is on Meta's allowlist (tested), so we mirror
  // each image to Cloudinary right before posting.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),

  MCP_AUTH_TOKEN: z.string().optional(),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
