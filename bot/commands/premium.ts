import { Context } from "telegraf";
import { prisma } from "../../src/db/prisma";
import axios from "axios";
import { Buffer } from "buffer";

export async function handleSubscription(ctx: Context) {
  if (!ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
  });

  if (!user) {
    return ctx.reply(
      "Usuário não encontrado. Por favor, envie /start primeiro."
    );
  }

  const valorEmCentavos = 990;
  const nomeDoProduto = "Assinatura Premium EziStock - 1 Mês";

  try {
    await ctx.reply("Gerando seu QR Code PIX, aguarde...");

    const response = await axios.post(
      "https://api.abacatepay.com/v1/pixQrCode/create",
      {
        amount: valorEmCentavos,
        description: nomeDoProduto,
        customer: {
          name: user.name,
          email: `${user.telegramId}@telegram.bot`,
          // ATENÇÃO: Estes dados estão fixos no seu código original.
          // O ideal seria solicitá-los ao usuário ou tê-los no banco de dados.
          cellphone: "(99) 99999-9999",
          taxId: "101.973.430-23",
        },
        metadata: {
          telegram_id: user.telegramId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.ABACATE_PAY_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const pixData = response.data.data;
    const qrCodeBase64 = pixData.brCodeBase64;
    const pixCopyPaste = pixData.brCode;

    const qrCodeBuffer = Buffer.from(
      qrCodeBase64.split("base64,")[1],
      "base64"
    );

    await ctx.replyWithPhoto(
      { source: qrCodeBuffer },
      {
        caption: `Assinatura: ${nomeDoProduto}\nValor: R$ ${(
          valorEmCentavos / 100
        ).toFixed(2)}\n\nEscaneie o QR Code com o app do seu banco para pagar.`,
      }
    );

    await ctx.reply("Ou use o PIX Copia e Cola abaixo:");
    await ctx.replyWithMarkdownV2("```\n" + pixCopyPaste + "\n```");


  } catch (error: string | any) {
    console.error(
      "Erro ao gerar cobrança na Abacate Pay:",
      error.response?.data || error.message
    );
    ctx.reply("Ocorreu um erro ao conectar com nosso sistema de pagamento.");
  }
}
