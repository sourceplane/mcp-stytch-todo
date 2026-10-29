# web

The todo app — Stytch's MCP todo demo on one Cloudflare Worker + Static Assets (the page, its REST API and the MCP server), over the KV namespace, per environment

A Cloudflare Worker with Static Assets (server rendering plus static files), deployed per environment by its CI lane.

|              |                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Type         | `cloudflare-workers-assets-turbo`                                                                                  |
| Source       | `apps/web`                                                                                                         |
| Package      | `@app/web`                                                                                                         |
| Environments | `dev`: `verify` · `stage`: `verify`, `deploy` on a push to `main` · `prod`: `verify`, `deploy` on a push to `main` |

## Depends on

- **cloudflare-kv** — Provisions the Cloudflare KV namespace the app binds as TODOS (stage and prod)

## Depended on by

- (none)
