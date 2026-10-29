# apps/web — the todo app and its MCP server on Workers

Stytch's [MCP todo demo](https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list)
from Cloudflare's AI demos (MIT, © 2025 stytchauth), running as one
Cloudflare Worker with Static Assets, the todos in the KV namespace bound as
`TODOS`:

- `api/index.ts` — the Worker, upstream's Hono app: `/api/health`, then the
  todo REST API under `/api`, the OAuth protected-resource metadata at
  `/.well-known/oauth-protected-resource`, the MCP server at `/mcp`
  (`createMcpHandler` from the Agents SDK: stateless, no Durable Object)
  behind the bearer check, and everything else from `ASSETS`
- `api/TodoMCP.ts`, `api/TodoAPI.ts`, `api/TodoService.ts` — upstream's MCP
  server (one resource template, `createTodo`, `markTodoComplete`,
  `deleteTodo`), REST routes and KV layout (one JSON list per Stytch user id),
  unchanged
- `api/lib/auth.ts` — upstream's checks of the Stytch session cookie (the
  page) and bearer token (`/mcp`), against the project's key set
- `api/lib/stytch.ts` — the Stytch project from the Worker's secrets
  `STYTCH_PROJECT_ID` and `STYTCH_DOMAIN`, or none: with none, every session
  and token is refused (`401`) without a call to Stytch, and the metadata
  names no authorization server
- `api/health.ts` — `GET /api/health`: reads one key of the namespace and
  answers `{ ok, name, kv, stytch }`, or `503` when the binding is missing or
  the read fails. It is the deploy's smoke check, the route only this Worker,
  bound to its namespace, can answer
- `src/` — upstream's React front end (Stytch's login and consent screens,
  the list); `src/site.ts` is the product's name, the page's heading and
  `<title>`; `src/Setup.tsx` is the page while Stytch is not connected
- `vite.config.ts` — Vite builds the front end into `dist/client`; wrangler
  bundles the Worker

```bash
pnpm dev        # the front end rebuilt on save + wrangler dev on http://localhost:3000, a local KV namespace
pnpm build      # the front end → dist/client
pnpm preview    # the same once, then wrangler dev
```

The MCP server is at `http://localhost:3000/mcp`; try it with the
[MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
(`npx @modelcontextprotocol/inspector@latest`) once Stytch is connected.

**Stytch, locally.** Copy `.dev.vars.example` to `.dev.vars` (the Worker's
`STYTCH_PROJECT_ID` and `STYTCH_DOMAIN`) and `.env.example` to `.env.local`
(the page's `VITE_STYTCH_PUBLIC_TOKEN` and `VITE_STYTCH_DOMAIN`), from the
Stytch dashboard's Project settings, and register `http://localhost:3000` as
upstream's README says. Without them the app runs unconnected: the page says
how to connect Stytch and the API and `/mcp` refuse everyone. On a deployed
environment the values are the Orun secrets `STYTCH_PROJECT_ID`,
`STYTCH_DOMAIN` and `STYTCH_PUBLIC_TOKEN`: the deploy pushes the first two to
the Worker as Worker secrets (`tooling/wire/worker-secrets.mjs`), and hands
the public token and domain — public by Stytch's design — to the page's
build. The project id reaches no bundle.

The namespace needs no key: the Worker binds it. Its id is not hand-written
either. `wrangler.template.jsonc` names it as a wiring token;
`wrangler.jsonc` is that template rendered from `wiring.fixture.json`
(placeholder ids, for local work and verification), and every deploy renders
it again from the id the `cloudflare-kv` Terraform root published for the
environment (`component.yaml`'s `buildCommand`).

⚠️ Upstream's warning stands: this is a demo, and an MCP server holding
people's data needs every preventive and defense-in-depth measure in
Cloudflare's [Securing MCP Servers](https://github.com/cloudflare/agents/blob/main/docs/securing-mcp-servers.md)
before it is anyone's production.
