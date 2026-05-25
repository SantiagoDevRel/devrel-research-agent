import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { loadPrompt } from "../utils.js";

/**
 * v1: uses WebSearch + WebFetch against Reddit/HN public URLs.
 * v2: dedicated mcp__social__* tools wrapping Reddit JSON + HN Algolia.
 */
export const socialAgent: AgentDefinition = {
  description:
    "Scans Reddit, Hacker News, and Twitter for developer sentiment about the project. " +
    "Produces the Sentiment section (complaints + praises with sources).",
  tools: ["WebSearch", "WebFetch"],
  prompt: loadPrompt("social"),
  model: "haiku",
};
