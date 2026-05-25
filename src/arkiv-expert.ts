import Anthropic from "@anthropic-ai/sdk";
import { loadPrompt, extractJson } from "./utils.js";
import {
  ArkivAnalysisSchema,
  type ArkivAnalysis,
  type ResearchReport,
} from "./schemas.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Takes a research report and produces an Arkiv-specific competitive analysis.
 *
 * Uses prompt caching on the large Arkiv positioning playbook so subsequent
 * reports in the same hour share the cached prefix (savings: ~75% on cached tokens).
 */
export async function runArkivExpert(report: ResearchReport): Promise<ArkivAnalysis> {
  const systemPrompt = loadPrompt("arkiv-expert");

  const msg = await client.messages.create({
    model: process.env.DEVREL_RESEARCH_SYNTH_MODEL ?? "claude-opus-4-7",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Research report (JSON) about **${report.project_name}**:\n\n` +
              "```json\n" +
              JSON.stringify(report, null, 2) +
              "\n```\n\n" +
              `Produce ONE JSON object matching ArkivAnalysisSchema. Output JSON only.`,
          },
        ],
      },
    ],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const raw = extractJson(text);
  const parsed = ArkivAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Arkiv expert output failed schema validation:\n${issues}\n\n` +
        `Raw output (first 1200 chars):\n${text.slice(0, 1200)}`,
    );
  }
  return parsed.data;
}
