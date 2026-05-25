import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { loadPrompt } from "../utils.js";

/**
 * GitHub research sub-agent.
 *
 * Spawned by the orchestrator via the `Task` tool. Returns a JSON object
 * combining ArchitectureSchema + AdoptionSchema.github populated.
 *
 * Has access to:
 *   - mcp__github__* tools (custom MCP server backed by Octokit)
 *   - WebFetch (for docs pages outside GitHub)
 *   - Task (for recursive sub-research when a project spans many repos)
 */
export const githubAgent: AgentDefinition = {
  description:
    "Researches a project's GitHub presence — repos, stars, contributors, last commit, " +
    "and synthesizes architecture from READMEs and stack files. Spawn when you need " +
    "Architecture or Adoption.github sections.",
  tools: [
    "mcp__github__search_repos",
    "mcp__github__get_repo",
    "mcp__github__get_contributors_count",
    "mcp__github__fetch_readme",
    "mcp__github__list_org_repos",
    "WebFetch",
    "Task",
  ],
  prompt: loadPrompt("github"),
  model: "haiku",
};
