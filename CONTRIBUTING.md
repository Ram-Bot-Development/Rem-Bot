# Contributing

Thanks for your interest in Rem Bot.

## Local setup

1. If you forked the project, point `repository`, `bugs`, and `homepage` in `package.json` at your repo so Discord API `User-Agent` and docs match your fork.
2. Use **Node.js 20.6+** and `npm install`.
3. Copy `.env.example` to `.env` and set `DISCORD_TOKEN` to a bot token from the [Discord Developer Portal](https://discord.com/developers/applications). Never commit `.env` or paste tokens into issues or pull requests.
4. Run `npm run dev` while iterating, or `npm run build` and `npm start` to match production.

## Code style

- Match existing formatting and patterns in `src/`.
- Prefer small, focused changes that are easy to review.
- Keep the production dependency surface minimal (see `package.json`).

## Pull requests

- Describe what changed and why in plain language.
- If you add behavior, note how you tested it (e.g. ran the bot and used `/ping`).

## Questions

Open an issue on the Git host where this repository is published (for example GitHub Issues on your fork) for bugs or design discussion.
