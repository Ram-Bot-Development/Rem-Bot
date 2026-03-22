import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const SETTINGS_PATH = join(DATA_DIR, 'guild-settings.json');

type GuildSettingsFile = {
  guilds: Record<string, { logChannelId: string }>;
};

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(): GuildSettingsFile {
  if (!existsSync(SETTINGS_PATH)) {
    return { guilds: {} };
  }
  try {
    const raw = readFileSync(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as GuildSettingsFile;
    if (parsed.guilds == null || typeof parsed.guilds !== 'object') {
      return { guilds: {} };
    }
    return parsed;
  } catch {
    return { guilds: {} };
  }
}

function writeJson(data: GuildSettingsFile): void {
  ensureDataDir();
  writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function getLogChannelId(guildId: string): string | undefined {
  const v = readJson().guilds[guildId]?.logChannelId;
  return typeof v === 'string' && v !== '' ? v : undefined;
}

export function setLogChannelId(guildId: string, channelId: string): void {
  const data = readJson();
  data.guilds[guildId] = { logChannelId: channelId };
  writeJson(data);
}

export function clearGuildSettings(guildId: string): void {
  const data = readJson();
  delete data.guilds[guildId];
  writeJson(data);
}
