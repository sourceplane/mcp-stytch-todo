import { defineConfig } from "vitest/config";
import * as path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${path.resolve(__dirname, "../../apps/web")}/` },
      // The Worker's `import { env } from "cloudflare:workers"` (api/TodoMCP.ts),
      // which only workerd provides: here a plain object the tests bind.
      { find: /^cloudflare:workers$/, replacement: path.resolve(__dirname, "src/cloudflare-workers.ts") },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
