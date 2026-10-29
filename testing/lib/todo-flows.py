#!/usr/bin/env python3
"""What the app promises, read off a served Worker (testing/e2e.test.sh).

  todo-flows.py unconnected <url> <values.json> <dist-dir>
  todo-flows.py connected   <url> <values.json> <dist-dir> <stytch-domain> <public-token>

`unconnected` is a fresh product, no Stytch project stored: the page (its
<title> the product's name) and its single-page routes from Static Assets,
its entry script saying how to connect Stytch and carrying no Stytch SDK
(that is in the lazily imported app chunk, which the entry only names); the
health route saying so; the OAuth protected-resource metadata naming no
authorization server; the MCP server's 401 naming that metadata, with no
token and with one; the todo API refusing every call; a missing asset the
page (upstream's single-page-application fallback), never a script.

`connected` is the same Worker with STYTCH_PROJECT_ID and STYTCH_DOMAIN as
its secrets and a page built with the public token: the health route says
connected, the metadata names the Stytch domain, the page's app chunk carries
the public token and the domain (public by Stytch's design) while the entry
script still loads no SDK until it renders the app, and every token that
Stytch did not sign — here, all of them — is refused.

stdlib only: urllib. Nothing is written to the namespace by any request it
makes (every write is refused).
"""
import html, json, pathlib, re, sys, urllib.error, urllib.request

mode, base, values, dist = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3])), pathlib.Path(sys.argv[4])
name = values["productname"]
problems = []
def bad(m): problems.append(m)

def req(path, method="GET", body=None, headers=None):
    r = urllib.request.Request(base + path, data=body, method=method, headers=dict(headers or {}))
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.headers, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()

def j(b):
    try:
        return json.loads(b or b"null")
    except ValueError:
        return None

METADATA = f"{base}/.well-known/oauth-protected-resource"
MCP_HEADERS = {"content-type": "application/json", "accept": "application/json, text/event-stream"}
INITIALIZE = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
    "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "e2e", "version": "1"}}}).encode()

def health(want):
    s, h, b = req("/api/health")
    body = j(b)
    if s != 200 or body != {"ok": True, "name": name, "kv": "TODOS", "stytch": want}:
        bad(f"/api/health answered {s} {b[:200]!r}, not ok/{name!r}/TODOS/{want!r}")
    if h.get("cache-control") != "no-store":
        bad(f"/api/health is cacheable ({h.get('cache-control')!r})")

def mcp_refuses(token=None):
    hdrs = dict(MCP_HEADERS)
    if token:
        hdrs["authorization"] = f"Bearer {token}"
    s, h, b = req("/mcp", "POST", INITIALIZE, hdrs)
    if s != 401:
        bad(f"/mcp {'with a token' if token else 'with no token'} answered {s} {b[:120]!r}, not 401")
    if not token:
        www = h.get("www-authenticate") or ""
        if not www.startswith("Bearer ") or f'resource_metadata="{METADATA}"' not in www:
            bad(f"/mcp's 401 does not name its protected-resource metadata: {www!r}")

def api_refuses():
    for method, path, body in (("GET", "/api/todos", None), ("POST", "/api/todos", b'{"todoText":"e2e"}'),
                               ("POST", "/api/todos/1/complete", None), ("DELETE", "/api/todos/1", None)):
        s, _, b = req(path, method, body, {"content-type": "application/json",
                                          "cookie": "stytch_session_jwt=eyJhbGciOiJSUzI1NiJ9.e30.c2ln"})
        if s != 401:
            bad(f"{method} {path} with a forged session answered {s} {b[:120]!r}, not 401")

