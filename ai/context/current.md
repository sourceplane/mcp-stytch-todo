# mcp-stytch-todo — where this repository stands

The entry page for anyone (or any agent) picking this repository up. It is
this repository's own state and does not ship to a product built from it;
the two pages that do are [operations.md](operations.md) and
[deployment.md](deployment.md).

## What it is

Stytch's MCP todo demo from Cloudflare's AI demos — a React todo list
signed in with Stytch, its Hono REST API, and an MCP server (the Agents
SDK's stateless `createMcpHandler`) through which an agent reads and edits
the same todos — on one Cloudflare Worker + Static Assets, the todos in a
Workers KV namespace Terraform provisions, packaged as an Orun baseline:
`orun new --blueprint repo-blueprint.yaml` builds a new product in its own
repository and takes it to live on stage and prod in one landing
(`01-product`: the namespace applied, then the Worker deployed), then
records what went live (`02-docs`). Stytch is optional: a product is born
unconnected — it answers, refuses every caller, and its page says how to
connect a Stytch project (three optional Orun secrets).

## Release

| | |
|---|---|
| Latest tag | `baseline-v1` (MT4 — the first baseline) |
| Proven live | No. Everything short of the platform and Stytch is proven offline in Baseline CI — the built Worker served under `wrangler dev` over a local namespace and driven unconnected, then connected (the metadata naming the Stytch domain, unsigned tokens refused), and the REST API and the MCP server's tools driven in `tests/web` with tokens a test key signs; a live bootstrap from a tag, and a real Stytch sign-in, are still to come (risk MT-L) |

## Where to read

| Question | Page |
|---|---|
| What shipped, and every departure from upstream | `specs/epics/mcp-stytch-todo/IMPLEMENTATION-STATUS.md` |
| Why it is built this way | [decisions.md](decisions.md), then `specs/epics/mcp-stytch-todo/design.md` |
| What could still go wrong | [open-risks.md](open-risks.md), then `specs/epics/mcp-stytch-todo/risks-and-open-questions.md` |
| How to instantiate it | `BOOTSTRAP.md`, `docs/phases/` |
| What each component is | `apps/web/docs/`, `tests/web/docs/`, `infra/terraform/cloudflare-kv/docs/` (generated; `python3 tooling/catalog/gen-component-docs.py`) |

## Next

1. Bootstrap one product from `baseline-v1` against a workspace with a
   Cloudflare connection, connect a Stytch test project to its stage
   environment, sign in on the page and through an MCP client, and record
   its timings (closes MT-L).
