import { Request, Response } from 'express';
import { uploadImage, uploadFile, uploadVideo } from '../services/storage.service';

export async function uploadImageController(req: Request, res: Response) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      res.status(400).json({ success: false, error: 'Invalid file type' });
      return;
    }

    if (req.file.size > 10 * 1024 * 1024) {
      res.status(400).json({ success: false, error: 'File too large (max 10MB)' });
      return;
    }

    const imageUrl = await uploadImage(req.file.buffer, req.file.mimetype);
    res.json({ success: true, data: { imageUrl } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to upload image' });
  }
}

export async function uploadMultipleImagesController(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: 'No files uploaded' });
      return;
    }
    if (files.length > 10) {
      res.status(400).json({ success: false, error: 'Max 10 images allowed' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const results: Array<{ imageUrl: string; order: number }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!allowedTypes.includes(file.mimetype)) {
        res.status(400).json({ success: false, error: `Invalid file type: ${file.originalname}` });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        res.status(400).json({ success: false, error: `File too large: ${file.originalname}` });
        return;
      }
      const imageUrl = await uploadImage(file.buffer, file.mimetype);
      results.push({ imageUrl, order: i });
    }

    res.json({ success: true, data: { images: results } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to upload images' });
  }
}

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-m4v'];
const MAX_VIDEO_SIZE = 150 * 1024 * 1024; // 150MB

export async function uploadVideoController(req: Request, res: Response) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No video uploaded' });
      return;
    }

    if (!ALLOWED_VIDEO_TYPES.includes(req.file.mimetype)) {
      res.status(400).json({ success: false, error: 'Tipo de video nao permitido (use MP4 ou MOV)' });
      return;
    }

    if (req.file.size > MAX_VIDEO_SIZE) {
      res.status(400).json({ success: false, error: `Video muito grande (max 150MB, atual: ${(req.file.size / 1024 / 1024).toFixed(1)}MB)` });
      return;
    }

    const { videoUrl, key } = await uploadVideo(req.file.buffer, req.file.mimetype, req.file.originalname);
    res.json({
      success: true,
      data: {
        videoUrl,
        videoMinioKey: key,
        sizeBytes: req.file.size,
        mimeType: req.file.mimetype,
        fileName: req.file.originalname,
      },
    });
  } catch (err: any) {
    console.error('[uploadVideo] Error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to upload video' });
  }
}

export async function uploadFileController(req: Request, res: Response) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(req.file.mimetype)) {
      res.status(400).json({ success: false, error: 'Tipo de arquivo nao permitido' });
      return;
    }

    if (req.file.size > 20 * 1024 * 1024) {
      res.status(400).json({ success: false, error: 'Arquivo muito grande (max 20MB)' });
      return;
    }

    const fileUrl = await uploadFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    res.json({ success: true, data: { fileUrl, fileName: req.file.originalname, mimeType: req.file.mimetype } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
}
