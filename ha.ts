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

function getHttpBaseUrl(): string {
  const wsUrl = process.env.HA_URL!;
  return wsUrl.replace(/^ws(s?):\/\//, "http$1://").replace("/api/websocket", "");
}

async function haFetch(path: string, method: string, body?: object): Promise<any> {
  const url = `${getHttpBaseUrl()}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.HA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HA REST error ${res.status}: ${await res.text()}`);
  return res.json().catch(() => null);
}

export async function createScene(scene_id: string, entities: Record<string, any>): Promise<any> {
  return send({
    type: "call_service",
    domain: "scene",
    service: "create",
    service_data: { scene_id, entities },
  });
}

export async function createSceneSnapshot(scene_id: string, snapshot_entities: string[]): Promise<any> {
  return send({
    type: "call_service",
    domain: "scene",
    service: "create",
    service_data: { scene_id, snapshot_entities },
  });
}

export async function createAutomation(id: string, alias: string, time: string, serviceCall: object): Promise<any> {
  const sc = serviceCall as any;
  const body = {
    alias,
    trigger: [{ platform: "time", at: time.includes(":") && time.split(":").length === 2 ? `${time}:00` : time }],
    condition: [],
    action: [{ service: `${sc.domain}.${sc.service}`, target: { entity_id: sc.entity_id } }],
    mode: "single",
  };
  return haFetch(`/api/config/automation/config/${id}`, "POST", body);
}

export async function deleteAutomation(id: string): Promise<any> {
  return haFetch(`/api/config/automation/config/${id}`, "DELETE");
}
