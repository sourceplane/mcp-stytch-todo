# mcp-stytch-todo (MT) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md` or from the upstream demo
([cloudflare/ai `demos/mcp-stytch-consumer-todo-list`](https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list),
at `34a8f4c`, MIT).

| Milestone | State | PR |
|---|---|---|
| MT0 — the spec | ✅ Shipped | [#1](https://github.com/sourceplane/mcp-stytch-todo/pull/1) (MT-1) |
| MT1 — the todo app and its MCP server on Workers | ✅ Shipped | [#2](https://github.com/sourceplane/mcp-stytch-todo/pull/2) (MT-2) |
| MT2 — the KV namespace from Terraform | ✅ Shipped (validated; apply gated on a linked workspace) | [#3](https://github.com/sourceplane/mcp-stytch-todo/pull/3) (MT-3) |
| MT3 — ready to instantiate | ✅ Shipped | [#4](https://github.com/sourceplane/mcp-stytch-todo/pull/4) (MT-4) |
| MT4 — a baseline | Planned | — |

## Departures from the upstream demo

### Where it lives

Upstream's demo is `apps/web` (`@app/web`) in the monorepo, with its
`LICENSE` beside it (`apps/web/LICENSE`, © 2025 stytchauth). Its `api/`,
`src/`, `public/`, `index.html` and `types.d.ts` keep their paths; its
`wrangler.jsonc` becomes `wrangler.template.jsonc`, rendered per environment
into `wrangler.jsonc`. Not carried: `package-lock` (pnpm locks the
workspace), `.oxlintrc.json` (the workspace's ESLint config), the four
`tsconfig*.json` (three here — `tsconfig.worker.json`, `tsconfig.app.json`,
`tsconfig.node.json` — each checked by `pnpm typecheck`; upstream's
`type-check` checks the empty root project, so nothing), `worker-configuration.d.ts`
(`cloudflare-env.d.ts` with `@cloudflare/workers-types`), `CODEOWNERS`,
`.dev.vars.template` and `.env.template` (`.dev.vars.example` and
`.env.example`, the same keys).

### Unchanged

`api/TodoMCP.ts` (the stateless MCP server: the `todoapp://todos/{id}`
resource template and `createTodo`, `markTodoComplete`, `deleteTodo`, all
scoped to the token's `sub`), `api/TodoAPI.ts`, `api/TodoService.ts`,
`types.d.ts`, `src/Todos.tsx` but for one URL, `src/index.css`, the
`cors()` and the route order of `api/index.ts`, and `api/lib/auth.ts`'s
middlewares and their `401`s.

### Stytch, optional

Upstream needs its four values before anything works. Here:

- `api/lib/stytch.ts` (new) reads `STYTCH_PROJECT_ID` and `STYTCH_DOMAIN`
  (trimmed; a domain pasted as `https://…/` read as its host). With either
  missing, `validateStytchJWT` refuses every token before fetching
  anything — the middlewares answer upstream's `401`s — and
  `/.well-known/oauth-protected-resource` answers `{ resource }` with no
  `authorization_servers` (upstream would name `https://undefined`).
- The key set is cached per domain (upstream: one module-level set).
- `getStytchOAuthEndpointUrl` takes the domain, not the env.
- `src/main.tsx` imports `App` lazily, inside upstream's `Setup` gate, so a
  page built without a public token loads no Stytch SDK and calls no
  Stytch API (upstream's page constructs the client either way, and its
  bootstrap call fails in the console).
- `src/Setup.tsx`'s notice says how to connect Stytch to this product (the
  dashboard steps, the URLs for this origin, the three Orun secrets, the
  redeploy) instead of "Error: Stytch Not Configured Yet" and upstream's
  README link.

### The Stytch values' path

`optionalSecretEnv` in `apps/web/component.yaml`: `STYTCH_PROJECT_ID`,
`STYTCH_DOMAIN`, `STYTCH_PUBLIC_TOKEN`. The `buildCommand` runs the page's
build with all three unset and only `VITE_STYTCH_PUBLIC_TOKEN` and
`VITE_STYTCH_DOMAIN` set from them (empty when not stored; `turbo.json`
passes both through and hashes them), then `tooling/wire/worker-secrets.mjs`
pushes `STYTCH_PROJECT_ID` and `STYTCH_DOMAIN` to `<repo>-web-<env>` with
`wrangler secret bulk` over stdin. A verify lane, holding no Cloudflare
credential, pushes nothing.

### The Stytch client

Upstream builds `new StytchUIClient(…)` from `@stytch/vanilla-js` 6.0.11
and hands it to `@stytch/react` 20.0.11's `StytchProvider`, whose type is
its own bundled `StytchClient` — not assignable (`_subscriptionService`
declared separately), which upstream's `type-check` never sees. Here the
client is `createStytchClient(…)` from `@stytch/react`, with upstream's
options (`endpointOptions.testApiDomain`), and `src/Auth.tsx` imports
`OAuthProviders`, `OTPMethods`, `Products`, `StytchEvent` and
`StytchLoginConfig` from `@stytch/react`; `@stytch/vanilla-js` is no longer
a dependency. Verified with a placeholder token: the client starts and
calls Stytch's API (which answers `public_token_not_found`, as it must).

### `/api/health`

New, first in the app: reads `health:probe` from `TODOS` and answers
`{ ok: true, name, kv: "TODOS", stytch: "connected" | "connect Stytch" }`,
or `503 { ok: false, error }`; never cached, never authenticated, naming no
todo and no Stytch value. It is the component's smoke with `/mcp`'s
unauthenticated `401` (its `WWW-Authenticate` naming `resource_metadata`)
and the page's `id="root"`.

### The build

Upstream's `vite.config.ts` uses `@cloudflare/vite-plugin` for the Worker
and the page. Here Vite (`@vitejs/plugin-react` only) builds the page into
`dist/client`, and wrangler bundles `api/index.ts` (risk MT-J). The page's
`<title>` is set from `SITE_NAME` (`src/site.ts`, `MCP Todos` in this
repository) by a `transformIndexHtml` hook (`scripts/page-title.mjs`,
HTML-escaped; a page with no `<title>` fails the build); the heading is
`SITE_NAME` too (upstream: "TODO App MCP Demo", title "TODO MCP Server").
`pnpm dev` (`scripts/dev.mjs`) runs `vite build --watch` beside `wrangler
dev` on port 3000: no hot module replacement, a reload on save.

### Small fixes

- `src/Todos.tsx` tells the user the MCP server is at `<origin>/mcp`;
  upstream's says `<origin>/sse`, which the demo does not serve.
- `api/index.ts` casts Hono's `c.executionCtx` to the runtime's
  `ExecutionContext` for `mcpHandler` (Hono's type predates `tracing`).

### The namespace

Upstream's hard-coded namespace id becomes one namespace per environment
from `infra/terraform/cloudflare-kv` (`<prefix>mcp-stytch-todo-app-kv-<env>`),
its id rendered into the `TODOS` binding from `WIRING_CLOUDFLARE_KV_<ENV>`;
`wrangler dev` uses a local namespace.

### Behaviour kept as upstream, recorded

- `cors()` allows every origin (risk MT-I); the session middleware logs
  every refused session with `console.error`.
- The tool results' text carries upstream's stray `}` after the JSON state.
- One JSON list per user, last writer wins (risk MT-E).
- `compatibility_date` `2025-03-19` and `nodejs_compat`, upstream's.

## Versions

| Package | Version | Why |
|---|---|---|
| agents | 0.29.0 | upstream's lockfile (`createMcpHandler`, stateless) |
| @modelcontextprotocol/server | 2.3.1 | upstream's pin |
| hono, jose, zod | 4.12.27, 6.2.3, 4.4.3 | upstream's lockfile |
| react, react-dom, react-router-dom | 19.2.7, 19.2.7, 7.18.0 | upstream's lockfile |
| @stytch/react | 20.0.11 | upstream's lockfile; `@stytch/vanilla-js` dropped (above) |
| vite, @vitejs/plugin-react | 8.1.0, 6.0.3 | upstream's lockfile |
| wrangler | ^4.151.0 | the conventions' deploy CLI; upstream's lockfile has 4.105.0 |
| typescript | ^5.8.3 | the workspace's; upstream pins 6.0.3 |

## Verified (MT1–MT3)

- `pnpm install`, `pnpm run wire:fixture`, `pnpm typecheck`, `pnpm lint`,
  `pnpm test` (`tests/web`, 28 tests: the page's title, the Stytch project,
  the health route, the todo service, and the real Worker — Stytch not
  connected: every route's answer, no fetch; connected: the metadata, the
  REST API's four routes from a session cookie, forged sessions refused,
  and the MCP server's `initialize`, `tools/list`, all three tools,
  `resources/list` and `resources/read` through `/mcp`, scoped to the
  token's user, forged tokens refused) and `pnpm build` green.
- `wrangler deploy --dry-run`: `env.TODOS (00000000000000000000000000000001)
  KV Namespace` and `env.ASSETS Assets`; the Worker bundle 1.19 MB (209 KiB
  gzipped with the page).
- `wrangler dev`, no Stytch values: the component's own smoke command
  passes; the page shows the connect-Stytch notice with no Stytch request
  and no page error. With placeholder values (`.dev.vars`, and a build with
  `VITE_STYTCH_*`): `/api/health` says connected, the metadata names the
  domain, a bogus token is a `401`, the public token is in the page's
  bundle and the project id in nothing under `dist/`.
- `pnpm dev`: the page and the Worker on one port, rebuilt on save.
- `orun validate` and `orun plan --trigger github-push-main`:
  `cloudflare-kv.<env>.terraform` (apply) before `web.<env>.verify-deploy`
  (deploy) on stage and prod, dev verify-only.
- `terraform validate` green on `infra/terraform/cloudflare-kv`.
- Not verified: a Terraform apply, a live deploy and a real Stytch sign-in
  — they need the product linked to an Orun workspace with a Cloudflare
  connection, and a Stytch project (risks MT-A, MT-K).
