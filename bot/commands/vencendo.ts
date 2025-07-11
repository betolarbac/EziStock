import { Context } from "telegraf";
import { prisma } from "../../src/db/prisma";

export async function vencendo(ctx: Context) {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(hoje.getDate() + 7);

  if (!ctx.message || !("text" in ctx.message) || !ctx.from) {
    return ctx.reply("Mensagem inválida.");
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
    include: {
      products: {
        where: {
          expiresAt: {
            gte: hoje,
            lte: limite,
          },
        },
      },
    },
  });

  if (!user || user.products.length === 0) {
    return ctx.reply("Nenhum produto vencendo nos próximos dias.");
  }

  const lista = user.products
    .map(
      (p) =>
        `🧨 ${p.name} - ${
          p.quantity
        } un - Vence: ${p.expiresAt?.toLocaleDateString('pt-BR')}`
    )
    .join("\n");

  ctx.reply(`Produtos vencendo nos próximos 7 dias:\n\n${lista}`);
}
