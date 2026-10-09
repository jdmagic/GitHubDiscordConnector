import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    token: string;
    /** "owner/name" pairs; merged PRs are counted across all of them. */
    repos: string[];
  };
  cookieSecret: string;
}

/** Replaces every "${VAR}" in string values with process.env.VAR, collecting any that are unset. */
function interpolate(value: unknown, missing: Set<string>): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{(\w+)\}/g, (_, name: string) => {
      const env = process.env[name];
      if (env === undefined || env === "") missing.add(name);
      return env ?? "";
    });
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, missing));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v, missing)]));
  }
  return value;
}

export function loadConfig(path = process.env.CONFIG_PATH ?? "config.json"): Config {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file; rely on the real environment (e.g. in production).
  }

  const raw = JSON.parse(readFileSync(resolve(path), "utf8"));
  const missing = new Set<string>();
  const config = interpolate(raw, missing) as Config;

  if (missing.size > 0) {
    throw new Error(`Missing environment variables referenced by ${path}: ${[...missing].join(", ")}`);
  }
  if (!Array.isArray(config.github?.repos) || config.github.repos.length === 0) {
    throw new Error(`${path}: github.repos must list at least one "owner/name" repo`);
  }
  for (const repo of config.github.repos) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || repo === "OWNER/REPO") {
      throw new Error(`${path}: "${repo}" is not a valid "owner/name" repo`);
    }
  }
  return config;
}
