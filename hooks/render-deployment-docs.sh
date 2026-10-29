#!/usr/bin/env bash
# Render the site's LIVE-DEPLOYMENT documentation from verified state.
# Called by phase 02-docs as a `run:` hook (and safe to run by hand, from the
# site's checkout). Idempotent: the generated file and the README section are
# fully re-rendered on every run, so re-running after a redeploy or a custom
# domain refreshes them.
#
#   hooks/render-deployment-docs.sh <out> <workspace> <baseline-dir>
#
# What it writes (in <out>):
#   ai/context/deployment.md   — REGENERATED: URLs with live probe results (and
#                                whether each Worker answered from its KV
#                                namespace, and whether Stytch is connected),
#                                identity, the KV wiring, and the secrets the
#                                deployment uses BY NAME
#   ai/context/operations.md   — healed from the baseline's copy if absent
#                                (the static operating contract; never rewritten)
#   README.md                  — the section between <!-- 02-docs:begin/end -->
#                                is replaced (appended after the title if the
#                                README predates the markers)
#
# No secret VALUE is ever read or written here — secrets are named, not read.
#
# IT ASKS THE PLATFORM NOTHING. The record used to carry the workspace's slug,
# its secrets listed per rung and its integrations — five CLI calls, one after
# another, from the build box — and all of it is what the console shows live
# and this file could only show as it was the day it was written. The record
# keeps what the repository is the right place for: the identity the code
# names, what answered at the URLs, and where to look for the rest.
set -euo pipefail

out="${1:?usage: render-deployment-docs.sh <out> <workspace> <baseline-dir>}"
ws="${2:-}"
L="${3:?usage: render-deployment-docs.sh <out> <workspace> <baseline-dir>}"

cd "$out"
vals=".rebrand/values.json"
[ -f "$vals" ] || { echo "render-docs: $vals missing — is this a scaffolded site?" >&2; exit 1; }
val() { python3 -c "import json,sys;print(json.load(open('$vals')).get(sys.argv[1],'') or '')" "$1"; }

repo="$(val reponame)"
brand="$(val brandSlug)"; [ -n "$brand" ] || brand="$repo"
sub="$(val subdomain)"; [ -n "$sub" ] || sub="your-workers-subdomain"
[ -n "$ws" ] || ws="$(sed -n 's/^[[:space:]]*workspace:[[:space:]]*\([^[:space:]#]*\).*/\1/p' intent.yaml | head -1)"
[ -n "$ws" ] || ws="?"

# CI lane pin (what version the deploy lanes run).
lanepin="$(sed -n 's/^ *version: *\(v[0-9.]*\) *$/\1/p' .github/workflows/ci.yml 2>/dev/null | head -1)"
[ -n "$lanepin" ] || lanepin="?"

# The page answers at /, and /api/health — the Worker's own route, ahead of
# the API and the MCP server — answers `"ok":true` only after reading a key
# of its KV namespace through the binding (an unbound or unreachable
# namespace is a 503), saying whether Stytch is connected. So a page that
# answers beside that health is a Worker that reached its namespace; nothing
# is written to find out. curl emits the -w format even on connection failure
# (000) — capture, don't append, or a failed probe reads "000000".
probe() { # BASE-URL → "<code> <connected|unconnected|no-kv>"
  local body code health
  body="$(mktemp)"
  code="$(curl -s -o "$body" -w '%{http_code}' --max-time 20 "$1/" 2>/dev/null)" || true
  health="$(curl -s --max-time 20 "$1/api/health" 2>/dev/null)" || true
  case "$health" in
    *'"ok":true'*'"stytch":"connected"'*) printf '%s connected' "${code:-000}" ;;
    *'"ok":true'*) printf '%s unconnected' "${code:-000}" ;;
    *) printf '%s no-kv' "${code:-000}" ;;
  esac
  rm -f "$body"
}
badge() { # "<code> <connected|unconnected|no-kv>"
  local code="${1%% *}" mode="${1#* }"
  case "$code" in
    2*) case "$mode" in
          unconnected) echo "LIVE ($code) — the Worker reads its KV namespace; Stytch not connected yet (README, \"Connecting Stytch\")" ;;
          connected) echo "LIVE ($code) — the Worker reads its KV namespace; Stytch connected" ;;
          *) echo "answering $code, the namespace did not answer" ;;
        esac ;;
    3*) echo "LIVE ($code)" ;;
    000) echo "unreachable" ;;
    *) echo "answering $code" ;;
  esac
}

# The MCP server's front door, read-only: /mcp with no token must be the 401
# whose WWW-Authenticate names the protected-resource metadata, connected or
# not — what an MCP client is sent to Stytch from.
mcp_badge() { # BASE-URL
  local headers
  headers="$(curl -s -o /dev/null -D - -X POST --max-time 20 "$1/mcp" 2>/dev/null)" || true
  if printf '%s' "$headers" | grep -q '^HTTP/[0-9.]* 401' \
     && printf '%s' "$headers" | grep -qi '^www-authenticate: Bearer .*resource_metadata='; then
    echo "LIVE (401) — asks for a token and names its metadata"
  elif [ -z "$headers" ]; then
    echo "unreachable"
  else
    echo "answering, but not as the MCP server"
  fi
}

