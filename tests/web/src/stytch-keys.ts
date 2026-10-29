// A stand-in for a Stytch project: an RS256 key pair whose public half is
// served as the project's key set (https://<domain>/.well-known/jwks.json)
// through a stubbed global fetch, and tokens signed with it the way Stytch
// signs session JWTs and OAuth access tokens (audience the project id,
// issuer https://<domain>).
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from "jose";
import { vi } from "vitest";

export type TestProject = {
  projectId: string;
  domain: string;
  /** Every URL the Worker fetched. */
  fetched: string[];
  sign(claims: { sub: string } & Record<string, unknown>, opts?: SignOptions): Promise<string>;
};

export type SignOptions = {
  audience?: string;
  issuer?: string;
  expiresIn?: string | number;
  key?: CryptoKey;
};

export async function otherKey(): Promise<CryptoKey> {
  return (await generateKeyPair("RS256")).privateKey;
}

let projects = 0;

/**
 * A fresh project with its own key pair and its own domain (`<name>-<n>.customers.stytch.dev`):
 * the Worker caches a domain's key set, as it should, so a new key needs a new domain.
 */
export async function testProject(name: string, projectId = "project-test-00000000-0000-4000-8000-000000000000"): Promise<TestProject> {
  const domain = `${name}-${++projects}.customers.stytch.dev`;
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256", use: "sig" };
  const fetched: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    fetched.push(url);
    if (url === `https://${domain}/.well-known/jwks.json`) {
      return new Response(JSON.stringify({ keys: [jwk] }), { headers: { "content-type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  });
  return {
    projectId,
    domain,
    fetched,
    async sign(claims, opts = {}) {
      return new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", kid: "test-key", typ: "JWT" })
        .setIssuedAt()
        .setAudience(opts.audience ?? projectId)
        .setIssuer(opts.issuer ?? `https://${domain}`)
        .setExpirationTime(opts.expiresIn ?? "5m")
        .sign(opts.key ?? privateKey);
    },
  };
}
