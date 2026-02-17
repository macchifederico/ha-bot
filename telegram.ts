import { Telegraf } from "telegraf";
import { handleCommand } from "./commands";

export let telegramBot: Telegraf;
let notifyFn: (msg: string) => Promise<void>;

export function startTelegram() {
  telegramBot = new Telegraf(process.env.TELEGRAM_TOKEN!);
  const chatId = process.env.TELEGRAM_CHAT_ID!;

  telegramBot.use(async (ctx, next) => {
    const allowedId = process.env.TELEGRAM_CHAT_ID!;
    const userId = ctx.from?.id.toString();

    if (userId !== allowedId) {
      console.log(`⚠️ Acceso denegado para usuario: ${userId}`);
      await ctx.reply("No estás autorizado para usar este bot.");
      return; // corta acá, no sigue al handler
    }

    return next();
  });

  telegramBot.on("text", async (ctx) => {
    const userId = ctx.from.id.toString();
    const response = await handleCommand(ctx.message.text, userId);
    await ctx.reply(response);
  });

  // Funcion para enviar notificaciones automaticas desde HA
  notifyFn = async (msg: string) => {
    await telegramBot.telegram.sendMessage(chatId, msg);
  };

  telegramBot.launch();
  console.log("? Telegram bot iniciado");

  return notifyFn;
}
