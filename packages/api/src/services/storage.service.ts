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

export async function deleteImage(key: string): Promise<void> {
  await minioClient.removeObject(env.MINIO_BUCKET, key);
}
