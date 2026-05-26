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
  top_complaints: [{ complaint, source, url? }]
  top_praises: [{ praise, source, url? }]
  notes?: string
  sources: url[]

use_cases:
  status: ok|partial|not_found|error
  apps: [{ name, description, url?, evidence: case_study|blog|tweet|showcase|other }]
  notes?: string
  sources: url[]

hackathon:
  status: ok|partial|not_found|error
  events: [{ event, date|null, role: sponsor|track|judge|mention, submissions|null,
             notable_projects: [{ name, description, url? }] }]
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
`.trim();
