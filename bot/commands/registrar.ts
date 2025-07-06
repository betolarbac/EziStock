import { Context } from "telegraf";
import { prisma } from "../../src/db/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function cadastrarProdutoIA(ctx: Context) {
  if (!ctx.message || !("text" in ctx.message) || !ctx.from) {
    return ctx.reply("Mensagem inválida. Tente novamente.");
  }
  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
  });

  if (!user) {
    return ctx.reply("Usuário não encontrado. Envie /start para começar.");
  }

  const textoUsuario = ctx.message.text.replace(/^Cadastrar:/i, "").trim();

  const prompt = `
    Analise o texto do usuário para identificar um produto, sua quantidade e sua data de validade.
    A data de hoje é: ${new Date().toLocaleDateString("pt-BR")}.
    Retorne a resposta em um formato JSON.
    - O nome do produto deve ser 'name'.
    - A quantidade deve ser 'quantity' (um número).
    - A data de validade deve ser 'expiresAt' no formato 'DD/MM/YYYY'. Se a data não for encontrada, retorne null.

    Exemplos:
    - Texto: "2 caixas de leite longa vida que vencem na próxima sexta" -> Retorne o JSON com a data correta.
    - Texto: "1 pacote de pão de forma para 12/07/2025" -> {"name": "pão de forma", "quantity": 1, "expiresAt": "12/07/2025"}
    - Texto: "maçãs, umas 5" -> {"name": "maçãs", "quantity": 5, "expiresAt": null}

    Texto do usuário para analisar: "${textoUsuario}"
  `;

  try {
    ctx.reply("Processando seu pedido com a IA, aguarde um instante...");

    // 3. Chama a API do Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const iaText = response.text();

    // Limpa a resposta da IA para garantir que seja um JSON válido
    const jsonText = iaText.replace("```json", "").replace("```", "").trim();
    const data = JSON.parse(jsonText);

    // 4. Validação dos dados retornados pela IA
    if (!data.name || !data.quantity) {
      return ctx.reply(
        "Não consegui identificar o produto ou a quantidade. Tente ser mais específico. Ex: 'Cadastrar: 2 leites para 20/12/2025'"
      );
    }

    let expirationDate = null;
    if (data.expiresAt) {
      const [dia, mes, ano] = data.expiresAt.split("/");
      expirationDate = new Date(Number(ano), Number(mes) - 1, Number(dia), 12);
    }

    // 5. Salva o produto no banco de dados
    await prisma.product.create({
      data: {
        name: data.name,
        quantity: Number(data.quantity),
        expiresAt: expirationDate,
        userId: user.id,
      },
    });

    ctx.reply(`Produto "${data.name}" cadastrado com sucesso!`);
  } catch (error) {
    console.error("Erro ao processar com a IA:", error);
    ctx.reply(
      "Ocorreu um erro ao tentar entender sua mensagem. Por favor, tente novamente."
    );
  }
}
