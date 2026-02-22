import { GoogleGenerativeAI } from "@google/generative-ai";
import { getStates, callService, createScene, createSceneSnapshot, createAutomation, deleteAutomation } from "./ha";
import { canControlDevices } from "./users";

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

  // Verificar permisos antes de ejecutar
  const canControl = canControlDevices(userId);

  const systemPrompt = `
Sos un asistente de hogar inteligente que controla dispositivos a través de Home Assistant.
Respondés siempre en español, de forma natural y coloquial.
Cuando el usuario te pide algo, interpretás su intención aunque no use comandos exactos.

${canControl ? "" : "IMPORTANTE: Este usuario solo puede CONSULTAR estados, NO puede controlar dispositivos. Si pide encender/apagar algo, explicále que no tiene permisos."}

Estado actual de los dispositivos:
${JSON.stringify(context, null, 2)}

Cuando necesites ejecutar una acción sobre un dispositivo, respondé ÚNICAMENTE con este JSON:
{
  "action": "call_service",
  "domain": "light",
  "service": "turn_off",
  "entity_id": "light.sala",
  "message": "Listo, apagué la luz de la sala."
}

Si son múltiples acciones, usá un array:
{
  "actions": [
    { "domain": "light", "service": "turn_off", "entity_id": "light.sala" },
    { "domain": "switch", "service": "turn_off", "entity_id": "switch.televisor" }
  ],
  "message": "Apagué las luces y el televisor. Buenas noches!"
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
  "message": "Listo, puse la lámpara en rojo al 80%."
}

Colores comunes en RGB:
- Rojo: [255, 0, 0]
- Verde: [0, 255, 0]
- Azul: [0, 0, 255]
- Amarillo: [255, 255, 0]
- Naranja: [255, 165, 0]
- Violeta: [148, 0, 211]
- Rosa: [255, 105, 180]
- Blanco cálido: usar color_temp_kelvin: 2700 (dentro de "extra")
- Blanco frío: usar color_temp_kelvin: 6500 (dentro de "extra")

Si es solo una consulta sin acción:
{
  "action": "none",
  "message": "Tu respuesta acá"
}

Dominios disponibles: light, switch, climate, media_player, cover, fan, alarm_control_panel.
Servicios comunes: turn_on, turn_off, toggle.
Para todos los dispositivos de un dominio usá entity_id: "all".

--- ESCENAS ---

Para crear una escena con estados específicos:
{
  "action": "create_scene",
  "scene_id": "cine",
  "entities": {
    "light.sala": { "state": "on", "brightness": 80 },
    "switch.tv": { "state": "on" }
  },
  "message": "Escena 'cine' creada!"
}

Para guardar el estado ACTUAL de dispositivos como escena (snapshot):
{
  "action": "create_scene_snapshot",
  "scene_id": "sala_ahora",
  "snapshot_entities": ["light.sala", "light.lampara_rgb"],
  "message": "Guardé el estado actual de las luces como escena 'sala_ahora'!"
}

Para activar una escena existente usá call_service con domain "scene" y service "turn_on":
{
  "action": "call_service",
  "domain": "scene",
  "service": "turn_on",
  "entity_id": "scene.cine",
  "message": "Activé la escena cine."
}

--- PROGRAMACIÓN ---

Para programar una acción a horario fijo o recurrente (persiste en HA como automatización):
{
  "action": "create_automation",
  "automation_id": "bot_apagar_luces_23hs",
  "alias": "Apagar luces a las 23hs",
  "time": "23:00",
  "service_call": {
    "domain": "light",
    "service": "turn_off",
    "entity_id": "all"
  },
  "message": "Programé apagar todas las luces todos los días a las 23hs."
}

Para programar una acción con delay en minutos (efímero, no persiste si el bot se reinicia):
{
  "action": "schedule_delay",
  "description": "Apagar TV en 30 minutos",
  "delay_minutes": 30,
  "service_call": {
    "domain": "media_player",
    "service": "turn_off",
    "entity_id": "media_player.tv"
  },
  "message": "En 30 minutos apago el TV."
}

Para listar las automatizaciones creadas por el bot:
{
  "action": "list_automations",
  "message": "Esto es lo que tengo programado:"
}

Para eliminar una automatización del bot:
{
  "action": "delete_automation",
  "automation_id": "bot_apagar_luces_23hs",
  "message": "Eliminé la programación."
}

Importante: los automation_id siempre empiezan con "bot_". El scene_id NO debe incluir el prefijo "scene.".
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

    const controlActions = [
      "call_service", "create_scene", "create_scene_snapshot",
      "create_automation", "schedule_delay", "delete_automation",
    ];

    // Solo ejecutar si el usuario tiene permisos
    if (!canControl && (parsed.actions || controlActions.includes(parsed.action))) {
      return "❌ No tenés permisos para controlar dispositivos. Solo podés consultar el estado.";
    }

    // Múltiples acciones
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

    // Acción única
    if (parsed.action === "call_service") {
      await callService(parsed.domain, parsed.service, {
        entity_id: parsed.entity_id,
        ...(parsed.extra ?? {}),
      });
    } else if (parsed.action === "create_scene") {
      await createScene(parsed.scene_id, parsed.entities);
    } else if (parsed.action === "create_scene_snapshot") {
      await createSceneSnapshot(parsed.scene_id, parsed.snapshot_entities);
    } else if (parsed.action === "create_automation") {
      await createAutomation(parsed.automation_id, parsed.alias, parsed.time, parsed.service_call);
    } else if (parsed.action === "schedule_delay") {
      const sc = parsed.service_call;
      const ms = (parsed.delay_minutes ?? 0) * 60 * 1000;
      setTimeout(() => callService(sc.domain, sc.service, { entity_id: sc.entity_id }), ms);
    } else if (parsed.action === "list_automations") {
      const allStatesNow = await getStates("automation");
      const botAutomations = allStatesNow.filter((s: any) => s.entity_id.startsWith("automation.bot_"));
      const list = botAutomations.length
        ? botAutomations.map((s: any) => `• ${s.attributes.friendly_name ?? s.entity_id} (${s.state})`).join("\n")
        : "No tenés nada programado todavía.";

      history.push({ role: "user", parts: [{ text: userMessage }] });
      history.push({ role: "model", parts: [{ text: raw }] });
      if (history.length > 20) history.splice(0, 2);
      conversationHistory.set(userId, history);

      return `${parsed.message ?? "Programaciones del bot:"}\n${list}`;
    } else if (parsed.action === "delete_automation") {
      await deleteAutomation(parsed.automation_id);
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