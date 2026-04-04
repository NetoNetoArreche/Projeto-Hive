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

const server = new McpServer({ name: 'openhive', version: '1.1.0' });

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

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
