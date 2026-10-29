// The bindings wrangler.jsonc declares, as the Worker sees them — and the two
// optional Worker secrets (api/lib/stytch.ts). Upstream generates this with
// `wrangler types`; here it is written once, and `Env` is what upstream's
// code names.
declare namespace Cloudflare {
	interface Env {
		TODOS: KVNamespace;
		ASSETS: Fetcher;
		STYTCH_PROJECT_ID?: string;
		STYTCH_DOMAIN?: string;
	}
}
interface Env extends Cloudflare.Env {}
