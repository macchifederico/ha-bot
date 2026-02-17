import { runAgent } from "./agent";

export async function handleCommand(text: string, userId: string = "default"): Promise<string> {
  try {
    return await runAgent(text, userId);
  } catch (error: any) {
    console.error("Error en agente:", error.message);
    return "Hubo un error, intentá de nuevo.";
  }
}
