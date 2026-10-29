import { describe, expect, it, vi } from "vitest";
import { todoService } from "@/api/TodoService.ts";
import { fakeKV } from "./fake-kv";

// The todos in KV, as upstream keeps them (apps/web/api/TodoService.ts):
// one JSON list per user id, open todos first.
describe("the todo service (apps/web/api/TodoService.ts)", () => {
  const envWith = (kv = fakeKV()) => ({ TODOS: kv }) as unknown as Env;

  it("adds, completes and deletes a user's todos under their id", async () => {
    const kv = fakeKV();
    const sam = todoService(envWith(kv), "user-test-sam");
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(2000);
    await sam.add("write the spec");
    const added = await sam.add("ship it");
    expect(added.map((t) => t.text)).toEqual(["write the spec", "ship it"]);

    const completed = await sam.markCompleted("1000");
    expect(completed).toEqual([
      { id: "2000", text: "ship it", completed: false },
      { id: "1000", text: "write the spec", completed: true },
    ]);
    expect(JSON.parse(kv.store.get("user-test-sam")!)).toEqual(completed);

    expect(await sam.delete("2000")).toEqual([{ id: "1000", text: "write the spec", completed: true }]);
  });

  it("keeps users apart", async () => {
    const kv = fakeKV();
    await todoService(envWith(kv), "user-test-a").add("a's");
    expect(await todoService(envWith(kv), "user-test-b").get()).toEqual([]);
  });

  it("leaves the list alone when completing a todo that is not there", async () => {
    const kv = fakeKV({ "user-test-a": [{ id: "1", text: "x", completed: false }] });
    expect(await todoService(envWith(kv), "user-test-a").markCompleted("nope")).toEqual([
      { id: "1", text: "x", completed: false },
    ]);
    expect(kv.calls.filter((c) => c.startsWith("put"))).toEqual([]);
  });
});
