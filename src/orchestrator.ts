import { query } from "@anthropic-ai/claude-agent-sdk";
import { searchAgent } from "./agents/search.js";
import { githubAgent } from "./agents/github.js";
import { socialAgent } from "./agents/social.js";
import { devexAgent } from "./agents/devex.js";
import { hackathonAgent } from "./agents/hackathon.js";
import { githubMcpServer } from "./mcp/github-tools.js";
import { loadPrompt, extractJson, nowIso } from "./utils.js";
import { ResearchReportSchema, type ResearchReport } from "./schemas.js";

export interface OrchestratorResult {
  report: ResearchReport;
  cost_usd: number;
  duration_ms: number;
}

/**
 * Runs the full research pipeline for a project:
 *   1. Lead orchestrator spawns 5 sub-agents in parallel via the Task tool
 *   2. Synthesizer (final assistant message) emits the merged JSON
 *   3. We parse + validate against ResearchReportSchema
 *
 * Throws if the final output fails Zod validation (caller can retry).
 */
export async function runResearchPipeline(projectName: string): Promise<OrchestratorResult> {
  const leadPrompt = loadPrompt("lead");
  const synthHint = loadPrompt("synthesizer");

  const userPrompt =
    `Project to research: **${projectName}**\n\n` +
    `Today's date: ${nowIso().slice(0, 10)}.\n\n` +
    `Spawn all 5 sub-agents in parallel now. When they return, synthesize their outputs into ` +
    `ONE JSON object matching ResearchReportSchema (snapshot, architecture, adoption, sentiment, ` +
    `use_cases, hackathon, devex). Add project_name="${projectName}" and generated_at="${nowIso()}". ` +
    `Output ONLY the JSON object as your final message — no prose, no code fences.\n\n` +
    `Synthesizer guidance:\n${synthHint}`;

  const q = query({
    prompt: userPrompt,
    options: {
      model: process.env.DEVREL_RESEARCH_LEAD_MODEL ?? "sonnet",
      systemPrompt: leadPrompt,
      maxTurns: 60,
      allowedTools: ["Task"],
      agents: {
        search: searchAgent,
        github: githubAgent,
        social: socialAgent,
        devex: devexAgent,
        hackathon: hackathonAgent,
      },
      mcpServers: {
        github: githubMcpServer,
      },
      // permissionMode default ("ask") is wrong for headless CLI;
      // we trust our own tools so we bypass prompts.
      permissionMode: "bypassPermissions",
    },
  });

  let finalText = "";
  let cost_usd = 0;
  let duration_ms = 0;

  for await (const msg of q) {
    if (msg.type === "assistant" && msg.message) {
      for (const block of msg.message.content) {
        if (block.type === "text" && "text" in block) {
          finalText = block.text; // keep last assistant text — the synth output
        }
      }
    }
    if (msg.type === "result" && msg.subtype === "success") {
      cost_usd = (msg as any).total_cost_usd ?? 0;
      duration_ms = (msg as any).duration_ms ?? 0;
    }
  }

  if (!finalText) {
    throw new Error("Orchestrator produced no assistant text. Check API key + connectivity.");
  }

  const raw = extractJson(finalText);
  const parsed = ResearchReportSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Synthesizer output failed schema validation:\n${issues}\n\n` +
        `Raw output (first 1200 chars):\n${finalText.slice(0, 1200)}`,
    );
  }

  return { report: parsed.data, cost_usd, duration_ms };
}
