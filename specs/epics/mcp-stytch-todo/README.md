# Epic: mcp-stytch-todo (MT)

**Cloudflare's `mcp-stytch-consumer-todo-list` demo is one Worker doing three jobs: a React todo list served from Static Assets, the Hono REST API it calls, and a [Model Context Protocol](https://modelcontextprotocol.io/) server — the Agents SDK's stateless `createMcpHandler`, no Durable Object — through which an agent reads and edits the same todos. [Stytch](https://stytch.com/) is the identity for both: the page signs its user in with Stytch's UI (Google or an email code) and calls the API with Stytch's session cookie; an MCP client registers itself with the Stytch project (Dynamic Client Registration), sends its user through the page's `/oauth/authorize` consent screen, and calls `/mcp` with the access token Stytch issues. The Worker checks both tokens against the project's public keys. The todos are one JSON list per user in a Workers KV namespace. Here the namespace is per environment from Terraform, the Stytch project is three optional Orun secrets, and the wrangler config is rendered per environment from the KV root's wiring document.**

The port keeps the demo's Worker, its MCP server, its REST routes, its Stytch checks and its front end. It adds the monorepo wrapper, `/api/health` (the smoke's and the probes' namespace check), the product's name on the page, a page that says how to connect Stytch when no project is stored (and a Worker that answers, and refuses every token, until one is), a test package that drives the real Worker — REST API and MCP server — with tokens signed by a test key, the KV Terraform root, the deploy contract and the Stytch values' path to the Worker and the front end — and makes the repository an Orun baseline.

## Status

| Field | Value |
|-------|-------|
| Status | In progress — MT0 (the spec) |
| Cluster | **MT** (MT0–MT4) |
| Owner(s) | `apps/web` (`api/` the Worker, `src/` the front end, the wrangler template) · `tests/web` · `infra/terraform/cloudflare-kv` |
| Builds on | `hono-api` (Hono on Workers: the app's name as a one-line seam, the health contract, the tests package); `r2-explorer` (the Workers + Static Assets composition, a Terraform root's wiring rendered into the config, optional Orun secrets handed to the Worker as Worker secrets); `kv-redis-starter` (the Cirrus KV root `cloudflare-kv`) |
| Upstream | [cloudflare/ai `demos/mcp-stytch-consumer-todo-list`](https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list) at `34a8f4c` (MIT, © 2025 stytchauth; the repository MIT, © 2025 Cloudflare, Inc.) |
| Changes | The Stytch project from three optional Orun secrets, and a Worker and a page that work without it; `/api/health`; the product's name on the page; the front end built by Vite alone and the Worker bundled by wrangler (no Cloudflare Vite plugin); the wrangler config rendered per environment; tests, the KV root, the deploy contract |
| Decisions locked | (1) The Worker, its MCP server and its Stytch checks stay upstream's; the MCP server stays stateless (design §2). (2) Stytch is optional: with no project stored the product builds, deploys, passes its smoke and says how to connect it (design §3). (3) `STYTCH_PROJECT_ID` and `STYTCH_DOMAIN` reach the Worker as Worker secrets; `STYTCH_PUBLIC_TOKEN` and `STYTCH_DOMAIN` reach the front end's build, which publishes them, as Stytch's front-end SDK means them to be (design §3). (4) No Stytch project is created for the owner (design §6). (5) The namespace before the Worker on main: cloudflare-kv → web, enforced; advisory on pull requests. |
| Gate | MT2 applies only with a linked workspace (a Cloudflare connection); verified by `terraform validate` and, from MT4, the offline end-to-end tier. |

## Read order

1. `design.md` — what maps to what, Stytch connected and not, the bindings, what is out of scope
2. `implementation-plan.md` — the milestones and what "done" means for each
3. `risks-and-open-questions.md` — what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md` — what actually shipped (kept distinct from intent)

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| MT0 — the spec | this doc set, the task contracts, the repository's intent, CI and tooling | merged on `main` |
| MT1 — the todo app and its MCP server on Workers | `apps/web`, the rendered wrangler config, `tests/web` | typecheck, lint, test and build green; the Worker serves the page, the API and the MCP server over the binding, Stytch not connected and connected |
| MT2 — the KV namespace from Terraform | `infra/terraform/cloudflare-kv` | the root validates; its wiring key matches the template |
| MT3 — ready to instantiate | README, as-built status | a reader can run, test, preview, deploy and connect Stytch |
| MT4 — a baseline | card, build document, rename engine, bootstrap tooling, the product's README and context pack, component docs, tests, `baseline.yml` / `tag.yml` | a new product goes from nothing to live on stage and prod in one landing; Baseline CI green; tagged `baseline-v1` |
