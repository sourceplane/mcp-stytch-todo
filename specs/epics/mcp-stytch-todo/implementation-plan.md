# mcp-stytch-todo — implementation plan

## MT0 — the spec (MT-1)

**Done when**
- the five documents and `epic.yaml` are on `main`, with `tasks/MT-1..MT-5.TaskContract.yaml`
- the repository's intent (`intent.yaml`, workspace `ws_CHANGE_ME` until it is linked), `ci.yml` (the plan job a green no-op until then), the workspace files and the shared tooling (`tooling/{eslint,tsconfig,wire}`) are on `main`

## MT1 — the todo app and its MCP server on Workers (MT-2)

**Done when**
- `apps/web` is upstream's demo — the Worker (`api/`), its MCP server, its REST routes, its Stytch checks and its front end (`src/`), every runtime dependency at upstream's resolved version — plus `api/lib/stytch.ts`, `/api/health`, `SITE_NAME`, the front end's Vite build and the wrangler template with its committed fixture render
- `pnpm install && pnpm run wire:fixture && pnpm typecheck && pnpm lint && pnpm test && pnpm build` is green locally; `tests/web` drives the real Worker: the health route over an in-memory namespace; Stytch not connected (every route's answer in design §3); and connected, with session cookies and bearer tokens signed by a test key whose key set stands in for Stytch's — the REST API's four routes, and the MCP server's `initialize`, `tools/list`, `tools/call` and `resources/list` through `/mcp`, scoped to the token's user
- `wrangler deploy --dry-run` lists `env.TODOS` and `env.ASSETS`
- `wrangler dev` serves the page under the product's name — with no Stytch values, the notice — and `/api/health`, and `/mcp`'s `401`
- the deploy hands `STYTCH_PROJECT_ID` and `STYTCH_DOMAIN` to the Worker as Worker secrets (`tooling/wire/worker-secrets.mjs`), and the front end's build gets only `VITE_STYTCH_PUBLIC_TOKEN` and `VITE_STYTCH_DOMAIN`

## MT2 — the KV namespace from Terraform (MT-3)

**Done when**
- `terraform validate` passes on `infra/terraform/cloudflare-kv`, and `app_kv_id` is the key the template's token names
- the root publishes `WIRING_CLOUDFLARE_KV` to stage and prod; `web` declares its edge on it, enforced on main and advisory on a pull request

## MT3 — ready to instantiate (MT-4)

**Done when**
- the README quick start works from a fresh clone: install, dev, test, preview, connect Stytch, deploy by hand
- the status file lists every PR and every departure from upstream

## MT4 — a baseline (MT-5)

The repository becomes an Orun baseline on the Cirrus conventions, held to
the starter standard and built the way turso-starter builds a product — in
ONE landing:

- `blueprint.yaml` (the card: `requires [github, cloudflare]`, the brokered
  secrets as a preview, the programme `01-product`, `02-docs`) and
  `repo-blueprint.yaml` (every module placed by `01-product` and landed as
  one pull request; `02-docs` hook-only);
- `web`'s edge on `cloudflare-kv` `mode: enforced` on a push to main,
  advisory on a pull request, so one convergence applies the namespace and
  then deploys the app per environment;
- `.baseline/`, the rename engine (`SITE_NAME`, the Worker and namespace
  names, the Stytch values' secret refs — and Cloudflare's and Stytch's
  links protected), the bootstrap helpers, the deployment record,
  `ai/context/`, the generated component docs, `testing/` and the
  `baseline.yml` / `tag.yml` lanes.

**Done when**
- orun reads the build document at the bootstrap floor and the lane pin, the
  card agrees with it, and `orun catalog validate` reports no errors
- the product's own `orun plan --trigger github-push-main` applies
  `cloudflare-kv` before `web`, enforced; a pull request's plan holds the
  edge advisory
- the e2e tier builds in the job tree orun stages with all three Stytch
  values planted in the build's environment — and finds the project id in
  nothing the build wrote, the public token and domain only in the front
  end — dry-deploys both bindings, and serves the built Worker over a local
  namespace: the deploy's own smoke, the page under the product's name with
  the notice, `/mcp`'s `401`, the metadata with no authorization server; then
  connected, the metadata naming the Stytch domain, a token Stytch did not
  sign refused
- tagged `baseline-v1` through `tag.yml`

## Sequencing note

MT1's component already names the KV root's wiring secret; MT2 makes the
name true. Applying MT2 needs a workspace with a Cloudflare connection (the
`workers-deploy` token scope covers Workers KV).
