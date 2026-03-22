import { registerApplicationCommands } from './commands.js';
import { DiscordGateway } from './gateway.js';
import { DiscordRest } from './rest.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and set your bot token.');
  process.exit(1);
}

/** Gateway intent: GUILDS — required for guild slash command interactions. */
const GUILDS_INTENT = 1 << 0;

type ApplicationMe = {
  id: string;
};

type Interaction = {
  id: string;
  token: string;
  type: number;
  data?: { name?: string };
};

const rest = new DiscordRest(DISCORD_TOKEN);

const app = await rest.request<ApplicationMe>('GET', '/oauth2/applications/@me');
await registerApplicationCommands(rest, app.id);

console.log(`Registered commands for application ${app.id}`);

const gateway = new DiscordGateway(
  DISCORD_TOKEN,
  GUILDS_INTENT,
  async (payload) => {
    if (payload.t !== 'INTERACTION_CREATE' || !payload.d) return;

    const interaction = payload.d as Interaction;

    if (interaction.type === 1) {
      await rest.request('POST', `/interactions/${interaction.id}/${interaction.token}/callback`, {
        type: 1,
      });
      return;
    }

    if (interaction.type === 2 && interaction.data?.name === 'ping') {
      await rest.request('POST', `/interactions/${interaction.id}/${interaction.token}/callback`, {
        type: 4,
        data: { content: 'Pong!' },
      });
    }
  },
);

gateway.connect();
console.log('Gateway connecting…');
