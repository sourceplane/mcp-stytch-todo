import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_NAME } from "@/src/site.ts";
import { json } from "./fake-kv";
import { otherKey, testProject } from "./stytch-keys";
import { harness, INITIALIZE, mcp, ORIGIN } from "./worker-harness";

afterEach(() => vi.unstubAllGlobals());

const RESOURCE_METADATA = `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource"`;

// The real Worker (apps/web/api/index.ts) with NO Stytch project connected: a
// fresh product. It answers, refuses every caller, and fetches nothing.
describe("the Worker, Stytch not connected", () => {
  it("answers /api/health over the namespace, saying to connect Stytch", async () => {
    const h = harness();
    const res = await h.fetch("/api/health");
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true, name: SITE_NAME, kv: "TODOS", stytch: "connect Stytch" });
  });

  it("refuses /mcp with no token: a 401 naming its metadata", async () => {
    const h = harness();
    const res = await mcp(h, undefined, "initialize", INITIALIZE);
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain('Bearer error="Unauthorized"');
    expect(res.headers.get("www-authenticate")).toContain(RESOURCE_METADATA);
  });

  it("refuses /mcp with a token, and asks Stytch nothing", async () => {
    const fetchSpy = vi.fn(async () => new Response("unexpected", { status: 500 }));
    vi.stubGlobal("fetch", fetchSpy);
    const h = harness();
    const res = await mcp(h, "eyJhbGciOiJSUzI1NiJ9.e30.c2ln", "initialize", INITIALIZE);
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("names no authorization server in its protected-resource metadata", async () => {
    const res = await harness().fetch("/.well-known/oauth-protected-resource");
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ resource: ORIGIN });
  });

  it("refuses the todo API, and stores nothing", async () => {
    const h = harness();
    for (const [method, path] of [
      ["GET", "/api/todos"],
      ["POST", "/api/todos"],
      ["POST", "/api/todos/1/complete"],
      ["DELETE", "/api/todos/1"],
    ] as const) {
      const res = await h.fetch(path, {
        method,
        headers: { cookie: "stytch_session_jwt=forged", "content-type": "application/json" },
        body: method === "POST" ? JSON.stringify({ todoText: "x" }) : undefined,
      });
      expect(res.status, `${method} ${path}`).toBe(401);
    }
    expect(h.kv.calls).toEqual([]);
  });

  it("serves every other path from Static Assets — the page, which says how to connect Stytch", async () => {
    const h = harness();
    expect((await h.fetch("/")).status).toBe(200);
    expect((await h.fetch("/todoapp")).status).toBe(200);
    expect(h.assets).toEqual(["/", "/todoapp"]);
  });
});

// Connected: upstream's checks, against a project whose key set the tests serve.
describe("the Worker, Stytch connected", () => {
  it("names the Stytch domain as its authorization server", async () => {
    const p = await testProject("worker-test");
    const h = harness({ STYTCH_PROJECT_ID: p.projectId, STYTCH_DOMAIN: p.domain });
    expect(await json(await h.fetch("/.well-known/oauth-protected-resource"))).toEqual({
      resource: ORIGIN,
      authorization_servers: [`https://${p.domain}`],
    });
    expect((await json(await h.fetch("/api/health"))).stytch).toBe("connected");
  });

  it("serves a signed-in user's todos through the REST API, from the session cookie", async () => {
    const p = await testProject("worker-test");
    const h = harness({ STYTCH_PROJECT_ID: p.projectId, STYTCH_DOMAIN: p.domain });
    const cookie = `stytch_session_jwt=${await p.sign({ sub: "user-test-sam" })}`;
    const call = async (method: string, path: string, body?: unknown) => {
      const res = await h.fetch(path, {
        method,
        headers: { cookie, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      expect(res.status, `${method} ${path}`).toBe(200);
      return (await json(res)).todos as Array<{ id: string; text: string; completed: boolean }>;
    };

    expect(await call("GET", "/api/todos")).toEqual([]);
    const [todo] = await call("POST", "/api/todos", { todoText: "ship the baseline" });
    expect(todo).toMatchObject({ text: "ship the baseline", completed: false });
    expect(await call("POST", `/api/todos/${todo!.id}/complete`)).toEqual([{ ...todo, completed: true }]);
    expect(await call("DELETE", `/api/todos/${todo!.id}`)).toEqual([]);
    expect([...h.kv.store.keys()]).toEqual(["user-test-sam"]);
    expect(p.fetched).toEqual([`https://${p.domain}/.well-known/jwks.json`]);
  });

  it("refuses a session Stytch did not issue for this project", async () => {
    const p = await testProject("worker-test");
    const h = harness({ STYTCH_PROJECT_ID: p.projectId, STYTCH_DOMAIN: p.domain });
    const forged = [
      await p.sign({ sub: "user-test-sam" }, { audience: "project-test-someone-else" }),
      await p.sign({ sub: "user-test-sam" }, { issuer: "https://evil.example" }),
      await p.sign({ sub: "user-test-sam" }, { expiresIn: Math.floor(Date.now() / 1000) - 60 }),
      await p.sign({ sub: "user-test-sam" }, { key: await otherKey() }),
    ];
    for (const token of forged) {
      const res = await h.fetch("/api/todos", { headers: { cookie: `stytch_session_jwt=${token}` } });
      expect(res.status).toBe(401);
    }
    expect(h.kv.calls).toEqual([]);
    // …while the same project's own session is accepted.
    const own = await p.sign({ sub: "user-test-sam" });
    expect((await h.fetch("/api/todos", { headers: { cookie: `stytch_session_jwt=${own}` } })).status).toBe(200);
  });
});
