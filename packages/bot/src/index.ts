import 'dotenv/config';
import { Bot } from 'grammy';
import { authMiddleware } from './middleware/auth';
import { startCommand } from './commands/start';
import { novopostCommand } from './commands/novopost';
import { gerarCommand } from './commands/gerar';
import { agendarCommand } from './commands/agendar';
import { listarCommand } from './commands/listar';
import { publicarCommand } from './commands/publicar';
import { cancelarCommand } from './commands/cancelar';
import { statusCommand } from './commands/status';
import { handleCallbackQuery } from './callbacks';
import { api } from './api-client';
import { InlineKeyboard } from 'grammy';
import { sendPhoto } from './utils/send-photo';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

const bot = new Bot(token);

// Auth middleware
bot.use(authMiddleware);

// Commands
bot.command('start', startCommand);
bot.command('novopost', novopostCommand);
bot.command('gerar', gerarCommand);
bot.command('agendar', agendarCommand);
bot.command('listar', listarCommand);
bot.command('publicar', publicarCommand);
bot.command('cancelar', cancelarCommand);
bot.command('status', statusCommand);

// Callback queries (inline buttons)
bot.on('callback_query:data', handleCallbackQuery);

// Free text → interpret as post creation request
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return;

  await ctx.reply(`Gerando post sobre: "${text}"... Aguarde.`);

  try {
    const [imageResult, captionResult] = await Promise.all([
      api.generateImage(text),
      api.generateCaption(text),
    ]);

    const post = (await api.createPost({
      caption: captionResult.caption,
      imageUrl: imageResult.imageUrl,
      hashtags: captionResult.hashtags,
      nanoPrompt: text,
      source: 'TELEGRAM',
    })) as any;

    const keyboard = new InlineKeyboard()
      .text('Aprovar', `approve_${post.id}`)
      .text('Nova Imagem', `regen_${post.id}`)
      .row()
      .text('Publicar Agora', `publish_${post.id}`)
      .text('Agendar', `schedule_${post.id}`)
      .row()
      .text('Cancelar', `cancel_${post.id}`);

    const captionText = `${captionResult.caption}\n\n${captionResult.hashtags.map((h: string) => `#${h}`).join(' ')}`;

    if (imageResult.imageUrl) {
      await sendPhoto(ctx, imageResult.imageUrl, {
        caption: captionText.slice(0, 1024),
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(captionText, { reply_markup: keyboard });
    }
  } catch (err) {
    await ctx.reply('Erro ao gerar post. Tente novamente.');
  }
});

bot.catch((err) => {
  console.error('Bot error:', err.message);
});

bot.start({
  onStart: () => console.log('InstaPost Telegram Bot running!'),
}).catch((err) => {
  console.error('Failed to start bot:', err.message);
  console.error('Bot will NOT restart - check TELEGRAM_BOT_TOKEN');
  // Stay alive so Docker doesn't restart loop
  setInterval(() => {}, 60_000);
});
