import { Context } from 'telegraf';
import { prisma } from '../src/db/prisma';
import { processarCadastroComIA } from './commands/registrar';
import axios from 'axios';
import FormData from 'form-data';

export async function handleAudio(ctx: Context) {
  // 1. Verifica se a mensagem é de voz e se o usuário existe
  if (!ctx.message || !('voice' in ctx.message) || !ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
  });
  if (!user) {
    return ctx.reply('Por favor, envie /start para se registrar antes de enviar áudios.');
  }

  try {
    ctx.reply('Ouvindo seu áudio, um momento...');
    const fileId = ctx.message.voice.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);

    // 2. Baixa o arquivo de áudio do Telegram
    const response = await axios({
      url: fileLink.href,
      responseType: 'arraybuffer',
    });
    const audioBuffer = Buffer.from(response.data);

    // 3. Prepara o formulário para enviar à Gladia
    const form = new FormData();
    form.append('audio', audioBuffer, { filename: 'audio.ogg', contentType: ctx.message.voice.mime_type });
    form.append('language', 'portuguese'); // Forçar português aumenta a precisão

    // 4. Envia para a API da Gladia para transcrição
    const gladiaResponse = await axios.post(
      'https://api.gladia.io/audio/text/audio-transcription/',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'x-gladia-key': process.env.GLADIA_API_KEY,
        },
      }
    );

    const transcription = gladiaResponse.data?.prediction?.map((p: { transcription: string }) => p.transcription).join(' ') || '';

    if (!transcription) {
      return ctx.reply('Não consegui entender o que você disse no áudio. Tente novamente.');
    }

    ctx.reply(`Eu entendi: "${transcription}".\n\nProcessando com a IA...`);

    // 5. Envia o texto transcrito para a mesma função que processa texto
    await processarCadastroComIA(transcription, user.id, ctx);

  } catch (error: string | any) {
    console.error('Erro no processamento do áudio com a Gladia:', error.response?.data || error.message);
    ctx.reply('Desculpe, tive um problema para processar seu áudio.');
  }
}