# mcp-stytch-todo

A todo list people sign in to with [Stytch](https://stytch.com/), and that
their agents reach over the [Model Context Protocol](https://modelcontextprotocol.io/):
a React page, the REST API behind it, and an MCP server — the Agents SDK's
stateless `createMcpHandler` — through which an MCP client, authorized by the
same person over OAuth, reads and edits the same todos. On **one Cloudflare
Worker + Static Assets**, the todos in a Workers KV namespace that Terraform
provisions per environment. Ported from Stytch's
[MCP todo demo](https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list)
in Cloudflare's AI demos.

> [!WARNING]
> This is a demo's security model: Stytch's tokens checked against the
> project's keys, every tool scoped to its user — and no per-tool scopes,
> rate limits or audit log. Read Cloudflare's
> [Securing MCP Servers](https://github.com/cloudflare/agents/blob/main/docs/securing-mcp-servers.md)
> before anyone's data depends on it.

## Live deployment

<!-- 02-docs:begin -->
Not recorded yet. The bootstrap's last phase writes the live URLs, the
workspace and the secrets the app uses into
[ai/context/deployment.md](ai/context/deployment.md); how the app deploys
and how to operate it is in
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## What is here

| Surface | Where |
|---|---|
| The Worker: the health route, the todo REST API, the OAuth metadata, the MCP server, the page | `apps/web/api/index.ts` |
| The MCP server (a resource template and three tools) and the todos in KV | `apps/web/api/TodoMCP.ts`, `apps/web/api/TodoService.ts`, `apps/web/api/TodoAPI.ts` |
| Stytch's session and bearer checks, and the project they check against (or none) | `apps/web/api/lib/auth.ts`, `apps/web/api/lib/stytch.ts` |
| The page: Stytch's login and consent screens and the list; what it says while Stytch is not connected | `apps/web/src/`, `apps/web/src/Setup.tsx` |
| The app's name (the heading and `<title>`) | `apps/web/src/site.ts` |
| Bindings and deploy contract | `apps/web/wrangler.template.jsonc` + `wiring.fixture.json` (→ `wrangler.jsonc`), `component.yaml` |
| The Stytch project, handed to the Worker as Worker secrets | `tooling/wire/worker-secrets.mjs` |
| The KV namespace (stage, prod) | `infra/terraform/cloudflare-kv` |
| Tests | `tests/web` (vitest: the health route, the todo service, and the real Worker's REST API and MCP server with Stytch not connected and connected, tokens signed by a test key) |

## Getting started

```bash
pnpm install
pnpm run wire:fixture   # render apps/web/wrangler.jsonc from the offline fixture
pnpm typecheck
pnpm lint
pnpm test
pnpm build              # the page → apps/web/dist/client
```

```bash
pnpm --filter @app/web dev      # http://localhost:3000: the page, the API and /mcp, a local KV namespace
cp apps/web/.dev.vars.example apps/web/.dev.vars   # the Worker's Stytch values
cp apps/web/.env.example apps/web/.env.local       # the page's Stytch values
```

Its name is `apps/web/src/site.ts`. The Worker's dependencies — the Agents
SDK, the MCP SDK, Hono, jose — are pinned exactly in `apps/web/package.json`:
upgrade them there, deliberately, and run the tests, which drive the MCP
server through `/mcp`.

## Connecting Stytch

**Until a Stytch project is connected, nobody can sign in.** The app answers
— its page says how to connect Stytch, and its API and its MCP server refuse
every caller — but nothing is exposed and nothing is stored. To connect one:

1. Create a [Stytch](https://stytch.com/) account and a **Consumer** project.
   In its dashboard:
   - Frontend SDKs: enable the SDK, and add each environment's URL
     (`https://mcp-stytch-todo-web-<env>.your-workers-subdomain.workers.dev`)
     as an authorized application;
   - Redirect URLs: add `<url>/authenticate` for each;
   - Connected Apps: enable Dynamic Client Registration, with the
     authorization URL `<url>/oauth/authorize`.
2. Store three secrets for each environment, in the workspace this product
   deploys from (console → the project → Secrets, or
   `orun secrets set <KEY> --env <env>`): `STYTCH_PROJECT_ID`,
   `STYTCH_DOMAIN` (the Project Domain) and `STYTCH_PUBLIC_TOKEN`, from the
   project's settings.
3. Redeploy (Deploy by hand, below). The deploy hands the project id and
   domain to the Worker as Worker secrets — `wrangler secret bulk`, the
   values over stdin — and compiles the public token and domain into the
   page, as Stytch's front-end SDK needs them; the project id reaches no
   file and no bundle. `GET /api/health` then says `"stytch":"connected"`.

Then a person signs in on the page (Google, or an email code) and keeps
their list; and an MCP client — the
[MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
(`npx @modelcontextprotocol/inspector@latest`), or an agent — pointed at
`<url>/mcp` finds the Stytch project from
`<url>/.well-known/oauth-protected-resource`, registers itself, sends its
person through the page's consent screen, and reads and changes that
person's todos with the token Stytch issues.

Stage and prod can share one test project, each URL registered, or prod can
have a live project of its own: the secrets are per environment. Locally the
Worker's two go in `apps/web/.dev.vars`, the page's in `apps/web/.env.local`
(`VITE_STYTCH_PUBLIC_TOKEN`, `VITE_STYTCH_DOMAIN`), with
`http://localhost:3000` registered. To disconnect, delete the Worker secrets
(dashboard → the Worker → Settings → Variables and Secrets, or `wrangler
secret delete`) and the Orun secrets with them, and redeploy.

## How the namespace reaches the Worker

There is no storage key to configure. The Worker binds the namespace as
`TODOS`, and the binding is the credential. Its id is never hand-written:
`apps/web/wrangler.template.jsonc` names it as a wiring token, and
`wrangler.jsonc` is that template rendered — from `wiring.fixture.json`
(placeholder ids) for local work and verification, and on every deploy from
the document the `cloudflare-kv` Terraform root publishes after its apply
(`WIRING_CLOUDFLARE_KV`, per environment). Edit the template, then
`pnpm run wire:fixture` and commit the render with the template.

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. The KV namespace applies first, then
the app builds with that environment's namespace id and deploys — to
`stage`, then to `prod` once stage has converged on the same commit; `dev`
only verifies. The Worker is `mcp-stytch-todo-web-<env>` on your account's
workers.dev subdomain, and every deploy is smoke-tested over HTTP: the health
route must read the namespace through its binding, `/mcp` with no token must
answer the `401` that names its metadata, and the page must be served. A
pull request runs the same pipeline's verify lanes, with nothing applied or
deployed: the KV namespace planned for stage and prod, the page built and
the Worker dry-deployed for each environment, and the tests run. They do not
run the linter — run it before you push (Getting started, above).

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The
Cloudflare token that applies the namespace and deploys the Worker, and the
account id, are brokered per run from the workspace's Cloudflare connection,
and the namespace ids travel as Orun secrets, as does the Stytch project
when you store it; nothing provider-shaped is stored in the repository or in
GitHub.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after connecting
or rotating the Stytch project, say. A component with nothing to run in that
environment (a test suite in `prod`) is left out with a notice.

## Custom domain

The app answers on workers.dev from its first deploy. To serve it on your
own domain, add the domain to the Cloudflare account the app deploys into
and attach it to the Worker (dashboard → Workers & Pages →
`mcp-stytch-todo-web-prod` → Settings → Domains & Routes → Add → Custom
domain). The page, the OAuth metadata and the MCP server build their URLs
from the request, so the code needs one change only: pass the hostname to
`createMcpHandler` as `allowedHostnames` in `apps/web/api/index.ts` (it
checks the `Host` header on workers.dev and localhost by itself). Register
the new URLs with the Stytch project. The repository names the domain in one
place, `BASE_DOMAIN` in `intent.yaml`, which the app was born with as the
reserved placeholder `mcp-stytch-todo.example.com`. Replace it with your
domain in the same change that records it.

## Credits

The app is Stytch's `mcp-stytch-consumer-todo-list` demo in
[cloudflare/ai](https://github.com/cloudflare/ai), MIT — © 2025 stytchauth,
`apps/web/LICENSE`; the repository © 2025 Cloudflare, Inc. The MCP server
runs on Cloudflare's [Agents SDK](https://github.com/cloudflare/agents) and
the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk),
installed as dependencies.
