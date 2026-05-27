import { query } from "@anthropic-ai/claude-agent-sdk";
import { loadPrompt, extractJson } from "./utils.js";
import {
  ArkivAnalysisSchema,
  type ArkivAnalysis,
  type ResearchReport,
} from "./schemas.js";
import { ARKIV_ANALYSIS_SHAPE } from "./schema-compact.js";

/**
 * Arkiv DevRel expert layer.
 *
 * Runs as a SEPARATE query() call (not a sub-agent of the orchestrator) so:
 *   1. Its large system prompt (the Arkiv positioning playbook + schema shape)
 *      hits the Agent SDK's prompt cache independently — shared across reports.
 *   2. We can iterate the Arkiv prompt without disturbing the research pipeline.
 *   3. Auth path is unified with the orchestrator.
 *
 * Takes a research report → produces an Arkiv-specific competitive analysis.
 */
export async function runArkivExpert(report: ResearchReport): Promise<ArkivAnalysis> {
  const systemPrompt = [
    loadPrompt("arkiv-expert"),
    "",
    "---",
    "",
    "## Output schema (use these EXACT field names)",
    "",
    ARKIV_ANALYSIS_SHAPE,
  ].join("\n");

  const userPrompt =
    `Research report (JSON) about **${report.project_name}**:\n\n` +
    "```json\n" +
    JSON.stringify(report, null, 2) +
    "\n```\n\n" +
    `Produce ONE JSON object matching the ArkivAnalysis shape from the system prompt. ` +
    `Output JSON only — no prose, no markdown wrapper, no fences.`;

  async function runOnce(prompt: string): Promise<string> {
    const q = query({
      prompt,
      options: {
        model: process.env.DEVREL_RESEARCH_SYNTH_MODEL ?? "opus",
        systemPrompt,
        maxTurns: 1,
        allowedTools: [],
        permissionMode: "bypassPermissions",
      },
    });

    let finalText = "";
    for await (const msg of q) {
      if (msg.type === "assistant" && msg.message) {
        for (const block of msg.message.content) {
          if (block.type === "text" && "text" in block) {
            finalText = block.text;
          }
        }
      }
    }
    return finalText;
  }

  const firstText = await runOnce(userPrompt);
  if (!firstText) {
    throw new Error("Arkiv expert produced no output. Check auth (API key or `claude login`).");
  }

  let parsed = ArkivAnalysisSchema.safeParse(extractJson(firstText));

  // Retry once with explicit errors injected, if validation fails.
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
      firstText.slice(0, 8000) +
      "\n```\n\n" +
      `Produce a CORRECTED JSON object that fixes ONLY those errors. ` +
      `Preserve all other content. Output ONLY the JSON, no prose, no fences.`;

    const retryText = await runOnce(fixPrompt);
    parsed = ArkivAnalysisSchema.safeParse(extractJson(retryText));
    if (!parsed.success) {
      const fixIssues = parsed.error.issues
        .slice(0, 5)
        .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(
        `Arkiv expert output failed validation even after retry:\n${fixIssues}\n\n` +
          `Original errors:\n${issues}`,
      );
    }
  }

  return parsed.data;
}
