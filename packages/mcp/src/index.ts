import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import http from 'node:http';
import { z } from 'zod';
import { createPost } from './tools/createPost';
import { generateImage } from './tools/generateImage';
import { generateCaption } from './tools/generateCaption';
import { schedulePost } from './tools/schedulePost';
import { listPosts } from './tools/listPosts';
import { publishNow } from './tools/publishNow';
import { uploadImage } from './tools/uploadImage';
import { getAnalytics } from './tools/getAnalytics';
import { addImageToPost } from './tools/addImageToPost';
import { createTask } from './tools/createTask';
import { listTasks } from './tools/listTasks';
import { updateTask } from './tools/updateTask';
import { deleteTask } from './tools/deleteTask';
import { createProject } from './tools/createProject';
import { listProjects } from './tools/listProjects';
import { getProject } from './tools/getProject';
import { updateProject } from './tools/updateProject';
import { deleteProject } from './tools/deleteProject';
import { addModule } from './tools/addModule';
import { updateModule } from './tools/updateModule';
import { deleteModule } from './tools/deleteModule';
import { generateTemplateImage } from './tools/generateTemplateImage';
import { renderHtmlToImage } from './tools/renderHtmlToImage';
import { analyzeYoutubeVideo } from './tools/analyzeYoutubeVideo';
import { cutYoutubeClips } from './tools/cutYoutubeClips';
import { listVideoClips } from './tools/listVideoClips';

const PORT = parseInt(process.env.PORT || '3002', 10);

