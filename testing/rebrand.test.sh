#!/usr/bin/env bash
# THE REBRAND WRITES EACH VALUE ONCE, AND WHAT IT WROTE STAYS WRITTEN.
#
# Drives the real tooling/rebrand/rebrand.mjs over one-file trees and compares
# the file. Each case is a shape this baseline's identity actually takes in the
# tree — the source link, the site-name seam, the worker name in the component
# and the wrangler config, the KV namespace titles and the terraform `repo`
# they are built from, the placeholder domain, a secret ref — and the
# survival cases run through three passes, so a value an earlier rebrand
# wrote (a re-run phase re-runs the rebrand over everything placed) comes
# out of every later one unchanged.
#
# The identity is PINNED (fixtures/baseline-identity.mcp-stytch-todo.json)
# rather than read from .baseline/identity.json: what this tests is the engine,
# and its fixtures spell the identity out literally.
#
# Needs: node, git. No network.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
rebrand="$here/../tooling/rebrand/rebrand.mjs"
identity="$here/fixtures/baseline-identity.mcp-stytch-todo.json"

fail=0
# check NAME VALUES-JSON FILE CONTENT WANT [PASSES]
check() {
  local name="$1" values="$2" file="$3" content="$4" want="$5" passes="${6:-1}"
  local tmp got out i
  tmp="$(mktemp -d)"
  git -C "$tmp" init -q
  mkdir -p "$tmp/$(dirname "$file")" "$tmp/.rebrand"
  printf '%s\n' "$content" > "$tmp/$file"
  printf '%s\n' "$values" > "$tmp/.rebrand/values.json"
  for ((i = 1; i <= passes; i++)); do
    git -C "$tmp" add -A
    if ! out="$(cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --values .rebrand/values.json --allow-dirty 2>&1)"; then
      echo "   ✕  $name: rebrand pass $i failed:" >&2
      printf '%s\n' "$out" | sed 's/^/        /' >&2
      fail=1
      rm -rf "$tmp"
      return
    fi
  done
  got="$(cat "$tmp/$file")"
  rm -rf "$tmp"
  if [ "$got" = "$want" ]; then
    echo "   ok  $name"
  else
    echo "   ✕  $name:" >&2
    echo "        got:  $got" >&2
    echo "        want: $want" >&2
    fail=1
  fi
}

acme='{"reponame":"acme-tasks","productname":"Acme Tasks","productdomain":"acme.dev","githuborg":"acme-inc","subdomain":"acme","orunWorkspace":"ws_79BDXAZQ"}'

echo "── rebrand: the product's own identity"
check "the source link names the product's owner and repository" \
  "$acme" README.md \
  'Source: https://github.com/sourceplane/mcp-stytch-todo' \
  'Source: https://github.com/acme-inc/acme-tasks'
check "the site-name seam takes the product's name" \
  "$acme" apps/web/src/site.ts 'export const SITE_NAME = "MCP Todos";' \
  'export const SITE_NAME = "Acme Tasks";'
check "…and stays a valid string for a name with an apostrophe and an ampersand" \
  '{"reponame":"sams-tasks","productname":"Sam'"'"'s Tasks & Agents","productdomain":"sam.dev"}' \
  apps/web/src/site.ts 'export const SITE_NAME = "MCP Todos";' \
  'export const SITE_NAME = "Sam'"'"'s Tasks & Agents";'
check "the display name elsewhere is content, and is left alone" \
  "$acme" apps/web/README.md 'MCP Todos, wherever it is not the seam, is prose.' \
  'MCP Todos, wherever it is not the seam, is prose.'
check "the worker name is re-prefixed, the environment suffix kept" \
  "$acme" apps/web/component.yaml 'workerName: mcp-stytch-todo-web' \
  'workerName: acme-tasks-web'
check "the wrangler config's worker name, template and render alike" \
  "$acme" apps/web/wrangler.template.jsonc '  "name": "mcp-stytch-todo-web",' \
  '  "name": "acme-tasks-web",'
check "the environment URLs: worker name and subdomain" \
  "$acme" intent.yaml '    url: https://mcp-stytch-todo-web-stage.your-workers-subdomain.workers.dev' \
  '    url: https://acme-tasks-web-stage.acme.workers.dev'
check "the KV root's terraform repo — every namespace title is built on it" \
  "$acme" infra/terraform/cloudflare-kv/terraform/main.tf '  default = "mcp-stytch-todo"' \
  '  default = "acme-tasks"'
check "the per-environment terraform repo parameter" \
  "$acme" intent.yaml '        repo: mcp-stytch-todo' \
  '        repo: acme-tasks'
