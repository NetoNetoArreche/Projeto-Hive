#!/usr/bin/env node

/**
 * OpenHive MCP CLI
 *
 * Connects IDEs (Antigravity, Claude Desktop, Cursor, etc.) to your OpenHive instance.
 * Supports single image posts and carousels (2-10 images).
 *
 * Environment variables:
 *   OPENHIVE_API_URL   - Your OpenHive API URL (e.g., https://your-server.com)
 *   OPENHIVE_API_TOKEN - Your API token (from Settings > MCP Token)
 *
 * Usage in IDE config:
 * {
 *   "mcpServers": {
 *     "openhive": {
 *       "command": "npx",
 *       "args": ["-y", "openhive-mcp-server"],
 *       "env": {
 *         "OPENHIVE_API_URL": "https://your-api-url",
 *         "OPENHIVE_API_TOKEN": "your-token"
 *       }
 *     }
 *   }
 * }
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const API_URL = process.env.OPENHIVE_API_URL || process.env.OPENHIVE_URL || '';
const API_TOKEN = process.env.OPENHIVE_API_TOKEN || process.env.OPENHIVE_TOKEN || '';

if (!API_URL) {
  console.error('Error: OPENHIVE_API_URL environment variable is required');
  console.error('Set it in your IDE MCP config env section');
  process.exit(1);
}

async function apiRequest(path, options = {}) {
  const url = `${API_URL.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`,
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API request failed: ${res.status}`);
  return data.data;
}

const server = new McpServer({ name: 'openhive', version: '1.8.0' });

// ── Posts ──

server.tool(
  'create_post',
  'Cria um post para Instagram. Suporta imagem unica ou carrossel (2-10 imagens). Para carrossel, use image_prompts (gerar via IA) ou image_urls (URLs prontas)',
  {
    caption: z.string().optional().describe('Legenda do post'),
    image_prompt: z.string().optional().describe('Prompt para gerar UMA imagem via IA'),
    image_prompts: z.array(z.string()).min(2).max(10).optional().describe('Array de prompts para gerar carrossel (2-10 imagens via IA)'),
    image_urls: z.array(z.string()).min(2).max(10).optional().describe('Array de URLs de imagens prontas para carrossel (2-10). Use com render_html_to_image'),
    aspect_ratio: z.string().optional().describe('Formato: 1:1 (Feed), 4:5 (Retrato), 9:16 (Stories)'),
    scheduled_at: z.string().optional().describe('Data/hora para agendar (ISO 8601)'),
    hashtags: z.array(z.string()).optional().describe('Lista de hashtags'),
    tone: z.string().optional().describe('Tom da legenda: educativo, inspirador, humor, noticia'),
    editor_state: z.object({}).passthrough().optional().describe('Estado estruturado dos slides para o Editor Visual da web. Formato: { slides: SlideState[], brandId?, aspectRatio?, globalStyle? }. Quando presente, o post pode ser aberto e editado no visual editor.'),
  },
  async (input) => {
    let imageUrl;
    let images = [];
    let caption = input.caption;
    let hashtags = input.hashtags;
    const aspectRatio = input.aspect_ratio || '1:1';

    // Generate multiple images for carousel via IA
    if (input.image_prompts && input.image_prompts.length >= 2) {
      const results = await Promise.allSettled(
        input.image_prompts.map((prompt) =>
          apiRequest('/api/generate/image', {
            method: 'POST',
            body: JSON.stringify({ prompt, aspectRatio }),
          })
        )
      );
      images = results
        .filter((r) => r.status === 'fulfilled')
        .map((r, idx) => ({
          imageUrl: r.value.imageUrl,
          order: idx,
          prompt: input.image_prompts[idx],
          source: 'NANOBANA',
        }));

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        console.error(`[create_post] ${failed} image(s) failed to generate`);
      }
    }
    // Use provided URLs directly for carousel
    else if (input.image_urls && input.image_urls.length >= 2) {
      images = input.image_urls.map((url, idx) => ({
        imageUrl: url,
        order: idx,
        source: 'URL',
      }));
    }
    // Single image generation
    else if (input.image_prompt) {
      const img = await apiRequest('/api/generate/image', {
        method: 'POST',
        body: JSON.stringify({ prompt: input.image_prompt, aspectRatio }),
      });
      imageUrl = img.imageUrl;
    }

    // Auto-generate caption if not provided
    if (!caption) {
      const topic = input.image_prompt || (input.image_prompts && input.image_prompts[0]) || 'post de tecnologia';
      const result = await apiRequest('/api/generate/caption', {
        method: 'POST',
        body: JSON.stringify({ topic, tone: input.tone }),
      });
      caption = result.caption;
      hashtags = hashtags || result.hashtags;
    }

    const isCarousel = images.length >= 2;

    const postBody = {
      caption,
      hashtags,
      source: 'MCP',
      aspectRatio,
      isCarousel,
      ...(isCarousel ? { images } : { imageUrl }),
      ...(input.scheduled_at ? { scheduledAt: input.scheduled_at } : {}),
      ...(input.editor_state ? { editorState: input.editor_state } : {}),
    };

    const post = await apiRequest('/api/posts', {
      method: 'POST',
      body: JSON.stringify(postBody),
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          post_id: post.id,
          caption: post.caption,
          image_url: post.imageUrl,
          is_carousel: post.isCarousel,
          image_count: isCarousel ? images.length : (post.imageUrl ? 1 : 0),
          images: post.images || [],
          status: post.status,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'add_image_to_post',
  'Adiciona uma imagem a um post existente. Se o post ficar com 2+ imagens, vira carrossel automaticamente',
  {
    post_id: z.string().describe('ID do post'),
    image_url: z.string().optional().describe('URL de imagem pronta (de render_html_to_image ou upload)'),
    image_prompt: z.string().optional().describe('Prompt para gerar imagem via IA'),
    aspect_ratio: z.string().optional().describe('Formato: 1:1, 4:5, 9:16 (usado se gerar via IA)'),
  },
  async (input) => {
    let imageUrl = input.image_url;

    // Generate image if prompt provided
    if (!imageUrl && input.image_prompt) {
      const img = await apiRequest('/api/generate/image', {
        method: 'POST',
        body: JSON.stringify({
          prompt: input.image_prompt,
          aspectRatio: input.aspect_ratio || '1:1',
        }),
      });
      imageUrl = img.imageUrl;
    }

    if (!imageUrl) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: 'Provide image_url or image_prompt' }),
        }],
      };
    }

    const result = await apiRequest(`/api/posts/${input.post_id}/images`, {
      method: 'POST',
      body: JSON.stringify({
        imageUrl,
        source: input.image_prompt ? 'NANOBANA' : 'URL',
        prompt: input.image_prompt || null,
      }),
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool('list_posts', 'Lista posts com filtros', {
  status: z.string().optional().describe('Filtrar por status: DRAFT, SCHEDULED, PUBLISHED, FAILED'),
  limit: z.string().optional().describe('Limite de resultados'),
  page: z.string().optional().describe('Pagina'),
}, async (input) => {
  const params = new URLSearchParams();
  if (input.status) params.set('status', input.status);
  if (input.limit) params.set('limit', input.limit);
  if (input.page) params.set('page', input.page);
  const result = await apiRequest(`/api/posts?${params}`);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('publish_now', 'Publica um post imediatamente no Instagram', {
  post_id: z.string().describe('ID do post'),
  account_id: z.string().optional().describe('ID da conta Instagram (opcional, usa a padrao se nao informado)'),
}, async (input) => {
  const body = input.account_id ? { accountId: input.account_id } : {};
  const result = await apiRequest(`/api/posts/${input.post_id}/publish`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('schedule_post', 'Agenda um post para publicacao', {
  post_id: z.string().describe('ID do post'),
  datetime: z.string().describe('Data e hora ISO'),
}, async (input) => {
  const result = await apiRequest(`/api/posts/${input.post_id}/schedule`, {
    method: 'POST', body: JSON.stringify({ scheduledAt: input.datetime }),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('generate_image', 'Gera uma imagem via IA (NanoBana)', {
  prompt: z.string().describe('Descricao da imagem desejada'),
  aspectRatio: z.string().optional().describe('Formato: 1:1, 4:5, 9:16'),
}, async (input) => {
  const result = await apiRequest('/api/generate/image', {
    method: 'POST', body: JSON.stringify(input),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('generate_caption', 'Gera legenda otimizada para Instagram', {
  topic: z.string().describe('Tema do post'),
  tone: z.string().optional().describe('Tom: educativo, inspirador, humor, noticia'),
}, async (input) => {
  const result = await apiRequest('/api/generate/caption', {
    method: 'POST', body: JSON.stringify(input),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool(
  'render_html_to_image',
  'Renderiza HTML/CSS/Tailwind em imagem PNG. Retorna image_url. Para carrossel: chame para cada slide e depois use create_post com image_urls contendo todas as URLs',
  {
    html: z.string().describe('Codigo HTML completo do slide (suporta Tailwind CSS via CDN)'),
    width: z.number().optional().describe('Largura em pixels (default: 1080)'),
    height: z.number().optional().describe('Altura em pixels (default: 1080). Use 1350 para 4:5, 1920 para 9:16'),
  },
  async (input) => {
    const result = await apiRequest('/api/generate/html', {
      method: 'POST', body: JSON.stringify(input),
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          image_url: result.imageUrl,
          width: input.width || 1080,
          height: input.height || 1080,
          tip: 'Colete todas as image_urls dos slides e use create_post({ image_urls: [...], caption: "..." }) para criar o carrossel',
        }, null, 2),
      }],
    };
  }
);

server.tool('generate_template_image', 'Gera imagem usando template HTML pre-definido', {
  title: z.string().describe('Texto principal'),
  subtitle: z.string().optional().describe('Subtitulo'),
  template: z.string().optional().describe('Template: bold-gradient, minimal-dark, neon-card, quote-elegant, stats-impact, split-color'),
  aspect_ratio: z.string().optional().describe('Formato: 1:1, 4:5, 9:16'),
}, async (input) => {
  const result = await apiRequest('/api/generate/template', {
    method: 'POST', body: JSON.stringify({
      title: input.title, subtitle: input.subtitle,
      template: input.template || 'bold-gradient',
      aspectRatio: input.aspect_ratio || '1:1',
    }),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool(
  'compose_image_with_html_overlay',
  'Combina imagem de fundo (gerada por IA OU URL pronta) + overlay HTML/Tailwind por cima. O background fica como background-image full-screen e o HTML do usuario e renderizado por cima. Aceita brand_id para injetar CSS variables (--brand-primary, --brand-secondary, --brand-accent, --brand-text, --brand-font) e o logo no canto. Retorna image_url pronto para usar em create_post ou add_image_to_post',
  {
    html: z.string().describe('HTML do overlay (corpo apenas, sem <html><head>). Suporta Tailwind via CDN. Use as CSS variables var(--brand-primary), var(--brand-secondary), var(--brand-accent), var(--brand-text) quando brand_id for fornecido'),
    background_prompt: z.string().optional().describe('Prompt para gerar a imagem de fundo via IA (Gemini). Ex: "fundo abstrato com formas geometricas roxas". Use OU isto OU background_url'),
    background_url: z.string().optional().describe('URL de imagem ja pronta para usar como fundo. Use OU isto OU background_prompt'),
    aspect_ratio: z.enum(['1:1', '4:5', '9:16']).optional().describe('Proporcao: 1:1 (Feed), 4:5 (Retrato), 9:16 (Stories/Reels)'),
    overlay_opacity: z.number().min(0).max(1).optional().describe('Opacidade da camada escura entre fundo e HTML (0-1, default: 0). Use 0.4-0.6 quando o fundo e claro e os textos sao brancos'),
    brand_id: z.string().optional().describe('ID do brand para injetar cores como CSS variables e logo no canto. Use list_brands para descobrir IDs'),
    apply_brand: z.boolean().optional().describe('Se true (padrao quando brand_id e fornecido), aplica brand. Se false, ignora mesmo com brand_id'),
  },
  async (input) => {
    const body = {
      html: input.html,
      backgroundPrompt: input.background_prompt,
      backgroundUrl: input.background_url,
      aspectRatio: input.aspect_ratio,
      overlayOpacity: input.overlay_opacity,
      brandId: input.brand_id,
      applyBrand: input.apply_brand,
    };
    const result = await apiRequest('/api/generate/composed', {
      method: 'POST', body: JSON.stringify(body),
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          image_url: result.imageUrl,
          background_url: result.backgroundUrl,
          tip: 'Use this image_url with create_post or add_image_to_post to publish.',
        }, null, 2),
      }],
    };
  }
);

server.tool('upload_image', 'Faz upload de uma imagem (base64) para o storage', {
  image_base64: z.string().describe('Imagem em base64'),
  filename: z.string().describe('Nome do arquivo (ex: foto.png)'),
}, async (input) => {
  const result = await apiRequest('/api/upload', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('get_analytics', 'Retorna metricas dos posts publicados', {
  period: z.string().optional().describe('Periodo: 7d, 30d ou 90d'),
}, async (input) => {
  const params = new URLSearchParams();
  if (input.period) params.set('period', input.period);
  const result = await apiRequest(`/api/analytics?${params}`);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

// ── Tasks ──

server.tool('create_task', 'Cria uma tarefa de producao de conteudo', {
  title: z.string().describe('Titulo da tarefa'),
  description: z.string().optional().describe('Descricao'),
  platform: z.string().optional().describe('Plataforma: YOUTUBE, INSTAGRAM, TIKTOK, OTHER'),
  priority: z.string().optional().describe('Prioridade: LOW, MEDIUM, HIGH, URGENT'),
  recordDate: z.string().optional().describe('Data de gravacao ISO'),
  publishDate: z.string().optional().describe('Data de publicacao ISO'),
  script: z.string().optional().describe('Roteiro'),
  projectId: z.string().optional().describe('ID do projeto associado'),
  isSponsored: z.boolean().optional().describe('Se e patrocinado'),
  sponsorName: z.string().optional().describe('Nome do patrocinador'),
  sponsorBriefing: z.string().optional().describe('Briefing do patrocinador'),
  sponsorDeadline: z.string().optional().describe('Deadline do patrocinador ISO'),
}, async (input) => {
  const result = await apiRequest('/api/tasks', { method: 'POST', body: JSON.stringify(input) });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('list_tasks', 'Lista tarefas com filtros', {
  status: z.string().optional().describe('Status: PENDING, IN_PROGRESS, COMPLETED, CANCELLED'),
  priority: z.string().optional().describe('Prioridade: LOW, MEDIUM, HIGH, URGENT'),
  platform: z.string().optional().describe('Plataforma: YOUTUBE, INSTAGRAM, TIKTOK, OTHER'),
  projectId: z.string().optional().describe('ID do projeto'),
  limit: z.string().optional().describe('Limite'),
  page: z.string().optional().describe('Pagina'),
}, async (input) => {
  const params = new URLSearchParams();
  if (input.status) params.set('status', input.status);
  if (input.priority) params.set('priority', input.priority);
  if (input.platform) params.set('platform', input.platform);
  if (input.projectId) params.set('projectId', input.projectId);
  if (input.limit) params.set('limit', input.limit);
  if (input.page) params.set('page', input.page);
  const result = await apiRequest(`/api/tasks?${params}`);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('update_task', 'Atualiza uma tarefa', {
  task_id: z.string().describe('ID da tarefa'),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional().describe('PENDING, IN_PROGRESS, COMPLETED, CANCELLED'),
  priority: z.string().optional().describe('LOW, MEDIUM, HIGH, URGENT'),
  platform: z.string().optional(),
  recordDate: z.string().optional(),
  publishDate: z.string().optional(),
  script: z.string().optional(),
  projectId: z.string().optional(),
  isSponsored: z.boolean().optional(),
  sponsorName: z.string().optional(),
  sponsorBriefing: z.string().optional(),
  sponsorDeadline: z.string().optional(),
}, async (input) => {
  const { task_id, ...body } = input;
  const result = await apiRequest(`/api/tasks/${task_id}`, { method: 'PUT', body: JSON.stringify(body) });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('delete_task', 'Remove uma tarefa', {
  task_id: z.string().describe('ID da tarefa'),
}, async (input) => {
  const result = await apiRequest(`/api/tasks/${input.task_id}`, { method: 'DELETE' });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

// ── Projects ──

server.tool('create_project', 'Cria um projeto com modulos opcionais', {
  title: z.string().describe('Titulo'),
  description: z.string().optional(),
  modules: z.array(z.object({
    title: z.string(),
    content: z.string().optional(),
  })).optional().describe('Lista de modulos iniciais'),
}, async (input) => {
  const result = await apiRequest('/api/projects', { method: 'POST', body: JSON.stringify(input) });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('list_projects', 'Lista projetos', {
  status: z.string().optional().describe('PLANNING, IN_PROGRESS, COMPLETED, ARCHIVED'),
  limit: z.string().optional(),
}, async (input) => {
  const params = new URLSearchParams();
  if (input.status) params.set('status', input.status);
  if (input.limit) params.set('limit', input.limit);
  const result = await apiRequest(`/api/projects?${params}`);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('get_project', 'Detalhes de um projeto com modulos e tarefas', {
  project_id: z.string().describe('ID do projeto'),
}, async (input) => {
  const result = await apiRequest(`/api/projects/${input.project_id}`);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('update_project', 'Atualiza um projeto', {
  project_id: z.string().describe('ID do projeto'),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional().describe('PLANNING, IN_PROGRESS, COMPLETED, ARCHIVED'),
}, async (input) => {
  const { project_id, ...body } = input;
  const result = await apiRequest(`/api/projects/${project_id}`, { method: 'PUT', body: JSON.stringify(body) });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('delete_project', 'Deleta um projeto e seus modulos', {
  project_id: z.string().describe('ID do projeto'),
}, async (input) => {
  const result = await apiRequest(`/api/projects/${input.project_id}`, { method: 'DELETE' });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

// ── Modules ──

server.tool('add_module', 'Adiciona modulo a um projeto', {
  project_id: z.string().describe('ID do projeto'),
  title: z.string().describe('Titulo do modulo'),
  content: z.string().optional().describe('Conteudo/descricao'),
  order: z.number().optional().describe('Posicao na lista'),
}, async (input) => {
  const { project_id, ...body } = input;
  const result = await apiRequest(`/api/projects/${project_id}/modules`, {
    method: 'POST', body: JSON.stringify(body),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('update_module', 'Atualiza um modulo', {
  project_id: z.string().describe('ID do projeto'),
  module_id: z.string().describe('ID do modulo'),
  title: z.string().optional(),
  content: z.string().optional(),
  isRecorded: z.boolean().optional().describe('Marcar como gravado'),
  driveLink: z.string().optional().describe('Link do Google Drive'),
}, async (input) => {
  const { project_id, module_id, ...body } = input;
  const result = await apiRequest(`/api/projects/${project_id}/modules/${module_id}`, {
    method: 'PUT', body: JSON.stringify(body),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('delete_module', 'Remove modulo de um projeto', {
  project_id: z.string().describe('ID do projeto'),
  module_id: z.string().describe('ID do modulo'),
}, async (input) => {
  const result = await apiRequest(`/api/projects/${input.project_id}/modules/${input.module_id}`, {
    method: 'DELETE',
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

// ── Video Clips ──

server.tool('analyze_youtube_video', 'Analisa video do YouTube: baixa, transcreve e encontra melhores momentos', {
  url: z.string().describe('URL do video do YouTube'),
  whisper_model: z.string().optional().describe('Modelo Whisper: tiny, base, small, medium, large'),
  max_moments: z.number().optional().describe('Maximo de momentos (default: 10)'),
  language: z.string().optional().describe('Idioma: pt, en, es'),
}, async (input) => {
  const result = await apiRequest('/api/video-clips/analyze', {
    method: 'POST', body: JSON.stringify(input),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('cut_youtube_clips', 'Corta clips de video ja analisado', {
  video_clip_id: z.string().describe('ID do video clip'),
  clips: z.array(z.object({
    start: z.number().describe('Segundo inicial'),
    end: z.number().describe('Segundo final'),
    title: z.string().optional().describe('Titulo do clip'),
  })).describe('Lista de clips para cortar'),
  format: z.string().optional().describe('Formato: vertical, square, horizontal'),
  burn_subs: z.boolean().optional().describe('Queimar legendas no video'),
}, async (input) => {
  const result = await apiRequest(`/api/video-clips/${input.video_clip_id}/cut`, {
    method: 'POST', body: JSON.stringify({
      clips: input.clips,
      format: input.format,
      burnSubs: input.burn_subs,
    }),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('list_video_clips', 'Lista video clips com status', {
  status: z.string().optional().describe('PENDING, ANALYZING, ANALYZED, CLIPPING, READY, FAILED'),
  page: z.string().optional().describe('Pagina'),
  limit: z.string().optional().describe('Itens por pagina'),
}, async (input) => {
  const params = new URLSearchParams();
  if (input.status) params.set('status', input.status);
  if (input.page) params.set('page', input.page);
  if (input.limit) params.set('limit', input.limit);
  const result = await apiRequest(`/api/video-clips?${params}`);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

// ── Update Post & Mixed Carousel ──

server.tool('update_post', 'Atualiza um post existente (legenda, hashtags, agendamento). Se o post estiver agendado e voce mudar a data, o agendamento e atualizado automaticamente', {
  post_id: z.string().describe('ID do post'),
  caption: z.string().optional().describe('Nova legenda'),
  hashtags: z.array(z.string()).optional().describe('Novas hashtags'),
  scheduled_at: z.string().optional().describe('Nova data/hora de agendamento (ISO 8601). Reagenda automaticamente se ja estiver agendado'),
  status: z.enum(['DRAFT', 'SCHEDULED']).optional().describe('Novo status (DRAFT cancela agendamento)'),
}, async (input) => {
  const body = {};
  if (input.caption !== undefined) body.caption = input.caption;
  if (input.hashtags !== undefined) body.hashtags = input.hashtags;
  if (input.scheduled_at !== undefined) body.scheduledAt = input.scheduled_at;
  if (input.status !== undefined) body.status = input.status;
  const result = await apiRequest(`/api/posts/${input.post_id}`, {
    method: 'PUT', body: JSON.stringify(body),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool(
  'create_mixed_carousel',
  'Cria carrossel misto: capa gerada por IA (Gemini) + slides informativos em HTML/Template. Aceita brand_id para aplicar logo, cores e tom de voz da marca automaticamente',
  {
    cover_prompt: z.string().describe('Prompt para gerar a imagem de capa via IA (primeiro slide)'),
    slides: z.array(z.object({
      title: z.string().describe('Texto principal do slide'),
      subtitle: z.string().optional().describe('Subtitulo do slide'),
      template: z.string().optional().describe('Template: bold-gradient, minimal-dark, neon-card, quote-elegant, stats-impact, split-color'),
    })).min(1).max(9).describe('Lista de slides template (1-9, a capa IA conta como slide 1)'),
    caption: z.string().optional().describe('Legenda do post (gerada automaticamente se nao informada)'),
    hashtags: z.array(z.string()).optional().describe('Lista de hashtags'),
    aspect_ratio: z.enum(['1:1', '4:5', '9:16']).optional().describe('Proporcao: 1:1 (Feed), 4:5 (Retrato), 9:16 (Stories)'),
    tone: z.string().optional().describe('Tom da legenda: educativo, inspirador, humor, noticia'),
    scheduled_at: z.string().optional().describe('Data/hora para agendar (ISO 8601)'),
    brand_id: z.string().optional().describe('ID do brand para aplicar identidade visual (logo + cores + tom + hashtags). Use list_brands antes'),
    apply_brand: z.boolean().optional().describe('Se true (padrao), aplica brand. Se false, ignora mesmo com brand_id'),
  },
  async (input) => {
    const aspectRatio = input.aspect_ratio || '1:1';
    const images = [];

    // Resolve brand if provided
    let brand = null;
    if (input.brand_id && input.apply_brand !== false) {
      try {
        brand = await apiRequest(`/api/brands/${input.brand_id}`);
      } catch (err) {
        // ignore brand load errors
      }
    }

    // Step 1: AI cover (with brand hints in prompt)
    let coverPrompt = input.cover_prompt;
    if (brand) {
      const hints = [];
      if (brand.primaryColor) hints.push(`paleta ${brand.primaryColor} e ${brand.secondaryColor || ''}`);
      if (brand.voiceTone) hints.push(`estilo ${brand.voiceTone}`);
      if (hints.length > 0) coverPrompt = `${input.cover_prompt}. Identidade visual: ${hints.join(', ')}`;
    }
    const cover = await apiRequest('/api/generate/image', {
      method: 'POST', body: JSON.stringify({ prompt: coverPrompt, aspectRatio }),
    });
    images.push({ imageUrl: cover.imageUrl, order: 0, prompt: coverPrompt });

    // Step 2: Template slides (with brand colors/logo if available)
    const slideResults = await Promise.allSettled(
      input.slides.map((slide) => {
        const body = {
          title: slide.title,
          subtitle: slide.subtitle,
          template: slide.template || 'bold-gradient',
          aspectRatio,
        };
        if (input.brand_id) {
          body.brandId = input.brand_id;
          body.applyBrand = input.apply_brand !== false;
        }
        return apiRequest('/api/generate/template', {
          method: 'POST', body: JSON.stringify(body),
        });
      })
    );

    for (let i = 0; i < slideResults.length; i++) {
      const r = slideResults[i];
      if (r.status === 'fulfilled') {
        images.push({ imageUrl: r.value.imageUrl, order: images.length, prompt: input.slides[i].title });
      }
    }

    if (images.length < 2) {
      throw new Error(`Carrossel precisa de pelo menos 2 imagens. Apenas ${images.length} gerada(s) com sucesso.`);
    }

    // Step 3: Caption
    let caption = input.caption;
    let hashtags = input.hashtags;
    if (!caption) {
      const tone = input.tone || (brand && brand.voiceTone) || undefined;
      const result = await apiRequest('/api/generate/caption', {
        method: 'POST', body: JSON.stringify({ topic: input.cover_prompt, tone }),
      });
      caption = result.caption;
      hashtags = hashtags || result.hashtags;
    }

    // Merge brand default hashtags
    if (brand && brand.defaultHashtags && brand.defaultHashtags.length) {
      const existing = new Set((hashtags || []).map((h) => h.toLowerCase()));
      const merged = [...(hashtags || [])];
      for (const tag of brand.defaultHashtags) {
        if (!existing.has(tag.toLowerCase())) merged.push(tag);
      }
      hashtags = merged;
    }

    // Step 4: Build editorState for visual editor
    const tplMap = { 'bold-gradient': 'content', 'minimal-dark': 'content', 'neon-card': 'content', 'quote-elegant': 'quote', 'stats-impact': 'stat', 'split-color': 'content' };
    // bgUrl = background image, renderedUrl = pre-rendered template image (for preview/export)
    const mkSlide = (id, tpl, bgUrl, bgPrompt, title, subtitle, label, num, isCta, renderedUrl) => ({
      id, template: tpl,
      backgroundUrl: bgUrl, renderedUrl: renderedUrl || '', backgroundPrompt: bgPrompt || '',
      backgroundX: 50, backgroundY: 50, backgroundZoom: 100,
      backgroundOpacity: 100, backgroundFlipH: false, infiniteCarousel: false,
      overlayOpacity: tpl === 'hero' ? 0.4 : 0.5, overlayStyle: tpl === 'hero' ? 'base' : 'gradient',
      slideBgColor: '#000000', slideBgPattern: 'none', slideBgPatternSize: 40, slideBgPatternOpacity: 15,
      label: label || '', title: title || '', subtitle: subtitle || '', stat: '',
      position: tpl === 'hero' ? 'bottom-left' : 'middle-center', textAlign: 'center',
      fontFamily: 'Inter', fontWeight: 800,
      titleColor: (brand && brand.primaryColor) || '#ffffff', titleFontSize: 72, titleLetterSpacing: -0.02,
      subtitleFontFamily: 'Inter', subtitleFontWeight: 400,
      subtitleColor: '#ffffff', subtitleFontSize: 28, subtitleLetterSpacing: 0, subtitleLineHeight: 1.4,
      globalScale: 100, glassEffect: tpl !== 'hero',
      cornerTopLeft: '', cornerTopRight: '', cornerBottomLeft: '', cornerBottomRight: '',
      cornerTopLeftEnabled: true, cornerTopRightEnabled: true, cornerBottomLeftEnabled: true, cornerBottomRightEnabled: true,
      logoPosition: '', customLogoUrl: '', showLogo: true, showProfileBadge: false,
      showIndicators: true, totalSlides: images.length, slideNumber: num,
      showCTA: !!isCta, ctaText: '', wordHighlights: {}, refinePrompt: '',
    });

    const editorSlides = [
      mkSlide('cover', 'hero', images[0].imageUrl, coverPrompt, input.slides[0]?.title || '', input.slides[0]?.subtitle || '', '', 1, false, ''),
      // Template slides: cover image as bg, template-rendered image as renderedUrl (not backgroundUrl to avoid double text)
      ...input.slides.map((s, i) => mkSlide(
        `slide${i+2}`, tplMap[s.template || 'bold-gradient'] || 'content',
        images[0].imageUrl, '', s.title, s.subtitle || '',
        i === input.slides.length - 1 ? '' : `Passo ${i+1}`, i+2,
        i === input.slides.length - 1,
        images[i+1]?.imageUrl || ''
      )),
    ];

    const editorState = {
      slides: editorSlides, brandId: input.brand_id || '', aspectRatio,
      globalStyle: { showCorners: true, showIndicators: true, cornerFontSize: 20, cornerEdgeDistance: 80, cornerOpacity: 85, cornerGlass: false, cornerBorder: false, bottomRightIcon: 'none' },
    };

    // Step 5: Create post with editorState
    const post = await apiRequest('/api/posts', {
      method: 'POST',
      body: JSON.stringify({
        caption, hashtags, source: 'MCP', aspectRatio,
        isCarousel: true, images, editorState,
        ...(input.scheduled_at ? { scheduledAt: input.scheduled_at } : {}),
      }),
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
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
        }, null, 2),
      }],
    };
  }
);

// ── Design Systems (visual inspirations library) ──

server.tool(
  'list_design_systems',
  'Lista a biblioteca de 58 design systems de marcas conhecidas (Stripe, Linear, Apple, Notion, etc) que podem ser usados como inspiracao visual para criar brands. Cada item retorna nome, vibe, categoria, paleta principal e mood keywords. Use isso quando o usuario pedir ajuda para criar um brand do zero ou refinar a identidade visual',
  {
    category: z.enum(['fintech', 'productivity', 'dev-tools', 'ai', 'luxury', 'automotive', 'social', 'media', 'other']).optional().describe('Filtrar por categoria'),
    search: z.string().optional().describe('Buscar por nome, vibe ou mood keyword (ex: warm, dark, minimal)'),
    limit: z.number().optional().describe('Quantidade maxima a retornar'),
  },
  async (input) => {
    const params = new URLSearchParams();
    if (input.category) params.set('category', input.category);
    if (input.search) params.set('search', input.search);
    if (input.limit) params.set('limit', String(input.limit));
    const qs = params.toString();
    const result = await apiRequest(`/api/design-systems${qs ? '?' + qs : ''}`);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          total_in_library: result.totalAvailable,
          returned: result.total,
          design_systems: result.items.map((d) => ({
            id: d.id,
            name: d.name,
            vibe: d.vibe,
            category: d.category,
            mood_keywords: d.moodKeywords,
            primary_color: d.colors.primary,
            secondary_color: d.colors.secondary,
          })),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'get_design_system',
  'Retorna detalhes completos de um design system especifico (todas as cores, tipografia, principios). Use depois de list_design_systems quando o usuario escolher uma inspiracao',
  {
    design_system_id: z.string().describe('ID do design system (ex: stripe, linear, apple)'),
  },
  async (input) => {
    const result = await apiRequest(`/api/design-systems/${input.design_system_id}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'list_design_system_categories',
  'Retorna as categorias disponiveis na biblioteca de design systems com a quantidade em cada (fintech, dev-tools, ai, etc)',
  {},
  async () => {
    const result = await apiRequest('/api/design-systems/categories');
    return { content: [{ type: 'text', text: JSON.stringify({ categories: result }, null, 2) }] };
  }
);

server.tool(
  'suggest_brand_from_inspirations',
  'Combina 1-5 design systems da biblioteca em uma sugestao de brand. Retorna paleta de cores, fonte, tom de voz e descricao. NAO salva nada - apenas sugere. Para salvar use create_brand depois que o usuario aprovar',
  {
    inspiration_ids: z.array(z.string()).min(1).max(5).describe('IDs dos design systems para combinar (ex: ["stripe", "linear"])'),
    business_name: z.string().optional().describe('Nome do negocio do usuario'),
    business_type: z.string().optional().describe('Tipo de negocio (ex: "AI startup", "fintech")'),
  },
  async (input) => {
    const result = await apiRequest('/api/design-systems/suggest', {
      method: 'POST',
      body: JSON.stringify({
        inspirationIds: input.inspiration_ids,
        businessName: input.business_name,
        businessType: input.business_type,
      }),
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Brands ──

server.tool('list_brands', 'Lista todos os brands cadastrados (identidade visual: logo, cores, produtos, tom de voz). Use ANTES de criar qualquer post visual para perguntar ao usuario qual brand aplicar', {}, async () => {
  const result = await apiRequest('/api/brands');
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('get_brand', 'Retorna detalhes completos de um brand especifico', {
  brand_id: z.string().describe('ID do brand'),
}, async (input) => {
  const result = await apiRequest(`/api/brands/${input.brand_id}`);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('get_default_brand', 'Retorna o brand padrao do usuario (se houver). Util para aplicar automaticamente quando o usuario nao especifica', {}, async () => {
  const result = await apiRequest('/api/brands/default');
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('create_brand', 'Cria um novo brand com identidade visual completa: 6 cores (primary, secondary, accent, background, text, muted) + 3 fontes (display, heading, body). Aceita website_url e instagram_url para que agentes possam pesquisar referencias', {
  name: z.string().describe('Nome do brand'),
  logo_url: z.string().optional().describe('URL do logo'),
  primary_color: z.string().optional().describe('Cor primaria em hex (#RRGGBB) - cor principal da marca'),
  secondary_color: z.string().optional().describe('Cor secundaria em hex - cor de apoio'),
  accent_color: z.string().optional().describe('Cor de destaque em hex - usada em CTAs e highlights'),
  background_color: z.string().optional().describe('Cor de fundo em hex - cor base dos slides'),
  text_color: z.string().optional().describe('Cor de texto principal em hex'),
  muted_color: z.string().optional().describe('Cor neutra/muted em hex - bordas, textos secundarios'),
  font_family: z.string().optional().describe('Familia de fonte display/principal (ex: Inter Variable)'),
  heading_font: z.string().optional().describe('Fonte para titulos (ex: Sora, Geist)'),
  body_font: z.string().optional().describe('Fonte para textos longos/body (ex: Inter)'),
  description: z.string().optional().describe('Descricao do brand'),
  voice_tone: z.string().optional().describe('Tom de voz: profissional, descontraido, educativo'),
  website_url: z.string().optional().describe('URL do site oficial - agentes podem visitar para pesquisar informacoes e contexto'),
  instagram_url: z.string().optional().describe('URL do perfil Instagram - agentes podem analisar o estilo visual e de conteudo'),
  products: z.array(z.string()).optional().describe('Lista de produtos/servicos'),
  default_hashtags: z.array(z.string()).optional().describe('Hashtags padrao a aplicar nos posts'),
  is_default: z.boolean().optional().describe('Se este sera o brand padrao'),
}, async (input) => {
  const body = {
    name: input.name,
    logoUrl: input.logo_url,
    primaryColor: input.primary_color,
    secondaryColor: input.secondary_color,
    accentColor: input.accent_color,
    backgroundColor: input.background_color,
    textColor: input.text_color,
    mutedColor: input.muted_color,
    fontFamily: input.font_family,
    headingFont: input.heading_font,
    bodyFont: input.body_font,
    description: input.description,
    voiceTone: input.voice_tone,
    websiteUrl: input.website_url,
    instagramUrl: input.instagram_url,
    products: input.products,
    defaultHashtags: input.default_hashtags,
    isDefault: input.is_default,
  };
  const result = await apiRequest('/api/brands', {
    method: 'POST', body: JSON.stringify(body),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('update_brand', 'Atualiza um brand existente. Todos os campos sao opcionais - so envie o que quer mudar', {
  brand_id: z.string().describe('ID do brand'),
  name: z.string().optional(),
  logo_url: z.string().optional(),
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
  accent_color: z.string().optional(),
  background_color: z.string().optional(),
  text_color: z.string().optional(),
  muted_color: z.string().optional(),
  font_family: z.string().optional(),
  heading_font: z.string().optional(),
  body_font: z.string().optional(),
  description: z.string().optional(),
  voice_tone: z.string().optional(),
  website_url: z.string().optional(),
  instagram_url: z.string().optional(),
  products: z.array(z.string()).optional(),
  default_hashtags: z.array(z.string()).optional(),
  is_default: z.boolean().optional(),
}, async (input) => {
  const body = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.logo_url !== undefined) body.logoUrl = input.logo_url;
  if (input.primary_color !== undefined) body.primaryColor = input.primary_color;
  if (input.secondary_color !== undefined) body.secondaryColor = input.secondary_color;
  if (input.accent_color !== undefined) body.accentColor = input.accent_color;
  if (input.background_color !== undefined) body.backgroundColor = input.background_color;
  if (input.text_color !== undefined) body.textColor = input.text_color;
  if (input.muted_color !== undefined) body.mutedColor = input.muted_color;
  if (input.font_family !== undefined) body.fontFamily = input.font_family;
  if (input.heading_font !== undefined) body.headingFont = input.heading_font;
  if (input.body_font !== undefined) body.bodyFont = input.body_font;
  if (input.description !== undefined) body.description = input.description;
  if (input.voice_tone !== undefined) body.voiceTone = input.voice_tone;
  if (input.website_url !== undefined) body.websiteUrl = input.website_url;
  if (input.instagram_url !== undefined) body.instagramUrl = input.instagram_url;
  if (input.products !== undefined) body.products = input.products;
  if (input.default_hashtags !== undefined) body.defaultHashtags = input.default_hashtags;
  if (input.is_default !== undefined) body.isDefault = input.is_default;
  const result = await apiRequest(`/api/brands/${input.brand_id}`, {
    method: 'PUT', body: JSON.stringify(body),
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('set_default_brand', 'Define um brand como padrao (desmarca os outros automaticamente)', {
  brand_id: z.string().describe('ID do brand a tornar padrao'),
}, async (input) => {
  const result = await apiRequest(`/api/brands/${input.brand_id}/default`, { method: 'PUT' });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('delete_brand', 'Remove um brand', {
  brand_id: z.string().describe('ID do brand a remover'),
}, async (input) => {
  const result = await apiRequest(`/api/brands/${input.brand_id}`, { method: 'DELETE' });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
