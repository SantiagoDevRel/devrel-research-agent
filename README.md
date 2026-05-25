# devrel-research-agent

> Multi-agent competitive intel system for DevRel work. Built on the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-demos).

Given the name of a developer-facing project (e.g. `Ceramic`, `Tableland`, `Pinecone`, `Supabase`), this tool produces a structured report covering:

1. **Snapshot** — what it is, founders, funding, team size
2. **Architecture & tech** — stack, consensus/storage model, key repos
3. **Developer adoption** — GitHub stars/forks/contributors, package downloads, community size
4. **Sentiment** — what devs say on Reddit, HN, Twitter (complaints + praises)
5. **Real-world use cases** — apps actually built with the project
6. **Hackathon presence** — ETHGlobal / devpost / Solana submissions
7. **DevEx audit** — docs score, quickstart friction, pain points
8. **Arkiv comparison** — gaps Arkiv fills, gaps Arkiv has, positioning, **content ideas for DevRel**

Output: `./reports/<project>.{md,json}` — human-readable markdown + structured JSON.

---

## Why this exists

I'm starting as DevRel at [Arkiv](https://arkiv.network) (decentralized DB on Ethereum). Competitor analysis is a permanent part of the job. Instead of doing it ad hoc, I'm building it as a multi-agent system — both because it's useful and because it's a great way to learn the Claude Agent SDK.

The project pairs with a blog post: _"Building a multi-agent competitive intel system with Claude Agent SDK"_ (see `BLOG.md` for the draft).

---

## Architecture

```
                          CLI: devrel-research <project>
                                        │
                                        ▼
                          ┌──────────────────────────┐
                          │   ORCHESTRATOR (Sonnet)  │
                          │   tools: [Task]          │
                          └─────────────┬────────────┘
                                        │ Task tool (parallel)
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼               ▼
     search          github           social          devex         hackathon
   (WebSearch +    (Octokit MCP    (Reddit + HN +  (docs audit)  (ETHGlobal +
    WebFetch)      + WebFetch +    Twitter via                    devpost +
                   recursive Task) WebSearch)                      WebSearch)
        │              │               │               │              │
        └──────────────┴───────┬───────┴───────────────┴──────────────┘
                               │  Zod-validated structured outputs
                               ▼
                  ┌──────────────────────────┐
                  │   SYNTHESIZER (Opus)     │
                  └─────────────┬────────────┘
                                ▼
                  ┌──────────────────────────┐
                  │  ARKIV EXPERT (Opus)     │  ← separate query(),
                  │  cached system prompt    │     prompt-cached
                  └─────────────┬────────────┘
                                ▼
                  ./reports/<project>.md
                  ./reports/<project>.json
```

Notes:
- The **Arkiv Expert** runs as a separate `Anthropic.messages.create()` call (not as a sub-agent) so its large system prompt — the Arkiv positioning playbook — hits the prompt cache across multiple reports.
- The **GitHub sub-agent** can recursively spawn its own `Task`-spawned children when a project lives across many repos (e.g. Ceramic has 30+ repos; the lead delegates to per-repo readers).
- Every sub-agent's output is validated against a Zod schema. Schema failures trigger a single retry; persistent failures surface in the report as `status: "not_found"`.

---

## Run it

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env
# fill in ANTHROPIC_API_KEY (required) and GITHUB_TOKEN (optional but recommended)

# 3. run
npm run dev -- Ceramic
# or directly:
npx tsx bin/devrel-research.ts Tableland

# skip Arkiv layer if you just want raw research:
npx tsx bin/devrel-research.ts Pinecone --skip-arkiv
```

Output lands in `./reports/`.

---

## Cost

Per-report cost (rough estimate with aggressive prompt caching):

| Phase | Model | Input tokens | Output tokens | Cost |
|---|---|---|---|---|
| Research (5 sub-agents) | Haiku | ~80k | ~15k | ~$0.10 |
| Synthesizer | Sonnet | ~20k | ~5k | ~$0.10 |
| Arkiv Expert | Opus | ~25k (cached) + 2k | ~3k | ~$0.20 |
| **Total** | | | | **~$0.40 per report** |

10 reports: ~$4. Fine.

---

## Repo layout

```
devrel-research-agent/
├── bin/
│   └── devrel-research.ts        # CLI entry (commander + ora)
├── src/
│   ├── orchestrator.ts            # query() with lead + 5 sub-agents
│   ├── arkiv-expert.ts            # separate query() with cached system prompt
│   ├── report.ts                  # MD + JSON writer
│   ├── schemas.ts                 # Zod schemas for every section
│   ├── utils.ts                   # loadPrompt, extractJson, nowIso
│   ├── agents/                    # AgentDefinition per sub-agent
│   │   ├── search.ts
│   │   ├── github.ts
│   │   ├── social.ts
│   │   ├── devex.ts
│   │   └── hackathon.ts
│   ├── mcp/                       # custom MCP servers (createSdkMcpServer)
│   │   └── github-tools.ts        # Octokit-backed tools
│   └── prompts/                   # iterable in plain markdown
│       ├── lead.md
│       ├── github.md
│       ├── search.md
│       ├── social.md
│       ├── devex.md
│       ├── hackathon.md
│       ├── synthesizer.md
│       └── arkiv-expert.md
└── reports/                       # generated reports (gitignored except samples)
```

---

## Roadmap

**v1 (current):** CLI, 5 sub-agents, Arkiv expert layer, local FS storage.

**v2 (planned, post-Arkiv-startdate):**
- Persist reports in Arkiv (dogfooding — entities with TTL + queryable history)
- Web UI (Next.js) to trigger + browse reports
- Eval agent: LLM-as-judge auto-grades report quality, suggests prompt revisions
- Cross-comparison: `devrel-research compare Ceramic Tableland Arkiv`

---

## License

MIT — feel free to fork, adapt, or use as a template for your own DevRel work.
