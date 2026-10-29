// GET /api/health — the deploy's smoke and the deployment record's probe.
//
// Answered by this Worker before anything else, so it needs no session and no
// token whether or not Stytch is connected. It reads ONE key of the TODOS
// namespace through its binding — a namespace that is not bound, or that does
// not answer, is a 503 — and returns nothing it holds: whose todos exist is
// not something an anonymous caller learns here. Read-only.
import { CONNECT_STYTCH, stytchConfig, type StytchEnv } from "./lib/stytch.ts";
import { SITE_NAME } from "../src/site.ts";

export type HealthEnv = StytchEnv & { TODOS?: KVNamespace };

/** The key read: no Stytch user id (`user-test-…`, `user-live-…`) can equal it. */
export const HEALTH_KEY = "health:probe";

export async function health(env: HealthEnv): Promise<Response> {
	const headers = { "cache-control": "no-store" };
	try {
		if (!env.TODOS) throw new Error("no TODOS binding");
		await env.TODOS.get(HEALTH_KEY);
	} catch {
		return Response.json(
			{ ok: false, error: "The KV namespace did not answer: is the `TODOS` binding deployed?" },
			{ status: 503, headers },
		);
	}
	return Response.json(
		{ ok: true, name: SITE_NAME, kv: "TODOS", stytch: stytchConfig(env) ? "connected" : CONNECT_STYTCH },
		{ headers },
	);
}