function registerTools(server: McpServer) {
  server.tool(
    'create_post',
    'Cria um post para Instagram. Suporta imagem unica ou carrossel (2-10 imagens)',
    {
      caption: z.string().optional().describe('Legenda do post'),
      image_prompt: z.string().optional().describe('Prompt para gerar UMA imagem'),
      image_prompts: z.array(z.string()).min(2).max(10).optional().describe('Array de prompts para gerar carrossel (2-10 imagens)'),
      image_urls: z.array(z.string()).min(2).max(10).optional().describe('Array de URLs de imagens prontas para carrossel'),
      aspect_ratio: z.enum(['1:1', '4:5', '9:16']).optional().describe('Proporcao da imagem: 1:1 (Feed), 4:5 (Retrato), 9:16 (Stories)'),
      scheduled_at: z.string().optional().describe('Data/hora para agendar (ISO 8601)'),
      hashtags: z.array(z.string()).optional().describe('Lista de hashtags'),
      tone: z.string().optional().describe('Tom: educativo, inspirador, humor, noticia'),
    },
    async ({ caption, image_prompt, image_prompts, image_urls, aspect_ratio, scheduled_at, hashtags, tone }) => {
      const result = await createPost({ caption, image_prompt, image_prompts, image_urls, aspect_ratio, scheduled_at, hashtags, tone });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'add_image_to_post',
    'Adiciona uma imagem a um post existente (transforma em carrossel se tiver 2+ imagens)',
    {
      post_id: z.string().describe('ID do post'),
      image_prompt: z.string().optional().describe('Prompt para gerar imagem via IA'),
      image_url: z.string().optional().describe('URL de imagem pronta'),
    },
    async ({ post_id, image_prompt, image_url }) => {
      const result = await addImageToPost({ post_id, image_prompt, image_url });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'generate_image',
    'Gera uma imagem via Nano Banana API',
    {
      prompt: z.string().describe('Descrição da imagem desejada'),
      style: z.string().optional().describe('Estilo da imagem'),
      aspect_ratio: z.enum(['1:1', '9:16', '4:5']).optional().describe('Proporção da imagem'),
    },
    async ({ prompt, style, aspect_ratio }) => {
      const result = await generateImage({ prompt, style, aspect_ratio });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'generate_caption',
    'Gera uma legenda otimizada para Instagram',
    {
      topic: z.string().describe('Tema do post'),
      tone: z.enum(['educativo', 'inspirador', 'humor', 'noticia']).optional().describe('Tom da legenda'),
      hashtags_count: z.number().optional().describe('Quantidade de hashtags (1-30)'),
      language: z.string().optional().describe('Idioma (padrão: pt-BR)'),
      max_length: z.number().optional().describe('Tamanho máximo da legenda'),
    },
    async ({ topic, tone, hashtags_count, language, max_length }) => {
      const result = await generateCaption({ topic, tone, hashtags_count, language, max_length });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'schedule_post',
    'Agenda um post para publicação em data/hora específica',
    {
      post_id: z.string().describe('ID do post'),
      datetime: z.string().describe('Data/hora para publicação (ISO 8601)'),
    },
    async ({ post_id, datetime }) => {
      const result = await schedulePost({ post_id, datetime });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_posts',
    'Lista posts por filtro',
    {
      status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']).optional().describe('Filtrar por status'),
      limit: z.number().optional().describe('Quantidade por página'),
      offset: z.number().optional().describe('Offset para paginação'),
    },
    async ({ status, limit, offset }) => {
      const result = await listPosts({ status, limit, offset });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'publish_now',
    'Publica um post imediatamente no Instagram. Use account_id para escolher a conta',
    {
      post_id: z.string().describe('ID do post para publicar'),
      account_id: z.string().optional().describe('ID da conta Instagram (opcional, usa a padrao se nao informado)'),
    },
    async ({ post_id, account_id }) => {
      const result = await publishNow({ post_id, account_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'upload_image',
    'Faz upload de uma imagem (base64) para o storage',
    {
      image_base64: z.string().describe('Imagem em base64'),
      filename: z.string().describe('Nome do arquivo (ex: foto.png)'),
    },
    async ({ image_base64, filename }) => {
      const result = await uploadImage({ image_base64, filename });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_analytics',
    'Retorna métricas dos posts publicados',
    {
      period: z.enum(['7d', '30d', '90d']).optional().describe('Período: 7d, 30d ou 90d'),
    },
    async ({ period }) => {
      const result = await getAnalytics({ period });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Task tools ──

  server.tool(
    'create_task',
    'Cria uma tarefa de producao de conteudo (gravacao de video, post patrocinado, etc)',
    {
      title: z.string().describe('Titulo da tarefa'),
      description: z.string().optional().describe('Descricao detalhada'),
      platform: z.enum(['YOUTUBE', 'INSTAGRAM', 'META_ADS', 'TIKTOK', 'OTHER']).describe('Plataforma alvo'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('Prioridade (padrao: MEDIUM)'),
      recordDate: z.string().optional().describe('Data/hora de gravacao (ISO 8601)'),
      publishDate: z.string().optional().describe('Data/hora de publicacao (ISO 8601)'),
      script: z.string().optional().describe('Roteiro do video'),
      scriptFileUrl: z.string().optional().describe('URL do arquivo do roteiro (PDF, DOC, etc)'),
      driveLink: z.string().optional().describe('Link do Google Drive'),
      isSponsored: z.boolean().optional().describe('Se e conteudo patrocinado'),
      sponsorName: z.string().optional().describe('Nome da empresa patrocinadora'),
      sponsorBriefing: z.string().optional().describe('Briefing do patrocinador'),
      briefingFileUrl: z.string().optional().describe('URL do arquivo do briefing (PDF, DOC, etc)'),
      sponsorContact: z.string().optional().describe('Contato do patrocinador'),
      sponsorDeadline: z.string().optional().describe('Deadline do patrocinador (ISO 8601)'),
      projectId: z.string().optional().describe('ID do projeto associado'),
    },
    async (input) => {
      const result = await createTask(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_tasks',
    'Lista tarefas de producao com filtros (status, prioridade, plataforma, datas)',
    {
      status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional().describe('Filtrar por status'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('Filtrar por prioridade'),
      platform: z.enum(['YOUTUBE', 'INSTAGRAM', 'META_ADS', 'TIKTOK', 'OTHER']).optional().describe('Filtrar por plataforma'),
      projectId: z.string().optional().describe('Filtrar por projeto'),
      from: z.string().optional().describe('Data inicial (ISO 8601)'),
      to: z.string().optional().describe('Data final (ISO 8601)'),
      limit: z.number().optional().describe('Quantidade por pagina'),
      offset: z.number().optional().describe('Offset para paginacao'),
    },
    async (input) => {
      const result = await listTasks(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'update_task',
    'Atualiza uma tarefa existente (status, datas, roteiro, dados de patrocinio, etc)',
    {
      task_id: z.string().describe('ID da tarefa'),
      title: z.string().optional().describe('Novo titulo'),
      description: z.string().optional().describe('Nova descricao'),
      status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional().describe('Novo status'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('Nova prioridade'),
      platform: z.enum(['YOUTUBE', 'INSTAGRAM', 'META_ADS', 'TIKTOK', 'OTHER']).optional().describe('Nova plataforma'),
      recordDate: z.string().optional().describe('Nova data de gravacao (ISO 8601)'),
      publishDate: z.string().optional().describe('Nova data de publicacao (ISO 8601)'),
      script: z.string().optional().describe('Novo roteiro'),
      scriptFileUrl: z.string().optional().describe('URL do arquivo do roteiro (PDF, DOC, etc)'),
      driveLink: z.string().optional().describe('Novo link do Drive'),
      isSponsored: z.boolean().optional().describe('Marcar como patrocinado'),
      sponsorName: z.string().optional().describe('Nome do patrocinador'),
      sponsorBriefing: z.string().optional().describe('Briefing do patrocinador'),
      briefingFileUrl: z.string().optional().describe('URL do arquivo do briefing (PDF, DOC, etc)'),
      sponsorContact: z.string().optional().describe('Contato do patrocinador'),
      sponsorDeadline: z.string().optional().describe('Deadline do patrocinador (ISO 8601)'),
      projectId: z.string().optional().describe('ID do projeto associado'),
    },
    async (input) => {
      const result = await updateTask(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'delete_task',
    'Deleta uma tarefa',
    {
      task_id: z.string().describe('ID da tarefa para deletar'),
    },
    async ({ task_id }) => {
      const result = await deleteTask({ task_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Project tools ──

  server.tool(
    'create_project',
    'Cria um projeto (curso, serie de videos) com modulos opcionais',
    {
      title: z.string().describe('Titulo do projeto'),
      description: z.string().optional().describe('Descricao do projeto'),
      modules: z.array(z.object({
        title: z.string().describe('Titulo do modulo'),
        content: z.string().optional().describe('Conteudo/descricao do modulo'),
      })).optional().describe('Lista de modulos iniciais'),
    },
    async (input) => {
      const result = await createProject(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_projects',
    'Lista projetos com filtro por status',
    {
      status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional().describe('Filtrar por status'),
      limit: z.number().optional().describe('Quantidade por pagina'),
      offset: z.number().optional().describe('Offset para paginacao'),
    },
    async (input) => {
      const result = await listProjects(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_project',
    'Retorna detalhes de um projeto com seus modulos e tarefas',
    {
      project_id: z.string().describe('ID do projeto'),
    },
    async ({ project_id }) => {
      const result = await getProject({ project_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'update_project',
    'Atualiza titulo, descricao ou status de um projeto',
    {
      project_id: z.string().describe('ID do projeto'),
      title: z.string().optional().describe('Novo titulo'),
      description: z.string().optional().describe('Nova descricao'),
      status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional().describe('Novo status'),
    },
    async (input) => {
      const result = await updateProject(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'delete_project',
    'Deleta um projeto e todos seus modulos',
    {
      project_id: z.string().describe('ID do projeto para deletar'),
    },
    async ({ project_id }) => {
      const result = await deleteProject({ project_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Module tools ──

  server.tool(
    'add_module',
    'Adiciona um modulo a um projeto existente',
    {
      project_id: z.string().describe('ID do projeto'),
      title: z.string().describe('Titulo do modulo'),
      content: z.string().optional().describe('Conteudo/descricao do modulo'),
      order: z.number().optional().describe('Posicao do modulo na lista'),
    },
    async (input) => {
      const result = await addModule(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'update_module',
    'Atualiza um modulo (titulo, conteudo, marcar como gravado, link do Drive)',
    {
      project_id: z.string().describe('ID do projeto'),
      module_id: z.string().describe('ID do modulo'),
      title: z.string().optional().describe('Novo titulo'),
      content: z.string().optional().describe('Novo conteudo'),
      isRecorded: z.boolean().optional().describe('Marcar como gravado (true/false)'),
      driveLink: z.string().optional().describe('Link do Google Drive com o video gravado'),
    },
    async (input) => {
      const result = await updateModule(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'delete_module',
    'Remove um modulo de um projeto',
    {
      project_id: z.string().describe('ID do projeto'),
      module_id: z.string().describe('ID do modulo para remover'),
    },
    async ({ project_id, module_id }) => {
      const result = await deleteModule({ project_id, module_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Template Image ──

  server.tool(
    'generate_template_image',
    'Gera imagem de post usando template HTML/CSS (sem precisar de IA). Templates: bold-gradient, minimal-dark, neon-card, quote-elegant, stats-impact, split-color',
    {
      title: z.string().describe('Texto principal do post'),
      subtitle: z.string().optional().describe('Subtitulo ou complemento'),
      body: z.string().optional().describe('Texto adicional menor'),
      accent: z.string().optional().describe('Cor accent em hex (default: #6C5CE7)'),
      template: z.string().optional().describe('Template: bold-gradient, minimal-dark, neon-card, quote-elegant, stats-impact, split-color'),
      aspect_ratio: z.string().optional().describe('Formato: 1:1 (feed), 4:5 (retrato), 9:16 (stories)'),
    },
    async (input) => {
      const result = await generateTemplateImage(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── HTML to Image ──

  server.tool(
    'render_html_to_image',
    'Renderiza HTML/CSS/Tailwind em imagem PNG. Use para criar posts visuais com codigo HTML gerado pela IA. Suporta Tailwind CSS via CDN.',
    {
      html: z.string().describe('Codigo HTML completo do post (pode usar Tailwind CSS)'),
      width: z.number().optional().describe('Largura em pixels (default: 1080)'),
      height: z.number().optional().describe('Altura em pixels (default: 1080). Use 1350 para 4:5, 1920 para 9:16'),
    },
    async (input) => {
      const result = await renderHtmlToImage(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Video Clips ──

  server.tool(
    'analyze_youtube_video',
    'Analisa um video do YouTube: baixa, transcreve com IA e encontra os melhores momentos para clips',
    {
      url: z.string().describe('URL do video do YouTube'),
      whisper_model: z.enum(['tiny', 'base', 'small', 'medium', 'large']).optional().describe('Modelo Whisper (default: tiny)'),
      max_moments: z.number().optional().describe('Maximo de momentos para retornar (default: 10)'),
      language: z.string().optional().describe('Forcar idioma (pt, en, es)'),
    },
    async (input) => {
      const result = await analyzeYoutubeVideo(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'cut_youtube_clips',
    'Corta clips de um video ja analisado. Gera videos verticais com face cam e legendas',
    {
      video_clip_id: z.string().describe('ID do video clip (retornado por analyze_youtube_video)'),
      clips: z.array(z.object({
        start: z.number().describe('Segundo inicial'),
        end: z.number().describe('Segundo final'),
        title: z.string().optional().describe('Titulo do clip'),
      })).describe('Lista de clips para cortar'),
      format: z.enum(['vertical', 'square', 'horizontal']).optional().describe('Formato (default: vertical)'),
      burn_subs: z.boolean().optional().describe('Queimar legendas no video (default: false)'),
    },
    async (input) => {
      const result = await cutYoutubeClips(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_video_clips',
    'Lista todos os video clips com status e detalhes',
    {
      status: z.string().optional().describe('Filtrar por status: PENDING, ANALYZING, ANALYZED, CLIPPING, READY, FAILED'),
      page: z.string().optional().describe('Pagina (default: 1)'),
      limit: z.string().optional().describe('Itens por pagina (default: 20)'),
    },
    async (input) => {
      const result = await listVideoClips(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}

async function main() {
  const httpServer = http.createServer(async (req, res) => {
    const url = req.url || '/';

    // Health check endpoint
    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // MCP endpoint - stateless: new server+transport per request
    if (url === '/mcp') {
      try {
        const server = new McpServer({ name: 'instapost-ai', version: '0.1.0' });
        registerTools(server);

        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await server.connect(transport);
        await transport.handleRequest(req, res);
        await transport.close();
        await server.close();
      } catch (err) {
        console.error('MCP request error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`InstaPost MCP Server running on http://0.0.0.0:${PORT}/mcp`);
  });
}

main().catch(console.error);
