import { Context } from 'telegraf';
import { prisma } from '../../src/db/prisma';

export async function atualizarQuantidade(ctx: Context) {
  if (!ctx.message || !("text" in ctx.message) || !ctx.from) {
  return ctx.reply("Mensagem inválida.");
}
  const texto = ctx.message.text;
  const adicionar = texto.toLowerCase().startsWith('adicionar');
  const regex = adicionar
    ? /^Adicionar\s+(\d+)\s+ao produto:\s*(.+)$/i
    : /^Remover\s+(\d+)\s+do produto:\s*(.+)$/i;

  const match = texto.match(regex);
  if (!match) return;

  const quantidade = parseInt(match[1]);
  const nome = match[2].trim();

  const user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
  if (!user) return ctx.reply('Usuário não encontrado.');

  const produto = await prisma.product.findFirst({
    where: { userId: user.id, name: { equals: nome, mode: 'insensitive' } }
  });
  if (!produto) return ctx.reply(`Produto "${nome}" não encontrado.`);

  const novaQtd = adicionar ? produto.quantity + quantidade : Math.max(0, produto.quantity - quantidade);

  await prisma.product.update({
    where: { id: produto.id },
    data: { quantity: novaQtd },
  });

  ctx.reply(`${adicionar ? 'Adicionadas' : 'Removidas'} ${quantidade} unidades do produto "${produto.name}". Total: ${novaQtd}`);
}