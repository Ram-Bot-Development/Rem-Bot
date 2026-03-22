/** Startup message posted once per process when `BOT_INFO_CHANNEL_ID` is set. */
export function buildBotInfoMessage(): string {
  return [
    '**What is Rem Bot?**',
    '',
    'Rem Bot is a lightweight, Discord-focused bot designed to be fast, smooth, and reliable. Unlike larger, more complex systems, Rem Bot keeps things simple by using fewer modules and focusing only on what matters most for Discord servers.',
    '',
    'The goal of Rem Bot is performance and stability — it runs with minimal overhead, responds quickly, and avoids unnecessary features that could slow things down. It’s perfect for servers that want essential functionality without the complexity of a full-scale system.',
    '',
    'While it’s less advanced than Ram Bot, that’s intentional — Rem Bot prioritizes efficiency, ease of use, and a clean experience over having every possible feature.',
    '',
    '**Commands & logging:** `/ping` — health check. `/settings` → **logs** → **channel** — set a log channel; **logs** → **disable** — turn logging off. Logging covers audit events, optional member join/leave (when enabled), and message deletes.',
  ].join('\n');
}
