import { describe, expect, it } from "vitest";
import { HEALTH_KEY, health } from "@/api/health.ts";
import { SITE_NAME } from "@/src/site.ts";
import { fakeKV, json } from "./fake-kv";

// GET /api/health — what the deploy's smoke and the deployment record's probe read.
describe("the health route (apps/web/api/health.ts)", () => {
  it("reads one key through the binding and answers ok, naming nothing stored", async () => {
    const kv = fakeKV({ "user-test-1": [{ id: "1", text: "private plans", completed: false }] });
    const res = await health({ TODOS: kv });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await json(res);
    expect(body).toEqual({ ok: true, name: SITE_NAME, kv: "TODOS", stytch: "connect Stytch" });
    expect(JSON.stringify(body)).not.toContain("private plans");
    expect(kv.calls).toEqual([`get ${HEALTH_KEY}`]);
  });

  it("says connected once both Stytch secrets are set — never their values", async () => {
    const res = await health({ TODOS: fakeKV(), STYTCH_PROJECT_ID: "project-test-1", STYTCH_DOMAIN: "acme.customers.stytch.dev" });
    const body = await json(res);
    expect(body.stytch).toBe("connected");
    expect(JSON.stringify(body)).not.toMatch(/project-test-1|acme\.customers/);
  });

  it("is a 503 when the namespace is not bound", async () => {
    const res = await health({});
    expect(res.status).toBe(503);
    expect((await json(res)).ok).toBe(false);
  });

  it("is a 503 when the namespace does not answer, naming no internals", async () => {
    const broken = { get: async () => Promise.reject(new Error("KV down at 10.0.0.1")) } as unknown as KVNamespace;
    const res = await health({ TODOS: broken });
    expect(res.status).toBe(503);
    expect(JSON.stringify(await json(res))).not.toContain("10.0.0.1");
  });
});
