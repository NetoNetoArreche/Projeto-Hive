import { randomUUID } from 'crypto';
import { minioClient } from '../config/minio';
import { env } from '../config/env';

export async function uploadImage(buffer: Buffer, mimetype: string): Promise<string> {
  const ext = mimetype === 'image/png' ? 'png' : 'jpg';
  const key = `uploads/${randomUUID()}.${ext}`;

  await minioClient.putObject(env.MINIO_BUCKET, key, buffer, buffer.length, {
    'Content-Type': mimetype,
  });

  return `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/${key}`;
}

export async function uploadFile(buffer: Buffer, mimetype: string, originalName: string): Promise<string> {
  const ext = originalName.split('.').pop() || 'bin';
  const key = `files/${randomUUID()}.${ext}`;

  await minioClient.putObject(env.MINIO_BUCKET, key, buffer, buffer.length, {
    'Content-Type': mimetype,
  });

  return `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/${key}`;
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
    videoUrl: `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/${key}`,
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
 * Extract MinIO object key from a public URL.
 * Example:
 *   https://minio.foo.com/openhive-images/videos/abc.mp4 -> videos/abc.mp4
 */
export function extractKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const prefix = `/${env.MINIO_BUCKET}/`;
    if (!parsed.pathname.startsWith(prefix)) return null;
    return parsed.pathname.slice(prefix.length);
  } catch {
    return null;
  }
}
