import { Telegraf } from "telegraf";
import { handleCommand } from "./commands";
import { isAuthorized, isAdmin, canControlDevices, addUser, removeUser, listUsers } from "./users";

export let telegramBot: Telegraf;
let notifyFn: (msg: string) => Promise<void>;

export function startTelegram() {
  telegramBot = new Telegraf(process.env.TELEGRAM_TOKEN!);
  const chatId = process.env.TELEGRAM_CHAT_ID!;

  // Middleware de autorización
  telegramBot.use(async (ctx, next) => {
    const userId = ctx.from?.id.toString();

    if (!userId || !isAuthorized(userId)) {
      console.log(`?? Acceso denegado para usuario: ${userId}`);
      await ctx.reply("No estás autorizado para usar este bot.");
      return;
    }

    return next();
  });

  // Comandos admin: gestión de usuarios
  telegramBot.command("adduser", async (ctx) => {
    const userId = ctx.from.id.toString();

    if (!isAdmin(userId)) {
      await ctx.reply("? Solo los administradores pueden agregar usuarios.");
      return;
    }

    const args = ctx.message.text.split(" ");
    if (args.length < 3) {
      await ctx.reply("Uso: /adduser <user_id> <nombre> [admin|user]\nEjemplo: /adduser 987654321 Celeste user");
      return;
    }

    const newUserId = args[1];
    const name = args[2];
    const role = (args[3] === "admin" ? "admin" : "user") as "admin" | "user";

    addUser(newUserId, name, role);
    await ctx.reply(`? Usuario agregado:\nID: ${newUserId}\nNombre: ${name}\nRol: ${role}`);
  });

  telegramBot.command("removeuser", async (ctx) => {
    const userId = ctx.from.id.toString();

    if (!isAdmin(userId)) {
      await ctx.reply("? Solo los administradores pueden eliminar usuarios.");
      return;
    }

    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
      await ctx.reply("Uso: /removeuser <user_id>");
      return;
    }

    const targetUserId = args[1];
    removeUser(targetUserId);
    await ctx.reply(`? Usuario ${targetUserId} eliminado.`);
  });

  telegramBot.command("listusers", async (ctx) => {
    const userId = ctx.from.id.toString();

    if (!isAdmin(userId)) {
      await ctx.reply("? Solo los administradores pueden ver la lista de usuarios.");
      return;
    }

    const users = listUsers();
    const list = Object.entries(users).map(
      ([id, user]) => `? ${user.name} (${id})\n  Rol: ${user.role}\n  Agregado: ${user.added_at}`
    );

    await ctx.reply(`? Usuarios autorizados:\n\n${list.join("\n\n")}`);
  });

  telegramBot.command("help", async (ctx) => {
    const userId = ctx.from.id.toString();
    const isAdminUser = isAdmin(userId);

    let help = `? *Comandos disponibles*\n\n`;
    help += `Hablame en lenguaje natural para controlar tus dispositivos.\n\n`;
    help += `Ejemplos:\n`;
    help += `? "apagá todo"\n`;
    help += `? "¿está prendida la luz del cuarto?"\n`;
    help += `? "poné la lámpara en azul"`;

    if (isAdminUser) {
      help += `\n\n*Comandos de administrador:*\n`;
      help += `/adduser <id> <nombre> [admin|user] - Agregar usuario\n`;
      help += `/removeuser <id> - Eliminar usuario\n`;
      help += `/listusers - Ver usuarios autorizados`;
    }

    await ctx.replyWithMarkdown(help);
  });

  // Handler principal de mensajes de texto
  telegramBot.on("text", async (ctx) => {
    // Ignorar comandos que ya fueron procesados
    if (ctx.message.text.startsWith("/")) return;

    const userId = ctx.from.id.toString();

    // Verificar si el usuario puede controlar dispositivos
    if (!canControlDevices(userId)) {
      await ctx.reply("? No tenés permisos para controlar dispositivos. Solo podés consultar el estado.");
      return;
    }

    const response = await handleCommand(ctx.message.text, userId);
    await ctx.reply(response);
  });

  // Función para enviar notificaciones automáticas desde HA
  notifyFn = async (msg: string) => {
    await telegramBot.telegram.sendMessage(chatId, msg);
  };

  telegramBot.launch();
  console.log("? Telegram bot iniciado");

  return notifyFn;
}
