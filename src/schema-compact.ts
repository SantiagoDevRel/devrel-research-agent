/**
 * Compact, model-friendly description of ResearchReportSchema.
 *
 * Why this instead of `z.toJSONSchema()`?
 *   - The full JSON Schema serialization is ~3-4k tokens (verbose: $ref, defaults,
 *     nullable wrappers, default: [], etc.)
 *   - Models parse this dense YAML-ish format faster and follow field names more reliably
 *   - This string is included verbatim in the lead orchestrator's SYSTEM prompt,
 *     which means the Agent SDK auto-caches it. Cost per cached repeat: ~10% of normal.
 */
export const RESEARCH_REPORT_SHAPE = `
ResearchReport shape (every section has: status, notes?, sources[]):

snapshot:
  status: ok|partial|not_found|error
  name: string
  one_liner: string
  founded_year: int|null
  founders: string[]
  funding_rounds: [{ round, amount_usd|null, date|null, lead_investors: string[] }]
  team_size_estimate: string|null
  notes?: string
  sources: url[]

architecture:
  status: ok|partial|not_found|error
  summary: string                                      # 3-5 sentences, dense
  stack: string[]
  consensus_or_storage_model: string|null
  key_repos: [{ url, purpose, primary_language|null }]
  notes?: string
  sources: url[]

adoption:
  status: ok|partial|not_found|error
  github: { stars, forks, contributors|null, open_issues, last_commit_iso|null } | null
  package_downloads: [{ ecosystem: npm|pypi|crates|go|other, package, downloads_weekly|null }]
  community: { discord_size|null, telegram_size|null, twitter_followers|null } | null
  notes?: string
  sources: url[]

sentiment:
  status: ok|partial|not_found|error
  overall_sentiment: positive|mixed|negative|unknown
  top_complaints: [{ complaint, source, url: url|null }]
  top_praises: [{ praise, source, url: url|null }]
  notes?: string
  sources: url[]

use_cases:
  status: ok|partial|not_found|error
  apps: [{ name, description, url: url|null, evidence: case_study|blog|tweet|showcase|other }]
  notes?: string
  sources: url[]

hackathon:
  status: ok|partial|not_found|error
  events: [{ event, date|null, role: sponsor|track|judge|mention, submissions|null,
             notable_projects: [{ name, description, url: url|null }] }]
  notes?: string
  sources: url[]

devex:
  status: ok|partial|not_found|error
  docs_quality_score: number (0-10)
  docs_quality_reasoning: string
  quickstart_minutes_estimate: number|null
  sdk_languages: string[]
  examples_count: number|null
  pain_points: string[]
  bright_spots: string[]
  notes?: string
  sources: url[]

Top-level:
  project_name: string
  generated_at: ISO datetime string
  + the 7 sections above

CRITICAL field-name rules (these are the EXACT keys — do not invent variants):
  use "one_liner"            NOT "tagline" or "description"
  use "founded_year"         NOT "founded" or "year"
  use "team_size_estimate"   NOT "team_size"
  use "funding_rounds"       NOT "funding" or "rounds"
    each round has "amount_usd" (NUMBER), "lead_investors" (ARRAY)
  use "key_repos"            NOT "repos" or "repositories"
    each entry has "url", "purpose", "primary_language"
  use "consensus_or_storage_model"  NOT "consensus" or "storage_model"
  use "docs_quality_score"   NOT "docs_score" — and ALWAYS pair with "docs_quality_reasoning"
  use "package_downloads"    NOT "packages" or "downloads"
    "ecosystem" must be one of: npm|pypi|crates|go|other
  use "overall_sentiment"    must be one of: positive|mixed|negative|unknown

GENERAL RULES for null/missing:
  - For any field marked "string|null", "number|null", "url|null": use null when unknown, not the string "null", "n/a", or "unknown".
  - For arrays: use [] when there are no items, never null.
  - Never invent URLs. If a project has no URL, set "url": null.
`.trim();

/**
 * Compact description of ArkivAnalysisSchema. Used in the Arkiv expert system prompt.
 */
export const ARKIV_ANALYSIS_SHAPE = `
ArkivAnalysis shape (output ONLY these top-level keys, no others):

comparison_table: [{
  dimension: string                  # e.g. "TTL/expiration", "Query API", "Auth model"
  arkiv: string                      # how Arkiv handles this dimension
  competitor: string                 # how the competitor handles it
  winner: "arkiv" | "competitor" | "tie" | "n/a"
}]

gaps_arkiv_fills: [{                 # things competitor lacks that Arkiv has
  gap: string
  why_it_matters: string
}]

gaps_arkiv_has: [{                   # things competitor does better — be honest
  gap: string
  why_it_matters: string
}]

positioning_one_liner: string        # 1 sentence on how Arkiv differs

content_ideas: [{                    # MINIMUM 3 — DevRel content angles
  title: string
  type: "tutorial" | "comparison" | "demo" | "thread" | "talk" | "workshop"
  angle: string
  effort: "S" | "M" | "L"            # S=under 2h, M=half-day, L=full day+
  audience: string
}]

sponsor_combo_angles: [{             # use the EXACT key name "hackathon_pitch"
  combo: string                      # e.g. "Arkiv + Lit Protocol"
  hackathon_pitch: string            # one-line pitch for a hackathon sponsor combo
}]

CRITICAL field-name rules:
  use "positioning_one_liner"  NOT "positioning" or "one_liner"
  use "hackathon_pitch"        NOT "pitch", "description", or "tagline"
  use "content_ideas"          NOT "ideas" or "content"
  use "gaps_arkiv_fills"       NOT "arkiv_advantages" or "fills"
  use "gaps_arkiv_has"         NOT "arkiv_weaknesses" or "has"
  use "comparison_table"       NOT "comparisons" or "table"
  use "sponsor_combo_angles"   NOT "sponsor_combos" or "combos"

Do NOT add top-level metadata like "competitor_name", "analyzed_at" — those are not in the schema.
`.trim();
