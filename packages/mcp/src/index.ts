import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import http from 'node:http';
import { z } from 'zod';
import { createPost } from './tools/createPost';
import { createMixedCarousel } from './tools/createMixedCarousel';
import {
  listBrands,
  getBrand,
  getDefaultBrand,
  createBrand,
  updateBrand,
  setDefaultBrand,
  deleteBrand,
} from './tools/brands';
import {
  listDesignSystems,
  getDesignSystem,
  listDesignSystemCategories,
  suggestBrandFromInspirations,
} from './tools/designSystems';
import { composeImageWithOverlay } from './tools/composeImageWithOverlay';
import { generateImage } from './tools/generateImage';
import { generateCaption } from './tools/generateCaption';
import { generateImagePrompt } from './tools/generateImagePrompt';
import { schedulePost } from './tools/schedulePost';
import { updatePost } from './tools/updatePost';
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
    'Cria um post para Instagram. Suporta imagem unica ou carrossel (2-10 imagens). Suporta brand_id para legenda com tom de voz da marca e platforms para multi-plataforma.',
    {
      caption: z.string().optional().describe('Legenda do post'),
      image_prompt: z.string().optional().describe('Prompt para gerar UMA imagem'),
      image_prompts: z.array(z.string()).min(2).max(10).optional().describe('Array de prompts para gerar carrossel (2-10 imagens)'),
      image_urls: z.array(z.string()).min(2).max(10).optional().describe('Array de URLs de imagens prontas para carrossel'),
      aspect_ratio: z.enum(['1:1', '4:5', '9:16']).optional().describe('Proporcao da imagem: 1:1 (Feed), 4:5 (Retrato), 9:16 (Stories)'),
      scheduled_at: z.string().optional().describe('Data/hora para agendar (ISO 8601)'),
      hashtags: z.array(z.string()).optional().describe('Lista de hashtags'),
      tone: z.string().optional().describe('Tom: educativo, inspirador, humor, noticia'),
      editor_state: z.record(z.unknown()).optional().describe('Estado estruturado dos slides para o Editor Visual da web'),
      brand_id: z.string().optional().describe('ID do brand para aplicar tom de voz e hashtags automaticamente na legenda'),
      platforms: z.array(z.string()).optional().describe('Plataformas alvo: instagram, facebook, linkedin, x (default: todas conectadas)'),
    },
    async ({ caption, image_prompt, image_prompts, image_urls, aspect_ratio, scheduled_at, hashtags, tone, editor_state, brand_id, platforms }) => {
      const result = await createPost({ caption, image_prompt, image_prompts, image_urls, aspect_ratio, scheduled_at, hashtags, tone, editor_state, brand_id, platforms });
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
    'create_mixed_carousel',
    'Cria carrossel misto: capa gerada por IA (Gemini) + slides informativos em HTML/Template. Aceita brand_id para aplicar logo, cores e tom de voz da marca automaticamente',
    {
      cover_prompt: z.string().describe('Prompt para gerar a imagem de capa via IA (primeiro slide)'),
      slides: z.array(z.object({
        title: z.string().describe('Texto principal do slide'),
        subtitle: z.string().optional().describe('Subtitulo do slide'),
        template: z.string().optional().describe('Template: bold-gradient, minimal-dark, neon-card, quote-elegant, stats-impact, split-color (padrao: bold-gradient)'),
      })).min(1).max(9).describe('Lista de slides template (1-9 slides, a capa IA conta como slide 1)'),
      caption: z.string().optional().describe('Legenda do post (gerada automaticamente se nao informada)'),
      hashtags: z.array(z.string()).optional().describe('Lista de hashtags'),
      aspect_ratio: z.enum(['1:1', '4:5', '9:16']).optional().describe('Proporcao: 1:1 (Feed), 4:5 (Retrato), 9:16 (Stories)'),
      tone: z.string().optional().describe('Tom da legenda auto-gerada: educativo, inspirador, humor, noticia'),
      scheduled_at: z.string().optional().describe('Data/hora para agendar (ISO 8601)'),
      brand_id: z.string().optional().describe('ID do brand para aplicar identidade visual (logo, cores, tom de voz, hashtags). Use list_brands para descobrir IDs disponiveis'),
      apply_brand: z.boolean().optional().describe('Se true (padrao), aplica logo + cores + tom de voz do brand. Se false, ignora brand mesmo com brand_id'),
    },
    async ({ cover_prompt, slides, caption, hashtags, aspect_ratio, tone, scheduled_at, brand_id, apply_brand }) => {
      const result = await createMixedCarousel({ cover_prompt, slides, caption, hashtags, aspect_ratio, tone, scheduled_at, brand_id, apply_brand });
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
    'Gera uma legenda otimizada. Use brand_id para legenda com tom de voz e hashtags da marca.',
    {
      topic: z.string().describe('Tema do post'),
      tone: z.enum(['educativo', 'inspirador', 'humor', 'noticia']).optional().describe('Tom da legenda'),
      hashtags_count: z.number().optional().describe('Quantidade de hashtags (1-30)'),
      language: z.string().optional().describe('Idioma (padrão: pt-BR)'),
      max_length: z.number().optional().describe('Tamanho máximo da legenda'),
      brand_id: z.string().optional().describe('ID do brand — gera legenda com tom de voz e hashtags da marca'),
    },
    async ({ topic, tone, hashtags_count, language, max_length, brand_id }) => {
      const result = await generateCaption({ topic, tone, hashtags_count, language, max_length, brand_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'generate_image_prompt',
    'Gera um prompt otimizado para Google AI Studio (Gemini/Imagen). Copie o prompt e cole no AI Studio para gerar imagens de alta qualidade gratuitamente. Retorna: prompt em inglês, negative prompt e dicas de ajuste.',
    {
      topic: z.string().describe('Tema/descricao da imagem desejada (ex: "Aventureiros em trilha na natureza com mochilas coloridas")'),
      brand_id: z.string().optional().describe('ID do brand — ajusta cores e estilo visual ao prompt'),
      style: z.string().optional().describe('Estilo visual: fotografico, ilustracao, flat-design, aquarela, cartoon, realista (default: fotografico)'),
      aspect_ratio: z.string().optional().describe('Proporcao: "1:1", "4:5", "9:16" (default: 4:5)'),
      usage: z.string().optional().describe('Uso da imagem: "post carrossel", "stories", "capa" (default: post de Instagram/Facebook)'),
    },
    async ({ topic, brand_id, style, aspect_ratio, usage }) => {
      const result = await generateImagePrompt({ topic, brand_id, style, aspect_ratio, usage });
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
    'update_post',
    'Atualiza um post existente (legenda, hashtags, agendamento, brand, plataformas). Se o post estiver agendado e voce mudar a data, o agendamento e atualizado automaticamente',
    {
      post_id: z.string().describe('ID do post'),
      caption: z.string().optional().describe('Nova legenda'),
      hashtags: z.array(z.string()).optional().describe('Novas hashtags'),
      scheduled_at: z.string().optional().describe('Nova data/hora de agendamento (ISO 8601). Reagenda automaticamente se o post ja estiver agendado'),
      status: z.enum(['DRAFT', 'SCHEDULED']).optional().describe('Novo status (DRAFT para cancelar agendamento)'),
      brand_id: z.string().optional().describe('ID do brand para associar ao post'),
      platforms: z.array(z.string()).optional().describe('Plataformas alvo: instagram, facebook, linkedin, x'),
    },
    async ({ post_id, caption, hashtags, scheduled_at, status, brand_id, platforms }) => {
      const result = await updatePost({ post_id, caption, hashtags, scheduled_at, status, brand_id, platforms });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Design Systems (visual inspirations library)

  server.tool(
    'list_design_systems',
    'Lista a biblioteca de 58 design systems de marcas conhecidas (Stripe, Linear, Apple, Notion, etc) que podem ser usados como inspiracao visual para criar brands. Cada item retorna nome, vibe (descricao), categoria, paleta principal e mood keywords. Use isso quando o usuario pedir ajuda para criar um brand do zero ou refinar a identidade visual',
    {
      category: z.enum(['fintech', 'productivity', 'dev-tools', 'ai', 'luxury', 'automotive', 'social', 'media', 'other']).optional().describe('Filtrar por categoria'),
      search: z.string().optional().describe('Buscar por nome, vibe ou mood keyword (ex: warm, dark, minimal)'),
      limit: z.number().optional().describe('Quantidade maxima a retornar'),
    },
    async (input) => {
      const result = await listDesignSystems(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_design_system',
    'Retorna detalhes completos de um design system especifico (todas as cores, tipografia, principios). Use depois de list_design_systems quando o usuario escolher uma inspiracao',
    {
      design_system_id: z.string().describe('ID do design system (ex: stripe, linear, apple)'),
    },
    async (input) => {
      const result = await getDesignSystem(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_design_system_categories',
    'Retorna as categorias disponiveis na biblioteca de design systems com a quantidade em cada (fintech, dev-tools, ai, etc)',
    {},
    async () => {
      const result = await listDesignSystemCategories();
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'suggest_brand_from_inspirations',
    'Combina 1-5 design systems da biblioteca em uma sugestao de brand. Retorna paleta de cores, fonte, tom de voz e descricao. NAO salva nada - apenas sugere. Para salvar use create_brand depois que o usuario aprovar',
    {
      inspiration_ids: z.array(z.string()).min(1).max(5).describe('IDs dos design systems para combinar (ex: ["stripe", "linear"])'),
      business_name: z.string().optional().describe('Nome do negocio do usuario (opcional)'),
      business_type: z.string().optional().describe('Tipo de negocio (ex: "AI startup", "fintech", "consultoria") - ajuda a personalizar a sugestao'),
    },
    async (input) => {
      const result = await suggestBrandFromInspirations(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Brand tools

  server.tool(
    'list_brands',
    'Lista todos os brands cadastrados (identidade visual: logo, cores, produtos, tom de voz). Use isso ANTES de criar qualquer post visual para perguntar ao usuario qual brand aplicar',
    {},
    async () => {
      const result = await listBrands();
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_brand',
    'Retorna detalhes completos de um brand especifico',
    {
      brand_id: z.string().describe('ID do brand'),
    },
    async ({ brand_id }) => {
      const result = await getBrand({ brand_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_default_brand',
    'Retorna o brand padrao do usuario (se houver). Util para aplicar automaticamente quando o usuario nao especifica',
    {},
    async () => {
      const result = await getDefaultBrand();
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'create_brand',
    'Cria um novo brand com identidade visual completa: 6 cores (primary, secondary, accent, background, text, muted) + 3 fontes (display, heading, body)',
    {
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
      voice_tone: z.string().optional().describe('Tom de voz: profissional, descontraido, educativo, etc'),
      website_url: z.string().optional().describe('URL do site oficial do brand - agentes podem visitar para pesquisar informacoes e contexto'),
      instagram_url: z.string().optional().describe('URL do perfil Instagram do brand - agentes podem analisar o estilo visual e de conteudo'),
      products: z.array(z.string()).optional().describe('Lista de produtos/servicos'),
      default_hashtags: z.array(z.string()).optional().describe('Hashtags padrao a aplicar nos posts'),
      is_default: z.boolean().optional().describe('Se este sera o brand padrao'),
    },
    async (input) => {
      const result = await createBrand(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'update_brand',
    'Atualiza um brand existente. Todos os campos sao opcionais - so envie o que quer mudar',
    {
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
    },
    async (input) => {
      const result = await updateBrand(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'set_default_brand',
    'Define um brand como padrao (desmarca os outros automaticamente)',
    {
      brand_id: z.string().describe('ID do brand a tornar padrao'),
    },
    async ({ brand_id }) => {
      const result = await setDefaultBrand({ brand_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'delete_brand',
    'Remove um brand',
    {
      brand_id: z.string().describe('ID do brand a remover'),
    },
    async ({ brand_id }) => {
      const result = await deleteBrand({ brand_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_posts',
    'Lista posts com filtros (status, brand, paginacao). Retorna brand_id e platforms em cada post.',
    {
      status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']).optional().describe('Filtrar por status'),
      limit: z.number().optional().describe('Quantidade por página'),
      offset: z.number().optional().describe('Offset para paginação'),
      brand_id: z.string().optional().describe('Filtrar posts de um brand especifico'),
    },
    async ({ status, limit, offset, brand_id }) => {
      const result = await listPosts({ status, limit, offset, brand_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'publish_now',
    'Publica um post imediatamente em todas as plataformas conectadas (Instagram, Facebook, LinkedIn, X). Retorna resultados por plataforma.',
    {
      post_id: z.string().describe('ID do post para publicar'),
      account_id: z.string().optional().describe('ID da conta (opcional, usa todas conectadas se nao informado)'),
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

  server.tool(
    'compose_image_with_html_overlay',
    'Renderiza HTML/Tailwind por cima de uma imagem de fundo (IA ou URL). Retorna image_url pronto para create_post ou add_image_to_post.\n\nCANVAS: Seu HTML preenche o viewport inteiro — 1080x1080 (1:1), 1080x1350 (4:5) ou 1080x1920 (9:16). Sempre use um root <div class="w-full h-full flex flex-col ..."> para preencher o canvas.\n\nRECURSOS DISPONIVEIS: Tailwind CSS (todas as classes), 50+ Google Fonts (Inter, Montserrat, Poppins, Sora, Playfair Display, Bebas Neue, DM Sans, Outfit, Space Grotesk, etc).\n\nCSS VARIABLES (disponiveis quando brand_id e passado — SEMPRE use estas, NUNCA hardcode cores do brand):\n  var(--brand-primary, #fallback)   cor principal (titulos, acentos, gradientes, botoes)\n  var(--brand-secondary, #fallback) cor de apoio (gradientes, elementos secundarios)\n  var(--brand-accent, #fallback)    cor de destaque (CTAs, labels, highlights)\n  var(--brand-text, #fallback)      cor do texto\n  var(--brand-font)                 fonte principal/display (use em font-family)\n  var(--brand-heading-font)         fonte de titulos (use em font-family)\n  var(--brand-body-font)            fonte de corpo (use em font-family)\n  IMPORTANTE: Sempre adicione fallback! Ex: style="color: var(--brand-primary, #6C5CE7)"\n\nLOGO: Um badge com logo+nome do brand e adicionado automaticamente no canto inferior direito. NAO coloque conteudo nessa area.\n\nEXEMPLO — Slide informativo:\n<div class="w-full h-full flex flex-col justify-center items-center p-20 text-center" style="font-family: var(--brand-heading-font, var(--brand-font, \'Inter\'))">\n  <p class="text-2xl font-bold uppercase tracking-widest mb-6" style="color: var(--brand-accent, var(--brand-primary, #E84393))">DICA #3</p>\n  <h1 class="text-7xl font-black leading-tight mb-8" style="color: var(--brand-text, #FFFFFF)">Automatize seus workflows com IA</h1>\n  <p class="text-2xl max-w-2xl leading-relaxed opacity-70" style="color: var(--brand-text, #FFFFFF); font-family: var(--brand-body-font, \'Inter\')">Economize 10h por semana usando agentes inteligentes</p>\n</div>\n\nEXEMPLO — Slide CTA:\n<div class="w-full h-full flex flex-col justify-center items-center p-20 text-center" style="font-family: var(--brand-font, \'Inter\')">\n  <div class="rounded-3xl p-16 w-full max-w-3xl" style="background: var(--brand-primary, #6C5CE7)">\n    <h2 class="text-6xl font-black mb-6 text-white">Gostou? Salve este post!</h2>\n    <p class="text-2xl text-white/80">Siga para mais dicas de IA e produtividade</p>\n  </div>\n</div>\n\nDICAS DE DESIGN: Padding generoso (p-16 a p-24). Texto grande (text-5xl a text-8xl para titulos). Use font-black ou font-extrabold. Maximo 2-3 elementos de texto por slide. Use overlay_opacity 0.4-0.6 para fundos fotograficos com texto branco. Varie layouts entre slides. Use glassmorphism com backdrop-blur para cards sobre fotos.',
    {
      html: z.string().describe('HTML do overlay (corpo apenas, sem <html><head><body>). DEVE usar CSS variables do brand quando brand_id for fornecido. Use Tailwind para layout e style="" para cores via var(). Root deve ser <div class="w-full h-full ...">. Ex: <div class="w-full h-full flex flex-col justify-center items-center p-20" style="font-family: var(--brand-font, \'Inter\')"><h1 class="text-7xl font-black" style="color: var(--brand-primary, #6C5CE7)">Titulo</h1></div>'),
      background_prompt: z.string().optional().describe('Prompt para gerar a imagem de fundo via IA (Gemini). Ex: "fundo abstrato escuro com formas geometricas e luzes neon". Use OU isto OU background_url'),
      background_url: z.string().optional().describe('URL de imagem ja pronta para usar como fundo. Use OU isto OU background_prompt'),
      aspect_ratio: z.enum(['1:1', '4:5', '9:16']).optional().describe('Proporcao: 1:1 (Feed 1080x1080), 4:5 (Retrato 1080x1350), 9:16 (Stories 1080x1920)'),
      overlay_opacity: z.number().min(0).max(1).optional().describe('Opacidade da camada escura entre fundo e HTML (0-1, default: 0). Use 0.4-0.6 quando o fundo e fotografico e os textos sao brancos'),
      brand_id: z.string().optional().describe('ID do brand para injetar cores/fontes como CSS variables e logo no canto. Use get_default_brand ou list_brands para descobrir IDs. SEMPRE passe quando disponivel'),
      apply_brand: z.boolean().optional().describe('Se true (padrao quando brand_id e fornecido), aplica brand. Se false, ignora mesmo com brand_id'),
    },
    async (input) => {
      const result = await composeImageWithOverlay(input);
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
