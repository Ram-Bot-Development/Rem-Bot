import type { DiscordRest } from './rest.js';

/** https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type */
export const ApplicationCommandOptionType = {
  SUB_COMMAND: 1,
  SUB_COMMAND_GROUP: 2,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
  CHANNEL: 7,
  ROLE: 8,
} as const;

export type ApplicationCommandOption = {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  options?: ApplicationCommandOption[];
};

export type ApplicationCommand = {
  name: string;
  description: string;
  type: number;
  options?: ApplicationCommandOption[];
  dm_permission?: boolean;
  /** Permission bitfield as string (e.g. Manage Guild = "32"). */
  default_member_permissions?: string | null;
};

const DEFAULT_COMMANDS: ApplicationCommand[] = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
    type: 1,
  },
  {
    name: 'settings',
    description: 'Configure Rem Bot for this server',
    type: 1,
    dm_permission: false,
    default_member_permissions: '32',
    options: [
      {
        name: 'logs',
        description: 'Server action logging',
        type: ApplicationCommandOptionType.SUB_COMMAND_GROUP,
        options: [
          {
            name: 'channel',
            description: 'Set the channel where server actions are logged',
            type: ApplicationCommandOptionType.SUB_COMMAND,
            options: [
              {
                name: 'channel',
                description: 'Text channel for logs',
                type: ApplicationCommandOptionType.CHANNEL,
                required: true,
              },
            ],
          },
          {
            name: 'disable',
            description: 'Stop logging and clear the saved log channel',
            type: ApplicationCommandOptionType.SUB_COMMAND,
          },
        ],
      },
    ],
  },
];

/** Overwrites global application commands (PUT /applications/{id}/commands). */
export async function registerApplicationCommands(
  rest: DiscordRest,
  applicationId: string,
  commands: ApplicationCommand[] = DEFAULT_COMMANDS,
): Promise<void> {
  await rest.request(
    'PUT',
    `/applications/${applicationId}/commands`,
    commands,
  );
}
