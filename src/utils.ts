import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadPrompt(name: string): string {
  return readFileSync(join(__dirname, "prompts", `${name}.md`), "utf-8");
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Extract the first balanced JSON object from a model's text response.
 * Models sometimes wrap JSON in ```json fences or add a sentence around it
 * even when told not to. This is a defense against that.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;

  const start = candidate.indexOf("{");
  if (start === -1) {
    throw new Error(`No JSON object found in model output:\n${text.slice(0, 500)}`);
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(candidate.slice(start, i + 1));
      }
    }
  }
  throw new Error(`Unbalanced JSON in model output:\n${text.slice(0, 500)}`);
}
