import { query } from "@anthropic-ai/claude-agent-sdk";
import { loadPrompt, extractJson } from "./utils.js";
import {
  ArkivAnalysisSchema,
  type ArkivAnalysis,
  type ResearchReport,
} from "./schemas.js";

/**
 * Arkiv DevRel expert layer.
 *
 * Runs as a SEPARATE query() call (not a sub-agent of the orchestrator) so:
 *   1. Its large system prompt (the Arkiv positioning playbook) hits the
 *      Agent SDK's prompt cache independently — shared across every report.
 *   2. We can iterate the Arkiv prompt without disturbing the research pipeline.
 *   3. Auth path is unified: same Claude Agent SDK as the orchestrator
 *      (uses ANTHROPIC_API_KEY or your `claude login` OAuth session).
 *
 * Takes a research report → produces an Arkiv-specific competitive analysis.
 */
export async function runArkivExpert(report: ResearchReport): Promise<ArkivAnalysis> {
  const systemPrompt = loadPrompt("arkiv-expert");

  const userPrompt =
    `Research report (JSON) about **${report.project_name}**:\n\n` +
    "```json\n" +
    JSON.stringify(report, null, 2) +
    "\n```\n\n" +
    `Produce ONE JSON object matching ArkivAnalysisSchema. Output JSON only — ` +
    `no prose, no markdown wrapper, no fences.`;

  const q = query({
    prompt: userPrompt,
    options: {
      model: process.env.DEVREL_RESEARCH_SYNTH_MODEL ?? "opus",
      systemPrompt,
      maxTurns: 1,
      allowedTools: [], // pure analysis, no tools needed
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

  if (!finalText) {
    throw new Error("Arkiv expert produced no output. Check auth (API key or `claude login`).");
  }

  const raw = extractJson(finalText);
  const parsed = ArkivAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Arkiv expert output failed schema validation:\n${issues}\n\n` +
        `Raw output (first 1200 chars):\n${finalText.slice(0, 1200)}`,
    );
  }
  return parsed.data;
}
