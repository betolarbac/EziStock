import fastify from "fastify";
import { Telegraf } from "telegraf";
import { prisma } from "../src/db/prisma";
import crypto from "crypto";

const app = fastify();

app.get("/", async (request, reply) => {
  return { status: "Bot is running!" };
});

app.post("/webhook/abacatepay", async (request, reply) => {
  // --- INÍCIO DO DIAGNÓSTICO ---
  console.log("--- NOVO WEBHOOK RECEBIDO ---");
  console.log("Headers:", JSON.stringify(request.headers, null, 2));
  console.log("Query Params:", JSON.stringify(request.query, null, 2));
  console.log("Corpo (Body):", JSON.stringify(request.body, null, 2));
  // --- FIM DO DIAGNÓSTICO ---

  try {
    const receivedSecret = (request.query as any).webhookSecret;

    if (receivedSecret !== process.env.ABACATE_PAY_WEBHOOK_SECRET) {
      console.warn("-> Secret do webhook inválido. Verificação falhou.");
      return reply.status(401).send({ error: "Secret do webhook inválido" });
    }
    console.log("-> Secret do webhook validado com sucesso!");

    const event = request.body as any;

    if (event.event === "charge.paid") {
      console.log("-> Evento é 'charge.paid'. Entrando na lógica de ativação.");

      const charge = event.data;
      const telegramId = charge.metadata?.telegram_id;

      if (!telegramId) {
        console.warn(
          "-> AVISO: charge.paid recebido, mas SEM telegram_id nos metadados. Não é possível ativar o usuário."
        );
        // Responde 200 para a AbacatePay não ficar reenviando, mas não faz nada.
        return reply.status(200).send({ received: true });
      }

      console.log(
        `-> telegram_id encontrado: ${telegramId}. Preparando para ativar assinatura.`
      );

      const hoje = new Date();
      const dataExpiracao = new Date(hoje.setDate(hoje.getDate() + 30));

      await prisma.user.update({
        where: { telegramId: String(telegramId) },
        data: {
          isPremium: true,
          subscriptionExpiresAt: dataExpiracao,
        },
      });
      console.log(
        `-> Usuário ${telegramId} atualizado para Premium no banco de dados.`
      );

      const bot = (request.server as any).bot as Telegraf;

      console.log(`-> Enviando mensagem de confirmação para ${telegramId}...`);
      await bot.telegram.sendMessage(
        telegramId,
        "✅ Pagamento confirmado! Sua assinatura Premium está ativa por 30 dias. Obrigado!"
      );
      console.log("-> Mensagem de confirmação enviada com sucesso!");
    } else {
      console.log(
        `-> Evento recebido foi '${event.event}', que não é 'charge.paid'. Nenhuma ação foi tomada.`
      );
    }

    reply.status(200).send({ received: true });
  } catch (error) {
    console.error("--- ERRO GRAVE NO PROCESSAMENTO DO WEBHOOK ---");
    console.error("ERRO DETALHADO:", error);
    // Mesmo em caso de erro, respondemos 200 para evitar que a AbacatePay reenvie o webhook indefinidamente.
    // O ideal é tratar o erro (ex: com um sistema de filas), mas para diagnóstico isso é suficiente.
    reply.status(200).send({ error: "Erro interno no processamento." });
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
