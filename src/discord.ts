import type { Config } from "./config.js";

const API = "https://discord.com/api/v10";

/** Keys and types of the role-connection metadata this app publishes. Admins build role requirements from these. */
export const METADATA = [
  {
    key: "merged_prs",
    name: "Merged PRs",
    description: "Pull requests merged into the project",
    type: 2, // INTEGER_GREATER_THAN_OR_EQUAL
  },
] as const;

export type Metadata = Record<(typeof METADATA)[number]["key"], number>;

export const SCOPES = ["identify", "connections", "role_connections.write"];

async function discordFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    throw new Error(`Discord ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export function authorizeUrl(config: Config, state: string): string {
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: config.discord.redirectUri,
    response_type: "code",
    state,
    scope: SCOPES.join(" "),
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function exchangeCode(config: Config, code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.discord.clientId,
    client_secret: config.discord.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.discord.redirectUri,
  });
  const token = await discordFetch<{ access_token: string; scope: string }>("/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const granted = token.scope.split(" ");
  const missing = SCOPES.filter((s) => !granted.includes(s));
  if (missing.length > 0) throw new Error(`User did not grant scopes: ${missing.join(", ")}`);
  return token.access_token;
}

export interface Connection {
  type: string;
  id: string;
  name: string;
  verified: boolean;
  revoked?: boolean;
}

export function getConnections(accessToken: string): Promise<Connection[]> {
  return discordFetch("/users/@me/connections", { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function pushRoleConnection(
  config: Config,
  accessToken: string,
  platformUsername: string,
  metadata: Metadata,
): Promise<void> {
  await discordFetch(`/users/@me/applications/${config.discord.clientId}/role-connection`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      platform_name: config.discord.platformName,
      platform_username: platformUsername,
      metadata,
    }),
  });
}

export function registerMetadata(config: Config): Promise<unknown> {
  return discordFetch(`/applications/${config.discord.clientId}/role-connections/metadata`, {
    method: "PUT",
    headers: { Authorization: `Bot ${config.discord.botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(METADATA),
  });
}
