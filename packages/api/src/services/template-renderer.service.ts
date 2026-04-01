import { renderTemplate, TemplateInput } from './templates';
import { uploadImage } from './storage.service';

const RENDERER_URL = process.env.RENDERER_URL || 'http://renderer:3003';

function getSize(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16': return { width: 1080, height: 1920 };
    case '4:5': return { width: 1080, height: 1350 };
    default: return { width: 1080, height: 1080 };
  }
}

export async function renderTemplateToImage(input: TemplateInput): Promise<{ imageUrl: string }> {
  const html = renderTemplate(input);
  const { width, height } = getSize(input.aspectRatio || '1:1');

  const res = await fetch(`${RENDERER_URL}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, width, height }),
  });

  const data = await res.json() as any;
  if (!data.success) throw new Error(data.error || 'Render failed');

  const buffer = Buffer.from(data.image, 'base64');
  const imageUrl = await uploadImage(buffer, 'image/png');
  return { imageUrl };
}

export async function renderHtmlToImage(html: string, width = 1080, height = 1080): Promise<{ imageUrl: string }> {
  const res = await fetch(`${RENDERER_URL}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, width, height }),
  });

  const data = await res.json() as any;
  if (!data.success) throw new Error(data.error || 'Render failed');

  const buffer = Buffer.from(data.image, 'base64');
  const imageUrl = await uploadImage(buffer, 'image/png');
  return { imageUrl };
}
