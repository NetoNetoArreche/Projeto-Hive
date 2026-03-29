import { Context } from 'grammy';
import { api } from '../api-client';
import { InlineKeyboard } from 'grammy';

export async function clipCommand(ctx: Context) {
  const text = ctx.message?.text || '';
  const url = text.replace('/clip', '').trim();

  if (!url) {
    // Show list of existing clips
    try {
      const result = await api.listVideoClips();
      const clips = result.items || [];

      if (clips.length === 0) {
        await ctx.reply(
          '🎬 *YouTube Clips*\n\n' +
          'Nenhum clip ainda.\n\n' +
          'Para analisar um video:\n`/clip https://youtube.com/watch?v=...`',
          { parse_mode: 'Markdown' },
        );
        return;
      }

      const statusEmoji: Record<string, string> = {
        PENDING: '⏳', ANALYZING: '🔄', ANALYZED: '📊',
        CLIPPING: '✂️', READY: '✅', FAILED: '❌',
      };

      const list = clips.slice(0, 10).map((c: any, i: number) => {
        const emoji = statusEmoji[c.status] || '⏳';
        const title = c.title || 'Sem titulo';
        const clipCount = Array.isArray(c.clips) ? c.clips.length : 0;
        return `${emoji} *${i + 1}.* ${title}\n   ${c.status}${clipCount > 0 ? ` | ${clipCount} clip(s)` : ''}`;
      }).join('\n\n');

      await ctx.reply(`🎬 *Clips (${clips.length})*\n\n${list}`, { parse_mode: 'Markdown' });
    } catch {
      await ctx.reply('Erro ao listar clips.');
    }
    return;
  }

  // Analyze new video
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    await ctx.reply('URL invalida. Use uma URL do YouTube.\nExemplo: `/clip https://youtube.com/watch?v=...`', { parse_mode: 'Markdown' });
    return;
  }

  await ctx.reply('🎬 Analisando video... Isso pode levar alguns minutos.\nVou avisar quando terminar!');

  try {
    const result = await api.analyzeVideo(url);
    const clipId = result.id;

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5s intervals)

    const poll = setInterval(async () => {
      attempts++;
      try {
        const clip = await api.getVideoClip(clipId);

        if (clip.status === 'ANALYZED') {
          clearInterval(poll);
          const moments = clip.moments || [];

          if (moments.length === 0) {
            await ctx.reply('Nenhum momento relevante encontrado no video.');
            return;
          }

          let msg = `✅ *Video analisado!*\n📹 ${clip.title || 'Video'}\n⏱ ${clip.duration ? Math.floor(clip.duration / 60) + 'min' : ''}\n\n*${moments.length} melhores momentos:*\n\n`;

          moments.slice(0, 8).forEach((m: any, i: number) => {
            msg += `*${i + 1}.* \\[${m.start_formatted} - ${m.end_formatted}\\] Score: ${m.score}\n_${(m.hook || '').slice(0, 80)}_\n\n`;
          });

          msg += `Para gerar clips de todos os momentos:\n\`/clipcortar ${clipId} todos\`\n\nOu acesse a web em /clips/${clipId}`;

          await ctx.reply(msg, { parse_mode: 'Markdown' });
        } else if (clip.status === 'FAILED') {
          clearInterval(poll);
          await ctx.reply(`❌ Erro na analise: ${clip.error || 'Erro desconhecido'}`);
        } else if (attempts >= maxAttempts) {
          clearInterval(poll);
          await ctx.reply('⏰ Analise esta demorando. Verifique o status na web em /clips/' + clipId);
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);
  } catch (err: any) {
    await ctx.reply(`Erro ao iniciar analise: ${err.message}`);
  }
}

export async function clipCortarCommand(ctx: Context) {
  const text = ctx.message?.text || '';
  const parts = text.replace('/clipcortar', '').trim().split(' ');
  const clipId = parts[0];
  const option = parts[1] || 'todos';

  if (!clipId) {
    await ctx.reply('Uso: `/clipcortar <id> [todos]`', { parse_mode: 'Markdown' });
    return;
  }

  try {
    const clip = await api.getVideoClip(clipId);
    if (clip.status !== 'ANALYZED') {
      await ctx.reply('Este video ainda nao foi analisado ou ja esta sendo cortado.');
      return;
    }

    const moments = clip.moments || [];
    if (moments.length === 0) {
      await ctx.reply('Nenhum momento encontrado neste video.');
      return;
    }

    const clips = moments.map((m: any) => ({
      start: m.start,
      end: m.end,
      title: (m.hook || '').slice(0, 50),
    }));

    await ctx.reply(`✂️ Cortando ${clips.length} clip(s)... Isso pode levar alguns minutos.`);
    await api.cutVideoClips(clipId, clips);

    // Poll for completion
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const updated = await api.getVideoClip(clipId);
        if (updated.status === 'READY') {
          clearInterval(poll);
          const generated = updated.clips || [];
          let msg = `✅ *${generated.length} clip(s) prontos!*\n\n`;
          generated.forEach((c: any) => {
            msg += `🎬 *Clip ${c.index}:* ${c.title || ''} (${c.duration}s)\n`;
            if (c.url) msg += `📥 [Download MP4](${c.url})\n`;
            msg += '\n';
          });
          msg += `Acesse todos na web em /clips/${clipId}`;
          await ctx.reply(msg, { parse_mode: 'Markdown' });
        } else if (updated.status === 'FAILED') {
          clearInterval(poll);
          await ctx.reply(`❌ Erro no corte: ${updated.error || 'Erro desconhecido'}`);
        } else if (attempts >= 120) {
          clearInterval(poll);
          await ctx.reply('⏰ Corte demorando. Verifique na web.');
        }
      } catch {}
    }, 5000);
  } catch (err: any) {
    await ctx.reply(`Erro: ${err.message}`);
  }
}
