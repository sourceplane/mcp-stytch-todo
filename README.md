# mcp-stytch-todo

Stytch's [MCP todo demo](https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list)
from Cloudflare's AI demos — a React todo list signed in with
[Stytch](https://stytch.com/), the Hono REST API behind it, and a
[Model Context Protocol](https://modelcontextprotocol.io/) server through
which an agent, authorized by the same user over OAuth, reads and edits the
same todos — running on **one Cloudflare Worker + Static Assets**, with the
todos in a Workers KV namespace provisioned by Terraform through
[Orun](https://github.com/sourceplane/orun), and packaged as an **Orun
baseline**: one command takes a new product from nothing to live on stage
and prod, in its own repository, under its own name — in ONE landing.

The Worker, its MCP server and its front end are upstream's: the MCP server
is the Agents SDK's stateless `createMcpHandler` (no Durable Object), its
tools upstream's `createTodo`, `markTodoComplete` and `deleteTodo`. **Stytch
is optional**: a product is born without a Stytch project, and until one is
connected the app still deploys and answers — its page says how to connect
Stytch, and its API and MCP server refuse every caller. What the baseline
adds is everything needed to make a copy of it somebody else's, built the
way [cirrus-baseline](https://github.com/sourceplane/cirrus-baseline) is
since its one-landing bootstrap. See
[`specs/epics/mcp-stytch-todo`](specs/epics/mcp-stytch-todo/README.md) for
the design, the milestones and the as-built status.

> [!WARNING]
> Upstream's warning stands: this is a demo, and an MCP server holding
> people's data needs every measure in Cloudflare's
> [Securing MCP Servers](https://github.com/cloudflare/agents/blob/main/docs/securing-mcp-servers.md)
> before it is anyone's production.

## Instantiating a product

```bash
git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/mcp-stytch-todo
cd mcp-stytch-todo
orun new --blueprint repo-blueprint.yaml --out ~/sites/acme-tasks --run-hooks --resume \
  --set reponame=acme-tasks --set productname="Acme Tasks" \
  --set githuborg=acme-inc --set subdomain=<workers-dev-subdomain>
```

Or, once the platform's registry lists it, from the Orun console (Baselines →
`mcp-stytch-todo` → Build). Two phases: **`01-product`** creates the
repository and lands the whole product as ONE pull request — intent, CI,
tooling, the KV root, the app and its tests — and one convergence applies
the KV namespace on stage and prod and then deploys the app bound to it;
**`02-docs`** records the live deployment from probed facts.
**[BOOTSTRAP.md](BOOTSTRAP.md)** is the operator guide;
[docs/phases/](docs/phases/README.md) has a page per phase.

The only connection a build needs is Cloudflare. The app answers from the
first deploy: the Worker reaches its namespace through its KV binding, so
there is no storage key to paste, and its MCP server is at `/mcp`. The
Stytch project — `STYTCH_PROJECT_ID`, `STYTCH_DOMAIN` and
`STYTCH_PUBLIC_TOKEN`, three optional Orun secrets — is the owner's to store
after the build; until then nobody can sign in and the page says how to
connect it.

The new repository receives the **product only** — the app, its KV root, its
tests, its CI, its tooling, a README of its own and its operating contract —
renamed throughout to the product's name, repository, Cloudflare Worker and
namespace titles. None of this repository's machinery ships.

| What makes it a baseline | Where |
|---|---|
| The console card (inputs, secrets, programme) | `blueprint.yaml` |
| The build document (modules, phases, hooks) | `repo-blueprint.yaml` |
| This tree's identity, and the bootstrap's task contracts | `.baseline/` |
| The rename engine | `tooling/rebrand/rebrand.mjs` |
| The bootstrap's helpers (deferrals, redeploy marker, work-tree strip) | `tooling/bootstrap/` |
| The deployment-record renderer | `hooks/render-deployment-docs.sh` |
| The product's README and context pack | `.baseline/product/README.md`, `ai/context/` |
| The generated component docs | `*/docs/`, `tooling/catalog/gen-component-docs.py` |
| The baseline's tests: contract, wiring, leak, offline bootstrap, end to end | `testing/`, `.github/workflows/baseline.yml` |
| Cutting a `baseline-vN` tag | `.github/workflows/tag.yml` |

## What is here (the product)

| Surface | Where |
|---|---|
| The Worker: health, the todo REST API, the OAuth metadata, the MCP server, the assets | `apps/web/api/index.ts` |
| The MCP server (a resource template and three tools) and the todos in KV | `apps/web/api/TodoMCP.ts`, `apps/web/api/TodoService.ts`, `apps/web/api/TodoAPI.ts` |
| Stytch's session and bearer checks; the project, or none | `apps/web/api/lib/auth.ts`, `apps/web/api/lib/stytch.ts` |
| The health route (the deploy's smoke) | `apps/web/api/health.ts` |
| The front end (login, consent, the list) and the page while Stytch is not connected | `apps/web/src/`, `apps/web/src/Setup.tsx` |
| The product's name (the heading and `<title>`) | `apps/web/src/site.ts` |
| Workers bindings and deploy contract | `apps/web/wrangler.template.jsonc` + `wiring.fixture.json` (→ the committed `wrangler.jsonc`), `component.yaml` |
| Stytch's values' path to the Worker (Worker secrets) | `tooling/wire/worker-secrets.mjs` |
| The KV namespace (stage, prod) | `infra/terraform/cloudflare-kv` |
| The wrangler renderer | `tooling/wire` |
| Tests | `tests/web` (vitest: the health route, the todo service, and the real Worker's REST API and MCP server with Stytch not connected and connected, tokens signed by a test key) |

## Getting started

```bash
pnpm install
pnpm run wire:fixture   # render apps/web/wrangler.jsonc from the offline fixture
pnpm typecheck
pnpm lint
pnpm test
pnpm build              # the front end → apps/web/dist/client
```

```bash
pnpm --filter @app/web dev       # http://localhost:3000: the page, the API and /mcp, a local KV namespace
pnpm --filter @app/web preview   # the same over one build
```

Without Stytch values the page says how to connect Stytch; that is the app
working as designed, not an error.

## Connecting Stytch

1. Create a [Stytch](https://stytch.com/) account and a **Consumer**
   project. In its dashboard (Test environment):
   - [Frontend SDKs](https://stytch.com/dashboard/sdk-configuration?env=test):
     enable the SDK and add the app's URL as an authorized application —
     `https://<repo>-web-<env>.<subdomain>.workers.dev` for each deployed
     environment, `http://localhost:3000` for local work;
   - [Redirect URLs](https://stytch.com/dashboard/redirect-urls?env=test):
     add `<url>/authenticate` for each;
   - [Connected Apps](https://stytch.com/dashboard/connected-apps?env=test):
     enable Dynamic Client Registration, with the authorization URL
     `<url>/oauth/authorize`.
2. From [Project settings](https://stytch.com/dashboard/project-settings?env=test)
   take the **Project ID**, the **Project Domain** and the **public token**,
   and store them for each environment as the product's Orun secrets
   `STYTCH_PROJECT_ID`, `STYTCH_DOMAIN` and `STYTCH_PUBLIC_TOKEN`
   (`orun secrets set <KEY> --env <env>`).
3. Redeploy the environment (a merge to `main`, or Run workflow on
   `ci.yml`). The deploy pushes `STYTCH_PROJECT_ID` and `STYTCH_DOMAIN` to
   the Worker as Worker secrets, and compiles `STYTCH_PUBLIC_TOKEN` and
   `STYTCH_DOMAIN` into the page — public by Stytch's design; the project id
   reaches no bundle. `GET /api/health` then says `"stytch":"connected"`.

Locally, the Worker's two go in `apps/web/.dev.vars` (from
`.dev.vars.example`) and the page's in `apps/web/.env.local` (from
`.env.example`, as `VITE_STYTCH_PUBLIC_TOKEN` and `VITE_STYTCH_DOMAIN`).
Stage and prod can share one test project, each URL registered; or prod can
have a live project of its own — the secrets are per environment.

Then connect an MCP client to `<url>/mcp` — for example the
[MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
(`npx @modelcontextprotocol/inspector@latest`). It finds the Stytch project
from `<url>/.well-known/oauth-protected-resource`, registers itself, and
sends you through the app's consent screen; the todos it sees and changes
are the ones the page shows.

## Deploying

A merge to `main` applies the KV namespace on stage and prod and then
deploys `mcp-stytch-todo-web-{stage,prod}` bound to it, once `intent.yaml`
names the product's Orun workspace (it names the placeholder `ws_CHANGE_ME`
until it is linked, and CI plans nothing). By hand: Run workflow on `main`
(`ci.yml`) with the environment, and optionally the components, to deploy.
The deploy's smoke is read-only: `/api/health` reads the namespace, `/mcp`
answers an unauthenticated call with the `401` that names its metadata, and
the page is served.

## How it maps to Cloudflare's demo

| The demo | Here |
|---|---|
| `api/index.ts`, `api/TodoMCP.ts`, `api/TodoAPI.ts`, `api/TodoService.ts` | The same Worker, its MCP server (stateless `createMcpHandler`), its routes and its KV layout; `/api/health` added first |
| `api/lib/auth.ts` with `STYTCH_PROJECT_ID` and `STYTCH_DOMAIN` from `.dev.vars` | The same checks; the two values are optional Worker secrets, and with neither every token is refused without a call to Stytch (`api/lib/stytch.ts`) |
| `src/` with `VITE_STYTCH_PUBLIC_TOKEN` and `VITE_STYTCH_DOMAIN` from `.env.local` | The same front end, its name the product's; the values from the Orun secrets at build; the client from `@stytch/react`'s `createStytchClient`; with no token, a page that says how to connect Stytch and loads no Stytch code |
| "Error: Stytch Not Configured Yet" | The connect-Stytch page: the three secrets, the URLs to register, the redeploy |
| `vite.config.ts` with `@cloudflare/vite-plugin` | Vite builds the page into `dist/client`; wrangler bundles the Worker, in dev and in the deploy alike |
| `wrangler kv namespace create TODOS`, its id pasted into `wrangler.jsonc` | `infra/terraform/cloudflare-kv`, applied by Orun before the Worker deploys, one namespace per environment, its id rendered into the binding |
| `npx wrangler secret bulk .dev.vars` | The deploy pushes the stored Stytch values as Worker secrets |
| `npm run deploy`, the Deploy to Cloudflare button | Orun applies the namespace and deploys `<repo>-web-{stage,prod}` on merge to `main` (`apps/web/component.yaml`); `orun new --blueprint repo-blueprint.yaml` for a new repository |
| npm, oxlint, TypeScript 6 | pnpm, ESLint, TypeScript 5; runtime dependencies pinned at upstream's lockfile versions |

## How the namespace id reaches the Worker

```
infra/terraform/cloudflare-kv ──apply──► orun secret WIRING_CLOUDFLARE_KV (stage, prod)
   (CLOUDFLARE_API_TOKEN, workers-deploy)      │   (each deploy resolves it as it starts;
                                               │    a missing one fails the lane)
                                               ▼
apps/web  dependsOn cloudflare-kv (enforced on main) · secretEnv WIRING_CLOUDFLARE_KV_<ENV>
          optionalSecretEnv STYTCH_PROJECT_ID, STYTCH_DOMAIN, STYTCH_PUBLIC_TOKEN
  build:  tooling/wire/live.mjs → wrangler.jsonc with the environment's namespace id
          (dev, verify-only, renders the fixture) → vite build of the page
          (VITE_STYTCH_PUBLIC_TOKEN, VITE_STYTCH_DOMAIN only)
          → tooling/wire/worker-secrets.mjs: STYTCH_PROJECT_ID and STYTCH_DOMAIN, when stored, to the Worker
  deploy: CLOUDFLARE_API_TOKEN (workers-deploy) — wrangler bundles api/index.ts and uploads dist/client
```

`wrangler.jsonc` is committed as the fixture render of
`wrangler.template.jsonc`, because the deploy lane's `verify-app-structure`
step checks the config exists before it builds.

## CI

| Workflow | What it runs | Ships to a product |
|---|---|---|
| `ci.yml` | the Orun pipeline, and the only workflow a product carries: `orun plan --changed`, then one job per lane. A pull request runs the verify lanes (the KV root planned for stage and prod, the page built and the Worker dry-deployed per environment, the tests run), except the bootstrap's own landings (`orun/BASE-*`), where `plan` alone runs and nothing waits for it (the landing checked its commit in the box); a merge applies the KV namespace, then deploys stage → prod. It plans nothing while `intent.yaml` names the placeholder workspace `ws_CHANGE_ME`, as this repository does. A manual run (Orunbase's Deploy button, or Run workflow on `main`) plans the environment and components it names under the push-to-main trigger, so they deploy as a merge deploys them | yes |
| `baseline.yml` | the baseline's own tiers: contract tests, the wiring path, the blueprint read by the pinned orun, the leak gate, the offline bootstrap with the product's own plan, the landing installed, type-checked, linted, tested and built, the product built in the job tree, dry-deployed and served — Stytch not connected, then connected | no |
| `tag.yml` | cuts a `baseline-vN` tag (manual) | no |

## Credits

The app is Stytch's [`mcp-stytch-consumer-todo-list`](https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list)
demo in [cloudflare/ai](https://github.com/cloudflare/ai), MIT (© 2025
stytchauth, kept as `apps/web/LICENSE`; the repository © 2025 Cloudflare,
Inc.). The MCP server runs on Cloudflare's [Agents SDK](https://github.com/cloudflare/agents)
and the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk),
installed as dependencies.
