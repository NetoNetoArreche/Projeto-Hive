import { Context } from 'grammy';
import { api } from '../api-client';

export async function statusCommand(ctx: Context) {
  try {
    const [igStatus, posts, projects, clips] = await Promise.allSettled([
      api.instagramStatus(),
      api.listPosts('SCHEDULED'),
      api.listProjects(),
      api.listVideoClips(),
    ]);

    const ig = igStatus.status === 'fulfilled' ? igStatus.value : null;
    const scheduled = posts.status === 'fulfilled' ? posts.value : null;
    const projs = projects.status === 'fulfilled' ? projects.value : null;
    const vids = clips.status === 'fulfilled' ? clips.value : null;

    await ctx.reply(
      `⚙️ *Status OpenHive AI*\n\n` +
      `📸 Instagram: ${ig?.connected ? '✅ Conectado' : '❌ Desconectado'}\n` +
      `📅 Posts agendados: ${scheduled?.total || 0}\n` +
      `📁 Projetos: ${projs?.total || 0}\n` +
      `🎬 Video clips: ${vids?.total || 0}\n` +
      (scheduled?.items?.[0]
        ? `\n📌 Proximo post: ${new Date(scheduled.items[0].scheduledAt).toLocaleString('pt-BR')}`
        : ''),
      { parse_mode: 'Markdown' },
    );
  } catch (err) {
    await ctx.reply('Erro ao verificar status.');
  }
}
