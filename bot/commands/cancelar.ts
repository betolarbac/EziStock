import { Context } from 'telegraf';
import { prisma } from '../../src/db/prisma';

export async function cancelarProduto(ctx: Context) {
  if (!ctx.message || !("text" in ctx.message) || !ctx.from) {
  return ctx.reply("Mensagem inválida.");
}
  const nome = ctx.message.text.replace(/^Cancelar produto:/i, '').trim();
  const user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
  if (!user) return ctx.reply('Usuário não encontrado.');

  const produto = await prisma.product.findFirst({
    where: { userId: user.id, name: { equals: nome, mode: 'insensitive' } }
  });
  if (!produto) return ctx.reply(`Produto "${nome}" não encontrado.`);

  await prisma.product.delete({ where: { id: produto.id } });
  ctx.reply(`O produto "${produto.name}" foi removido com sucesso.`);
}