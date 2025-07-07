import { Context } from "telegraf";
import { prisma } from "../../src/db/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function processarCadastroComIA(texto: string, userId: string, ctx: Context) {
  const prompt = `
    Analise o texto do usuário para identificar um produto, sua quantidade e sua data de validade.
    A data de hoje é: ${new Date().toLocaleDateString('pt-BR')}.
    Retorne a resposta em um formato JSON.
    - O nome do produto deve ser 'name'.
    - A quantidade deve ser 'quantity' (um número).
    - A data de validade deve ser 'expiresAt' no formato 'DD/MM/YYYY'. Se a data não for encontrada, retorne null.
    Texto do usuário para analisar: "${texto}"
  `;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const iaText = response.text();

    const jsonText = iaText.replace('```json', '').replace('```', '').trim();
    const data = JSON.parse(jsonText);

    if (!data.name || !data.quantity) {
      return ctx.reply("Não consegui identificar o produto ou a quantidade. Tente ser mais específico.");
    }

    let expirationDate = null;
    if (data.expiresAt) {
      const [dia, mes, ano] = data.expiresAt.split('/');
      expirationDate = new Date(Number(ano), Number(mes) - 1, Number(dia), 12);
    }
    
    await prisma.product.create({
      data: {
        name: data.name,
        quantity: Number(data.quantity),
        expiresAt: expirationDate,
        userId: userId,
      },
    });

    // Informa se o cadastro veio de áudio ou texto
    const origem = ctx.message && 'voice' in ctx.message ? 'áudio' : 'texto';
    return ctx.reply(`Produto "${data.name}" cadastrado com sucesso via ${origem}!`);

  } catch (error) {
    console.error("Erro ao processar com a IA:", error);
    throw new Error("Falha no processamento da IA.");
  }
}

export async function cadastrarProdutoPorTexto(ctx: Context) {
  if (!ctx.message || !("text" in ctx.message) || !ctx.from) {
    return ctx.reply("Mensagem inválida.");
  }
  const user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
  if (!user) {
    return ctx.reply("Usuário não encontrado.");
  }

  const textoUsuario = ctx.message.text.replace(/^Cadastrar:/i, "").trim();
  ctx.reply("Processando seu pedido com a IA, aguarde um instante...");

  try {
    await processarCadastroComIA(textoUsuario, user.id, ctx);
  } catch (error) {
    ctx.reply("Ocorreu um erro ao tentar entender sua mensagem. Por favor, tente novamente.");
  }
}
