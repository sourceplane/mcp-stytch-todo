import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { stytchConfig } from "./stytch.ts";

/**
 * stytchAuthMiddleware is a Hono middleware that validates that the user is logged in
 * It checks for the stytch_session_jwt cookie set by the Stytch FE SDK
 */
export const stytchSessionAuthMiddleware = createMiddleware<{
	Variables: {
		userID: string;
	};
	Bindings: Env;
}>(async (c, next) => {
	const sessionCookie = getCookie(c, "stytch_session_jwt");

	try {
		const verifyResult = await validateStytchJWT(sessionCookie ?? "", c.env);
		c.set("userID", verifyResult.payload.sub!);
	} catch (error) {
		console.error(error);
		throw new HTTPException(401, { message: "Unauthenticated" });
	}

	await next();
});

/**
 * stytchBearerTokenAuthMiddleware is a Hono middleware that validates that the request has a Stytch-issued bearer token
 * Tokens are issued to clients at the end of a successful OAuth flow
 */
export const stytchBearerTokenAuthMiddleware = createMiddleware<{
	Bindings: Env;
}>(async (c, next) => {
	const authHeader = c.req.header("Authorization");
	const url = new URL(c.req.url);

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		const wwwAuthValue = `Bearer error="Unauthorized", error_description="Unauthorized", resource_metadata="${url.origin}/.well-known/oauth-protected-resource"`;
		const responseHeaders = new Headers();

		responseHeaders.set("WWW-Authenticate", wwwAuthValue);
		const res = new Response(null, { status: 401, headers: responseHeaders });
		throw new HTTPException(401, { message: "Missing or invalid access token", res: res });
	}
	const accessToken = authHeader.substring(7);

	try {
		const verifyResult = await validateStytchJWT(accessToken, c.env);
		c.executionCtx.props = {
			accessToken,
			claims: verifyResult.payload,
		};
	} catch (error) {
		console.error(error);
		throw new HTTPException(401, { message: "Unauthenticated" });
	}

	await next();
});

// One key set per Stytch domain, fetched on first use and cached by jose.
const jwksByDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function validateStytchJWT(token: string, env: Env) {
	// No Stytch project connected (STYTCH_PROJECT_ID and STYTCH_DOMAIN, api/lib/stytch.ts):
	// no token can be valid, and there is no key set to fetch.
	const stytch = stytchConfig(env);
	if (!stytch) {
		throw new Error("Stytch is not connected: STYTCH_PROJECT_ID and STYTCH_DOMAIN are not both set");
	}

	let jwks = jwksByDomain.get(stytch.domain);
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL(getStytchOAuthEndpointUrl(stytch.domain, ".well-known/jwks.json")));
		jwksByDomain.set(stytch.domain, jwks);
	}

	return await jwtVerify(token, jwks, {
		algorithms: ["RS256"],
		audience: stytch.projectId,
		issuer: [`https://${stytch.domain}`],
		typ: "JWT",
	});
}

export function getStytchOAuthEndpointUrl(domain: string, endpoint: string): string {
	const baseURL = `https://${domain}`;
	return `${baseURL}/${endpoint}`;
}
