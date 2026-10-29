# mcp-stytch-todo — decisions

The choices that shape this repository, one line each, with where the full
reasoning lives. Superseded decisions stay listed, marked, so the history
reads in order.

| # | Decision | Why | Source |
|---|---|---|---|
| 1 | The Worker, its MCP server, its REST routes and its Stytch checks stay upstream's; every runtime dependency pinned at upstream's lockfile version (`agents` 0.29.0, `@modelcontextprotocol/server` 2.3.1, `hono` 4.12.27, `jose` 6.2.3) | A port that rewrote the demo would no longer be the demo | `specs/epics/mcp-stytch-todo/design.md` §2, risk MT-G |
| 2 | The MCP server stays stateless (`createMcpHandler`) — no Durable Object | Upstream is already stateless, and there is no Orun composition for Durable Objects; nothing to drop | design.md §1, §6 |
| 3 | Stytch is OPTIONAL: with no project stored the app builds, deploys, passes its smoke and says how to connect one | Stytch is outside Cloudflare: no composition provisions it and no brokered credential reaches it, so a product is born without it | design.md §3, risk MT-A |
| 4 | `STYTCH_PROJECT_ID` and `STYTCH_DOMAIN` are Worker secrets pushed by the deploy (`wrangler secret bulk`); `STYTCH_PUBLIC_TOKEN` and `STYTCH_DOMAIN` reach the page's build as `VITE_*`; the build runs with all three Orun secrets unset | The Worker reads the project at request time; Stytch's front-end SDK needs the token and domain in the browser, as upstream's `.env.local` puts them; the project id reaches no bundle | design.md §3, risk MT-B |
| 5 | With no Stytch project every token is refused before any fetch, and the metadata names no authorization server | Upstream would fetch `https://undefined/…` and name it | design.md §3 |
| 6 | The page imports the Stytch app lazily, behind upstream's `Setup` gate | An unconnected page loads no Stytch SDK and calls no Stytch API | design.md §2 |
| 7 | The Stytch client is `@stytch/react`'s `createStytchClient`, and `@stytch/vanilla-js` is dropped | `@stytch/react` 20's provider takes its own client type, which upstream's vanilla-js `StytchUIClient` is not | IMPLEMENTATION-STATUS, "The Stytch client" |
| 8 | Vite builds only the page (`dist/client`); wrangler bundles the Worker; no `@cloudflare/vite-plugin` | The composition deploys with `wrangler deploy --config wrangler.jsonc`, which does not read the plugin's output; the tested bundle is the shipped one | design.md §2, risk MT-J |
| 9 | `cloudflare-workers-assets-turbo`, not hono-api's `cloudflare-worker-turbo` | The page is Static Assets the Worker serves (`run_worker_first`) | design.md §5 |
| 10 | `/api/health` reads one KV key and is the deploy's smoke and the record's probe, with `/mcp`'s unauthenticated `401` | Read-only routes only this Worker, bound to its namespace, can answer — the page alone would answer from Static Assets | design.md §4 |
| 11 | `wrangler.jsonc` is rendered from the KV root's wiring document per environment, and the fixture render is committed | The deploy lane checks the config exists before the build | design.md §4 |
| 12 | One token: the KV root applies with `workers-deploy` (KV Storage write), as the deploy does | No second scope is needed for KV | `infra/terraform/cloudflare-kv/component.yaml` |
| 13 | One landing (`01-product`) then the record (`02-docs`); `apps/web` `dependsOn: cloudflare-kv`, enforced on main, advisory on a pull request | The plan, not a landing boundary, orders the namespace before the Worker | design.md §5 |
| 14 | stack-tectonic 0.19.0 | The floor for the first-deploy retry and the smoke's backoff; the app has one job per lane, so 0.20.0's shared install would save nothing | `intent.yaml` |
| 15 | The console asks for no domain; an empty `productdomain` brands the placeholder `<reponame>.example.com`, and `subdomain` is read from the Cloudflare connection | The app goes live on workers.dev; attaching a domain is an owner's step | `blueprint.yaml`, risk MT-H |
