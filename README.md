# Rem Bot

Minimal [Discord](https://discord.com/) bot that uses the **HTTP API v10** and **Gateway** directly—no `discord.js`. REST calls go through a small client that respects Discord [`X-RateLimit-*`](https://discord.com/developers/docs/topics/rate-limits) headers and handles `429` / global scope. The Gateway uses the [`ws`](https://github.com/websockets/ws) package for WebSockets.

## License

This project is released under the [MIT License](LICENSE).

## Forking

After you fork, set **`repository`**, **`bugs`**, and **`homepage`** in [`package.json`](package.json) to your own repo URL. The bot builds its Discord REST `User-Agent` and Gateway client label from `name`, `version`, and those fields so API traffic identifies your project, not upstream.

## Requirements

- **Node.js** 20.6 or newer (uses native `fetch`, `import`, and `node --env-file` for environment variables)

## Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Create a Discord application and bot user in the [Discord Developer Portal](https://discord.com/developers/applications).

3. Copy `.env.example` to `.env` and set `DISCORD_TOKEN` to your bot token. Do not commit `.env`.

4. Build and run:

   ```bash
   npm run build
   npm start
   ```

   For development with TypeScript directly:

   ```bash
   npm run dev
   ```

## Inviting the bot

Use an invite URL like (replace `YOUR_APPLICATION_ID` with your application’s Client ID from the portal):

```text
https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&permissions=0&scope=bot%20applications.commands
```

The `applications.commands` scope is required for slash commands. Adjust `permissions` if you add features that need them.

## Behavior

- On startup, the bot registers a global **`/ping`** command and connects to the Gateway.
- Slash **`/ping`** is answered with `Pong!` via [`Create Interaction Response`](https://discord.com/developers/docs/interactions/receiving-and-responding#create-interaction-response).

## Dependencies

- **Runtime:** [`ws`](https://www.npmjs.com/package/ws) — WebSocket client for the Gateway only.

## Policies

Bots must follow the [Discord Developer Policy](https://discord.com/developers/docs/policy) and [Terms of Service](https://discord.com/terms).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).
