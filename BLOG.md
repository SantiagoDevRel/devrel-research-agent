# Building a multi-agent competitive intel system with Claude Agent SDK

_Draft — to be published day 1 of the Arkiv DevRel role._

---

## TL;DR

I spent ~25 hours of my holiday week building `devrel-research-agent`: a CLI that, given the name of a developer-facing project, produces a structured competitive-intel report — 13 sections covering everything from funding to hackathon submissions to "here are 5 DevRel content angles Arkiv could ship next week against this project".

It's a 6-agent system built on the Claude Agent SDK. This post is what I learned.

---

## Why I built this

I start as DevRel at Arkiv (decentralized DB on Ethereum) on $START_DATE. Competitor analysis isn't a one-time onboarding task — it's a permanent rhythm. Every week there's a new sponsor combo to pitch, a new hackathon to support, a new "how does X compare to Arkiv?" question in Discord.

I could do it manually each time. Or I could spend a week building a tool I'll use 50+ times in the first year.

I picked door 2. The tool itself is part of the contribution.

---

## Architecture in one diagram

[insert diagram from README]

The shape is canonical multi-agent research from the Anthropic blog post: a **lead orchestrator** that does no work itself, parallel **specialist sub-agents** that each own a section of the report, and a **synthesizer** that merges. The wrinkle I added: a **separate `query()` call for the Arkiv expert layer** so its big system prompt (the "how to position Arkiv" playbook) hits the prompt cache across every report I run.

---

## Things I learned

### 1. The `Task` tool is the magic

If you've used Claude Code, you've seen the `Task` tool. In the Agent SDK it's the same primitive: the orchestrator calls `Task` N times in parallel, the runtime spawns a fresh agent per call (using the `AgentDefinition` you registered under `options.agents`), and gathers the results. No glue code on my end. No promise-juggling. Five parallel research streams from a single tool call.

This is what makes multi-agent systems feel cheap to build instead of expensive.

### 2. Custom MCP tools beat WebFetch for structured data

For the GitHub agent I wrapped Octokit in `createSdkMcpServer` + `tool()` calls with Zod schemas. The agent gets `mcp__github__get_repo`, `mcp__github__list_org_repos`, etc — typed tools with rate limits handled, instead of "scrape api.github.com via WebFetch and hope it parses".

Cost: ~80 lines of MCP wrapping. Benefit: the GitHub agent finishes its section in seconds with structured outputs the rest of the pipeline can trust.

### 3. Zod-validated outputs at every layer

Every sub-agent returns JSON. Every JSON is parsed and validated against a Zod schema. Failures don't crash — they retry once with the error injected into the prompt. Persistent failures degrade gracefully (`status: "not_found"` propagates up).

This was the single biggest reliability win. Without it, you're at the mercy of "the model wrapped the JSON in a code fence" or "the model added a friendly sentence before the JSON".

### 4. Separating the "Arkiv expert" layer from the research pipeline

This is the architectural decision I'm proudest of. The research pipeline is generic — it could produce a report about Stripe or Postgres or anything. The Arkiv expert layer is the lens that turns "data about Ceramic" into "here's how to position Arkiv against Ceramic, here are 5 content ideas, here are 2 sponsor combos for ETHLisbon".

Keeping them separate means:
- The Arkiv prompt (~3k tokens of positioning, SDK surface area, sponsor combo history) gets cached and shared across every report I generate. ~75% savings on input tokens for that layer.
- I can iterate the Arkiv prompt without touching the research pipeline.
- If a teammate wants to use the research pipeline for a different framing (e.g. "Filebase competitive landscape" with no Arkiv angle), they can `--skip-arkiv`.

### 5. Cost: $0.40 per report

With aggressive prompt caching on the synthesizer + Arkiv layer, and Haiku for the 5 parallel sub-agents, the total is ~$0.40 per report. Ten reports per week — $4. Fine.

---

## Things I'd do differently

- **Start with 2 sub-agents, not 5.** I built all 5 in parallel and spent half my time chasing parallel bugs. If I were starting over: get one sub-agent (`github`) end-to-end first, then add the rest one at a time.
- **Build the report writer earlier.** I had JSON output for 2 days before I had readable markdown. That delayed my ability to "feel" if the output was actually useful. Recommendation: ship a crappy markdown renderer on day 1.
- **Eval before optimization.** I want a v2 eval agent that auto-grades report quality. I should have built a simple version of this on day 2 instead of polishing prompts blindly.

---

## What's next (v2)

- **Persist reports in Arkiv.** Each report becomes an entity with TTL — queryable history of every competitor I've researched. This is dogfooding-as-content: my DevRel tool runs on the product I evangelize.
- **Web UI.** Next.js app to trigger reports + browse history + compare across competitors.
- **Eval agent.** LLM-as-judge that grades each section against a rubric, surfaces weak spots, suggests prompt revisions.

---

## Try it

Repo: [github.com/santiagotrujillozuluaga/devrel-research-agent](#)

```bash
npx tsx bin/devrel-research.ts Ceramic
```

PRs welcome — especially new sub-agents (e.g. `funding_agent` that hits Crunchbase, `repo_health_agent` that scores maintenance signals).

---

_If you're a DevRel and want to fork this for your own positioning, I'd love to see it. Tag me._
