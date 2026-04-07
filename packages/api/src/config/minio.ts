import * as Minio from 'minio';
import { env } from './env';

export const minioClient = new Minio.Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export async function initMinio() {
  const bucket = env.MINIO_BUCKET;
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket);
    console.log(`[MinIO] Created bucket: ${bucket}`);
  }

  // Set public read policy so Instagram (and any external service) can
  // download media via MINIO_PUBLIC_URL without authentication.
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadGetObject',
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  };
  try {
    await minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
    console.log(`[MinIO] Public read policy applied to ${bucket}`);
  } catch (err: any) {
    console.warn(`[MinIO] Failed to set public policy on ${bucket}: ${err?.message}. External services may not be able to download from MINIO_PUBLIC_URL.`);
  }
}
