# 🏠 HA Bot

Bot de Telegram con IA para controlar dispositivos de **Home Assistant** usando lenguaje natural en español.

## ¿Qué hace?

Conecta Telegram con Home Assistant a través de un agente de IA (Google Gemini), permitiendo controlar y consultar el estado de tus dispositivos del hogar con mensajes coloquiales, sin necesidad de comandos exactos.

```
Telegram → Bun → Gemini AI → Home Assistant
```

## Características

- **Lenguaje natural**: "apagá todo antes de dormir", "¿está prendida la luz del cuarto?"
- **Control de dispositivos**: luces, switches, climatización, persianas, y más
- **Soporte RGB**: cambio de color y brillo en luces inteligentes
- **Múltiples acciones**: ejecuta varias acciones en simultáneo con un solo mensaje
- **Historial de conversación**: recuerda el contexto de mensajes anteriores por usuario
- **Notificaciones automáticas**: HA puede enviar alertas al chat (movimiento, temperatura, etc.)
- **Acceso restringido**: solo el usuario autorizado puede controlar el bot
- **Reconexión automática**: si se cae la conexión con HA, reconecta sola

## Tecnologías

- **[Bun](https://bun.sh/)** — Runtime de JavaScript/TypeScript
- **[Telegraf](https://telegraf.js.org/)** — Framework para bots de Telegram
- **[Google Gemini](https://ai.google.dev/)** — Modelo de IA para interpretación de lenguaje natural
- **[Home Assistant WebSocket API](https://developers.home-assistant.io/docs/api/websocket)** — Comunicación en tiempo real con HA

## Requisitos

- Bun v1.0 o superior (ARM64 recomendado)
- Home Assistant corriendo en la red local
- Token de bot de Telegram (via [@BotFather](https://t.me/BotFather))
- API Key de Google Gemini ([aistudio.google.com](https://aistudio.google.com))
- Long-Lived Access Token de Home Assistant

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/ha-bot
cd ha-bot

# Instalar dependencias
bun install

# Configurar variables de entorno
cp .env.example .env
# Completar los valores en .env

# Iniciar
bun run index.ts
```

## Configuración

Copiá `.env.example` a `.env` y completá los valores:

```env
# Home Assistant
HA_URL=ws://localhost:8123/api/websocket
HA_TOKEN=tu_long_lived_token

# Telegram
TELEGRAM_TOKEN=tu_bot_token
TELEGRAM_CHAT_ID=tu_chat_id

# Google Gemini
GEMINI_API_KEY=tu_api_key
```

### Obtener las credenciales

**Home Assistant Token**
`Perfil → Long-Lived Access Tokens → Create Token`

**Telegram Bot Token**
Hablar con [@BotFather](https://t.me/BotFather) → `/newbot`

**Telegram Chat ID**
Hablar con [@userinfobot](https://t.me/userinfobot)

**Gemini API Key**
[aistudio.google.com](https://aistudio.google.com) → Get API Key → Create API key (gratuito)

## Estructura del proyecto

```
ha-bot/
├── index.ts          # Entry point, arranca todos los servicios
├── ha.ts             # Conexión WebSocket con Home Assistant
├── agent.ts          # Agente de IA con Google Gemini
├── commands.ts       # Interfaz entre bots y agente
├── telegram.ts       # Bot de Telegram
├── discord.ts        # Bot de Discord (opcional)
├── .env              # Variables de entorno (no subir al repo)
├── .env.example      # Plantilla de variables de entorno
└── package.json
```

## Ejemplos de uso

```
"apagá todo antes de dormir"
"¿está prendida alguna luz?"
"hace frío, subí la calefacción"
"¿qué temperatura tiene el living?"
"poné la lámpara en azul al 50%"
"encendé el ventilador del cuarto"
"apagá la tele y las luces del living"
```

## Dispositivos soportados

| Dominio | Ejemplos |
|---|---|
| `light` | Luces, tiras LED, lámparas RGB |
| `switch` | Enchufes inteligentes, switches |
| `climate` | Aire acondicionado, calefacción |
| `media_player` | Televisores, parlantes |
| `cover` | Persianas, cortinas |
| `fan` | Ventiladores |
| `alarm_control_panel` | Alarmas |

## Docker

Próximamente: dockerización para integrar con el stack existente de Home Assistant, Pi-hole y Nginx Proxy Manager.

## Seguridad

El bot solo acepta mensajes del `TELEGRAM_CHAT_ID` configurado en el `.env`. Cualquier otro usuario recibe un mensaje de acceso denegado.

## Licencia

MIT
