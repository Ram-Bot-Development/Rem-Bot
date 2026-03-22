import { clearGuildSettings, setLogChannelId } from './guild-settings.js';
import type { DiscordRest } from './rest.js';

const EPHEMERAL = 1 << 6;

type InteractionOption = {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: InteractionOption[];
};

type InteractionData = {
  name?: string;
  options?: InteractionOption[];
};

export type InteractionPayload = {
  id: string;
  token: string;
  type: number;
  guild_id?: string;
  data?: InteractionData;
};

function callback(
  rest: DiscordRest,
  interaction: InteractionPayload,
  body: { content: string; ephemeral?: boolean },
): Promise<unknown> {
  return rest.request(
    'POST',
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    {
      type: 4,
      data: {
        content: body.content,
        ...(body.ephemeral ? { flags: EPHEMERAL } : {}),
      },
    },
  );
}

function parseSettingsLogs(
  data: InteractionData | undefined,
): { sub: 'channel' | 'disable'; channelId?: string } | null {
  if (data?.name !== 'settings' || !data.options?.length) return null;
  const logsGroup = data.options.find((o) => o.name === 'logs');
  if (!logsGroup?.options?.length) return null;
  const sub = logsGroup.options[0];
  if (sub.name === 'disable') return { sub: 'disable' };
  if (sub.name === 'channel') {
    const chOpt = sub.options?.find((o) => o.name === 'channel');
    const channelId =
      chOpt?.value != null ? String(chOpt.value) : undefined;
    return { sub: 'channel', channelId };
  }
  return null;
}

export async function handleInteractionCreate(
  rest: DiscordRest,
  interaction: InteractionPayload,
): Promise<void> {
  if (interaction.type === 1) {
    await rest.request('POST', `/interactions/${interaction.id}/${interaction.token}/callback`, {
      type: 1,
    });
    return;
  }

  if (interaction.type !== 2 || !interaction.data) return;

  const { name } = interaction.data;

  if (name === 'ping') {
    await callback(rest, interaction, { content: 'Pong!' });
    return;
  }

  if (name === 'settings') {
    if (!interaction.guild_id) {
      await callback(rest, interaction, {
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const parsed = parseSettingsLogs(interaction.data);
    if (parsed == null) {
      await callback(rest, interaction, {
        content: 'Could not read command options.',
        ephemeral: true,
      });
      return;
    }

    if (parsed.sub === 'disable') {
      clearGuildSettings(interaction.guild_id);
      await callback(rest, interaction, {
        content: 'Server logging is disabled and the saved log channel was cleared.',
        ephemeral: true,
      });
      return;
    }

    if (parsed.sub === 'channel') {
      if (!parsed.channelId) {
        await callback(rest, interaction, {
          content: 'No channel was provided.',
          ephemeral: true,
        });
        return;
      }
      setLogChannelId(interaction.guild_id, parsed.channelId);
      await callback(rest, interaction, {
        content: `Server actions will be logged in <#${parsed.channelId}>.`,
        ephemeral: true,
      });
    }
  }
}
