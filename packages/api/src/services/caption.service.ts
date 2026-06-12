interface BrandContext {
  name: string;
  voiceTone?: string;
  defaultHashtags?: string[];
  products?: string[];
  description?: string;
}

interface GenerateCaptionParams {
  topic: string;
  tone?: 'educativo' | 'inspirador' | 'humor' | 'noticia';
  hashtagsCount?: number;
  language?: string;
  maxLength?: number;
  brandId?: string;
}

interface GenerateCaptionResult {
  caption: string;
  hashtags: string[];
}

interface RefineSlideParams {
  title: string;
  subtitle?: string;
  label?: string;
  instruction: string;
}

interface RefineSlideResult {
  title: string;
  subtitle: string;
  label: string;
}

const TONE_TEMPLATES: Record<string, string> = {
  educativo: '💡 Você sabia?\n\n{content}\n\n💾 Salva esse post para consultar depois!',
  inspirador: '🚀 {content}\n\n✨ O futuro é agora!\n\n📌 Salve e compartilhe!',
  humor: '😂 {content}\n\n🤣 Marca aquele amigo dev!\n\n#humor #tech',
  noticia: '🔥 NOVIDADE!\n\n{content}\n\n📲 Fica ligado para mais updates!',
};

async function getBrandContext(brandId: string): Promise<BrandContext | null> {
  const { prisma } = await import('../config/database');
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return null;
  return {
    name: brand.name,
    voiceTone: brand.voiceTone || undefined,
    defaultHashtags: brand.defaultHashtags?.length ? brand.defaultHashtags : undefined,
    products: brand.products?.length ? brand.products : undefined,
    description: brand.description || undefined,
  };
}

