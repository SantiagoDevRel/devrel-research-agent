import { query } from "@anthropic-ai/claude-agent-sdk";
import { searchAgent } from "./agents/search.js";
import { githubAgent } from "./agents/github.js";
import { socialAgent } from "./agents/social.js";
import { devexAgent } from "./agents/devex.js";
import { hackathonAgent } from "./agents/hackathon.js";
import { githubMcpServer } from "./mcp/github-tools.js";
import { loadPrompt, extractJson, nowIso } from "./utils.js";
import { ResearchReportSchema, type ResearchReport } from "./schemas.js";
import { RESEARCH_REPORT_SHAPE } from "./schema-compact.js";

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
 * Cost optimization: the schema lives in the SYSTEM prompt (along with the
 * lead orchestrator prompt + synth guidance). System prompts are auto-cached
 * by the Agent SDK once they cross ~1024 tokens, so subsequent reports in the
 * same hour reuse the cache (~90% cost reduction on input tokens).
 *
 * Throws if the final output fails Zod validation (caller can retry).
 */
export async function runResearchPipeline(projectName: string): Promise<OrchestratorResult> {
  const systemPrompt = [
    loadPrompt("lead"),
    "",
    "---",
    "",
    "## Output schema (use these EXACT field names in the final synthesis)",
    "",
    RESEARCH_REPORT_SHAPE,
    "",
    "---",
    "",
    "## Synthesizer guidance",
    "",
    loadPrompt("synthesizer"),
  ].join("\n");

  const userPrompt =
    `Project to research: **${projectName}**\n\n` +
    `Today's date: ${nowIso().slice(0, 10)}.\n\n` +
    `Spawn all 5 sub-agents in parallel now via the Task tool. When all return, ` +
    `synthesize their outputs into ONE JSON object matching the ResearchReport shape ` +
    `from the system prompt. Set project_name="${projectName}" and generated_at="${nowIso()}". ` +
    `Output ONLY the JSON object as your final assistant message — no prose, no code fences.`;

  const q = query({
    prompt: userPrompt,
    options: {
      model: process.env.DEVREL_RESEARCH_LEAD_MODEL ?? "sonnet",
      systemPrompt,
      maxTurns: 30,
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
          finalText = block.text;
        }
      }
    }
    if (msg.type === "result" && msg.subtype === "success") {
      cost_usd = (msg as any).total_cost_usd ?? 0;
      duration_ms = (msg as any).duration_ms ?? 0;
    }
  }

  if (!finalText) {
    throw new Error("Orchestrator produced no assistant text. Check auth (API key or `claude login`).");
  }

  // First validation attempt
  let parsed = ResearchReportSchema.safeParse(extractJson(finalText));

  // If validation fails, ask the synth to fix ONLY the specific errors.
  // This is much cheaper than re-running the entire research pipeline (~$0.05 vs ~$2).
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 15)
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");

    const fixPrompt =
      `Your previous JSON output failed schema validation with these errors:\n\n` +
      issues +
      `\n\nHere is your previous output:\n\n` +
      "```json\n" +
      finalText.slice(0, 8000) +
      "\n```\n\n" +
      `Produce a CORRECTED JSON object that fixes ONLY those errors. ` +
      `Preserve all other content. Output ONLY the JSON, no prose, no fences.`;

    const fix = query({
      prompt: fixPrompt,
      options: {
        model: process.env.DEVREL_RESEARCH_LEAD_MODEL ?? "sonnet",
        systemPrompt,
        maxTurns: 1,
        allowedTools: [],
        permissionMode: "bypassPermissions",
      },
    });

    let fixedText = "";
    for await (const msg of fix) {
      if (msg.type === "assistant" && msg.message) {
        for (const block of msg.message.content) {
          if (block.type === "text" && "text" in block) fixedText = block.text;
        }
      }
      if (msg.type === "result" && msg.subtype === "success") {
        cost_usd += (msg as any).total_cost_usd ?? 0;
        duration_ms += (msg as any).duration_ms ?? 0;
      }
    }

    parsed = ResearchReportSchema.safeParse(extractJson(fixedText));
    if (!parsed.success) {
      const fixIssues = parsed.error.issues
        .slice(0, 5)
        .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(
        `Synthesizer output failed validation even after retry:\n${fixIssues}\n\n` +
          `Original errors:\n${issues}\n\n` +
          `Retry output (first 800 chars):\n${fixedText.slice(0, 800)}`,
      );
    }
  }

  return { report: parsed.data, cost_usd, duration_ms };
}
