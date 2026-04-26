import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';
import { getSetting } from '../helpers/getSetting';

interface CloudinaryCreds {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Resolve Cloudinary credentials. Settings table (configured via the
 * web /settings page) takes priority over env vars (legacy / docker
 * defaults).
 */
async function resolveCreds(): Promise<CloudinaryCreds | null> {
  const cloudName = (await getSetting('CLOUDINARY_CLOUD_NAME')) || env.CLOUDINARY_CLOUD_NAME;
  const apiKey = (await getSetting('CLOUDINARY_API_KEY')) || env.CLOUDINARY_API_KEY;
  const apiSecret = (await getSetting('CLOUDINARY_API_SECRET')) || env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export async function isCloudinaryConfigured(): Promise<boolean> {
  return (await resolveCreds()) !== null;
}

/**
 * Upload an image buffer to Cloudinary and return the public secure URL.
 * folder: organisational prefix in Cloudinary (e.g. "openhive/instagram").
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder = 'openhive/instagram',
): Promise<string> {
  const creds = await resolveCreds();
  if (!creds) {
    throw new Error('Cloudinary not configured — set credentials in Settings or via CLOUDINARY_* env vars');
  }

  // Reconfigure on every call so DB-side credential rotations take effect
  cloudinary.config({
    cloud_name: creds.cloudName,
    api_key: creds.apiKey,
    api_secret: creds.apiSecret,
    secure: true,
  });

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Cloudinary upload returned no result'));
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}
