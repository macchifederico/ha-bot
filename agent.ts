import { GoogleGenerativeAI } from "@google/generative-ai";
import { getStates, callService } from "./ha";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const conversationHistory = new Map<string, {role: string, parts: {text: string}[]}[]>();

export async function runAgent(userMessage: string, userId: string): Promise<string> {
  const allStates = await getStates();
  const context = allStates.map((s: any) => ({
    id: s.entity_id,
    name: s.attributes.friendly_name ?? s.entity_id,
    state: s.state,
    attributes: s.attributes,
  }));

  const systemPrompt = `
Sos un asistente de hogar inteligente que controla dispositivos a traves de Home Assistant.
Respondas siempre en espaol, de forma natural y coloquial.
Cuando el usuario te pide algo, interpretes su intencion aunque no use comandos exactos.

Estado actual de los dispositivos:
${JSON.stringify(context, null, 2)}

Cuando necesites ejecutar una accion sobre un dispositivo, responde UNICAMENTE con este JSON:
{
  "action": "call_service",
  "domain": "light",
  "service": "turn_off",
  "entity_id": "light.sala",
  "message": "Listo, apagua la luz de la sala."
}

Si son multiples acciones, usa un array:
{
  "actions": [
    { "domain": "light", "service": "turn_off", "entity_id": "light.sala" },
    { "domain": "switch", "service": "turn_off", "entity_id": "switch.televisor" }
  ],
  "message": "Apagua las luces y el televisor. Buenas noches!"
}

Para luces RGB, el servicio es turn_on con atributos extra en el campo "extra":
{
  "action": "call_service",
  "domain": "light",
  "service": "turn_on",
  "entity_id": "light.lampara_rgb",
  "extra": {
    "rgb_color": [255, 0, 0],
    "brightness_pct": 80
  },
  "message": "Listo, puse la lampara en rojo al 80%."
}

Colores comunes en RGB:
- Rojo: [255, 0, 0]
- Verde: [0, 255, 0]
- Azul: [0, 0, 255]
- Amarillo: [255, 255, 0]
- Naranja: [255, 165, 0]
- Violeta: [148, 0, 211]
- Rosa: [255, 105, 180]
- Blanco calido: usar color_temp_kelvin: 2700 (dentro de "extra")
- Blanco frio: usar color_temp_kelvin: 6500 (dentro de "extra")

Si es solo una consulta sin accion:
{
  "action": "none",
  "message": "Tu respuesta aca"
}

Dominios disponibles: light, switch, climate, media_player, cover, fan, alarm_control_panel.
Servicios comunes: turn_on, turn_off, toggle.
Para todos los dispositivos de un dominio usa entity_id: "all".
  `.trim();

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });

  const history = conversationHistory.get(userId) ?? [];

  const chat = model.startChat({ history });

  const result = await chat.sendMessage(userMessage);
  const raw = result.response.text();

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return raw;

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.actions && Array.isArray(parsed.actions)) {
      await Promise.all(
        parsed.actions.map((a: any) =>
          callService(a.domain, a.service, { entity_id: a.entity_id, ...(a.extra ?? {}) })
        )
      );

      history.push({ role: "user", parts: [{ text: userMessage }] });
      history.push({ role: "model", parts: [{ text: raw }] });
      if (history.length > 20) history.splice(0, 2);
      conversationHistory.set(userId, history);

      return parsed.message ?? "Hecho.";
    }

    if (parsed.action === "call_service") {
      await callService(parsed.domain, parsed.service, {
        entity_id: parsed.entity_id,
        ...(parsed.extra ?? {}),
      });
    }

    history.push({ role: "user", parts: [{ text: userMessage }] });
    history.push({ role: "model", parts: [{ text: raw }] });
    if (history.length > 20) history.splice(0, 2);
    conversationHistory.set(userId, history);

    return parsed.message ?? "Hecho.";
  } catch {
    return raw;
  }
}
