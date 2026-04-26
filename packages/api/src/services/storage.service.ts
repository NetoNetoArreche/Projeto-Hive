import { randomUUID } from 'crypto';
import { minioClient } from '../config/minio';
import { env } from '../config/env';

/**
 * Build the public URL for a given object key.
 *   MinIO style: https://minio.host/{bucket}/{key}
 *   R2 dev URL:  https://pub-xxx.r2.dev/{key}      (no bucket in path)
 */
export function buildPublicUrl(key: string): string {
  const base = env.MINIO_PUBLIC_URL.replace(/\/+$/, '');
  if (env.STORAGE_PUBLIC_URL_INCLUDES_BUCKET) {
    return `${base}/${env.MINIO_BUCKET}/${key}`;
  }
  return `${base}/${key}`;
}

export async function uploadImage(buffer: Buffer, mimetype: string): Promise<string> {
  const ext = mimetype === 'image/png' ? 'png' : 'jpg';
  const key = `uploads/${randomUUID()}.${ext}`;

  await minioClient.putObject(env.MINIO_BUCKET, key, buffer, buffer.length, {
    'Content-Type': mimetype,
  });

  return buildPublicUrl(key);
}

export async function uploadFile(buffer: Buffer, mimetype: string, originalName: string): Promise<string> {
  const ext = originalName.split('.').pop() || 'bin';
  const key = `files/${randomUUID()}.${ext}`;

  await minioClient.putObject(env.MINIO_BUCKET, key, buffer, buffer.length, {
    'Content-Type': mimetype,
  });

  return buildPublicUrl(key);
}

export async function uploadVideo(
  buffer: Buffer,
  mimetype: string,
  originalName?: string
): Promise<{ videoUrl: string; key: string }> {
  const ext = (originalName?.split('.').pop() || (mimetype === 'video/quicktime' ? 'mov' : 'mp4')).toLowerCase();
  const key = `videos/${randomUUID()}.${ext}`;

  await minioClient.putObject(env.MINIO_BUCKET, key, buffer, buffer.length, {
    'Content-Type': mimetype,
  });

  return {
    videoUrl: buildPublicUrl(key),
    key,
  };
}

export async function deleteImage(key: string): Promise<void> {
  await minioClient.removeObject(env.MINIO_BUCKET, key);
}

export async function deleteObject(key: string): Promise<void> {
  await minioClient.removeObject(env.MINIO_BUCKET, key);
}

/**
 * Extract object key from a public URL. Handles both URL patterns:
 *   - https://minio.host/{bucket}/path/file.ext      -> path/file.ext
 *   - https://pub-xxx.r2.dev/path/file.ext           -> path/file.ext
 */
export function extractKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (env.STORAGE_PUBLIC_URL_INCLUDES_BUCKET) {
      const prefix = `/${env.MINIO_BUCKET}/`;
      if (!parsed.pathname.startsWith(prefix)) return null;
      return parsed.pathname.slice(prefix.length);
    }
    // R2-style: drop the leading slash
    return parsed.pathname.replace(/^\/+/, '') || null;
  } catch {
    return null;
  }
}
