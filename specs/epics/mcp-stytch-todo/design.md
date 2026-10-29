# mcp-stytch-todo — design

## 1. What the demo is

Cloudflare's [`demos/mcp-stytch-consumer-todo-list`](https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list)
(cloudflare/ai at `34a8f4c`, MIT, © 2025 stytchauth) is one Worker,
`api/index.ts`, a Hono app that, in order:

1. allows any origin (`cors()`);
2. mounts the todo REST API under `/api` (`api/TodoAPI.ts`: `GET` and `POST
   /todos`, `POST /todos/:id/complete`, `DELETE /todos/:id`), each route
   behind `stytchSessionAuthMiddleware` — the `stytch_session_jwt` cookie the
   Stytch front-end SDK sets, verified as a JWT;
3. answers `GET /.well-known/oauth-protected-resource` (RFC 9728) with the
   Worker's origin as the resource and `https://<STYTCH_DOMAIN>` as its
   authorization server — how an MCP client finds where to register and sign
   its user in;
4. guards `/mcp` with `stytchBearerTokenAuthMiddleware` — no bearer token is a
   `401` whose `WWW-Authenticate` names that metadata; a token is verified as
   a JWT and its claims handed to the MCP server as the request's props;
5. answers `/mcp` with `createMcpHandler(createTodoServer)` from
   `agents/mcp/server` — the Agents SDK's **stateless** Streamable HTTP
   handler: a fresh `McpServer` ("TODO Service") per request, no session, no
   Durable Object. `api/TodoMCP.ts` registers the user's todos as a resource
   template (`todoapp://todos/{id}`) and three tools (`createTodo`,
   `markTodoComplete`, `deleteTodo`), all scoped to the token's `sub`;
6. serves everything else from Static Assets (`env.ASSETS`, with
   `run_worker_first: true` and single-page-application fallback).

Both tokens are checked the same way (`api/lib/auth.ts`): `jose`'s
`jwtVerify` against the project's JWKS
(`https://<STYTCH_DOMAIN>/.well-known/jwks.json`), RS256, audience
`STYTCH_PROJECT_ID`, issuer `https://<STYTCH_DOMAIN>`. The todos
(`api/TodoService.ts`) are one JSON array per user id in the `TODOS` KV
namespace, sorted with open todos first.

