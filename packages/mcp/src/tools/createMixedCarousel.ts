import { api } from '../api-client';

interface SlideDefinition {
  title: string;
  subtitle?: string;
  template?: string;
}

interface CreateMixedCarouselInput {
  cover_prompt: string;
  slides: SlideDefinition[];
  caption?: string;
  hashtags?: string[];
  aspect_ratio?: '1:1' | '4:5' | '9:16';
  tone?: string;
  scheduled_at?: string;
  brand_id?: string;
  apply_brand?: boolean;
}

export async function createMixedCarousel(input: CreateMixedCarouselInput) {
  const aspectRatio = input.aspect_ratio || '1:1';
  const images: Array<{ imageUrl: string; order: number; prompt?: string }> = [];

  // Step 0: Resolve brand if provided
  let brand: any = null;
  if (input.brand_id && input.apply_brand !== false) {
    try {
      brand = await api.getBrand(input.brand_id);
      console.log(`[MCP mixed_carousel] Brand applied: ${brand?.name}`);
    } catch (err) {
      console.warn('[MCP mixed_carousel] Failed to load brand:', err);
    }
  }

  // Step 1: Generate AI cover (first slide)
  console.log('[MCP mixed_carousel] Generating AI cover...');
  // Inject brand context into cover prompt if available
  let coverPrompt = input.cover_prompt;
  if (brand) {
    const brandHints: string[] = [];
    if (brand.primaryColor) brandHints.push(`paleta de cores ${brand.primaryColor} e ${brand.secondaryColor || ''}`);
    if (brand.voiceTone) brandHints.push(`estilo ${brand.voiceTone}`);
    if (brandHints.length > 0) {
      coverPrompt = `${input.cover_prompt}. Identidade visual: ${brandHints.join(', ')}`;
    }
  }
  const cover = await api.generateImage({ prompt: coverPrompt, aspectRatio });
  images.push({ imageUrl: cover.imageUrl, order: 0, prompt: coverPrompt });

  // Step 2: Generate template slides (with brand colors/logo if available)
  console.log(`[MCP mixed_carousel] Generating ${input.slides.length} template slides...`);
  const slideResults = await Promise.allSettled(
    input.slides.map((slide) => {
      const body: Record<string, unknown> = {
        title: slide.title,
        subtitle: slide.subtitle,
        template: slide.template || 'bold-gradient',
        aspectRatio,
      };
      if (input.brand_id) {
        body.brandId = input.brand_id;
        body.applyBrand = input.apply_brand !== false;
      }
      return api.generateTemplate(body);
    })
  );

  for (let i = 0; i < slideResults.length; i++) {
    const result = slideResults[i];
    if (result.status === 'fulfilled') {
      images.push({
        imageUrl: result.value.imageUrl,
        order: images.length,
        prompt: input.slides[i].title,
      });
    } else {
      console.error(`[MCP mixed_carousel] Slide ${i + 1} failed:`, result.reason);
    }
  }

  if (images.length < 2) {
    throw new Error(`Carrossel precisa de pelo menos 2 imagens. Apenas ${images.length} gerada(s) com sucesso.`);
  }

  // Step 3: Generate caption if not provided
  let caption = input.caption;
  let hashtags = input.hashtags;
  if (!caption) {
    const topic = input.cover_prompt;
    const tone = input.tone || (brand?.voiceTone || undefined);
    const result = await api.generateCaption({ topic, tone });
    caption = result.caption;
    hashtags = hashtags || result.hashtags;
  }

  // Merge brand default hashtags
  if (brand?.defaultHashtags?.length) {
    const existing = new Set((hashtags || []).map((h: string) => h.toLowerCase()));
    const merged = [...(hashtags || [])];
    for (const tag of brand.defaultHashtags) {
      if (!existing.has(tag.toLowerCase())) merged.push(tag);
    }
    hashtags = merged;
  }

  // Step 4: Build editorState so visual editor can edit text
  const templateToEditor: Record<string, string> = {
    'bold-gradient': 'content',
    'minimal-dark': 'content',
    'neon-card': 'content',
    'quote-elegant': 'quote',
    'stats-impact': 'stat',
    'split-color': 'content',
  };

  const editorSlides = [
    // Cover slide (AI image)
    {
      id: 'cover',
      template: 'hero',
      backgroundUrl: images[0].imageUrl,
      backgroundPrompt: coverPrompt,
      backgroundX: 50, backgroundY: 50, backgroundZoom: 100,
      backgroundOpacity: 100, backgroundFlipH: false, infiniteCarousel: false,
      overlayOpacity: 0.4, overlayStyle: 'base',
      slideBgColor: '#000000', slideBgPattern: 'none',
      slideBgPatternSize: 40, slideBgPatternOpacity: 15,
      label: '', title: input.slides[0]?.title || '', subtitle: input.slides[0]?.subtitle || '', stat: '',
      position: 'bottom-left', textAlign: 'center',
      fontFamily: 'Inter', fontWeight: 800,
      titleColor: '#ffffff', titleFontSize: 72, titleLetterSpacing: -0.02,
      subtitleFontFamily: 'Inter', subtitleFontWeight: 400,
      subtitleColor: '#ffffff', subtitleFontSize: 28,
      subtitleLetterSpacing: 0, subtitleLineHeight: 1.4,
      globalScale: 100, glassEffect: false,
      cornerTopLeft: '', cornerTopRight: '', cornerBottomLeft: '', cornerBottomRight: '',
      cornerTopLeftEnabled: true, cornerTopRightEnabled: true,
      cornerBottomLeftEnabled: true, cornerBottomRightEnabled: true,
      logoPosition: '', customLogoUrl: '', showLogo: true, showProfileBadge: false,
      showIndicators: true, totalSlides: images.length, slideNumber: 1,
      showCTA: false, ctaText: '', wordHighlights: {}, refinePrompt: '',
    },
    // Template slides (editable text)
    ...input.slides.map((slide, i) => ({
      id: `slide${i + 2}`,
      template: templateToEditor[slide.template || 'bold-gradient'] || 'content',
      backgroundUrl: images[i + 1]?.imageUrl || '',
      backgroundPrompt: '',
      backgroundX: 50, backgroundY: 50, backgroundZoom: 100,
      backgroundOpacity: 100, backgroundFlipH: false, infiniteCarousel: false,
      overlayOpacity: 0, overlayStyle: 'base',
      slideBgColor: '#000000', slideBgPattern: 'none',
      slideBgPatternSize: 40, slideBgPatternOpacity: 15,
      label: i === input.slides.length - 1 ? '' : `Passo ${i + 1}`,
      title: slide.title,
      subtitle: slide.subtitle || '',
      stat: '',
      position: 'middle-center', textAlign: 'center',
      fontFamily: 'Inter', fontWeight: 800,
      titleColor: brand?.primaryColor || '#ffffff', titleFontSize: 72, titleLetterSpacing: -0.02,
      subtitleFontFamily: 'Inter', subtitleFontWeight: 400,
      subtitleColor: '#ffffff', subtitleFontSize: 28,
      subtitleLetterSpacing: 0, subtitleLineHeight: 1.4,
      globalScale: 100, glassEffect: false,
      cornerTopLeft: '', cornerTopRight: '', cornerBottomLeft: '', cornerBottomRight: '',
      cornerTopLeftEnabled: true, cornerTopRightEnabled: true,
      cornerBottomLeftEnabled: true, cornerBottomRightEnabled: true,
      logoPosition: '', customLogoUrl: '', showLogo: true, showProfileBadge: false,
      showIndicators: true, totalSlides: images.length, slideNumber: i + 2,
      showCTA: i === input.slides.length - 1, ctaText: '',
      wordHighlights: {}, refinePrompt: '',
    })),
  ];

  const editorState = {
    slides: editorSlides,
    brandId: input.brand_id || '',
    aspectRatio,
    globalStyle: {
      showCorners: true, showIndicators: true,
      cornerFontSize: 20, cornerEdgeDistance: 80, cornerOpacity: 85,
      cornerGlass: false, cornerBorder: false, bottomRightIcon: 'none',
    },
  };

  // Step 5: Create post with editorState
  const post = (await api.createPost({
    caption,
    hashtags,
    source: 'MCP',
    aspectRatio,
    isCarousel: true,
    images,
    editorState,
    ...(input.scheduled_at ? { scheduledAt: input.scheduled_at } : {}),
  })) as any;

  return {
    post_id: post.id,
    caption: post.caption,
    is_carousel: true,
    cover_image: images[0].imageUrl,
    template_slides: images.length - 1,
    total_images: images.length,
    brand_applied: brand ? { id: brand.id, name: brand.name } : null,
    status: post.status,
    scheduled_at: post.scheduledAt || null,
    editor_state: 'included',
  };
}
