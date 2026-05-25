import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { loadPrompt } from "../utils.js";

export const hackathonAgent: AgentDefinition = {
  description:
    "Finds the project's appearances at ETHGlobal, devpost, EthDenver, Pragma, and other " +
    "hackathons, plus notable submissions. Produces the Hackathon section.",
  tools: ["WebSearch", "WebFetch"],
  prompt: loadPrompt("hackathon"),
  model: "haiku",
};
