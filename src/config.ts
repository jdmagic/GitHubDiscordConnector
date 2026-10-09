export interface Config {
  port: number;
  discord: {
    clientId: string;
    clientSecret: string;
    botToken: string;
    redirectUri: string;
    /** Shown on the user's profile badge, e.g. "GitHub". */
    platformName: string;
  };
  github: {
    /** Optional; only raises rate limits. Public repos work without one. */
    token: string;
    /** "owner/name" pairs; merged PRs are counted across all of them. */
    repos: string[];
  };
  cookieSecret: string;
}

/** Reads settings from the environment, loading .env first if present. See .env.example. */
export function loadConfig(): Config {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file; rely on the real environment (e.g. in production).
  }

  const missing: string[] = [];
  const required = (name: string) => {
    const value = process.env[name];
    if (!value) missing.push(name);
    return value ?? "";
  };
  const optional = (name: string, fallback: string) => process.env[name] || fallback;

  const config: Config = {
    port: Number(optional("PORT", "3000")),
    discord: {
      clientId: required("DISCORD_CLIENT_ID"),
      clientSecret: required("DISCORD_CLIENT_SECRET"),
      botToken: required("DISCORD_BOT_TOKEN"),
      redirectUri: required("DISCORD_REDIRECT_URI"),
      platformName: optional("DISCORD_PLATFORM_NAME", "GitHub"),
    },
    github: {
      token: optional("GITHUB_TOKEN", ""),
      repos: required("GITHUB_REPOS")
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),
    },
    cookieSecret: required("COOKIE_SECRET"),
  };

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")} (see .env.example)`);
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  for (const repo of config.github.repos) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      throw new Error(`GITHUB_REPOS: "${repo}" is not a valid "owner/name" repo`);
    }
  }
  return config;
}