def page():
    """The page from Static Assets, named; returns its entry script's text."""
    s, h, b = req("/")
    text = b.decode(errors="replace")
    title = re.search(r"<title>(.*?)</title>", text, re.S)
    if s != 200 or 'id="root"' not in text:
        bad(f"/ answered {s} without the app's mount point")
    if not title or html.unescape(title.group(1)) != name:
        bad(f"the page's <title> is {title and title.group(1)!r}, not {name!r}")
    if "MCP Todos" in text or "TODO MCP Server" in text:
        bad("the page still carries the baseline's or upstream's name as its title")
    for route in ("/todoapp", "/login", "/authenticate", "/oauth/authorize"):
        s, _, b = req(route, headers={"sec-fetch-mode": "navigate", "accept": "text/html"})
        if s != 200 or 'id="root"' not in b.decode(errors="replace"):
            bad(f"a navigation to {route} answered {s} without the page (single-page-application fallback)")
    entry = re.search(r'<script type="module"[^>]*src="(/assets/[^"]+\.js)"', text)
    if not entry:
        bad("the page names no entry script")
        return ""
    s, h, b = req(entry.group(1))
    if s != 200 or "javascript" not in (h.get("content-type") or ""):
        bad(f"the entry script {entry.group(1)} answered {s} {h.get('content-type')}")
    # Upstream's asset settings: the Worker runs first and hands the rest to
    # Static Assets with single-page-application fallback, so a path with no
    # file — a missing chunk included — is the page, never a script.
    s, h, b2 = req("/assets/no-such-chunk.js")
    if s != 200 or 'id="root"' not in b2.decode(errors="replace") or "javascript" in (h.get("content-type") or ""):
        bad(f"a missing asset answered {s} {h.get('content-type')}, not the page (single-page-application fallback)")
    return b.decode(errors="replace")

def app_chunk():
    """The lazily imported app: the one built chunk that carries Stytch's SDK."""
    chunks = [p for p in (dist / "assets").glob("*.js") if "api.stytch.com" in p.read_text(errors="replace")]
    if len(chunks) != 1:
        bad(f"{len(chunks)} built chunks carry Stytch's SDK, not one (the app's, imported lazily)")
        return None
    return chunks[0]

if mode == "unconnected":
    health("connect Stytch")
    s, _, b = req("/.well-known/oauth-protected-resource")
    if s != 200 or j(b) != {"resource": base}:
        bad(f"the metadata answered {s} {b[:200]!r}, not {{'resource': {base!r}}} alone")
    mcp_refuses()
    mcp_refuses("eyJhbGciOiJSUzI1NiJ9.e30.c2ln")
    api_refuses()
    entry = page()
    if "Stytch is not connected yet" not in entry:
        bad("the entry script does not carry the connect-Stytch notice")
    if "api.stytch.com" in entry:
        bad("the entry script carries Stytch's SDK: an unconnected page would load it")
    chunk = app_chunk()
    if chunk and chunk.name not in entry:
        bad(f"the entry script does not import the app chunk {chunk.name} lazily")
    # A public token is `public-token-test-…` or `public-token-live-…`; the
    # SDK itself only spells the prefixes, in its own checks of the token.
    TOKEN = re.compile(r"public-token-(test|live)-[0-9A-Za-z]{8,}")
    if any(TOKEN.search(p.read_text(errors="replace")) for p in (dist / "assets").glob("*.js")):
        bad("a page built with no Stytch values carries a public token")
elif mode == "connected":
    domain, token = sys.argv[5], sys.argv[6]
    health("connected")
    s, _, b = req("/.well-known/oauth-protected-resource")
    if s != 200 or j(b) != {"resource": base, "authorization_servers": [f"https://{domain}"]}:
        bad(f"the metadata answered {s} {b[:200]!r}, not naming https://{domain}")
    mcp_refuses()
    mcp_refuses("eyJhbGciOiJSUzI1NiJ9.e30.c2ln")
    api_refuses()
    entry = page()
    if "api.stytch.com" in entry:
        bad("the entry script carries Stytch's SDK: it must load with the app, not before")
    chunk = app_chunk()
    if chunk:
        text = chunk.read_text(errors="replace")
        if token not in text or domain not in text:
            bad(f"the app chunk does not carry the public token and the domain it was built with")
    for f in dist.rglob("*"):
        if f.is_file() and (chunk is None or f != chunk) and token in f.read_text(errors="replace"):
            bad(f"{f.relative_to(dist)} carries the public token — only the app chunk should")
else:
    sys.exit(f"unknown mode {mode}")

if problems:
    for p in problems:
        print(f"  ✕ {p}", file=sys.stderr)
    sys.exit(1)
print(f"   {mode}: every promise held")
