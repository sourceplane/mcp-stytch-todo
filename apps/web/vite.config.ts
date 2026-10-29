import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { setTitle } from "./scripts/page-title.mjs";
import { SITE_NAME } from "./src/site.ts";

// The front end only: Vite builds the page into dist/client, which the Worker
// serves as Static Assets (wrangler.jsonc). The Worker itself (api/index.ts)
// is bundled by wrangler — in `wrangler dev` and in the deploy alike — so the
// bundle that is tested is the bundle that ships. Upstream's
// @cloudflare/vite-plugin is not used: it bundles the Worker itself, into an
// output `wrangler deploy --config wrangler.jsonc` does not read.
//
// VITE_STYTCH_PUBLIC_TOKEN and VITE_STYTCH_DOMAIN, when set, are compiled into
// the page: public by Stytch's design (its front-end SDK needs both). Locally
// they come from .env.local; on Orun, from the Orun secrets STYTCH_PUBLIC_TOKEN
// and STYTCH_DOMAIN (component.yaml's buildCommand).
export default defineConfig({
	plugins: [
		react(),
		{
			name: "site-title",
			transformIndexHtml: (html) => setTitle(html, SITE_NAME),
		},
	],
	build: {
		outDir: "dist/client",
		emptyOutDir: true,
	},
});