check "a fixture's namespace title follows the same rule" \
  "$acme" apps/web/wiring.fixture.json '    "app_kv_title": "stg-mcp-stytch-todo-app-kv-stage"' \
  '    "app_kv_title": "stg-acme-tasks-app-kv-stage"'
check "the placeholder domain is the product's domain, not a renamed slug" \
  "$acme" intent.yaml '      BASE_DOMAIN: mcp-stytch-todo.example.com' \
  '      BASE_DOMAIN: acme.dev'
check "no domain given: the reserved placeholder, for an owner to replace later" \
  '{"reponame":"acme-tasks","productname":"Acme Tasks","githuborg":"acme-inc","subdomain":"acme"}' \
  intent.yaml '      BASE_DOMAIN: mcp-stytch-todo.example.com' \
  '      BASE_DOMAIN: acme-tasks.example.com'
check "an empty domain is no domain" \
  '{"reponame":"acme-tasks","productname":"Acme Tasks","productdomain":""}' \
  intent.yaml '      BASE_DOMAIN: mcp-stytch-todo.example.com' \
  '      BASE_DOMAIN: acme-tasks.example.com'
check "the repo slug" \
  "$acme" package.json '  "name": "mcp-stytch-todo",' \
  '  "name": "acme-tasks",'
check "a wiring secret ref names the product's workspace and project" \
  "$acme" apps/web/component.yaml \
  '    WIRING_CLOUDFLARE_KV_STAGE: "secret://mcp-stytch-todo/mcp-stytch-todo/stage/WIRING_CLOUDFLARE_KV"' \
  '    WIRING_CLOUDFLARE_KV_STAGE: "secret://ws_79BDXAZQ/acme-tasks/stage/WIRING_CLOUDFLARE_KV"'
check "the KV root's templated token ref too" \
  "$acme" infra/terraform/cloudflare-kv/component.yaml \
  '    CLOUDFLARE_API_TOKEN: "secret://mcp-stytch-todo/mcp-stytch-todo/{{ .environment }}/CLOUDFLARE_API_TOKEN"' \
  '    CLOUDFLARE_API_TOKEN: "secret://ws_79BDXAZQ/acme-tasks/{{ .environment }}/CLOUDFLARE_API_TOKEN"'
check "org-owned identity is not renamed" \
  "$acme" intent.yaml 'apiVersion: sourceplane.io/v1 # mail ops@sourceplane.ai' \
  'apiVersion: sourceplane.io/v1 # mail ops@sourceplane.ai'
check "without githuborg the source link keeps the baseline's owner" \
  '{"reponame":"acme-tasks","productname":"Acme Tasks","productdomain":"acme.dev"}' \
  README.md 'Source: https://github.com/sourceplane/mcp-stytch-todo' \
  'Source: https://github.com/sourceplane/acme-tasks'
check "the optional Stytch secrets name the product's workspace and project" \
  "$acme" apps/web/component.yaml \
  '    STYTCH_PROJECT_ID: "secret://mcp-stytch-todo/mcp-stytch-todo/{{ .environment }}/STYTCH_PROJECT_ID"' \
  '    STYTCH_PROJECT_ID: "secret://ws_79BDXAZQ/acme-tasks/{{ .environment }}/STYTCH_PROJECT_ID"'
check "the Worker the Stytch values are pushed to is the product's" \
  "$acme" apps/web/component.yaml \
  '    buildCommand: node ../../tooling/wire/worker-secrets.mjs --secret STYTCH_PROJECT_ID --secret STYTCH_DOMAIN --worker "mcp-stytch-todo-web-${ORUN_ENVIRONMENT}" --config wrangler.jsonc' \
  '    buildCommand: node ../../tooling/wire/worker-secrets.mjs --secret STYTCH_PROJECT_ID --secret STYTCH_DOMAIN --worker "acme-tasks-web-${ORUN_ENVIRONMENT}" --config wrangler.jsonc'

# THE UPSTREAM DEMO KEEPS ITS NAME. Stytch's mcp-stytch-consumer-todo-list,
# in cloudflare/ai and in Stytch's own repository: no rule matches it, and
# tooling/rebrand/rebrand.mjs UPSTREAM masks it so that none ever will.
echo "── rebrand: the upstream demo keeps its name"
check "the demo's directory in Cloudflare's AI demos" \
  "$acme" README.md 'https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list · mcp-stytch-todo' \
  'https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list · acme-tasks' 3
check "Stytch's copy of it" \
  "$acme" apps/web/README.md 'https://github.com/stytchauth/mcp-stytch-consumer-todo-list' \
  'https://github.com/stytchauth/mcp-stytch-consumer-todo-list' 3

