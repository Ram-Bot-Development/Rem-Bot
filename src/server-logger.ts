import { clearGuildSettings, getLogChannelId } from './guild-settings.js';
import type { DiscordRest } from './rest.js';

/** https://discord.com/developers/docs/resources/audit-log#audit-log-entry-object-audit-log-events */
const AUDIT_ACTION_LABEL: Record<number, string> = {
  1: 'Guild update',
  2: 'Channel create',
  3: 'Channel update',
  4: 'Channel delete',
  5: 'Channel overwrite create',
  6: 'Channel overwrite update',
  7: 'Channel overwrite delete',
  8: 'Member kick',
  9: 'Member prune',
  10: 'Ban',
  11: 'Unban',
  12: 'Member update',
  13: 'Role create',
  14: 'Role update',
  15: 'Role delete',
  16: 'Invite create',
  17: 'Invite update',
  18: 'Invite delete',
  19: 'Webhook create',
  20: 'Webhook update',
  21: 'Webhook delete',
  22: 'Emoji create',
  23: 'Emoji update',
  24: 'Emoji delete',
  25: 'Message delete',
  26: 'Message bulk delete',
  27: 'Message pin',
  28: 'Message unpin',
  29: 'Integration create',
  30: 'Integration update',
  31: 'Integration delete',
  32: 'Stage instance create',
  33: 'Stage instance update',
  34: 'Stage instance delete',
  35: 'Sticker create',
  36: 'Sticker update',
  37: 'Sticker delete',
  38: 'Guild scheduled event create',
  39: 'Guild scheduled event update',
  40: 'Guild scheduled event delete',
  41: 'Thread create',
  42: 'Thread update',
  43: 'Thread delete',
  50: 'Creator monetization request created',
  51: 'Creator monetization terms agreed',
  52: 'Soundboard sound create',
  53: 'Soundboard sound update',
  54: 'Soundboard sound delete',
};

type AuditEntryCreate = {
  guild_id: string;
  action_type: number;
  user_id?: string;
  target_id?: string | null;
  reason?: string | null;
};

type MemberPayload = {
  guild_id?: string;
  user?: { id: string; username?: string; global_name?: string | null };
};

type MessageDeletePayload = {
  id: string;
  channel_id: string;
  guild_id?: string;
  author?: { id: string };
};

type MessageDeleteBulkPayload = {
  ids: string[];
  channel_id: string;
  guild_id?: string;
};

async function postLog(
  rest: DiscordRest,
  guildId: string,
  content: string,
): Promise<void> {
  const channelId = getLogChannelId(guildId);
  if (channelId == null) return;

  try {
    await rest.request('POST', `/channels/${channelId}/messages`, {
      content,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Log channel send failed:', msg);
    if (msg.includes('10003') || msg.includes('Missing Access') || msg.includes('50001')) {
      clearGuildSettings(guildId);
    }
  }
}

function auditLabel(actionType: number): string {
  return AUDIT_ACTION_LABEL[actionType] ?? `Action (${actionType})`;
}

export async function handleAuditLogEntryCreate(
  rest: DiscordRest,
  d: unknown,
): Promise<void> {
  const e = d as AuditEntryCreate;
  if (e.guild_id == null) return;
  const action = auditLabel(e.action_type);
  const exec = e.user_id ? `<@${e.user_id}>` : 'Unknown';
  const target = e.target_id ? `target \`${e.target_id}\`` : 'no target';
  const reason = e.reason ? ` — ${e.reason}` : '';
  const line = `**Audit:** ${action} — ${exec}, ${target}${reason}`;
  await postLog(rest, e.guild_id, line);
}

export async function handleGuildMemberAdd(
  rest: DiscordRest,
  d: unknown,
): Promise<void> {
  const m = d as MemberPayload;
  const gid = m.guild_id;
  const uid = m.user?.id;
  if (gid == null || uid == null) return;
  const name =
    m.user?.global_name ?? m.user?.username ?? uid;
  await postLog(rest, gid, `**Member join:** ${name} (<@${uid}>)`);
}

export async function handleGuildMemberRemove(
  rest: DiscordRest,
  d: unknown,
): Promise<void> {
  const m = d as MemberPayload;
  const gid = m.guild_id;
  const uid = m.user?.id;
  if (gid == null || uid == null) return;
  const name =
    m.user?.global_name ?? m.user?.username ?? uid;
  await postLog(rest, gid, `**Member leave:** ${name} (<@${uid}>)`);
}

export async function handleMessageDelete(
  rest: DiscordRest,
  d: unknown,
): Promise<void> {
  const m = d as MessageDeletePayload;
  const gid = m.guild_id;
  if (gid == null) return;
  const author = m.author?.id ? `author <@${m.author.id}>` : 'author unknown';
  await postLog(
    rest,
    gid,
    `**Message deleted** in <#${m.channel_id}> — ${author} — message \`${m.id}\``,
  );
}

export async function handleMessageDeleteBulk(
  rest: DiscordRest,
  d: unknown,
): Promise<void> {
  const m = d as MessageDeleteBulkPayload;
  const gid = m.guild_id;
  if (gid == null) return;
  const n = m.ids?.length ?? 0;
  await postLog(
    rest,
    gid,
    `**Bulk delete:** ${n} messages in <#${m.channel_id}>`,
  );
}

export async function dispatchServerLogEvent(
  rest: DiscordRest,
  eventName: string,
  d: unknown,
): Promise<void> {
  switch (eventName) {
    case 'GUILD_AUDIT_LOG_ENTRY_CREATE':
      await handleAuditLogEntryCreate(rest, d);
      break;
    case 'GUILD_MEMBER_ADD':
      await handleGuildMemberAdd(rest, d);
      break;
    case 'GUILD_MEMBER_REMOVE':
      await handleGuildMemberRemove(rest, d);
      break;
    case 'MESSAGE_DELETE':
      await handleMessageDelete(rest, d);
      break;
    case 'MESSAGE_DELETE_BULK':
      await handleMessageDeleteBulk(rest, d);
      break;
    default:
      break;
  }
}
