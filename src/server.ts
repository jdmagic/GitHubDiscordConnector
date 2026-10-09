import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { html } from "hono/html";
import { loadConfig } from "./config.js";
import { authorizeUrl, exchangeCode, getConnections, pushRoleConnection } from "./discord.js";
import { countMergedPrs, loginForId } from "./github.js";

const config = loadConfig();
const callbackPath = new URL(config.discord.redirectUri).pathname;
const secureCookies = config.discord.redirectUri.startsWith("https://");
const STATE_COOKIE = "oauth_state";

const page = (title: string, body: ReturnType<typeof html>) => html`<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.5; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${body}
    </body>
  </html>`;

const app = new Hono();

app.get("/", (c) =>
  c.html(page("GitHub contributor verification", html`<p><a href="/linked-role">Link your Discord account</a></p>`)),
);

// Set as the "Linked Roles Verification URL" in the Discord Developer Portal.
app.get("/linked-role", async (c) => {
  const state = randomUUID();
  await setSignedCookie(c, STATE_COOKIE, state, config.cookieSecret, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });
  return c.redirect(authorizeUrl(config, state));
});

app.get(callbackPath, async (c) => {
  const { code, state, error } = c.req.query();
  if (error) return c.html(page("Authorization cancelled", html`<p>Discord returned: ${error}</p>`), 400);

  const expected = await getSignedCookie(c, config.cookieSecret, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/" });
  if (!code || !state || !expected || state !== expected) {
    return c.html(page("Link expired", html`<p>Please start again from Discord.</p>`), 403);
  }

  const accessToken = await exchangeCode(config, code);
  const connections = await getConnections(accessToken);
  const github = connections.find((conn) => conn.type === "github" && conn.verified && !conn.revoked);
  if (!github) {
    return c.html(
      page(
        "No GitHub account found",
        html`<p>
          Connect GitHub to Discord first (User Settings → Connections), then try linking the role again.
        </p>`,
      ),
      400,
    );
  }

  const login = await loginForId(config, github.id);
  const mergedPrs = await countMergedPrs(config, login);
  await pushRoleConnection(config, accessToken, login, { merged_prs: mergedPrs });

  return c.html(
    page(
      "You're linked!",
      html`<p>
          GitHub account <strong>${login}</strong> has <strong>${mergedPrs}</strong> merged PR${mergedPrs === 1 ? "" : "s"}
          in ${config.github.repos.join(", ")}.
        </p>
        <p>You can close this tab and return to Discord.</p>`,
    ),
  );
});

app.onError((err, c) => {
  console.error(err);
  return c.html(page("Something went wrong", html`<p>Please try again later.</p>`), 500);
});

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(`Listening on http://localhost:${port}`);
  console.log(`Linked Roles Verification URL path: /linked-role, OAuth callback path: ${callbackPath}`);
});
