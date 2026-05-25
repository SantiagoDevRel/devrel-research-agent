import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { loadPrompt } from "../utils.js";

export const searchAgent: AgentDefinition = {
  description:
    "General web research: what is the project, who founded it, funding rounds, team size. " +
    "Produces the Snapshot section.",
  tools: ["WebSearch", "WebFetch"],
  prompt: loadPrompt("search"),
  model: "haiku",
};
