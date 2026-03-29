import { Context } from 'grammy';

export async function startCommand(ctx: Context) {
  await ctx.reply(
    `Bem-vindo ao OpenHive AI! 🐝

📝 *Posts*
/novopost - Criar post interativo
/gerar [tema] - Gerar imagem + legenda com IA
/listar - Listar posts agendados
/publicar [id] - Publicar imediatamente
/agendar [id] [YYYY-MM-DD HH:mm] - Agendar post
/cancelar [id] - Cancelar agendamento

📋 *Tarefas & Projetos*
/tarefas - Tarefas dos proximos 7 dias
/projetos - Listar projetos
/funis - Listar funis de vendas

🎬 *YouTube Clips*
/clip - Listar clips
/clip [URL] - Analisar video do YouTube
/clipcortar [id] todos - Cortar clips de um video

⚙️ *Sistema*
/status - Status das integracoes

💡 Ou envie qualquer texto e eu gero um post automaticamente!`,
    { parse_mode: 'Markdown' },
  );
}
