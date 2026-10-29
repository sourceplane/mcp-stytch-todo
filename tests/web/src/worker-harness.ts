// Calling the real Worker (apps/web/api/index.ts) as workerd would: its
// bindings, a fresh ExecutionContext per request (the bearer check writes the
// token's claims onto ctx.props), and `cloudflare:workers`'s env bound to the
// same bindings.
import app from "@/api/index.ts";
import { bindEnv } from "./cloudflare-workers";
import { fakeKV, type FakeKV } from "./fake-kv";

export const ORIGIN = "http://localhost:3000";

export type Harness = {
  env: Env;
  kv: FakeKV;
  /** Requests the Worker passed to Static Assets. */
  assets: string[];
  fetch(path: string, init?: RequestInit): Promise<Response>;
};

export function harness(secrets: { STYTCH_PROJECT_ID?: string; STYTCH_DOMAIN?: string } = {}, kv = fakeKV()): Harness {
  const assets: string[] = [];
  const env = {
    TODOS: kv,
    ASSETS: {
      fetch: async (req: Request) => {
        assets.push(new URL(req.url).pathname);
        return new Response("<!doctype html><title>page</title><div id=\"root\"></div>", {
          headers: { "content-type": "text/html" },
        });
      },
    },
    ...secrets,
  } as unknown as Env;
  bindEnv(env);
  return {
    env,
    kv,
    assets,
    fetch: (path, init = {}) => {
      const headers = new Headers(init.headers);
      if (!headers.has("host")) headers.set("host", new URL(ORIGIN).host);
      const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext;
      return Promise.resolve(app.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers }), env, ctx));
    },
  };
}

/** A JSON-RPC call to /mcp, as a Streamable HTTP client sends it; the result (or error) of the one message the stream carries. */
export async function mcp(
  h: Harness,
  token: string | undefined,
  method: string,
  params: Record<string, unknown> = {},
): Promise<{ status: number; headers: Headers; message?: { result?: Record<string, unknown>; error?: { message: string } } }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (method !== "initialize") headers["mcp-protocol-version"] = "2025-06-18";
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await h.fetch("/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  const data = text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice("data: ".length))
    .at(-1);
  return { status: res.status, headers: res.headers, message: data ? JSON.parse(data) : undefined };
}

export const INITIALIZE = {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "tests", version: "1.0.0" },
};