The front end (`src/`) is React 19 with react-router and Stytch's React
SDK: `/login` (Stytch's login UI — Google OAuth and email one-time codes),
`/authenticate` (the OAuth callback), `/oauth/authorize` (Stytch's
`IdentityProvider` consent screen, which an MCP client sends its user to),
`/todoapp` (the list, through Hono's typed client). `src/Setup.tsx` shows a
"Stytch not configured" notice when the build had no public token.

Vite builds both halves through `@cloudflare/vite-plugin`; the README
creates the namespace by hand (`wrangler kv namespace create TODOS`), pastes
its id into `wrangler.jsonc`, uploads the Stytch values with `wrangler secret
bulk .dev.vars`, deploys with `wrangler deploy`, and registers the deployed
URL with the Stytch project.

## 2. The mapping (upstream → here)

| The demo | Here |
|---|---|
| `api/index.ts` | kept, in `apps/web/api/`; `GET /api/health` answered first (§4); the metadata names no authorization server while Stytch is not connected (§3) |
| `api/lib/auth.ts` | kept; the Stytch project read once through `stytchConfig(env)` (`api/lib/stytch.ts`): with none, every token is refused with upstream's `401` and nothing is fetched; the key set cached per Stytch domain |
| `api/TodoMCP.ts`, `api/TodoAPI.ts`, `api/TodoService.ts`, `types.d.ts` | unchanged — the stateless `createMcpHandler`, its resource and its tools; the REST routes; the KV layout |
| `src/` | kept; the heading and the page's `<title>` are the product's name (`src/site.ts`, `SITE_NAME`); `Setup.tsx` says how to connect Stytch to this product; the Stytch app is imported only once the build has a public token, so an unconnected page makes no call to Stytch; the page names the MCP server's URL as `/mcp` (upstream's says `/sse`, a route the demo does not serve) |
| `vite.config.ts` with `@cloudflare/vite-plugin` | Vite builds the front end alone, into `dist/client`; `wrangler deploy` bundles the Worker from `api/index.ts` — the command the deploy contract runs (§5). `pnpm dev` rebuilds the front end on change and serves both through `wrangler dev` on port 3000 |
| `wrangler.jsonc` with a pasted namespace id | `wrangler.template.jsonc`: `@@wiring(cloudflare-kv/__ENV__:app_kv_id)@@`, `assets.directory: dist/client`, upstream's asset settings and `nodejs_compat`; rendered per environment (§4) |
| `wrangler kv namespace create TODOS` | `infra/terraform/cloudflare-kv`, one namespace per environment |
| `.dev.vars` (`STYTCH_PROJECT_ID`, `STYTCH_DOMAIN`), `wrangler secret bulk` | Orun secrets of the same names, pushed to the Worker as Worker secrets by the deploy (§3); locally `apps/web/.dev.vars` |
| `.env.local` (`VITE_STYTCH_PUBLIC_TOKEN`, `VITE_STYTCH_DOMAIN`) | the Orun secrets `STYTCH_PUBLIC_TOKEN` and `STYTCH_DOMAIN`, handed to the front end's build under those names (§3); locally `apps/web/.env.local` |
| `wrangler deploy`, the Deploy to Cloudflare button | Orun: `apps/web/component.yaml` renders the config for `$ORUN_ENVIRONMENT`, builds, pushes the Worker secrets, and deploys `mcp-stytch-todo-web-{stage,prod}` on merge to `main`, after the namespace's apply |
| npm, oxlint, TypeScript 6 | pnpm, the workspace's ESLint config and TypeScript 5; every runtime dependency pinned exactly at the version upstream's lockfile resolved (`agents` 0.29.0, `@modelcontextprotocol/server` 2.3.1, `hono` 4.12.27, `jose` 6.2.3, `zod` 4.4.3, React 19.2.7, Stytch's SDKs 20.0.11 / 6.0.11) |
| `worker-configuration.d.ts` (`wrangler types`) | `cloudflare-env.d.ts` and `@cloudflare/workers-types` |

Alternative rejected: keeping `@cloudflare/vite-plugin`. It builds the Worker
into `dist/<name>/` with a generated config and a redirect that `wrangler
deploy` follows only when it is not given `--config`; the composition
deploys with `--config wrangler.jsonc` (the rendered one). Two bundlers for
one Worker would also mean the deployed bundle is not the one tested. So
wrangler bundles the Worker everywhere — dev, tests' dry run, deploy — and
Vite builds only what is static.

## 3. Stytch: connected, and not

The Stytch project is three values from its dashboard (Project settings),
each an **optional** Orun secret of the product per environment:

| Orun secret | Goes to | Read by |
|---|---|---|
| `STYTCH_PROJECT_ID` | the Worker, as a Worker secret | the tokens' audience |
| `STYTCH_DOMAIN` | the Worker, as a Worker secret; and the front end's build, as `VITE_STYTCH_DOMAIN` | the tokens' issuer and key set, the metadata's authorization server; the front-end SDK's API domain |
| `STYTCH_PUBLIC_TOKEN` | the front end's build, as `VITE_STYTCH_PUBLIC_TOKEN` | the front-end SDK |

The public token and the domain are public by Stytch's design — the
front-end SDK cannot work without them in the page — so the build publishes
them, as upstream's `.env.local` does. The project id never reaches the
build (`env -u`); the deploy lane hands it and the domain to the Worker with
`tooling/wire/worker-secrets.mjs` (`wrangler secret bulk --name
mcp-stytch-todo-web-<env>`, the values over stdin). No log holds them.

**Not connected** (a fresh product; any value missing). The Worker is
connected when both `STYTCH_PROJECT_ID` and `STYTCH_DOMAIN` are set, the
page when its build had `VITE_STYTCH_PUBLIC_TOKEN`. Until then:

| Route | Answers |
|---|---|
| `/` and every page | the notice: Stytch is not connected, and the three secrets to store, the redirect URL and the authorized application to register, and the redeploy that applies them |
| `GET /api/health` | `200 {"ok":true, "name", "kv":"TODOS", "stytch":"connect Stytch"}` — the namespace read (§4) |
| `/api/todos…` | `401`, as upstream answers a missing session |
| `/mcp` | `401` with upstream's `WWW-Authenticate: Bearer … resource_metadata=…`; a bearer token is refused the same way without a call to Stytch |
| `/.well-known/oauth-protected-resource` | `{"resource": <origin>}` — no authorization server to name yet |

So a product with no Stytch project builds, deploys, passes its smoke and
says what to do; storing the three secrets and redeploying (the console's
Deploy button, or `ci.yml`'s Run workflow) connects it.

**Connected.** Upstream's behaviour, unchanged: the page signs its user in
and lists their todos; `/mcp` answers an MCP client holding a token Stytch
issued for that user; `GET /api/health` reports `"stytch":"connected"`. The
owner registers each environment's URL with the Stytch project (a redirect
URL `https://<worker>.workers.dev/authenticate` and an authorized
application `https://<worker>.workers.dev`), and turns on Dynamic Client
Registration with the authorization URL `https://<worker>.workers.dev/oauth/authorize`
— the product's README, "Connecting Stytch".

## 4. The bindings and the wiring flow

| Binding | Kind | From |
|---|---|---|
| `TODOS` | KV namespace | `app_kv_id` in the `cloudflare-kv` root's wiring document |
| `ASSETS` | Static Assets | `dist/client`, the front end's build |

The binding names are upstream's. `wrangler.template.jsonc` carries the
wiring token; `pnpm run wire:fixture` renders it from `wiring.fixture.json`
into the committed `wrangler.jsonc` (the deploy lane checks the config exists
before it builds); the stage and prod lanes render from
`WIRING_CLOUDFLARE_KV_<ENV>`, and dev, which no root applies to, from the
fixture.

`GET /api/health` (`api/health.ts`) reads one key of `TODOS`
(`health:probe`, which no Stytch user id can equal) and answers `{ ok: true,
name, kv: "TODOS", stytch }`, or `503 { ok: false, error }` when the binding
is missing or the read throws, never cached. It is the deploy's smoke and
the deployment record's probe because it is a read-only route only this
Worker, bound to its namespace, can answer: the page alone answers from
Static Assets whether a namespace exists or not. The smoke also asks `/mcp`
with no token and expects the `401` that names the metadata — the MCP
server's front door, read-only.

## 5. The repository

```
apps/web                          the demo + the Workers build
  api/index.ts                    the Worker: /api/health, the API, the metadata, /mcp, the assets
  api/TodoAPI.ts                  the REST routes (upstream)
  api/TodoMCP.ts                  the MCP server: one resource template, three tools (upstream)
  api/TodoService.ts              the todos in KV (upstream)
  api/lib/auth.ts                 the session and bearer checks (upstream, §3)
  api/lib/stytch.ts               the Stytch project from the Worker's secrets, or none
  api/health.ts                   GET /api/health (§4)
  src/                            the front end (upstream); src/site.ts the product's name
  index.html, public/             the page
  vite.config.ts                  the front end's build → dist/client
  wrangler.template.jsonc         the config's source (§4); wrangler.jsonc its fixture render
  component.yaml                  the deploy contract
  .dev.vars.example, .env.example the local Stytch values
  LICENSE                         upstream's (stytchauth, MIT)
tests/web                         vitest: the service, the health route, the REST API and the MCP server through the real Worker with tokens signed by a test key
infra/terraform/cloudflare-kv     one namespace per environment; publishes WIRING_CLOUDFLARE_KV
tooling/wire                      the wrangler renderer; worker-secrets.mjs
```

The namespace before the Worker: `apps/web` declares `dependsOn:
cloudflare-kv`, `mode: enforced` on a push to main and advisory on a pull
request, so one landing applies the namespace and then deploys the Worker
that binds it. Its composition is `cloudflare-workers-assets-turbo` (the
front end is static files the Worker serves first-in-line), not hono-api's
`cloudflare-worker-turbo`, which ships no assets.

## 6. Out of scope

- **Creating the Stytch project.** Stytch is a service outside Cloudflare;
  no Orun composition provisions it and no brokered credential reaches it.
  The owner creates a Consumer project, turns on the front-end SDK and
  Dynamic Client Registration, registers the URLs and stores the three
  values (§3). Until then the product runs unconnected.
- **Stytch B2B** (organizations). Upstream points at a separate demo; this
  one is Consumer.
- **A custom domain.** The app goes live on workers.dev; attaching a domain
  is the owner's step, and the Stytch project then needs the new URLs. The
  MCP handler checks the `Host` header only on localhost and workers.dev by
  default (risk MT-H).
- **Durable Objects.** Nothing to leave out: upstream's MCP server is already
  the stateless `createMcpHandler`.
- **Smart Placement** (commented out upstream) and **the MCP Inspector**
  (a tool the README suggests running locally) — unchanged, left to the
  owner.
