# cloudflare-kv

Provisions the Cloudflare KV namespace the app binds as TODOS (stage and prod)

Terraform-managed infrastructure, planned and applied per environment by its CI lane.

|              |                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Type         | `terraform`                                                                                          |
| Source       | `infra/terraform/cloudflare-kv`                                                                      |
| Environments | `stage`: `plan-only`, `apply` on a push to `main` · `prod`: `plan-only`, `apply` on a push to `main` |

## Depends on

- (none)

## Depended on by

- **web** — The todo app — Stytch's MCP todo demo on one Cloudflare Worker + Static Assets (the page, its REST API and the MCP server), over the KV namespace, per environment
