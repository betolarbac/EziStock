import { Context } from "telegraf";
import { prisma } from "../../src/db/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function processarCadastroComIA(
  texto: string,
  userId: string,
  ctx: Context
) {
  const prompt = `
    Analise o texto do usuário para identificar um ou mais produtos, suas quantidades e datas de validade.
    A data de hoje é: ${new Date().toLocaleDateString("pt-BR", {
      timeZone: "America/Maceio",
    })}.
    Sempre retorne a resposta em um formato de ARRAY JSON, mesmo que encontre apenas um produto.
    Cada objeto no array deve conter:
    - 'name' (string): o nome do produto.
    - 'quantity' (number): a quantidade.
    - 'expiresAt' (string no formato 'DD/MM/YYYY'): a data de validade. Se não houver, retorne null.

    Exemplos:
    - Texto: "2 caixas de leite que vencem na próxima sexta" -> [{"name": "leite", "quantity": 2, "expiresAt": "12/07/2025"}]
    - Texto: "cadastre 2 arroz que vao vencer mes que vem e 3 feijoes que vao vencer em dezembro" -> [{"name": "arroz", "quantity": 2, "expiresAt": "07/08/2025"}, {"name": "feijão", "quantity": 3, "expiresAt": "07/12/2025"}]
    
    Texto do usuário para analisar: "${texto}"
  `;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const iaText = response.text();

    const jsonText = iaText.replace("```json", "").replace("```", "").trim();
    const data = JSON.parse(jsonText);

    if (!Array.isArray(data) || data.length === 0) {
      return ctx.reply(
        "Não consegui identificar nenhum produto. Tente ser mais específico."
      );
    }

    const produtosCadastrados = [];

    for (const produto of data) {
      if (!produto.name || !produto.quantity) {
        console.warn("IA retornou um item de produto incompleto:", produto);
        continue;
      }

      let expirationData = null;
      if (produto.expiresAt) {
        const [dia, mes, ano] = produto.expiresAt.split("/");
        expirationData = new Date(
          Number(ano),
          Number(mes) - 1,
          Number(dia),
          12
        );
      }

      await prisma.product.create({
        data: {
          name: produto.name,
          quantity: produto.quantity,
          expiresAt: expirationData,
          userId: userId,
        },
      });
      produtosCadastrados.push(produto.name);
    }

    if (produtosCadastrados.length === 0) {
      return ctx.reply(
        "Não consegui extrair informações válidas de nenhum produto."
      );
    }

    const origem = ctx.message && "voice" in ctx.message ? "áudio" : "texto";
    return ctx.reply(
      `Os seguintes produtos foram cadastrados com sucesso via ${origem}:\n- ${produtosCadastrados.join(
        "\n- "
      )}`
    );
  } catch (error) {
    console.error("Erro ao processar com a IA:", error);
    throw new Error("Falha no processamento da IA.");
  }
}

export async function cadastrarProdutoPorTexto(ctx: Context) {
  if (!ctx.message || !("text" in ctx.message) || !ctx.from) {
    return ctx.reply("Mensagem inválida.");
  }
  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
  });
  if (!user) {
    return ctx.reply("Usuário não encontrado.");
  }

  const textoUsuario = ctx.message.text.replace(/^Cadastrar:/i, "").trim();
  ctx.reply("Processando seu pedido com a IA, aguarde um instante...");

  try {
    await processarCadastroComIA(textoUsuario, user.id, ctx);
  } catch (error) {
    ctx.reply(
      "Ocorreu um erro ao tentar entender sua mensagem. Por favor, tente novamente."
    );
  }
}
