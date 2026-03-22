import { clearGuildSettings, getLogChannelId } from './guild-settings.js';
import type { DiscordRest } from './rest.js';

/**
 * action_type values — must match Discord’s table (not sequential 1…n).
 * @see https://discord.com/developers/docs/resources/audit-log#audit-log-entry-object-audit-log-events
 */
const AUDIT_ACTION_LABEL: Record<number, string> = {
  1: 'Guild update',
  10: 'Channel create',
  11: 'Channel update',
  12: 'Channel delete',
  13: 'Channel overwrite create',
  14: 'Channel overwrite update',
  15: 'Channel overwrite delete',
  20: 'Member kick',
  21: 'Member prune',
  22: 'Member ban added',
  23: 'Member unbanned',
  24: 'Member update',
  25: 'Member role update',
  26: 'Member move',
  27: 'Member disconnect',
  28: 'Bot added',
  30: 'Role create',
  31: 'Role update',
  32: 'Role delete',
  40: 'Invite create',
  41: 'Invite update',
  42: 'Invite delete',
  50: 'Webhook create',
  51: 'Webhook update',
  52: 'Webhook delete',
  60: 'Emoji create',
  61: 'Emoji update',
  62: 'Emoji delete',
  72: 'Message delete',
  73: 'Message bulk delete',
  74: 'Message pin',
  75: 'Message unpin',
  80: 'Integration create',
  81: 'Integration update',
  82: 'Integration delete',
  83: 'Stage instance create',
  84: 'Stage instance update',
  85: 'Stage instance delete',
  90: 'Sticker create',
  91: 'Sticker update',
  92: 'Sticker delete',
  100: 'Scheduled event create',
  101: 'Scheduled event update',
  102: 'Scheduled event delete',
  110: 'Thread create',
  111: 'Thread update',
  112: 'Thread delete',
  121: 'Application command permission update',
  130: 'Soundboard sound create',
  131: 'Soundboard sound update',
  132: 'Soundboard sound delete',
  140: 'Auto Moderation rule create',
  141: 'Auto Moderation rule update',
  142: 'Auto Moderation rule delete',
  143: 'Auto Moderation: message blocked',
  144: 'Auto Moderation: message flagged',
  145: 'Auto Moderation: user timed out',
  146: 'Auto Moderation: user quarantined',
  150: 'Creator monetization request created',
  151: 'Creator monetization terms accepted',
  163: 'Onboarding prompt create',
  164: 'Onboarding prompt update',
  165: 'Onboarding prompt delete',
  166: 'Onboarding create',
  167: 'Onboarding update',
  190: 'Server Guide create',
  191: 'Server Guide update',
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
  const target = e.target_id ? `\`${e.target_id}\`` : '—';
  const reason = e.reason ? `\n**Reason:** ${e.reason}` : '';
  const line = `**Audit:** ${action}\n**Executor:** ${exec}\n**Target:** ${target}${reason}`;
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
