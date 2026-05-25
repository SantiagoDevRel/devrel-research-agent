import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { Octokit } from "@octokit/rest";
import { z } from "zod";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN, // optional — raises rate limit
  userAgent: "devrel-research-agent",
});

function asContent(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function asError(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
  };
}

export const githubMcpServer = createSdkMcpServer({
  name: "github",
  version: "0.1.0",
  tools: [
    tool(
      "search_repos",
      "Search GitHub repositories by query. Returns the top 10 results with name, owner, stars, description.",
      {
        query: z.string().describe("GitHub search query, e.g. 'ceramic network in:name org:ceramicnetwork'"),
        sort: z
          .enum(["stars", "forks", "updated"])
          .optional()
          .default("stars"),
      },
      async ({ query, sort }) => {
        try {
          const { data } = await octokit.search.repos({
            q: query,
            sort,
            order: "desc",
            per_page: 10,
          });
          return asContent({
            total: data.total_count,
            items: data.items.map((r) => ({
              full_name: r.full_name,
              html_url: r.html_url,
              stars: r.stargazers_count,
              forks: r.forks_count,
              description: r.description,
              language: r.language,
              pushed_at: r.pushed_at,
            })),
          });
        } catch (e) {
          return asError((e as Error).message);
        }
      },
    ),

    tool(
      "get_repo",
      "Get detailed metadata for a single repository: stars, forks, open_issues, default_branch, primary language, last push timestamp.",
      {
        owner: z.string(),
        repo: z.string(),
      },
      async ({ owner, repo }) => {
        try {
          const { data } = await octokit.repos.get({ owner, repo });
          return asContent({
            full_name: data.full_name,
            html_url: data.html_url,
            description: data.description,
            stars: data.stargazers_count,
            forks: data.forks_count,
            open_issues: data.open_issues_count,
            default_branch: data.default_branch,
            language: data.language,
            pushed_at: data.pushed_at,
            created_at: data.created_at,
            license: data.license?.spdx_id ?? null,
            topics: data.topics ?? [],
          });
        } catch (e) {
          return asError((e as Error).message);
        }
      },
    ),

    tool(
      "get_contributors_count",
      "Get the exact contributor count for a repository (more accurate than the contributors_url shortcut).",
      {
        owner: z.string(),
        repo: z.string(),
      },
      async ({ owner, repo }) => {
        try {
          // The list endpoint with per_page=1 returns Link header with last page = total count
          const res = await octokit.request("GET /repos/{owner}/{repo}/contributors", {
            owner,
            repo,
            per_page: 1,
            anon: "true",
          });
          const link = res.headers.link ?? "";
          const m = link.match(/&page=(\d+)>;\s*rel="last"/);
          const total = m ? parseInt(m[1]!, 10) : Array.isArray(res.data) ? res.data.length : 0;
          return asContent({ owner, repo, contributors: total });
        } catch (e) {
          return asError((e as Error).message);
        }
      },
    ),

    tool(
      "fetch_readme",
      "Fetch the raw markdown content of a repository's README.",
      {
        owner: z.string(),
        repo: z.string(),
      },
      async ({ owner, repo }) => {
        try {
          const { data } = await octokit.repos.getReadme({
            owner,
            repo,
            mediaType: { format: "raw" },
          });
          // When mediaType.format === "raw", data is the raw string
          const text = typeof data === "string" ? data : "";
          return asContent({
            owner,
            repo,
            length: text.length,
            // Truncate to keep token usage reasonable — the agent gets a feel for it
            content: text.length > 12000 ? text.slice(0, 12000) + "\n\n…[truncated]" : text,
          });
        } catch (e) {
          return asError((e as Error).message);
        }
      },
    ),

    tool(
      "list_org_repos",
      "List all public repositories under a GitHub organization (top 50, sorted by stars).",
      {
        org: z.string(),
      },
      async ({ org }) => {
        try {
          const { data } = await octokit.repos.listForOrg({
            org,
            type: "public",
            sort: "pushed",
            per_page: 50,
          });
          const sorted = [...data].sort((a, b) => b.stargazers_count! - a.stargazers_count!);
          return asContent({
            org,
            count: sorted.length,
            repos: sorted.map((r) => ({
              name: r.name,
              full_name: r.full_name,
              description: r.description,
              stars: r.stargazers_count,
              pushed_at: r.pushed_at,
              language: r.language,
              archived: r.archived,
            })),
          });
        } catch (e) {
          return asError((e as Error).message);
        }
      },
    ),
  ],
});
