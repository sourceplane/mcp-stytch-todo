# mcp-stytch-todo

Stytch's [MCP todo demo](https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list)
from Cloudflare — a React todo list signed in with [Stytch](https://stytch.com/),
the Hono REST API behind it, and a [Model Context Protocol](https://modelcontextprotocol.io/)
server through which an agent, authorized by the same user over OAuth, reads
and edits the same todos — running on **one Cloudflare Worker + Static
Assets**, with the todos in a Workers KV namespace provisioned by Terraform
through [Orun](https://github.com/sourceplane/orun). Stytch is optional: with
no project connected the app still deploys, answers and says how to connect
one — and, at its last milestone (MT4), it is packaged as an **Orun
baseline**: one command taking a new product from nothing to live on stage
and prod, in its own repository, under its own name, in ONE landing.

This repository is being built in five steps, one pull request each: the
spec (MT0), the todo app and its MCP server on Workers (MT1), the KV
namespace from Terraform (MT2), ready to instantiate (MT3), and the baseline
(MT4). The design, the milestones and the as-built status are in
[`specs/epics/mcp-stytch-todo`](specs/epics/mcp-stytch-todo/README.md).

## Credit

The app is Stytch's [`mcp-stytch-consumer-todo-list`](https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list),
one of Cloudflare's [AI demos](https://github.com/cloudflare/ai) — MIT-licensed
(© 2025 stytchauth; the repository © 2025 Cloudflare, Inc.); the licence
arrives with it, in `apps/web/LICENSE`, at MT1.
