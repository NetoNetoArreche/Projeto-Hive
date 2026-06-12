import { api } from '../api-client';
import { CreatePostInput } from '../types';

export async function createPost(input: CreatePostInput) {
  console.log('[MCP create_post] Input received:', JSON.stringify({
    has_caption: !!input.caption,
    image_prompt: input.image_prompt ? 'yes' : 'no',
    image_prompts_count: input.image_prompts?.length || 0,
    image_urls_count: input.image_urls?.length || 0,
    aspect_ratio: input.aspect_ratio,
    tone: input.tone,
  }));

  let imageUrl: string | undefined;
  let images: Array<{ imageUrl: string; order: number; prompt?: string }> = [];
  let caption = input.caption;
  let hashtags = input.hashtags;

  const aspectRatio = input.aspect_ratio || '1:1';

  // Generate multiple images for carousel
  if (input.image_prompts && input.image_prompts.length >= 2) {
    const results = await Promise.allSettled(
      input.image_prompts.map((prompt) => api.generateImage({ prompt, aspectRatio }))
    );
    images = results
      .filter((r): r is PromiseFulfilledResult<{ imageUrl: string; minioKey: string }> => r.status === 'fulfilled')
      .map((r, idx) => ({
        imageUrl: r.value.imageUrl,
        order: idx,
        prompt: input.image_prompts![idx],
      }));
  } else if (input.image_urls && input.image_urls.length >= 2) {
    // Use provided URLs directly
    images = input.image_urls.map((url, idx) => ({
      imageUrl: url,
      order: idx,
    }));
  } else if (input.image_prompt) {
    // Single image (existing behavior)
    const img = await api.generateImage({ prompt: input.image_prompt, aspectRatio });
    imageUrl = img.imageUrl;
  }

  if (!caption) {
    const topic = input.image_prompt || input.image_prompts?.[0] || 'post de tecnologia';
    const result = await api.generateCaption({ topic, tone: input.tone });
    caption = result.caption;
    hashtags = hashtags || result.hashtags;
  }

  const isCarousel = images.length >= 2;
  console.log('[MCP create_post] Result:', { isCarousel, imagesCount: images.length, hasImageUrl: !!imageUrl });

  const post = (await api.createPost({
    caption,
    hashtags,
    source: 'MCP',
    aspectRatio,
    isCarousel,
    ...(isCarousel ? { images } : { imageUrl }),
    ...(input.scheduled_at ? { scheduledAt: input.scheduled_at } : {}),
    ...(input.editor_state ? { editorState: input.editor_state } : {}),
    ...(input.brand_id ? { brandId: input.brand_id } : {}),
    ...(input.platforms?.length ? { platforms: input.platforms } : {}),
  })) as any;

  return {
    post_id: post.id,
    caption: post.caption,
    image_url: post.imageUrl,
    is_carousel: post.isCarousel,
    image_count: isCarousel ? images.length : (post.imageUrl ? 1 : 0),
    status: post.status,
    brand_id: post.brandId || null,
    platforms: post.platforms || [],
  };
}