echo "── rebrand: a written value is not rewritten, in any later pass"
contains='{"reponame":"mcp-stytch-todo-2","productname":"MCP Todos 2","productdomain":"mcp-stytch-todo.example.com.au","githuborg":"sourceplane","subdomain":"your-workers-subdomain-2"}'
check "a repo slug containing the baseline's slug survives three passes" \
  "$contains" package.json '  "name": "mcp-stytch-todo",' \
  '  "name": "mcp-stytch-todo-2",' 3
check "a worker name built on it survives three passes" \
  "$contains" apps/web/component.yaml 'workerName: mcp-stytch-todo-web' \
  'workerName: mcp-stytch-todo-2-web' 3
check "a namespace title built on it survives three passes" \
  "$contains" apps/web/wiring.fixture.json '"app_kv_title": "prod-mcp-stytch-todo-app-kv-prod"' \
  '"app_kv_title": "prod-mcp-stytch-todo-2-app-kv-prod"' 3
check "a domain containing the baseline's domain survives three passes" \
  "$contains" intent.yaml 'BASE_DOMAIN: mcp-stytch-todo.example.com' \
  'BASE_DOMAIN: mcp-stytch-todo.example.com.au' 3
check "a subdomain containing the placeholder survives three passes" \
  "$contains" apps/web/component.yaml 'workersDevSubdomain: your-workers-subdomain' \
  'workersDevSubdomain: your-workers-subdomain-2' 3
check "a site name containing the baseline's name survives three passes" \
  "$contains" apps/web/src/site.ts 'export const SITE_NAME = "MCP Todos";' \
  'export const SITE_NAME = "MCP Todos 2";' 3

# --verify runs in every phase. Without the product's values it cannot tell
# the product's own identity from a leftover; with them it can. A real
# leftover must fail it either way.
verify() { # NAME VALUES FILE CONTENT WANT(pass|fail) [--values]
  local name="$1" values="$2" file="$3" content="$4" want="$5" withvalues="${6:-}" tmp got
  tmp="$(mktemp -d)"
  git -C "$tmp" init -q
  mkdir -p "$tmp/$(dirname "$file")" "$tmp/.rebrand"
  printf '%s\n' "$content" > "$tmp/$file"
  printf '%s\n' "$values" > "$tmp/.rebrand/values.json"
  git -C "$tmp" add -A
  if (cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --verify ${withvalues:+--values .rebrand/values.json} >/dev/null 2>&1); then got=pass; else got=fail; fi
  rm -rf "$tmp"
  if [ "$got" = "$want" ]; then echo "   ok  $name"; else echo "   ✕  $name: --verify ${got}ed, want $want" >&2; fail=1; fi
}
echo "── rebrand --verify: the product's own identity is not residue"
verify "given the values, a slug containing the baseline's passes" \
  "$contains" package.json '"name": "mcp-stytch-todo-2"' pass --values
verify "without them it cannot know, and fails" \
  "$contains" package.json '"name": "mcp-stytch-todo-2"' fail
verify "given the values, a real leftover still fails" \
  "$acme" package.json '"name": "mcp-stytch-todo"' fail --values
verify "a leftover worker name fails" \
  "$acme" apps/web/wrangler.jsonc '"name": "mcp-stytch-todo-web",' fail --values
verify "a leftover namespace title fails" \
  "$acme" apps/web/wiring.fixture.json '"app_kv_title": "stg-mcp-stytch-todo-app-kv-stage"' fail --values
verify "a leftover code identifier fails (no rule renames it — so nothing may spell it)" \
  "$acme" apps/web/api/x.ts 'export class McpStytchTodo {}' fail --values
verify "the upstream demo's name is not residue" \
  "$acme" README.md 'Stytch'"'"'s mcp-stytch-consumer-todo-list demo' pass --values
verify "a clean product passes" \
  "$acme" package.json '"name": "acme-tasks"' pass --values

echo "── rebrand: a residue it cannot rename fails the rebrand itself"
tmp="$(mktemp -d)"; git -C "$tmp" init -q; mkdir -p "$tmp/.rebrand" "$tmp/apps/web"
printf '%s\n' "$acme" > "$tmp/.rebrand/values.json"
printf 'const x = "MCP_STYTCH_TODO_TOKEN"\n' > "$tmp/apps/web/x.ts"
git -C "$tmp" add -A
if (cd "$tmp" && node "$rebrand" --baseline-identity "$identity" --values .rebrand/values.json --allow-dirty >/dev/null 2>&1); then
  echo "   ✕  an unrenamable env-var prefix passed the rebrand" >&2; fail=1
else
  echo "   ok  an unrenamable env-var prefix fails the rebrand, naming the file"
fi
rm -rf "$tmp"

[ "$fail" -eq 0 ] || exit 1
echo "rebrand.test.sh: ok"
