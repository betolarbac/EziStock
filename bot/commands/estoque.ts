import { Context } from 'telegraf';
import { prisma } from '../../src/db/prisma';

export async function visualizarEstoque(ctx: Context) {
  if (!ctx.message || !("text" in ctx.message) || !ctx.from) {
  return ctx.reply("Mensagem inválida.");
}
  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
    include: { products: true },
  });

  if (!user || user.products.length === 0) {
    return ctx.reply('Seu estoque está vazio.');
  }

  const lista = user.products.map((p) =>
    `📦 ${p.name} - ${p.quantity} un - Vence: ${p.expiresAt?.toLocaleDateString('pt-BR') ?? 'Sem data'}`).join('\n');

  ctx.reply(lista);
}