# mcp-stytch-todo — risks and open questions

## MT-A — A fresh product signs nobody in (ACCEPTED)

Stytch is a service outside Cloudflare, so a product is born without a
Stytch project: the page shows the "connect Stytch" notice, the API and the
MCP server refuse every caller, and `/api/health` says `"stytch":"connect
Stytch"`. Accepted because the alternative — a product that fails to build or
deploy until its owner has a Stytch account — is worse, and because nothing
is exposed meanwhile: every route that reads or writes a todo answers `401`.
The product's README and its operating contract open with the three secrets
to store and the URLs to register (design §3).

## MT-B — Stytch's public values are in the page (ACCEPTED)

`STYTCH_PUBLIC_TOKEN` and `STYTCH_DOMAIN` are compiled into the front end, as
upstream's `.env.local` compiles them: Stytch's front-end SDK needs both in
the browser, and Stytch scopes the public token to the domains the owner
authorizes in its dashboard. They are stored as Orun secrets only so all
three values live in one place. `STYTCH_PROJECT_ID` is never handed to the
build; the e2e tier (MT4) plants all three in the build's environment and
holds that the project id is in nothing the build wrote, and that the other
two are only in the front end.

## MT-C — Each environment is its own Stytch application (ACCEPTED)

Stytch allows a redirect URL and an authorized application per origin, so
stage's and prod's workers.dev URLs must each be registered — or each
environment given its own project (test for stage, live for prod). The
secrets are per environment, so either works; the README says both.

## MT-D — Changing a Stytch value needs a redeploy (ACCEPTED)

The public token and domain are in the front end's build, and the Worker
secrets are pushed by the deploy, so storing or rotating a value takes
effect on the next deploy — a merge to main, the console's Deploy button or
`ci.yml`'s Run workflow. Upstream's own flow is the same (`.env.local`, then
`wrangler secret bulk`, then `npm run deploy`).

## MT-E — The todo list is one KV value per user (ACCEPTED)

Upstream's layout: each user's todos are one JSON array under their Stytch
user id, read, changed and written back whole. Two writes at once (the page
and an agent) can lose one; KV is eventually consistent across locations,
so a write can take up to a minute to be seen elsewhere. Kept as upstream
ships it — a demo of the agent and the page sharing one list — and recorded
for an owner who outgrows it (D1 or a Durable Object per user).

## MT-F — The MCP server's security is upstream's (ACCEPTED)

Upstream warns that the demo must be hardened before production and points
at the Agents SDK's guide to securing MCP servers. The checks kept here:
RS256 JWTs from the project's key set, audience the project id, issuer the
project's domain; every tool scoped to the token's `sub`. Not added: scope
checks per tool, rate limits, audit logs. The product's README carries
upstream's warning.

## MT-G — Pre-1.0 SDKs, pinned (ACCEPTED)

`agents` (0.29.0) and `@modelcontextprotocol/server` (2.3.1) move fast; the
stateless handler's options and the server's registration API have changed
between minor versions. Both are pinned exactly at upstream's lockfile
versions, as are `hono`, `jose`, `zod`, React and Stytch's SDKs; `tests/web`
drives the MCP server through `/mcp` so an upgrade that breaks it fails a
test, not a deploy.

## MT-H — The MCP handler's host check (ACCEPTED)

`createMcpHandler` rejects a request whose `Host` is not the endpoint's own
on localhost and workers.dev, and checks nothing on any other host unless
given `allowedHostnames`. The product lives on workers.dev; an owner who
attaches a custom domain should pass it (`api/index.ts`).

## MT-I — Cross-origin requests (ACCEPTED)

Upstream allows every origin (`cors()`: `Access-Control-Allow-Origin: *`,
no credentials), so another site's script can read nothing a user's
session cookie unlocks. `/mcp` authenticates by bearer token, which no
browser attaches on its own. What remains is upstream's: the REST API reads
Stytch's session cookie, so a browser that sends that cookie with a
cross-site form post could let another site add or change a todo. Kept as
upstream ships it; an owner who needs more restricts `cors()` to the app's
origin and checks `Origin` on writes.

## MT-J — No Cloudflare Vite plugin (RESOLVED)

Upstream builds the Worker and the front end with `@cloudflare/vite-plugin`,
whose output the composition's `wrangler deploy --config wrangler.jsonc`
would not follow (design §2). Here Vite builds the front end only, and
wrangler bundles the Worker everywhere. What changes for a developer: `pnpm
dev` rebuilds the front end on save and `wrangler dev` reloads it, instead of
Vite's hot module replacement.

## MT-K — The KV namespace needs a linked workspace (GATE)

`infra/terraform/cloudflare-kv` applies with the product's Cloudflare
connection (the brokered `workers-deploy` token, which covers Workers KV).
Until a workspace is linked, `ci.yml` plans nothing; the root is verified by
`terraform validate` and, from MT4, by the offline bootstrap's plans.