function generateHashtags(topic: string, count: number, brandHashtags?: string[]): string[] {
  const base = brandHashtags?.length ? brandHashtags : ['IA', 'Tech', 'Programacao', 'Dev', 'Tecnologia'];
  const topicWords = topic
    .split(' ')
    .filter((w) => w.length > 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  return [...base, ...topicWords.slice(0, Math.ceil(count / 2))].slice(0, count);
}

function generateCaptionStatic(params: GenerateCaptionParams, brand?: BrandContext | null): GenerateCaptionResult {
  const { topic, tone = 'educativo', hashtagsCount = 10, maxLength = 2200 } = params;

  const template = TONE_TEMPLATES[tone] || TONE_TEMPLATES.educativo;
  const brandName = brand?.name || 'nossos seguidores';
  const content = `Sobre ${topic}: Conteúdo relevante para ${brandName}. Confira!`;
  let caption = template.replace('{content}', content);

  if (caption.length > maxLength) {
    caption = caption.slice(0, maxLength - 3) + '...';
  }

  const hashtags = generateHashtags(topic, hashtagsCount, brand?.defaultHashtags);

  return { caption, hashtags };
}

async function callGeminiText(apiKey: string, prompt: string): Promise<string> {
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No text returned from Gemini');
  return text.trim();
}

export async function generateCaption(params: GenerateCaptionParams): Promise<GenerateCaptionResult> {
  const { getSetting } = await import('../helpers/getSetting');
  const apiKey = await getSetting('NANO_BANANA_API_KEY');

  let brand: BrandContext | null = null;
  if (params.brandId) {
    brand = await getBrandContext(params.brandId);
  }

  if (!apiKey) {
    return generateCaptionStatic(params, brand);
  }

  const { topic, tone = 'educativo', hashtagsCount = 10 } = params;

  let prompt: string;
  if (brand) {
    prompt = `Você é redator de redes sociais de "${brand.name}".
${brand.description ? `\nSobre a marca: ${brand.description}\n` : ''}
${brand.voiceTone ? `IDENTIDADE DA MARCA - Tom de voz: ${brand.voiceTone}` : 'Tom: profissional e engajador'}

Gere conteúdo para Instagram sobre: "${topic}"

${brand.defaultHashtags?.length ? `Hashtags obrigatórias da marca (inclua todas): ${brand.defaultHashtags.join(', ')}` : ''}

Retorne EXATAMENTE neste formato (sem markdown, sem aspas extras):
TITULO: [título impactante, máximo 6 palavras]
SUBTITULO: [subtítulo que complementa, máximo 15 palavras]
LEGENDA: [legenda para Instagram, 100-200 palavras, com emojis adequados ao tom da marca e CTA]
HASHTAGS: [${hashtagsCount} hashtags separadas por vírgula, sem #${brand.defaultHashtags?.length ? ' — inclua TODAS as hashtags obrigatórias da marca e adicione relevantes ao tema' : ', mix de alto volume e nicho'}]

Regras:
- Português BR
- Título deve ser hook que para o scroll
- Subtítulo complementa o título com dado ou contexto
- Legenda com gancho, valor e CTA
- Hashtags relevantes ao nicho da marca
- Mantenha o tom de voz da marca em TODO o conteúdo`;
  } else {
    prompt = `Você é redator de conteúdo para Instagram.

Gere conteúdo para um slide de carrossel sobre: "${topic}"

Tom: ${tone}

Retorne EXATAMENTE neste formato (sem markdown, sem aspas extras):
TITULO: [título impactante, máximo 6 palavras]
SUBTITULO: [subtítulo que complementa, máximo 15 palavras]
LEGENDA: [legenda para Instagram, 100-200 palavras, com emojis moderados e CTA]
HASHTAGS: [${hashtagsCount} hashtags separadas por vírgula, sem #]

Regras:
- Português BR
- Título deve ser hook que para o scroll
- Subtítulo complementa o título com dado ou contexto
- Legenda com gancho, valor e CTA
- Hashtags mix de alto volume e nicho`;
  }

  try {
    const result = await callGeminiText(apiKey, prompt);

    const titleMatch = result.match(/TITULO:\s*(.+)/i);
    const subtitleMatch = result.match(/SUBTITULO:\s*(.+)/i);
    const captionMatch = result.match(/LEGENDA:\s*([\s\S]+?)(?=HASHTAGS:|$)/i);
    const hashtagsMatch = result.match(/HASHTAGS:\s*(.+)/i);

    const title = titleMatch?.[1]?.trim() || topic;
    const subtitle = subtitleMatch?.[1]?.trim() || '';
    const captionText = captionMatch?.[1]?.trim() || '';
    const rawHashtags = hashtagsMatch?.[1]
      ?.split(',')
      .map((h: string) => h.trim().replace(/^#/, ''))
      .filter(Boolean) || [];

    const brandHashtags = brand?.defaultHashtags || [];
    const mergedHashtags = [...new Set([...brandHashtags, ...rawHashtags])].slice(0, hashtagsCount);
    const hashtags = mergedHashtags.length > 0 ? mergedHashtags : generateHashtags(topic, hashtagsCount, brand?.defaultHashtags);

    const caption = `${title}.\n${subtitle}${captionText ? `\n\n${captionText}` : ''}`;

    return { caption, hashtags };
  } catch (err) {
    console.error('[caption] Gemini failed, falling back to static:', err);
    return generateCaptionStatic(params, brand);
  }
}

interface GenerateImagePromptParams {
  topic: string;
  brandId?: string;
  style?: string;
  aspectRatio?: string;
  usage?: string;
}

interface GenerateImagePromptResult {
  prompt: string;
  negative_prompt: string;
  tips: string;
}

async function getBrandVisualContext(brandId: string): Promise<{ name: string; primaryColor?: string; secondaryColor?: string; description?: string } | null> {
  const { prisma } = await import('../config/database');
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return null;
  return {
    name: brand.name,
    primaryColor: brand.primaryColor || undefined,
    secondaryColor: brand.secondaryColor || undefined,
    description: brand.description || undefined,
  };
}

export async function generateImagePromptForStudio(params: GenerateImagePromptParams): Promise<GenerateImagePromptResult> {
  const { getSetting } = await import('../helpers/getSetting');
  const apiKey = await getSetting('NANO_BANANA_API_KEY');

  let brand: { name: string; primaryColor?: string; secondaryColor?: string; description?: string } | null = null;
  if (params.brandId) {
    brand = await getBrandVisualContext(params.brandId);
  }

  const style = params.style || 'fotográfico';
  const ratio = params.aspectRatio || '4:5 (retrato)';
  const usage = params.usage || 'post de Instagram/Facebook';

  let systemContext = '';
  if (brand) {
    systemContext = `
Contexto da marca: "${brand.name}"
${brand.description ? `Descrição: ${brand.description}` : ''}
Cores da marca: primária ${brand.primaryColor || 'N/A'}, secundária ${brand.secondaryColor || 'N/A'}
O prompt deve gerar uma imagem que combine visualmente com a identidade dessa marca.`;
  }

  const prompt = `Você é um especialista em engenharia de prompts para geração de imagens em IA (Google Gemini / Imagen 3).
Gere um prompt otimizado para Google AI Studio (Gemini) que produza uma imagem de alta qualidade.

TEMA: "${params.topic}"
ESTILO VISUAL: ${style}
PROPORÇÃO: ${ratio}
USO: ${usage}
${systemContext}

Retorne EXATAMENTE neste formato (sem markdown, sem aspas extras):

PROMPT: [prompt detalhado em inglês para gerar a imagem no AI Studio — seja específico sobre iluminação, composição, cores, texturas, atmosfera. Mínimo 50 palavras, máximo 150 palavras]
NEGATIVE: [negative prompt — o que evitar na imagem, ex: text, watermarks, blurry, deformed faces]
DICAS: [3 dicas curtas em português sobre como ajustar o prompt se o resultado não ficar bom]

Regras do prompt:
- SEMPRE em inglês (AI Studio gera melhor com prompts em inglês)
- Seja ultra-específico sobre composição, iluminação e atmosfera
- Inclua detalhes de textura e qualidade (ex: "crisp details", "professional photography")
- Se o tema envolver pessoas, especifique "diverse group" ou detalhes de aparência
- Para posts de redes sociais: fundo com espaço negativo para sobrepor texto depois
- NUNCA peça texto/letras na imagem (vamos adicionar via overlay HTML)
- Evite faces muito próximas (AI Studio distorce facilmente)`;

  if (!apiKey) {
    // Fallback: prompt simples sem Gemini
    const fallbackPrompt = `Professional ${style} style image for social media. Topic: ${params.topic}. High quality, vibrant colors, ${ratio} composition with negative space for text overlay. Crisp details, modern aesthetic.`;
    return {
      prompt: fallbackPrompt,
      negative_prompt: 'text, watermark, blurry, deformed faces, low quality, cartoon, illustration (unless specified)',
      tips: '1. Se a imagem tiver texto, adicione "no text, no letters" ao prompt.\n2. Se as cores não combinarem com a marca, ajuste as cores descritas no prompt.\n3. Para mais espaço de texto, adicione "generous negative space, minimal background".',
    };
  }

  try {
    const result = await callGeminiText(apiKey, prompt);

    const promptMatch = result.match(/PROMPT:\s*([\s\S]+?)(?=NEGATIVE:|$)/i);
    const negativeMatch = result.match(/NEGATIVE:\s*([\s\S]+?)(?=DICAS:|$)/i);
    const tipsMatch = result.match(/DICAS:\s*([\s\S]+?)(?=$)/i);

    return {
      prompt: promptMatch?.[1]?.trim() || `Professional ${style} image about ${params.topic}. High quality, vibrant, ${ratio}.`,
      negative_prompt: negativeMatch?.[1]?.trim() || 'text, watermark, blurry, deformed, low quality',
      tips: tipsMatch?.[1]?.trim() || 'Ajuste cores e composição conforme necessário.',
    };
  } catch (err) {
    console.error('[image-prompt] Gemini failed:', err);
    const fallbackPrompt = `Professional ${style} style image for social media. Topic: ${params.topic}. High quality, vibrant colors, ${ratio} composition with negative space for text overlay.`;
    return {
      prompt: fallbackPrompt,
      negative_prompt: 'text, watermark, blurry, deformed faces, low quality',
      tips: 'Gemini indisponível. Ajuste o prompt manualmente no AI Studio.',
    };
  }
}

export async function refineSlide(params: RefineSlideParams): Promise<RefineSlideResult> {
  const { getSetting } = await import('../helpers/getSetting');
  const apiKey = await getSetting('NANO_BANANA_API_KEY');

  if (!apiKey) {
    throw new Error('Configure sua Google Gemini API Key em Configurações para usar IA');
  }

  const { title, subtitle, label, instruction } = params;

  const prompt = `Você é um especialista em conteúdo para Instagram.

Conteúdo atual do slide:
${label ? `Label: "${label}"` : ''}
Título: "${title}"
${subtitle ? `Subtítulo: "${subtitle}"` : ''}

Instrução do usuário: "${instruction}"

Refine o conteúdo seguindo a instrução. Retorne EXATAMENTE neste formato (sem markdown):
TITULO: [título refinado, máximo 8 palavras]
SUBTITULO: [subtítulo refinado, máximo 20 palavras]
LABEL: [label refinado ou vazio se não tinha]

Regras:
- Português BR
- Mantenha impactante e conciso
- Siga a instrução do usuário fielmente`;

  const result = await callGeminiText(apiKey, prompt);

  const titleMatch = result.match(/TITULO:\s*(.+)/i);
  const subtitleMatch = result.match(/SUBTITULO:\s*(.+)/i);
  const labelMatch = result.match(/LABEL:\s*(.+)/i);

  return {
    title: titleMatch?.[1]?.trim() || title,
    subtitle: subtitleMatch?.[1]?.trim() || subtitle || '',
    label: labelMatch?.[1]?.trim() || label || '',
  };
}
