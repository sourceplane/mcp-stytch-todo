# web — architecture

Built by the turbo pipeline from `apps/web` and deployed with wrangler.

|                     |                                    |
| ------------------- | ---------------------------------- |
| Worker config       | `apps/web/wrangler.template.jsonc` |
| Entry               | `api/index.ts`                     |
| Compatibility date  | `2025-03-19`                       |
| Compatibility flags | `nodejs_compat`                    |

## Bindings

| Binding  | Kind                 | Source                           |
| -------- | -------------------- | -------------------------------- |
| `TODOS`  | Workers KV namespace | `app_kv_id` from `cloudflare-kv` |
| `ASSETS` | Static assets        | `dist/client`                    |

Identifiers marked _from_ a component are filled in at deploy time from
that component's published outputs for the environment being deployed.

## Wiring

Resolved at deploy time from secrets the infrastructure lanes publish (names only):

- `WIRING_CLOUDFLARE_KV_PROD`
- `WIRING_CLOUDFLARE_KV_STAGE`

## Secrets resolved by the lane (names only)

- `STYTCH_DOMAIN` (optional)
- `STYTCH_PROJECT_ID` (optional)
- `STYTCH_PUBLIC_TOKEN` (optional)
