import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FinalReport } from "./schemas.js";

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function bulletList<T>(items: T[], render: (it: T) => string): string {
  return items.length === 0 ? "_None found._" : items.map((it) => `- ${render(it)}`).join("\n");
}

function renderMarkdown(final: FinalReport): string {
  const r = final.research;
  const a = final.arkiv_analysis;

  const compRows = a.comparison_table
    .map((row) => `| ${row.dimension} | ${row.arkiv} | ${row.competitor} | ${row.winner} |`)
    .join("\n");

  return `# ${r.project_name} — Competitive Intel Report

_Generated ${r.generated_at} by devrel-research-agent_

## 1. Snapshot

${r.snapshot.one_liner}

- **Founded:** ${r.snapshot.founded_year ?? "—"}
- **Founders:** ${r.snapshot.founders.join(", ") || "—"}
- **Team size:** ${r.snapshot.team_size_estimate ?? "—"}
- **Funding:** ${
    r.snapshot.funding_rounds.length === 0
      ? "—"
      : r.snapshot.funding_rounds
          .map(
            (f) =>
              `${f.round} (${f.amount_usd ? `$${(f.amount_usd / 1_000_000).toFixed(1)}M` : "?"}, ${f.date ?? "?"})`,
          )
          .join("; ")
  }

## 2. Architecture & tech

${r.architecture.summary}

**Stack:** ${r.architecture.stack.join(", ") || "—"}
**Consensus / storage:** ${r.architecture.consensus_or_storage_model ?? "—"}

**Key repos:**
${bulletList(
  r.architecture.key_repos,
  (k) => `[${k.url}](${k.url}) — ${k.purpose}${k.primary_language ? ` (${k.primary_language})` : ""}`,
)}

## 3. Developer adoption

${
  r.adoption.github
    ? `**GitHub:** ${fmtNum(r.adoption.github.stars)}★ · ${fmtNum(r.adoption.github.forks)} forks · ${fmtNum(r.adoption.github.contributors)} contributors · ${fmtNum(r.adoption.github.open_issues)} open issues · last commit ${r.adoption.github.last_commit_iso ?? "—"}`
    : "_No GitHub data._"
}

**Packages:**
${bulletList(
  r.adoption.package_downloads,
  (p) => `${p.ecosystem}: \`${p.package}\` — ${fmtNum(p.downloads_weekly)}/wk`,
)}

**Community:** ${
    r.adoption.community
      ? `Discord ${fmtNum(r.adoption.community.discord_size)} · Telegram ${fmtNum(r.adoption.community.telegram_size)} · Twitter ${fmtNum(r.adoption.community.twitter_followers)}`
      : "—"
  }

## 4. Sentiment

**Overall:** ${r.sentiment.overall_sentiment}

**Top complaints:**
${bulletList(r.sentiment.top_complaints, (c) => `${c.complaint} _(${c.source}${c.url ? `, [link](${c.url})` : ""})_`)}

**Top praises:**
${bulletList(r.sentiment.top_praises, (p) => `${p.praise} _(${p.source}${p.url ? `, [link](${p.url})` : ""})_`)}

## 5. Real-world use cases

${bulletList(r.use_cases.apps, (app) => `**${app.name}** — ${app.description}${app.url ? ` [${app.url}](${app.url})` : ""} _(${app.evidence})_`)}

## 6. Hackathon presence

${bulletList(
  r.hackathon.events,
  (e) =>
    `**${e.event}** (${e.date ?? "?"}, ${e.role}, ${e.submissions ?? "?"} submissions)\n` +
    e.notable_projects.map((p) => `  - _${p.name}_ — ${p.description}`).join("\n"),
)}

## 7. Developer experience (outside-in audit)

**Docs quality:** ${r.devex.docs_quality_score}/10 — ${r.devex.docs_quality_reasoning}

**Quickstart estimate:** ${r.devex.quickstart_minutes_estimate ?? "—"} min · **SDKs:** ${r.devex.sdk_languages.join(", ") || "—"} · **Examples:** ${r.devex.examples_count ?? "—"}

**Pain points:**
${bulletList(r.devex.pain_points, (p) => p)}

**Bright spots:**
${bulletList(r.devex.bright_spots, (b) => b)}

---

# Arkiv Strategic Analysis

## 8. Comparison vs Arkiv

| Dimension | Arkiv | ${r.project_name} | Winner |
|---|---|---|---|
${compRows}

## 9. Gaps Arkiv fills (that ${r.project_name} doesn't)

${bulletList(a.gaps_arkiv_fills, (g) => `**${g.gap}** — ${g.why_it_matters}`)}

## 10. Gaps Arkiv has (that ${r.project_name} does better)

${bulletList(a.gaps_arkiv_has, (g) => `**${g.gap}** — ${g.why_it_matters}`)}

## 11. Positioning one-liner

> ${a.positioning_one_liner}

## 12. DevRel content ideas

${a.content_ideas
  .map(
    (idea, i) =>
      `### ${i + 1}. ${idea.title} _(${idea.type}, effort=${idea.effort})_\n\n${idea.angle}\n\n_Audience:_ ${idea.audience}`,
  )
  .join("\n\n")}

## 13. Sponsor combo angles

${bulletList(a.sponsor_combo_angles, (s) => `**${s.combo}** — ${s.hackathon_pitch}`)}
`;
}

export interface ReportPaths {
  jsonPath: string;
  mdPath: string;
}

export function writeReport(final: FinalReport, outDir: string): ReportPaths {
  mkdirSync(outDir, { recursive: true });
  const base = slug(final.research.project_name);
  const jsonPath = join(outDir, `${base}.json`);
  const mdPath = join(outDir, `${base}.md`);
  writeFileSync(jsonPath, JSON.stringify(final, null, 2), "utf-8");
  writeFileSync(mdPath, renderMarkdown(final), "utf-8");
  return { jsonPath, mdPath };
}
