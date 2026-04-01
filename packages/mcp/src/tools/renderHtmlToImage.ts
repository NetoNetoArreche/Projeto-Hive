import { api } from '../api-client';

export async function renderHtmlToImage(input: {
  html: string;
  width?: number;
  height?: number;
}) {
  const result = (await api.renderHtml({
    html: input.html,
    width: input.width || 1080,
    height: input.height || 1080,
  })) as any;

  return {
    image_url: result.imageUrl,
    width: input.width || 1080,
    height: input.height || 1080,
  };
}
