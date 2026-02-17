import { connectHA, eventHandlers } from "./ha";
import { startTelegram } from "./telegram";
import { startDiscord } from "./discord";

// Arranca HA
connectHA();

// Arranca bots
const telegramNotify = startTelegram();
const discordNotify = await startDiscord();

// Notificaciones automáticas de eventos de HA hacia ambos bots
eventHandlers.push((entityId: string, newState: any) => {
  if (entityId === "binary_sensor.movimiento_entrada" && newState.state === "on") {
    const msg = "? Movimiento detectado en la entrada!";
    telegramNotify?.(msg);
    discordNotify?.(msg);
  }

  if (entityId === "sensor.temperatura_salon") {
    const temp = parseFloat(newState.state);
    if (temp < 15) {
      const msg = `? Temperatura baja: ${temp}°C en el salón`;
      telegramNotify?.(msg);
      discordNotify?.(msg);
    }
  }
});
