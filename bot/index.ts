import { Telegraf } from "telegraf";
import { config } from "dotenv";
import { prisma } from "../src/db/prisma";
import { setupCommands } from "./commands/index";
import { iniciarCron } from "./cron";
import { handleAudio } from "./audioHandler";
import { message } from "telegraf/filters";

config();
const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.start(async (ctx) => {
  const telegramId = String(ctx.from.id);
  const name = ctx.from.first_name;
  await prisma.user.upsert({
    where: { telegramId },
    update: {},
    create: { telegramId, name },
  });
  ctx.reply(`Olá, ${name}! Bem-vindo ao assistente de estoque.`);
});

setupCommands(bot);
bot.on(message("voice"), handleAudio);

iniciarCron(bot);
bot.launch();
