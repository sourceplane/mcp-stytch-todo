import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json } from "./fake-kv";
import { otherKey, testProject, type TestProject } from "./stytch-keys";
import { harness, INITIALIZE, mcp, type Harness } from "./worker-harness";

// The MCP server (apps/web/api/TodoMCP.ts) through the real Worker's /mcp:
// upstream's stateless createMcpHandler, behind the bearer check, with access
// tokens signed the way Stytch signs them for an authorized MCP client.
describe("the MCP server at /mcp", () => {
  let p: TestProject;
  let h: Harness;
  let token: string;

  beforeEach(async () => {
    p = await testProject("mcp-test");
    h = harness({ STYTCH_PROJECT_ID: p.projectId, STYTCH_DOMAIN: p.domain });
    token = await p.sign({ sub: "user-test-sam", scope: "openid", client_id: "connected-app-test-1" });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("initializes as upstream's TODO Service, with tools and resources", async () => {
    const res = await mcp(h, token, "initialize", INITIALIZE);
    expect(res.status).toBe(200);
    expect(res.message?.result).toMatchObject({
      serverInfo: { name: "TODO Service", version: "1.0.0" },
      capabilities: { tools: {}, resources: {} },
    });
  });

  it("lists the three tools", async () => {
    const res = await mcp(h, token, "tools/list");
    const tools = (res.message?.result?.tools as Array<{ name: string }>).map((t) => t.name);
    expect(tools).toEqual(["createTodo", "markTodoComplete", "deleteTodo"]);
  });

  it("creates, completes and deletes the token's user's todos — the list the page shows", async () => {
    const created = await mcp(h, token, "tools/call", { name: "createTodo", arguments: { todoText: "from an agent" } });
    expect(created.status).toBe(200);
    expect(JSON.stringify(created.message?.result)).toContain("TODO added successfully");
    const stored = JSON.parse(h.kv.store.get("user-test-sam")!) as Array<{ id: string; text: string }>;
    expect(stored).toMatchObject([{ text: "from an agent", completed: false }]);
    const id = stored[0]!.id;

    // The same todo through the REST API, with the same user's session.
    const cookie = `stytch_session_jwt=${await p.sign({ sub: "user-test-sam" })}`;
    expect((await json(await h.fetch("/api/todos", { headers: { cookie } }))).todos).toEqual(stored);

    const resources = await mcp(h, token, "resources/list");
    expect(resources.message?.result?.resources).toEqual([{ name: "from an agent", uri: `todoapp://todos/${id}` }]);
    const read = await mcp(h, token, "resources/read", { uri: `todoapp://todos/${id}` });
    expect(JSON.stringify(read.message?.result)).toContain("text: from an agent completed: false");

    await mcp(h, token, "tools/call", { name: "markTodoComplete", arguments: { todoID: id } });
    expect(JSON.parse(h.kv.store.get("user-test-sam")!)).toMatchObject([{ id, completed: true }]);
    await mcp(h, token, "tools/call", { name: "deleteTodo", arguments: { todoID: id } });
    expect(JSON.parse(h.kv.store.get("user-test-sam")!)).toEqual([]);
  });

  it("scopes every call to the token's user", async () => {
    await mcp(h, token, "tools/call", { name: "createTodo", arguments: { todoText: "sam's" } });
    const other = await p.sign({ sub: "user-test-alex", scope: "openid", client_id: "connected-app-test-1" });
    const res = await mcp(h, other, "resources/list");
    expect(res.message?.result?.resources).toEqual([]);
  });

  it("refuses a token Stytch did not issue for this project, and stores nothing", async () => {
    for (const bad of [
      await p.sign({ sub: "user-test-sam" }, { audience: "project-test-someone-else" }),
      await p.sign({ sub: "user-test-sam" }, { key: await otherKey() }),
      "not-a-jwt",
    ]) {
      const res = await mcp(h, bad, "tools/call", { name: "createTodo", arguments: { todoText: "x" } });
      expect(res.status).toBe(401);
    }
    expect(h.kv.calls).toEqual([]);
    // …while the project's own token is accepted.
    expect((await mcp(h, token, "tools/list")).status).toBe(200);
  });
});
