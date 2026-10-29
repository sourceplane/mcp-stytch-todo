// What `cloudflare:workers` gives the Worker's modules under workerd, as far
// as they use it: `env`, the Worker's bindings (api/TodoMCP.ts reads TODOS
// from it). The tests bind it with `bindEnv` before each request.
export const env = {} as Env;

export function bindEnv(bindings: Partial<Env>): void {
  for (const key of Object.keys(env)) delete (env as unknown as Record<string, unknown>)[key];
  Object.assign(env, bindings);
}
