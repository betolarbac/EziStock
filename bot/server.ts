import fastify from "fastify";
import { Telegraf } from "telegraf";
import { prisma } from "../src/db/prisma";

const app = fastify();

app.get("/", async (request, reply) => {
  return { status: "Bot is running!" };
});

app.post("/webhook/abacatepay", async (request, reply) => {
  try {
    const event = request.body as any;

    // Verifica se o evento é de cobrança paga
    if (event.event === "charge.paid") {
      const charge = event.data;
      const telegramId = charge.metadata?.telegram_id;

      if (!telegramId) {
        console.warn("Webhook recebido sem telegram_id nos metadados.");
        return reply.status(200).send({ received: true });
      }

      // Calcula a data de expiração da assinatura (ex: 30 dias)
      const hoje = new Date();
      const dataExpiracao = new Date(hoje.setDate(hoje.getDate() + 30));

      // Atualiza o usuário no banco de dados
      await prisma.user.update({
        where: { telegramId: String(telegramId) },
        data: {
          isPremium: true,
          subscriptionExpiresAt: dataExpiracao,
        },
      });

      // Envia a mensagem de confirmação para o usuário
      const bot = (request.server as any).bot as Telegraf;
      await bot.telegram.sendMessage(
        telegramId,
        "✅ Pagamento confirmado! Sua assinatura Premium está ativa por 30 dias. Obrigado!"
      );
    }

    // Responde à Abacate Pay para confirmar o recebimento
    reply.status(200).send({ received: true });
  } catch (error) {
    console.error("Erro ao processar webhook da Abacate Pay:", error);
    reply.status(500).send({ error: "Internal Server Error" });
  }
});

export function startServer(bot: Telegraf) {
  (app as any).bot = bot;

  const port = process.env.PORT || 3000;
  app.listen({ port: Number(port), host: "0.0.0.0" }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  });
}
