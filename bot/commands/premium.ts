import { Context } from "telegraf";
import { prisma } from "../../src/db/prisma";
import axios from "axios";

export async function handleSubscription(ctx: Context) {
  if (!ctx.from) return;

  const user = await prisma.user.findUnique({
    where: {telegramId: String(ctx.from.id)}
  })

  if(!user) {
    return ctx.reply('Usuário não encontrado. Por favor, envie /start primeiro.');
  }

  const ValorEmCentavos = 990;
  const descricao = 'Assinatura Premium EziStock - 1 Mês';

  try {
    ctx.reply('Gerando sua cobrança PIX, aguarde...');

    const response = await axios.post('https://api.abacatepay.com.br/v1/charges', {
      value: ValorEmCentavos,
      description: descricao,
      customer: {
        name: user.name,
      },
      split: [],
      metadata: {
        telegram_id: user.telegramId
      }
     }, {
      headers: {
        'x-api-key': process.env.ABACATE_PAY_API_KEY,
        'Content-Type': 'application/json'
      }
     });

     const charge = response.data;

     if(charge.payment_method == 'pix' && charge.pix) {
       const qrCodeUrl = charge.pix.qr_code_url;
       const copiaECola = charge.pix.emv;

       await ctx.replyWithPhoto(qrCodeUrl, {
        caption: `Para se tornar Premium, faça o pagamento do PIX abaixo.`
       })

       await ctx.reply(`Ou use o PIX Copia e Cola:\n\n\`${copiaECola}\``, {
        parse_mode: 'Markdown'
      });

     } else {
      ctx.reply('Não foi possível gerar a cobrança PIX. Tente novamente mais tarde.');
    }
    
  } catch (error: string | any) {
    console.error("Erro ao gerar cobrança na Abacate Pay:", error.response?.data || error.message);
    ctx.reply('Ocorreu um erro ao conectar com nosso sistema de pagamento.');
  }
}