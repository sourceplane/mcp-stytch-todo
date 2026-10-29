# mcp-stytch-todo — open risks

What is not yet proven or not yet decided. The full write-up of every risk,
including the accepted and resolved ones, is
`specs/epics/mcp-stytch-todo/risks-and-open-questions.md`; this page lists
only what is still live, so it should be short.

| ID | Risk | State | What closes it |
|---|---|---|---|
| MT-L | No live bootstrap yet: the repository created and linked, the token minted, a real `terraform apply` of the namespace, the published wiring document, a real `wrangler deploy` with its Worker secrets, the probes — and a real Stytch sign-in, on the page and through an MCP client — are all unproven | OPEN | One bootstrap from a tag against a workspace with a Cloudflare connection, then a Stytch test project connected to it |

Accepted, and worth knowing before you change them: MT-A (a fresh product
signs nobody in), MT-B (Stytch's public values are in the page), MT-C (each
environment is its own Stytch application), MT-D (a Stytch change needs a
redeploy), MT-E (one KV value per user, last writer wins), MT-F (the MCP
server's security is upstream's demo's), MT-G (pre-1.0 SDKs, pinned), MT-H
(the MCP handler's host check on a custom domain), MT-I (upstream's CORS).
Resolved: MT-J (no Cloudflare Vite plugin). Gate: MT-K (the namespace needs
a linked workspace).
