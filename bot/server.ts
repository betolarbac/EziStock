import fastify from "fastify";
import { Telegraf } from "telegraf";
import { prisma } from "../src/db/prisma";
import crypto from "crypto";

const app = fastify();

app.get("/", async (request, reply) => {
  return { status: "Bot is running!" };
});

app.post("/webhook/abacatepay", async (request, reply) => {
  try {
    const signature = request.headers["x-abacatepay-signature"] as string;

    if (!signature) {
      console.warn("Requisição de webhook recebida sem assinatura.");
      return reply.status(401).send({ error: "Assinatura não encontrada." });
    }

    const hmac = crypto.createHmac(
      "sha256",
      process.env.ABACATE_PAY_WEBHOOK_SECRET!
    );
    const digest = hmac.update(JSON.stringify(request.body)).digest("hex");

    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );

    if (!isSignatureValid) {
      console.warn("Assinatura de webhook inválida!");
      return reply.status(401).send({ error: "Assinatura inválida." });
    }

    const event = request.body as any;

    if (event.event === "charge.paid") {
      const charge = event.data;
      const telegramId = charge.metadata?.telegram_id;

      if (!telegramId) {
        console.warn("Webhook recebido sem telegram_id nos metadados.");
        return reply.status(200).send({ received: true });
      }

      const hoje = new Date();
      const dataExpiracao = new Date(hoje.setDate(hoje.getDate() + 30));

      await prisma.user.update({
        where: { telegramId: String(telegramId) },
        data: {
          isPremium: true,
          subscriptionExpiresAt: dataExpiracao,
        },
      });

      const bot = (request.server as any).bot as Telegraf;
      await bot.telegram.sendMessage(
        telegramId,
        "✅ Pagamento confirmado! Sua assinatura Premium está ativa por 30 dias. Obrigado!"
      );
    }

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
