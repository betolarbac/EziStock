import cron from 'node-cron';
import { prisma } from '../src/db/prisma';
import { Telegraf } from 'telegraf';

export function iniciarCron(bot: Telegraf) {
  cron.schedule('0 9 * * *', async () => {
    const hoje = new Date();
    const tresDias = new Date();
    tresDias.setDate(hoje.getDate() + 3);

    const produtos = await prisma.product.findMany({
      where: {
        expiresAt: { lte: tresDias, gte: hoje },
      },
      include: { user: true },
    });

    for (const produto of produtos) {
      await bot.telegram.sendMessage(
        Number(produto.user.telegramId),
        `⚠️ O produto *${produto.name}* vence em breve (${produto.expiresAt?.toLocaleDateString()})!`,
        { parse_mode: 'Markdown' }
      );
    }
  });
}