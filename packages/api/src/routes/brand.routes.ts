import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  createBrand,
  listBrands,
  getBrand,
  getDefaultBrand,
  updateBrand,
  setDefaultBrand,
  deleteBrand,
} from '../controllers/brand.controller';

const router = Router();

// Accept hex (#RRGGBB), null, or empty string (treated as null)
const hexColorOptional = z
  .union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v));

// Accept any short string, null, or empty string
const optionalString = (max: number) =>
  z
    .union([z.string().max(max), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v));

// Accept URL, null, or empty string
const optionalUrl = z
  .union([z.string().url(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v));

const createBrandSchema = z.object({
  name: z.string().min(1).max(100),
  logoUrl: optionalUrl,
  primaryColor: hexColorOptional,
  secondaryColor: hexColorOptional,
  accentColor: hexColorOptional,
  backgroundColor: hexColorOptional,
  textColor: hexColorOptional,
  mutedColor: hexColorOptional,
  fontFamily: optionalString(100),
  headingFont: optionalString(100),
  bodyFont: optionalString(100),
  description: optionalString(10000),
  voiceTone: optionalString(1000),
  websiteUrl: optionalUrl,
  instagramUrl: optionalUrl,
  products: z.array(z.string()).optional(),
  defaultHashtags: z.array(z.string()).optional(),
  defaultPlatforms: z.array(z.string()).optional(),
  tonePrompt: optionalString(2000),
  stylePrompt: optionalString(2000),
  isDefault: z.boolean().optional(),
});

const updateBrandSchema = createBrandSchema.partial();

router.use(authMiddleware);

router.post('/', validate(createBrandSchema), createBrand);
router.get('/', listBrands);
router.get('/default', getDefaultBrand);
router.get('/:id', getBrand);
router.put('/:id', validate(updateBrandSchema), updateBrand);
router.put('/:id/default', setDefaultBrand);
router.delete('/:id', deleteBrand);

export default router;
