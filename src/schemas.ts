import { z } from "zod";

/**
 * Every sub-agent returns one of these wrapped payloads.
 * status="not_found" never crashes the pipeline — it surfaces in the final report
 * as "No public X data found".
 */
const sectionStatus = z.enum(["ok", "partial", "not_found", "error"]);

const sectionMeta = z.object({
  status: sectionStatus,
  notes: z.string().nullish().describe("Reasoning, warnings, or what was missing."),
  sources: z.array(z.string().url()).default([]).catch([]),
});

// ─── Section 1: Snapshot (Search agent) ────────────────────────────────────────
export const SnapshotSchema = sectionMeta.extend({
  name: z.string(),
  one_liner: z.string(),
  founded_year: z.number().int().nullable(),
  founders: z.array(z.string()).default([]),
  funding_rounds: z
    .array(
      z.object({
        round: z.string(),
        amount_usd: z.number().nullable(),
        date: z.string().nullable(),
        lead_investors: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  team_size_estimate: z.string().nullable(),
});

// ─── Section 2: Architecture & tech (GitHub agent, reads repo + docs) ─────────
export const ArchitectureSchema = sectionMeta.extend({
  summary: z.string().describe("How the system works at a high level."),
  stack: z.array(z.string()).default([]),
  consensus_or_storage_model: z.string().nullable(),
  key_repos: z
    .array(
      z.object({
        url: z.string().url(),
        purpose: z.string(),
        primary_language: z.string().nullable(),
      }),
    )
    .default([]),
});

// ─── Section 3: Developer adoption signals (GitHub agent) ─────────────────────
export const AdoptionSchema = sectionMeta.extend({
  github: z
    .object({
      stars: z.number(),
      forks: z.number(),
      contributors: z.number().nullable(),
      open_issues: z.number(),
      last_commit_iso: z.string().nullable(),
    })
    .nullable(),
  package_downloads: z
    .array(
      z.object({
        ecosystem: z.enum(["npm", "pypi", "crates", "go", "other"]),
        package: z.string(),
        downloads_weekly: z.number().nullable(),
      }),
    )
    .default([]),
  community: z
    .object({
      discord_size: z.number().nullable(),
      telegram_size: z.number().nullable(),
      twitter_followers: z.number().nullable(),
    })
    .nullable(),
});

// ─── Section 4: Sentiment & complaints (Social agent) ─────────────────────────
export const SentimentSchema = sectionMeta.extend({
  overall_sentiment: z.enum(["positive", "mixed", "negative", "unknown"]),
  top_complaints: z
    .array(
      z.object({
        complaint: z.string(),
        source: z.string(),
        url: z.string().url().nullish(),
      }),
    )
    .default([]),
  top_praises: z
    .array(
      z.object({
        praise: z.string(),
        source: z.string(),
        url: z.string().url().nullish(),
      }),
    )
    .default([]),
});

// ─── Section 5: Real-world use cases (Search + Hackathon agents) ──────────────
export const UseCasesSchema = sectionMeta.extend({
  apps: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        url: z.string().url().nullish(),
        evidence: z.enum(["case_study", "blog", "tweet", "showcase", "other"]),
      }),
    )
    .default([]),
});

// ─── Section 6: Hackathon presence (Hackathon agent) ──────────────────────────
export const HackathonSchema = sectionMeta.extend({
  events: z
    .array(
      z.object({
        event: z.string(),
        date: z.string().nullable(),
        role: z.enum(["sponsor", "track", "judge", "mention"]),
        submissions: z.number().nullable(),
        notable_projects: z
          .array(
            z.object({
              name: z.string(),
              description: z.string(),
              url: z.string().url().nullish(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

// ─── DevEx evaluation (DevEx agent) ────────────────────────────────────────────
export const DevExSchema = sectionMeta.extend({
  docs_quality_score: z.number().min(0).max(10),
  docs_quality_reasoning: z.string(),
  quickstart_minutes_estimate: z.number().nullable(),
  sdk_languages: z.array(z.string()).default([]),
  examples_count: z.number().nullable(),
  pain_points: z.array(z.string()).default([]),
  bright_spots: z.array(z.string()).default([]),
});

// ─── Synthesizer output: full research report (sections 1-6 + devex) ──────────
export const ResearchReportSchema = z.object({
  project_name: z.string(),
  generated_at: z.string().datetime(),
  snapshot: SnapshotSchema,
  architecture: ArchitectureSchema,
  adoption: AdoptionSchema,
  sentiment: SentimentSchema,
  use_cases: UseCasesSchema,
  hackathon: HackathonSchema,
  devex: DevExSchema,
});

// ─── Arkiv Expert layer output (sections 7-8) ─────────────────────────────────
export const ArkivAnalysisSchema = z.object({
  comparison_table: z.array(
    z.object({
      dimension: z.string().describe("e.g. 'TTL/expiration', 'Query API', 'Auth'"),
      arkiv: z.string(),
      competitor: z.string(),
      winner: z.enum(["arkiv", "competitor", "tie", "n/a"]),
    }),
  ),
  gaps_arkiv_fills: z
    .array(
      z.object({
        gap: z.string(),
        why_it_matters: z.string(),
      }),
    )
    .default([]),
  gaps_arkiv_has: z
    .array(
      z.object({
        gap: z.string(),
        why_it_matters: z.string(),
      }),
    )
    .default([]),
  positioning_one_liner: z.string().describe("How Arkiv should position vs this project in 1 sentence."),
  content_ideas: z
    .array(
      z.object({
        title: z.string(),
        type: z.enum(["tutorial", "comparison", "demo", "thread", "talk", "workshop"]),
        angle: z.string(),
        effort: z.enum(["S", "M", "L"]),
        audience: z.string(),
      }),
    )
    .min(3, "Must produce at least 3 content ideas."),
  sponsor_combo_angles: z
    .array(
      z.object({
        combo: z.string().describe("e.g. 'Arkiv + Lit Protocol'"),
        hackathon_pitch: z.string(),
      }),
    )
    .default([]),
});

export const FinalReportSchema = z.object({
  research: ResearchReportSchema,
  arkiv_analysis: ArkivAnalysisSchema,
});

export type Snapshot = z.infer<typeof SnapshotSchema>;
export type Architecture = z.infer<typeof ArchitectureSchema>;
export type Adoption = z.infer<typeof AdoptionSchema>;
export type Sentiment = z.infer<typeof SentimentSchema>;
export type UseCases = z.infer<typeof UseCasesSchema>;
export type Hackathon = z.infer<typeof HackathonSchema>;
export type DevEx = z.infer<typeof DevExSchema>;
export type ResearchReport = z.infer<typeof ResearchReportSchema>;
export type ArkivAnalysis = z.infer<typeof ArkivAnalysisSchema>;
export type FinalReport = z.infer<typeof FinalReportSchema>;
