import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  uploadImageController,
  uploadMultipleImagesController,
  uploadFileController,
  uploadVideoController,
} from '../controllers/upload.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadFile = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const uploadVideo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 150 * 1024 * 1024 } });

router.use(authMiddleware);
router.post('/', upload.single('image'), uploadImageController);
router.post('/multiple', upload.array('images', 10), uploadMultipleImagesController);
router.post('/file', uploadFile.single('file'), uploadFileController);
router.post('/video', uploadVideo.single('video'), uploadVideoController);

export default router;
