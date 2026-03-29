import { Context } from 'grammy';
import { api } from '../api-client';

export async function projetosCommand(ctx: Context) {
  try {
    const result = await api.listProjects();
    const projects = result.items || [];

    if (projects.length === 0) {
      await ctx.reply('Nenhum projeto encontrado.\nCrie um na web em /projects/new');
      return;
    }

    const list = projects.map((p: any, i: number) => {
      const modules = p.modules?.length || 0;
      const status = p.status === 'COMPLETED' ? '✅' : p.status === 'IN_PROGRESS' ? '🔄' : '📋';
      return `${status} *${i + 1}.* ${p.title}\n   ${modules} modulo(s) | ${p.status}`;
    }).join('\n\n');

    await ctx.reply(`📁 *Projetos (${projects.length})*\n\n${list}`, { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.reply('Erro ao listar projetos.');
  }
}
