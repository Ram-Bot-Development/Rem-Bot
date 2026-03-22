import type { DiscordRest } from './rest.js';

export type ApplicationCommand = {
  name: string;
  description: string;
  type: number;
};

const DEFAULT_COMMANDS: ApplicationCommand[] = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
    type: 1,
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
