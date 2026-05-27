#!/usr/bin/env -S npx tsx
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Command } from "commander";
import ora from "ora";
import pc from "picocolors";
import { runResearchPipeline } from "../src/orchestrator.js";
import { runArkivExpert } from "../src/arkiv-expert.js";
import { writeReport } from "../src/report.js";
import { ResearchReportSchema } from "../src/schemas.js";

const program = new Command();

program
  .name("devrel-research")
  .description("Generate a competitive intel report on a project, framed for Arkiv DevRel.")
  .argument("<project>", "Project name to research, e.g. Ceramic, Tableland, Pinecone")
  .option("-o, --out <dir>", "Output directory", process.env.DEVREL_RESEARCH_OUT_DIR ?? "./reports")
  .option("--skip-arkiv", "Skip the Arkiv expert layer (research only)", false)
  .option(
    "--from-json <path>",
    "Skip research, load an existing report JSON, and only run the Arkiv layer (cheap iteration)",
  )
  .option(
    "--use-oauth",
    "Ignore ANTHROPIC_API_KEY and use your `claude login` OAuth session (Pro/Max subscription)",
    false,
  )
  .action(
    async (
      project: string,
      opts: { out: string; skipArkiv: boolean; fromJson?: string; useOauth: boolean },
    ) => {
      if (opts.useOauth) {
        delete process.env.ANTHROPIC_API_KEY;
        console.log(pc.dim("Using `claude login` OAuth session (--use-oauth).\n"));
      } else if (!process.env.ANTHROPIC_API_KEY) {
        console.log(
          pc.dim("No ANTHROPIC_API_KEY set — relying on your `claude login` session.\n"),
        );
      }

      console.log(pc.bold(`🔍 Researching ${pc.cyan(project)}\n`));

      // ─── Phase 1: research ──────────────────────────────────────────────
      let report;
      let researchCost = 0;
      let researchMs = 0;

      if (opts.fromJson) {
        const raw = JSON.parse(readFileSync(opts.fromJson, "utf-8"));
        const candidate = raw.research ?? raw; // accept FinalReport or bare ResearchReport
        const parsed = ResearchReportSchema.safeParse(candidate);
        if (!parsed.success) {
          console.error(pc.red(`Loaded JSON does not match ResearchReportSchema:\n${parsed.error.message}`));
          process.exit(1);
        }
        report = parsed.data;
        console.log(pc.dim(`Loaded existing research from ${opts.fromJson} (skipping Phase 1)\n`));
      } else {
        const phase1 = ora("Phase 1/2 — orchestrator + 5 sub-agents (parallel)").start();
        try {
          const r = await runResearchPipeline(project);
          report = r.report;
          researchCost = r.cost_usd;
          researchMs = r.duration_ms;
          phase1.succeed(
            `Research complete — ${pc.dim(`$${researchCost.toFixed(3)}, ${(researchMs / 1000).toFixed(1)}s`)}`,
          );
        } catch (e) {
          phase1.fail(`Research pipeline failed: ${(e as Error).message}`);
          process.exit(1);
        }
      }

      // ─── Phase 2: Arkiv expert ──────────────────────────────────────────
      let finalReport;
      if (opts.skipArkiv) {
        finalReport = {
          research: report,
          arkiv_analysis: {
            comparison_table: [],
            gaps_arkiv_fills: [],
            gaps_arkiv_has: [],
            positioning_one_liner: "(skipped — --skip-arkiv)",
            content_ideas: [
              { title: "skipped", type: "tutorial" as const, angle: "skipped", effort: "S" as const, audience: "n/a" },
              { title: "skipped", type: "tutorial" as const, angle: "skipped", effort: "S" as const, audience: "n/a" },
              { title: "skipped", type: "tutorial" as const, angle: "skipped", effort: "S" as const, audience: "n/a" },
            ],
            sponsor_combo_angles: [],
          },
        };
      } else {
        const phase2 = ora("Phase 2/2 — Arkiv expert layer (Opus)").start();
        try {
          const arkivAnalysis = await runArkivExpert(report);
          finalReport = { research: report, arkiv_analysis: arkivAnalysis };
          phase2.succeed("Arkiv analysis complete");
        } catch (e) {
          phase2.fail(`Arkiv expert failed: ${(e as Error).message}`);
          process.exit(1);
        }
      }

      const { jsonPath, mdPath } = writeReport(finalReport, opts.out);
      console.log(`\n${pc.green("✓")} ${pc.bold("Report saved:")}`);
      console.log(`  ${pc.dim("MD  ")} ${mdPath}`);
      console.log(`  ${pc.dim("JSON")} ${jsonPath}\n`);
    },
  );

program.parseAsync().catch((err) => {
  console.error(pc.red("Fatal:"), err);
  process.exit(1);
});
