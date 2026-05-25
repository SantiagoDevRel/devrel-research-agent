import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { loadPrompt } from "../utils.js";

export const devexAgent: AgentDefinition = {
  description:
    "Acts like a developer encountering the project for the first time. Reads docs, " +
    "estimates quickstart friction, lists pain points and bright spots. Produces the DevEx section.",
  tools: ["WebFetch", "WebSearch", "mcp__github__fetch_readme"],
  prompt: loadPrompt("devex"),
  model: "haiku",
};
