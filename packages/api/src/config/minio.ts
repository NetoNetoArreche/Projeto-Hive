import * as Minio from 'minio';
import { env } from './env';

// region: 'auto' is required for Cloudflare R2 sigv4 signing.
// MinIO and AWS S3 ignore it (or default to us-east-1).
export const minioClient = new Minio.Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
  region: env.MINIO_ENDPOINT.includes('r2.cloudflarestorage.com') ? 'auto' : 'us-east-1',
});

export async function initMinio() {
  const bucket = env.MINIO_BUCKET;
  const isR2 = env.MINIO_ENDPOINT.includes('r2.cloudflarestorage.com');

  // Check bucket existence — works on MinIO, AWS S3, and R2
  let exists = false;
  try {
    exists = await minioClient.bucketExists(bucket);
  } catch (err: any) {
    console.warn(`[Storage] bucketExists check failed: ${err?.message}. Assuming bucket exists (managed externally).`);
    exists = true;
  }

  if (!exists) {
    try {
      await minioClient.makeBucket(bucket);
      console.log(`[Storage] Created bucket: ${bucket}`);
    } catch (err: any) {
      console.warn(`[Storage] Failed to create bucket ${bucket}: ${err?.message}. Create it manually if needed.`);
    }
  }

  // R2 doesn't support setBucketPolicy via the S3 API — public access is
  // controlled in the Cloudflare dashboard (Public Development URL or Custom
  // Domain). Skip the policy call for R2 to avoid log noise.
  if (isR2) {
    console.log(`[Storage] R2 detected — skipping setBucketPolicy (configure Public Access in Cloudflare dashboard)`);
    return;
  }

  // MinIO / AWS S3: set public-read policy so external services can download
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
    console.log(`[Storage] Public read policy applied to ${bucket}`);
  } catch (err: any) {
    console.warn(`[Storage] Failed to set public policy on ${bucket}: ${err?.message}. External services may not be able to download from MINIO_PUBLIC_URL.`);
  }
}
