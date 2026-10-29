# Epics

Orun-style work programs. Each epic is a folder carrying `epic.yaml` (the
declaration the platform reads: slug, key prefix, milestones with exit
criteria and task keys) beside its doc set. The pull request that adds the
folder is the adoption; the merge creates the epic in the workspace.

| Epic | Cluster | Status | What it is |
|------|---------|--------|------------|
| [`mcp-stytch-todo/`](./mcp-stytch-todo/) | **MT** | In progress (MT0) | Stytch's MCP todo app (Cloudflare's demo) — a React todo list, its REST API and an MCP server for agents, on one Cloudflare Worker + Static Assets with the todos in Workers KV from Terraform, and an Orun baseline that instantiates it in one landing (MT4) |

As-built ≠ intent: what shipped lives in each epic's `IMPLEMENTATION-STATUS.md`.
