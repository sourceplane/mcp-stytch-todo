import type { ReactNode } from "react";
import { SITE_NAME } from "./site.ts";

/**
 * The page while no Stytch project is connected: the build had no
 * VITE_STYTCH_PUBLIC_TOKEN (on a deployed environment, the Orun secret
 * STYTCH_PUBLIC_TOKEN). The Worker answers meanwhile and refuses every
 * session and token; this says what connecting Stytch takes.
 */
export default function Setup({ children }: { children: ReactNode }) {
	if (!import.meta.env.VITE_STYTCH_PUBLIC_TOKEN) {
		const origin = window.location.origin;
		return (
			<main className="setup">
				<h1>{SITE_NAME}</h1>
				<h2>Stytch is not connected yet</h2>
				<p>
					This app signs its users in with <a href="https://stytch.com/">Stytch</a> — and so does
					its MCP server, at <code>{origin}/mcp</code>, for the agents they authorize. Until a
					Stytch project is connected, nobody can sign in and the MCP server refuses every
					client.
				</p>
				<p>To connect one:</p>
				<ol>
					<li>
						In the Stytch dashboard, create a <b>Consumer</b> project, enable its Frontend SDK, and
						in Connected Apps enable Dynamic Client Registration with the authorization URL{" "}
						<code>{origin}/oauth/authorize</code>.
					</li>
					<li>
						Add <code>{origin}/authenticate</code> as a redirect URL, and <code>{origin}</code> as
						an authorized application of the Frontend SDK.
					</li>
					<li>
						Store the project's ID, domain and public token as this environment's secrets{" "}
						<code>STYTCH_PROJECT_ID</code>, <code>STYTCH_DOMAIN</code> and{" "}
						<code>STYTCH_PUBLIC_TOKEN</code>, then redeploy. Running it locally, they go in{" "}
						<code>apps/web/.dev.vars</code> and <code>apps/web/.env.local</code>.
					</li>
				</ol>
			</main>
		);
	}

	return children;
}
