# mcp-stytch-todo — operating contract (for humans and agents)

This is the standing guide to how this app is deployed and operated.
Instance facts (live URLs, workspace, the secrets it uses) live in
[deployment.md](deployment.md), rendered from probed reality by the
bootstrap's `02-docs` phase; this file is the contract that stays true
between deployments. It is written to give an agent with repository read
access enough context to reason about and operate the app without any other
source.

## What this system is

A todo list people sign in to with [Stytch](https://stytch.com/), and that
their agents reach over the [Model Context Protocol](https://modelcontextprotocol.io/)
— Stytch's [MCP todo demo](https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list)
from Cloudflare's AI demos — on Cloudflare alone, expressed as an Orun
component-native desired-state repo.

- **`infra/terraform/cloudflare-kv`** — one Workers KV namespace per
  deployed environment (`stage`, `prod`), applied by Terraform. After each
  apply it publishes a wiring document — `{app_kv_id, app_kv_title}` — as the
  Orun secret `WIRING_CLOUDFLARE_KV` on that environment.
- **`apps/web`** — the app: one Worker with Static Assets, in this order:
  `GET /api/health`; the todo REST API under `/api` (the page's, behind
  Stytch's session cookie); `/.well-known/oauth-protected-resource` (where an
  MCP client learns which Stytch project to authorize with); `/mcp`, the MCP
  server — the Agents SDK's stateless `createMcpHandler`, no Durable Object,
  a resource template and three tools (`createTodo`, `markTodoComplete`,
  `deleteTodo`) — behind Stytch's bearer token; and everything else from the
  page's Static Assets (React; its heading and `<title>` the app's name,
  `apps/web/src/site.ts`). The todos are one JSON list per Stytch user id in
  the `TODOS` namespace, the same list for the page and for an agent.
- **`tests/web`** — the health route, the todo service, and the real
  Worker's REST API and MCP server with Stytch not connected and connected,
  tokens signed by a test key (vitest). Its `dev` lane installs it and checks
  its structure; the tests themselves are `pnpm test`, run before a push.
- **`tooling/*`** — shared TypeScript and ESLint configuration, the wrangler
  renderer that turns `wrangler.template.jsonc` plus a wiring document into
  `wrangler.jsonc`, and the step that hands the Stytch project to the Worker
  as Worker secrets.

Environments: **`stage`** and **`prod`** are deployed; **`dev` is
verify-only by design** — its lanes build and dry-run the deploy, nothing
deploys, and no namespace exists for it (its build renders the committed
fixture).

## Identity and tenancy

Every remote operation runs against ONE Orun workspace, declared in
`intent.yaml` under `execution.state.workspace` — committed, enforced, and
what CI uses. Do not remove it; headless credentials depend on it. If it
reads `ws_SET_ME`, the bootstrap had no workspace to write: set the real one
before anything else.

## How deployment works

1. Merge (or push) to `main`.
2. CI (`.github/workflows/ci.yml`) runs `orun plan --changed` — only
   components whose files changed are planned — then runs each planned lane
   with `orun run --remote-state`, authenticated by GitHub OIDC (the
   exchange resolves this repository's linked workspace server-side).
3. **The namespace before the Worker.** `cloudflare-kv` applies for the
   environment and publishes `WIRING_CLOUDFLARE_KV`. `apps/web` declares an
   enforced `dependsOn` on it for pushes to `main`, so its deploy starts only
   after that apply — and a job resolves its secrets when it starts, so the
   document is there.
4. `apps/web` renders `wrangler.jsonc` from that document (the real
   namespace id), builds the page with Vite — with `VITE_STYTCH_PUBLIC_TOKEN`
   and `VITE_STYTCH_DOMAIN` from the environment's Stytch secrets when
   stored, empty when not — and, when the environment holds
   `STYTCH_PROJECT_ID` and `STYTCH_DOMAIN`, pushes them to
   `mcp-stytch-todo-web-<env>` as Worker secrets. `wrangler deploy` bundles
   and ships the Worker, and a smoke test requires `/api/health` to answer
   `"ok":true` — the Worker read its namespace through the binding — `/mcp`
   with no token to answer `401` with a `WWW-Authenticate` naming its
   `resource_metadata`, and `/` to serve the page. The smoke writes nothing.
5. `prod` deploys after `stage` has converged on the same commit
   (`environments.prod.promotion` in intent.yaml).
6. **The convergence run is the deployment.** A green run means every
   planned lane applied. Failed lanes are retried with
   `gh run rerun --failed`, which resumes the same execution.

On a pull request nothing applies or deploys: the KV root plans, the app
builds and dry-deploys, and the edges in step 3 are advisory.

Caveats that matter:

- A push that touches no component files plans zero lanes — that run is
  green and deployed nothing. Never treat "latest run green" as "app
  converged"; probe the URLs instead.
- A change to `intent.yaml`'s `environments` maps to no component and
  redeploys nothing on its own. Land it with a change under `apps/web`.
- `wrangler.jsonc` is generated. Edit `wrangler.template.jsonc`, run
  `pnpm run wire:fixture` and commit both; the deploy renders its own
  config from the template, so a stale committed render misleads local work.
- Storing or changing a Stytch value takes effect on the next deploy: the
  public token is compiled into the page, and the Worker secrets are pushed
  by the deploy.

## Who can do what

| Stored in the environment | The app |
|---|---|
| no Stytch value (as built) | **answers, and lets nobody in**: the page says how to connect Stytch and loads no Stytch code; `/api/todos…` and `/mcp` refuse every caller (`401`), without a call to Stytch; the metadata names no authorization server |
| `STYTCH_PROJECT_ID` and `STYTCH_DOMAIN`, not the public token | the Worker checks tokens, but the page cannot sign anyone in — store the public token too |
| all three, and the URLs registered with the Stytch project | a person signs in on the page (Google, or an email code) and manages their todos; an MCP client registers itself with the project, sends its user through the page's consent screen (`/oauth/authorize`), and calls `/mcp` with the token Stytch issues — reading and changing that user's todos only |

`/api/health` answers without a token either way; it says whether Stytch is
connected and that the Worker can reach its namespace, and nothing about
whose todos exist. Every tool and route is scoped to the token's Stytch user
id: no caller can see another user's list.

⚠️ This is a demo's security model (the README carries its warning): JWTs
from the project's key set, the audience the project id, the issuer the
project's domain — and no per-tool scopes, rate limits or audit log. Read
Cloudflare's [Securing MCP Servers](https://github.com/cloudflare/agents/blob/main/docs/securing-mcp-servers.md)
before anyone's data depends on it.

## Secrets model

- **Brokered provider secrets**, minted per run from the workspace's
  Cloudflare connection — no long-lived values at rest, nothing to rotate by
  hand:
  - `CLOUDFLARE_API_TOKEN` — the `workers-deploy` scope (Workers Scripts and
    KV Storage write). The KV root's apply, the Worker's deploy and the
    Worker secrets it pushes all use it.
  - `CLOUDFLARE_ACCOUNT_ID` — a connection fact both bind.
- **The Stytch project**: `STYTCH_PROJECT_ID`, `STYTCH_DOMAIN` and
  `STYTCH_PUBLIC_TOKEN`, optional Orun secrets per environment
  (`optionalSecretEnv` in `apps/web/component.yaml`), set by the owner. The
  deploy pushes the project id and domain to the Worker as Worker secrets
  (`tooling/wire/worker-secrets.mjs`, `wrangler secret bulk`); the page's
  build runs with all three unset and only `VITE_STYTCH_PUBLIC_TOKEN` and
  `VITE_STYTCH_DOMAIN` set from them — public by Stytch's design (its
  front-end SDK needs both in the browser). The project id reaches no
  bundle, asset or log.
- **Wiring**: `WIRING_CLOUDFLARE_KV` on `stage` and `prod`, written by the
  KV root's apply (lease-published), read by the Worker's build as
  `WIRING_CLOUDFLARE_KV_<ENV>`. It holds the namespace id, not a credential.
- **The running Worker holds no storage credential.** It reaches the
  namespace through its `TODOS` binding.
- Inspect by NAME only: `orun secrets list --org <ws> --project` and
  `--env stage|prod`. No tooling in this repository prints a secret value,
  and no document in `ai/context/` may contain one.

## Verifying the system

```bash
# the app on each environment (also recorded, probed, in deployment.md)
curl -s https://mcp-stytch-todo-web-stage.your-workers-subdomain.workers.dev/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://mcp-stytch-todo-web-prod.your-workers-subdomain.workers.dev/

# the MCP server's front door: a 401 naming its metadata, and the metadata
curl -s -o /dev/null -D - -X POST https://mcp-stytch-todo-web-stage.your-workers-subdomain.workers.dev/mcp | grep -i www-authenticate
curl -s https://mcp-stytch-todo-web-stage.your-workers-subdomain.workers.dev/.well-known/oauth-protected-resource

# the wiring the deploys read, and workspace readiness
orun secrets list --org <ws> --env stage && orun secrets list --org <ws> --env prod
orun integrations list --org <ws> --json && orun cloud check --org <ws>
```

With Stytch connected, the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
(`npx @modelcontextprotocol/inspector@latest`) pointed at `<url>/mcp` walks
the whole OAuth flow and lists the tools.

## Common operations

| task | how |
|---|---|
| connect Stytch | in the Stytch dashboard: a Consumer project, its Frontend SDK enabled with the app's URL authorized, `<url>/authenticate` as a redirect URL, Dynamic Client Registration on with `<url>/oauth/authorize`; then `orun secrets set STYTCH_PROJECT_ID --env <env>`, the same for `STYTCH_DOMAIN` and `STYTCH_PUBLIC_TOKEN` (each prompts for its value), and deploy by hand (below) |
| use a separate Stytch project for prod | store prod's own three values under `--env prod`; register prod's URLs with that project |
| disconnect Stytch | delete the three Orun secrets and the Worker's (`wrangler secret delete STYTCH_PROJECT_ID --name mcp-stytch-todo-web-<env>`, the same for `STYTCH_DOMAIN`), then deploy by hand |
| rename the app | `SITE_NAME` in `apps/web/src/site.ts`, merge |
| upgrade the MCP or Stytch SDKs | bump the exact pins in `apps/web/package.json` (`agents` and `@modelcontextprotocol/server` together), `pnpm install`, `pnpm test` — the MCP server's tests drive it through `/mcp` — merge |
| deploy a change | merge to `main`; watch the run; failed lanes → `gh run rerun --failed` |
| deploy by hand | Orunbase's Deploy button, or `gh workflow run ci.yml --ref main -f environment=<env> [-f component=<a,b>]` — the named components (blank: every one) run in that environment as a merge runs them; started off `main` it is refused |
| redeploy without a change | edit the last line of `apps/web/component.yaml` (`# orun: redeploy <reason> <stamp>`) and merge — it is a deploy trigger, nothing reads it |
| read or clear a user's todos | `wrangler kv key get <stytch-user-id> --namespace-id <id> --remote` (the id is in the environment's `WIRING_CLOUDFLARE_KV`), or the dashboard's KV page |
| add a binding (D1, R2, another namespace) | a Terraform root under `infra/terraform/` that publishes `WIRING_<ROOT>`, a token in `wrangler.template.jsonc`, its fixture entry, the root in the build's `--components`, the `WIRING_<ROOT>_<ENV>` secretEnv and an enforced `dependsOn` on it in `apps/web/component.yaml` |
| serve a custom domain | attach it to the Worker in Cloudflare (README, "Custom domain"), replace the placeholder `mcp-stytch-todo.example.com` in `intent.yaml`'s `BASE_DOMAIN` with it, register the new URLs with the Stytch project, and pass the hostname to `createMcpHandler` as `allowedHostnames` in `apps/web/api/index.ts` |
| headless credentials | `ORUN_TOKEN` (workspace-scoped) + `GITHUB_TOKEN` |

The deployment record is the bootstrap's `02-docs` phase. Re-running it (the
Orun console's Retry on that phase, or `orun new … --phase 02-docs`)
re-probes the URLs and re-renders [deployment.md](deployment.md); it is
idempotent.

## Evolution

The todos are one KV value per user, read and written whole: two writes at
once (the page and an agent) can lose one, and a write can take up to a
minute to be seen in another location. An owner who outgrows that moves the
list to D1, or to a Durable Object per user, behind the same
`TodoService` interface. Structural changes follow the same contract that
deployed the app: add a component under `apps/`, `infra/` or `packages/`
with a `component.yaml`, land it as a pull request, and the convergence run
applies it.
