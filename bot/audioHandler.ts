import { Context } from 'telegraf';
import { prisma } from '../src/db/prisma';
import { processarCadastroComIA } from './commands/registrar';
import axios from 'axios';
import FormData from 'form-data';

export async function handleAudio(ctx: Context) {

  if (!ctx.message || !('voice' in ctx.message) || !ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
  });

  if (!user) {
    return ctx.reply('Por favor, envie /start para se registrar antes de enviar áudios.');
  }

  const isPremium = user.isPremium && user.subscriptionExpiresAt && user.subscriptionExpiresAt > new Date();

  if (!isPremium) {
    return ctx.reply("🎙️ O cadastro de produtos por áudio é uma funcionalidade Premium.\n\nDigite /assinar para liberar este e outros recursos!")
  }

  try {
    ctx.reply('Ouvindo seu áudio, um momento...');
    const fileId = ctx.message.voice.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);

   
    const response = await axios({
      url: fileLink.href,
      responseType: 'arraybuffer',
    });
    const audioBuffer = Buffer.from(response.data);


    const form = new FormData();
    form.append('audio', audioBuffer, { filename: 'audio.ogg', contentType: ctx.message.voice.mime_type });
    form.append('language', 'portuguese'); 

  
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

   
    await processarCadastroComIA(transcription, user, ctx);

  } catch (error: string | any) {
    console.error('Erro no processamento do áudio com a Gladia:', error.response?.data || error.message);
    ctx.reply('Desculpe, tive um problema para processar seu áudio.');
  }
}