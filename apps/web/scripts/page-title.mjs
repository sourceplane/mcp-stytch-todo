// The page's <title> is the product's name (src/site.ts, SITE_NAME), set by
// vite.config.ts when it builds index.html. Escaped, because a name may carry
// `&`, `<` or quotes; and a page with no <title> to set is an error, so a
// change to index.html that drops it breaks the build, not the brand.
export function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function setTitle(html, name) {
  const re = /<title>[^<]*<\/title>/;
  if (!re.test(html)) throw new Error("index.html has no <title> to set to the product's name");
  return html.replace(re, `<title>${escapeHtml(name)}</title>`);
}