stage_url="https://${brand}-web-stage.${sub}.workers.dev"
prod_url="https://${brand}-web-prod.${sub}.workers.dev"
rows=""
for pair in "stage|$stage_url" "prod|$prod_url"; do
  env="${pair%%|*}"; url="${pair#*|}"
  rows+="| app (${env}) | ${url} | $(badge "$(probe "$url")") |"$'\n'
  rows+="| MCP server (${env}) | ${url}/mcp | $(mcp_badge "$url") |"$'\n'
done

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Heal the static operating contract when the site predates it.
mkdir -p ai/context
if [ ! -f ai/context/operations.md ] && [ -f "$L/ai/context/operations.md" ]; then
  cp "$L/ai/context/operations.md" ai/context/operations.md
  git add ai/context/operations.md 2>/dev/null || true
  node "$L/tooling/rebrand/rebrand.mjs" --values "$vals" --allow-dirty >/dev/null 2>&1 || true
  echo "render-docs: healed ai/context/operations.md"
fi

cat > ai/context/deployment.md <<EOF
# ${repo} — live deployment manifest

> GENERATED by the \`02-docs\` phase on ${now}; re-run it to refresh
> (idempotent; see [operations.md](operations.md)). Hand-edits here are
> overwritten. No secret values appear in this file — secrets are named only.

## Identity

| | |
|---|---|
| repository / project slug | \`${repo}\` |
| Orun workspace | \`${ws}\` |
| declared in | \`intent.yaml\` → \`execution.state.workspace\` |
| Workers | \`${brand}-web-stage\`, \`${brand}-web-prod\` on \`${sub}.workers.dev\` |
| KV namespaces | \`stg-${repo}-app-kv-stage\`, \`prod-${repo}-app-kv-prod\` (\`infra/terraform/cloudflare-kv\`); their ids reach the Workers as \`WIRING_CLOUDFLARE_KV\` on each environment |
| CI lane CLI pin | orun \`${lanepin}\` (\`.github/workflows/ci.yml\`) |

## Public URLs (probed ${now})

| surface | URL | status |
|---|---|---|
${rows}
The \`dev\` environment is verify-only by design — no deployed URL and no
namespace.

## Secrets (names only)

| secret | where | what it is |
|---|---|---|
| \`CLOUDFLARE_API_TOKEN\` | the workspace | BROKERED from its Cloudflare connection (\`workers-deploy\`): applies the KV namespaces and deploys the Workers |
| \`CLOUDFLARE_ACCOUNT_ID\` | the workspace | the connection's account id — a fact, not a credential |
| \`WIRING_CLOUDFLARE_KV\` | \`${repo}\` on stage and on prod | written by the KV root's apply: the namespace's id and title, not a credential |
| \`STYTCH_PROJECT_ID\`, \`STYTCH_DOMAIN\` | \`${repo}\` on stage and on prod, when set | OPTIONAL: the Stytch project the Worker checks tokens against, pushed to it as Worker secrets on deploy; without both every caller is refused (README, "Connecting Stytch") |
| \`STYTCH_PUBLIC_TOKEN\` | \`${repo}\` on stage and on prod, when set | OPTIONAL: Stytch's front-end token, compiled into the page with \`STYTCH_DOMAIN\` — public by Stytch's design |

Brokered secrets are minted per run, so no long-lived value is at rest. The
running Workers hold no storage credential: they reach their namespaces
through the \`TODOS\` binding. What the workspace holds right now (every secret by
name, and its integrations and their health) is on the console's Secrets and
Integrations pages for \`${ws}\`.

## How this deployment changes

Merges to \`main\` converge automatically: CI plans the changed components and
runs each lane with \`orun run --remote-state\` against the workspace above —
the KV namespace first, then the app. See [operations.md](operations.md) for
the full operating contract.
EOF
echo "render-docs: wrote ai/context/deployment.md"

python3 - <<'PY'
import re
begin, end = "<!-- 02-docs:begin -->", "<!-- 02-docs:end -->"
body = f"""{begin}
This site is **live**. Verified URLs, identity and the secrets it uses are
recorded in [ai/context/deployment.md](ai/context/deployment.md) (re-rendered
by the `02-docs` phase); how it deploys and how to operate it:
[ai/context/operations.md](ai/context/operations.md).
{end}"""
s = open("README.md").read()
if begin in s and end in s:
    s = re.sub(re.escape(begin) + r".*?" + re.escape(end), lambda _m: body, s, count=1, flags=re.S)
else:
    lines = s.splitlines(keepends=True)
    at = 1
    while at < len(lines) and lines[at].strip() == "":
        at += 1
    lines.insert(at, f"\n## Live deployment\n\n{body}\n")
    s = "".join(lines)
open("README.md", "w").write(s)
print("render-docs: README live-deployment section rendered")
PY
echo "render-docs: done"
