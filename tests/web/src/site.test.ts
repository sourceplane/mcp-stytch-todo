import { describe, expect, it } from "vitest";
import { escapeHtml, setTitle } from "@/scripts/page-title.mjs";
import { SITE_NAME } from "@/src/site.ts";

// The page's <title> is the product's name (vite.config.ts → scripts/page-title.mjs).
describe("the page's title (apps/web/scripts/page-title.mjs)", () => {
  it("is the product's name", () => {
    const html = "<head><title>TODO MCP Server</title></head>";
    expect(setTitle(html, SITE_NAME)).toBe(`<head><title>${SITE_NAME}</title></head>`);
  });

  it("escapes a name that carries markup", () => {
    expect(setTitle("<title>x</title>", `Sam's <Todos> & "Lists"`)).toBe(
      "<title>Sam&#39;s &lt;Todos&gt; &amp; &quot;Lists&quot;</title>",
    );
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  it("fails a page with no <title> to set", () => {
    expect(() => setTitle("<head></head>", SITE_NAME)).toThrow(/no <title>/);
  });
});
