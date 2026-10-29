// An in-memory KV namespace with the surface the Worker uses (get, as text or
// JSON, and put), recording every call so a test can hold what was read.
export type FakeKV = KVNamespace & { store: Map<string, string>; calls: string[] };

export function fakeKV(initial: Record<string, unknown> = {}): FakeKV {
  const store = new Map<string, string>(
    Object.entries(initial).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]),
  );
  const calls: string[] = [];
  const kv = {
    store,
    calls,
    async get(key: string, type?: unknown) {
      calls.push(`get ${key}`);
      const value = store.get(key);
      if (value === undefined) return null;
      const kind = typeof type === "object" && type !== null ? (type as { type?: string }).type : type;
      return kind === "json" ? JSON.parse(value) : value;
    },
    async put(key: string, value: string) {
      calls.push(`put ${key}`);
      store.set(key, value);
    },
  };
  return kv as unknown as FakeKV;
}

export async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}
