import { Hono } from "hono";
import { cors } from "hono/cors";
import { stytchBearerTokenAuthMiddleware } from "./lib/auth";
import { TodoAPI } from "./TodoAPI.ts";
import { createMcpHandler } from "agents/mcp/server";
import { createTodoServer } from "./TodoMCP.ts";
import { health } from "./health.ts";
import { stytchConfig } from "./lib/stytch.ts";

const mcpHandler = createMcpHandler(createTodoServer);

export default new Hono<{ Bindings: Env }>()
	.use(cors())

	// The deploy's smoke: the KV namespace read through its binding, and
	// whether Stytch is connected (api/health.ts)
	.get("/api/health", (c) => health(c.env))

	// Mount the TODO API underneath us
	.route("/api", TodoAPI)

	// Serve the OAuth Authorization Server response for Dynamic Client Registration
	// (with no Stytch project connected there is no authorization server to name yet)
	.get("/.well-known/oauth-protected-resource", async (c) => {
		const url = new URL(c.req.url);
		const stytch = stytchConfig(c.env);
		if (!stytch) return c.json({ resource: url.origin });
		return c.json({
			resource: url.origin,
			authorization_servers: [`https://${stytch.domain}`],
		});
	})

	// Let the MCP Server have a go at handling the request
	.use("/mcp/*", stytchBearerTokenAuthMiddleware)
	// (Hono's ExecutionContext type predates the runtime's `tracing`; the object is the runtime's)
	.all("/mcp", (c) => mcpHandler(c.req.raw, c.env, c.executionCtx as ExecutionContext))

	// Finally - serve static assets from Vite
	.mount("/", (req, env) => env.ASSETS.fetch(req));
