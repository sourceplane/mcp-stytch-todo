#!/usr/bin/env node
// `pnpm dev`: the front end rebuilt on every save (`vite build --watch`, into
// dist/client) and the Worker served over it by `wrangler dev` on port 3000
// (wrangler.jsonc's `dev.port`), which reloads both. One origin, as upstream's
// `npm run dev` gives: the page at http://localhost:3000, the MCP server at
// http://localhost:3000/mcp. Stytch's values: .env.local (the page's) and
// .dev.vars (the Worker's) — README, "Connecting Stytch".
import { spawn, spawnSync } from "node:child_process";

const first = spawnSync("pnpm", ["exec", "vite", "build"], { stdio: "inherit" });
if (first.status !== 0) process.exit(first.status ?? 1);

const children = [
  spawn("pnpm", ["exec", "vite", "build", "--watch", "--logLevel", "warn"], { stdio: "inherit" }),
  spawn("pnpm", ["exec", "wrangler", "dev", ...process.argv.slice(2)], { stdio: "inherit" }),
];
const stop = (code) => {
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  process.exit(code);
};
for (const child of children) child.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
