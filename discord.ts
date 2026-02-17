import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { handleCommand } from "./commands";

export function startDiscord() {
/*  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  client.on("ready", () => console.log("✅ Discord bot iniciado"));

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith("!ha")) return; // prefijo para no responder a todo

    const text = message.content.replace("!ha", "").trim();
    const response = await handleCommand(text);
    await message.reply(response);
  });

  client.login(process.env.DISCORD_TOKEN!);

  // Función para enviar notificaciones
  return async (msg: string) => {
    const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID!) as TextChannel;
    await channel?.send(msg);
  };
*/
}

