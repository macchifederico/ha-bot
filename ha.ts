let msgId = 1;
const pending = new Map<number, (d: any) => void>();
let ws: WebSocket;

// Callbacks para notificaciones
export const eventHandlers: ((entityId: string, newState: any) => void)[] = [];

export function connectHA() {
  ws = new WebSocket(process.env.HA_URL!);

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "auth_required")
      ws.send(JSON.stringify({ type: "auth", access_token: process.env.HA_TOKEN }));

    if (msg.type === "auth_ok") {
      console.log("✅ HA conectado");
      send({ type: "subscribe_events", event_type: "state_changed" });
    }

    if (msg.type === "result") {
      pending.get(msg.id)?.(msg);
      pending.delete(msg.id);
    }

    if (msg.type === "event" && msg.event.event_type === "state_changed") {
      const { entity_id, new_state } = msg.event.data;
      eventHandlers.forEach(fn => fn(entity_id, new_state));
    }
  };

  ws.onclose = () => {
    console.log("⚠️ HA desconectado, reconectando en 5s...");
    setTimeout(connectHA, 5000); // reconexión automática
  };
}

function send(payload: object): Promise<any> {
  return new Promise(resolve => {
    const id = msgId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, ...payload }));
  });
}

export async function getStates(domain?: string) {
  const res = await send({ type: "get_states" });
  return domain
    ? res.result.filter((s: any) => s.entity_id.startsWith(domain))
    : res.result;
}

export async function callService(domain: string, service: string, data = {}) {
  return send({ type: "call_service", domain, service, service_data: data });
}
