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

const PORT = parseInt(process.env.PORT || '3002', 10);

function registerTools(server: McpServer) {
  server.tool(
    'create_post',
    'Cria um post completo para Instagram (gera imagem + texto se necessário)',
    {
      caption: z.string().optional().describe('Legenda do post'),
      image_prompt: z.string().optional().describe('Prompt para gerar imagem via Nano Banana'),
      scheduled_at: z.string().optional().describe('Data/hora para agendar (ISO 8601)'),
      hashtags: z.array(z.string()).optional().describe('Lista de hashtags'),
      tone: z.string().optional().describe('Tom: educativo, inspirador, humor, noticia'),
    },
    async ({ caption, image_prompt, scheduled_at, hashtags, tone }) => {
      const result = await createPost({ caption, image_prompt, scheduled_at, hashtags, tone });
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
    'Publica um post imediatamente no Instagram',
    {
      post_id: z.string().describe('ID do post para publicar'),
    },
    async ({ post_id }) => {
      const result = await publishNow({ post_id });
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
