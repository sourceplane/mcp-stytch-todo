// The Stytch project the Worker checks tokens against — or none.
//
// Both values are Worker secrets: on a deployed environment the Orun secrets
// STYTCH_PROJECT_ID and STYTCH_DOMAIN, pushed by the deploy when its owner has
// stored them; locally apps/web/.dev.vars. Both are OPTIONAL: a product is
// born without a Stytch project, and until both are set the Worker refuses
// every session and every access token (with upstream's 401s), names no
// authorization server, and says so on /api/health.

export type StytchEnv = {
  STYTCH_PROJECT_ID?: string;
  STYTCH_DOMAIN?: string;
};

export type StytchConfig = {
  /** The tokens' audience. */
  projectId: string;
  /** The project's domain, a bare host (`…customers.stytch.dev`): the tokens' issuer and key set. */
  domain: string;
};

/** What /api/health says while no project is connected. */
export const CONNECT_STYTCH = "connect Stytch";

/**
 * The project, when both values are set. A domain pasted as a URL
 * (`https://…/`) is read as its host, which is what upstream's `.dev.vars`
 * holds.
 */
export function stytchConfig(env: StytchEnv): StytchConfig | null {
  const projectId = env.STYTCH_PROJECT_ID?.trim() ?? "";
  const domain = (env.STYTCH_DOMAIN?.trim() ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!projectId || !domain) return null;
  return { projectId, domain };
}
