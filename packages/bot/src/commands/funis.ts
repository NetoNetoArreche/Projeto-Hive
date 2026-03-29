import { Context } from 'grammy';
import { api } from '../api-client';

export async function funisCommand(ctx: Context) {
  try {
    const funnels = (await api.listFunnels()) as any[];

    if (!funnels || funnels.length === 0) {
      await ctx.reply('Nenhum funil encontrado.\nCrie um na web em /funnels/new');
      return;
    }

    const list = funnels.map((f: any, i: number) => {
      const stages = f.stages?.length || 0;
      const totalSteps = f.stages?.reduce((sum: number, s: any) => sum + (s.steps?.length || 0), 0) || 0;
      const doneSteps = f.stages?.reduce((sum: number, s: any) => sum + (s.steps?.filter((st: any) => st.status === 'DONE').length || 0), 0) || 0;
      const pct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
      return `🔀 *${i + 1}.* ${f.title}\n   ${stages} etapa(s) | ${doneSteps}/${totalSteps} passos (${pct}%)`;
    }).join('\n\n');

    await ctx.reply(`🔀 *Funis (${funnels.length})*\n\n${list}`, { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.reply('Erro ao listar funis.');
  }
}
