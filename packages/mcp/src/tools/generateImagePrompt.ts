import { api } from '../api-client';
import { GenerateImagePromptInput } from '../types';

export async function generateImagePrompt(input: GenerateImagePromptInput) {
  const result = await api.generateImagePrompt({
    topic: input.topic,
    ...(input.brand_id ? { brandId: input.brand_id } : {}),
    ...(input.style ? { style: input.style } : {}),
    ...(input.aspect_ratio ? { aspectRatio: input.aspect_ratio } : {}),
    ...(input.usage ? { usage: input.usage } : {}),
  });
  return result as { prompt: string; negative_prompt: string; tips: string };
}
