import { buildBotInfoMessage } from './bot-info.js';
import { registerApplicationCommands } from './commands.js';
import type { BotPresenceConfig } from './gateway.js';
import { DiscordGateway } from './gateway.js';
import { handleInteractionCreate, type InteractionPayload } from './interactions.js';
import { DiscordRest } from './rest.js';
import { dispatchServerLogEvent } from './server-logger.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and set your bot token.');
  process.exit(1);
}

/**
 * GUILDS | GUILD_MODERATION | GUILD_MESSAGES, plus GUILD_MEMBERS only when
 * ENABLE_MEMBER_EVENTS=1 and the Server Members intent is enabled in the portal.
 * Requesting GUILD_MEMBERS without the portal toggle yields Gateway close 4014 and no READY.
 */
const GATEWAY_INTENTS =
  (1 << 0) |
  (1 << 2) |
  (1 << 9) |
  (process.env.ENABLE_MEMBER_EVENTS?.trim() === '1' ? 1 << 1 : 0);

if (process.env.ENABLE_MEMBER_EVENTS?.trim() !== '1') {
  console.warn(
    'ENABLE_MEMBER_EVENTS is not 1: member join/leave events are disabled. Set ENABLE_MEMBER_EVENTS=1 in .env after enabling Server Members Intent in the Developer Portal.',
  );
}

type ApplicationMe = {
  id: string;
};

function parsePresenceFromEnv(): BotPresenceConfig | undefined {
  const name = process.env.BOT_ACTIVITY_NAME?.trim();
  const typeRaw = process.env.BOT_ACTIVITY_TYPE;
  const statusRaw = process.env.BOT_PRESENCE_STATUS?.trim().toLowerCase();

  const hasName = name != null && name.length > 0;
  const hasStatus =
    statusRaw === 'online' ||
    statusRaw === 'idle' ||
    statusRaw === 'dnd' ||
    statusRaw === 'invisible';

  if (!hasName && !hasStatus) return undefined;

  const typeNum = typeRaw != null && typeRaw !== '' ? parseInt(typeRaw, 10) : NaN;
  const activityType = Number.isFinite(typeNum) ? typeNum : 3;

  const activities = hasName
    ? [{ name: name!.slice(0, 128), type: activityType }]
    : [];

  return {
    status: hasStatus ? (statusRaw as BotPresenceConfig['status']) : 'online',
    activities,
  };
}

const rest = new DiscordRest(DISCORD_TOKEN);

const app = await rest.request<ApplicationMe>('GET', '/oauth2/applications/@me');
await registerApplicationCommands(rest, app.id);

console.log(`Registered commands for application ${app.id}`);

let infoPosted = false;

const gateway = new DiscordGateway(
  DISCORD_TOKEN,
  GATEWAY_INTENTS,
  async (payload) => {
    if (payload.op !== 0 || payload.t == null) return;

    const t = payload.t;

    if (t === 'READY' && !infoPosted) {
      infoPosted = true;
      const ch = process.env.BOT_INFO_CHANNEL_ID?.trim();
      if (ch) {
        try {
          await rest.request('POST', `/channels/${ch}/messages`, {
            content: buildBotInfoMessage(),
          });
        } catch (e) {
          console.error('Failed to post startup info message:', e);
        }
      }
      return;
    }

    if (t === 'INTERACTION_CREATE' && payload.d) {
      await handleInteractionCreate(rest, payload.d as InteractionPayload);
      return;
    }

    await dispatchServerLogEvent(rest, t, payload.d);
  },
  parsePresenceFromEnv(),
);

gateway.connect();
console.log('Gateway connecting…');
