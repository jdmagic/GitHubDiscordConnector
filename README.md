# AnyPS5 Discord Verification

A Discord [Linked Roles](https://discord.com/developers/docs/tutorials/configuring-app-metadata-for-linked-roles) app that grants a role to members who have merged a pull request into the project on GitHub.

No bot process runs. The app is a small web server: the user authorizes it via Discord OAuth2, it reads their verified GitHub connection, counts their merged PRs, and reports `merged_prs` to Discord. Discord grants the role based on the requirement admins set in server settings.

## Flow

1. User opens the server menu → **Linked Roles** → picks the role → clicks this app.
2. Discord opens `/linked-role`, which redirects to Discord OAuth2 (`identify connections role_connections.write`).
3. `/discord-oauth-callback` reads the user's verified GitHub connection (numeric ID), resolves it to their current login, counts merged PRs in `github.repos`, and pushes `{ merged_prs: N }` to Discord.
4. Discord checks the role's requirement (e.g. Merged PRs ≥ 1) and grants the role.

## Setup

1. **Create a Discord app** at <https://discord.com/developers/applications>.
   - **OAuth2 → Redirects:** add your callback URL, e.g. `http://localhost:3000/discord-oauth-callback`.
   - **Bot:** reset the token (used once to register metadata). The bot needs no intents or permissions.
   - **General Information → Linked Roles Verification URL:** `https://<your-host>/linked-role`.
2. **Create a GitHub fine-grained token.** No permissions are needed for a public repo.
3. **Configure:**
   ```bash
   cp .env.example .env   # fill in secrets
   ```
   Edit `config.json` and set `github.repos` to the project, e.g. `["owner/name"]`. `config.json` is committed; secrets are referenced as `${VAR}` and filled from `.env` or the real environment.
4. **Install and register metadata** (once, and again whenever `METADATA` in `src/discord.ts` changes):
   ```bash
   npm install
   npm run register
   ```
5. **Run:** `npm run dev` (or `npm start`).
6. **Add the app to your server:** open the OAuth2 URL generator with the `applications.commands` scope. Then go to **Server Settings → Roles → (role) → Links → Add requirement**, pick this app, and set **Merged PRs ≥ 1**.

Discord opens the Linked Roles Verification URL in the user's browser. For testing on another device, or for real use, expose the server over HTTPS (e.g. `cloudflared tunnel --url http://localhost:3000`). Then update the redirect URI in both the Developer Portal and `.env`.

## Notes

- A user's `merged_prs` updates only when they link again. That's fine for a "≥ 1" requirement because the count can only go up.
- The GitHub search API allows 30 requests per minute with a token.
- Set `CONFIG_PATH` to use a config file other than `./config.json`.
