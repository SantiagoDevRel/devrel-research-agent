#!/usr/bin/env -S npx tsx
import "dotenv/config";
import { Command } from "commander";
import ora from "ora";
import pc from "picocolors";
import { runResearchPipeline } from "../src/orchestrator.js";
import { runArkivExpert } from "../src/arkiv-expert.js";
import { writeReport } from "../src/report.js";

const program = new Command();

program
  .name("devrel-research")
  .description("Generate a competitive intel report on a project, framed for Arkiv DevRel.")
  .argument("<project>", "Project name to research, e.g. Ceramic, Tableland, Pinecone")
  .option("-o, --out <dir>", "Output directory", process.env.DEVREL_RESEARCH_OUT_DIR ?? "./reports")
  .option("--skip-arkiv", "Skip the Arkiv expert layer (research only)", false)
  .action(async (project: string, opts: { out: string; skipArkiv: boolean }) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(pc.red("Missing ANTHROPIC_API_KEY. Copy .env.example to .env and fill it in."));
      process.exit(1);
    }

    console.log(pc.bold(`\n🔍 Researching ${pc.cyan(project)}\n`));

    const phase1 = ora("Phase 1/2 — orchestrator + 5 sub-agents (parallel)").start();
    let researchResult;
    try {
      researchResult = await runResearchPipeline(project);
      phase1.succeed(
        `Research complete — ${pc.dim(`$${researchResult.cost_usd.toFixed(3)}, ${(researchResult.duration_ms / 1000).toFixed(1)}s`)}`,
      );
    } catch (e) {
      phase1.fail(`Research pipeline failed: ${(e as Error).message}`);
      process.exit(1);
    }

    let finalReport;
    if (opts.skipArkiv) {
      finalReport = {
        research: researchResult.report,
        arkiv_analysis: {
          comparison_table: [],
          gaps_arkiv_fills: [],
          gaps_arkiv_has: [],
          positioning_one_liner: "(skipped — --skip-arkiv)",
          content_ideas: [
            {
              title: "skipped",
              type: "tutorial" as const,
              angle: "skipped",
              effort: "S" as const,
              audience: "n/a",
            },
            { title: "skipped", type: "tutorial" as const, angle: "skipped", effort: "S" as const, audience: "n/a" },
            { title: "skipped", type: "tutorial" as const, angle: "skipped", effort: "S" as const, audience: "n/a" },
          ],
          sponsor_combo_angles: [],
        },
      };
    } else {
      const phase2 = ora("Phase 2/2 — Arkiv expert layer (Opus)").start();
      try {
        const arkivAnalysis = await runArkivExpert(researchResult.report);
        finalReport = { research: researchResult.report, arkiv_analysis: arkivAnalysis };
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
  });

program.parseAsync().catch((err) => {
  console.error(pc.red("Fatal:"), err);
  process.exit(1);
});
