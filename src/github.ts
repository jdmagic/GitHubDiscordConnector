import type { Config } from "./config.js";

async function githubFetch<T>(config: Config, path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(config.github.token && { Authorization: `Bearer ${config.github.token}` }),
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "anyps5-discord-verification",
    },
  });
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * Resolves a GitHub numeric user ID to its current login. Logins can be renamed,
 * so the ID from the Discord connection is the source of truth.
 */
export async function loginForId(config: Config, id: string): Promise<string> {
  const user = await githubFetch<{ login: string }>(config, `/user/${encodeURIComponent(id)}`);
  return user.login;
}

/** Counts PRs authored by `login` that were merged into any configured repo. */
export async function countMergedPrs(config: Config, login: string): Promise<number> {
  const repos = config.github.repos.map((r) => `repo:${r}`).join(" ");
  const q = `${repos} is:pr is:merged author:${login}`;
  const result = await githubFetch<{ total_count: number }>(
    config,
    `/search/issues?per_page=1&q=${encodeURIComponent(q)}`,
  );
  return result.total_count;
}
