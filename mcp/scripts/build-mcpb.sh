#!/usr/bin/env bash
# Build a Smithery/Claude .mcpb bundle from the Mirai stdio server.
# Does not publish. Does not include src/, .env, node_modules, or credentials.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
STAGE="$ROOT/.mcpb-build"
OUT_DIR="$ROOT/dist-mcpb"
OUT="$OUT_DIR/mirai-mcp-${VERSION}.mcpb"
MANIFEST="$ROOT/manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "error: missing $MANIFEST" >&2
  exit 1
fi

node --input-type=module <<'EOF'
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const cfg = manifest.user_config ?? {};
const key = cfg.MIRAI_API_KEY;
const base = cfg.MIRAI_BASE_URL;
const env = manifest.server?.mcp_config?.env ?? {};

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

if (!key || key.required === true) {
  fail("user_config.MIRAI_API_KEY must be optional for guest discovery");
}
if ("default" in key) {
  fail("MIRAI_API_KEY must be declared by name only (no default)");
}
if (!base || base.required === true) {
  fail("user_config.MIRAI_BASE_URL must be optional");
}
if ("default" in base) {
  fail("MIRAI_BASE_URL must be declared by name only (no default)");
}
if (env.MIRAI_API_KEY !== "${user_config.MIRAI_API_KEY}") {
  fail("mcp_config.env.MIRAI_API_KEY must map from user_config by name");
}
if (env.MIRAI_BASE_URL !== "${user_config.MIRAI_BASE_URL}") {
  fail("mcp_config.env.MIRAI_BASE_URL must map from user_config by name");
}

const blob = JSON.stringify(manifest);
if (/sk_live_|sk_test_|sec_[A-Za-z0-9]{16}|AKIA[0-9A-Z]{16}/.test(blob)) {
  fail("manifest looks like it contains a credential value");
}
console.log("manifest: MIRAI_API_KEY optional, MIRAI_BASE_URL optional, names only");
EOF

rm -rf "$STAGE"
mkdir -p "$STAGE/server" "$OUT_DIR"

ESBUILD=""
if [[ -x "$ROOT/node_modules/.bin/esbuild" ]]; then
  ESBUILD="$ROOT/node_modules/.bin/esbuild"
elif [[ -x "$ROOT/node_modules/esbuild/bin/esbuild" ]]; then
  ESBUILD="$ROOT/node_modules/esbuild/bin/esbuild"
else
  ESBUILD="$(node -e "try { console.log(require.resolve('esbuild/bin/esbuild')) } catch { process.exit(1) }" 2>/dev/null || true)"
fi

if [[ -z "${ESBUILD}" || ! -x "${ESBUILD}" ]]; then
  echo "error: esbuild not found. Run npm install in mcp first." >&2
  exit 1
fi

"$ESBUILD" src/index.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --legal-comments=none \
  --outfile="$STAGE/server/index.js"

cp "$MANIFEST" "$STAGE/manifest.json"
cp "$ROOT/LICENSE" "$STAGE/LICENSE"
cp "$ROOT/README.md" "$STAGE/README.md"
cat > "$STAGE/package.json" <<EOF
{
  "name": "mirai-mcp",
  "version": "$VERSION",
  "private": true,
  "type": "module"
}
EOF

node "$ROOT/scripts/mcpb-smoke.mjs" "$STAGE/server/index.js"

PACKED=0
if command -v npx >/dev/null 2>&1; then
  if npx --yes @anthropic-ai/mcpb validate "$STAGE/manifest.json" \
    && npx --yes @anthropic-ai/mcpb pack "$STAGE" "$OUT"; then
    PACKED=1
  else
    echo "warning: mcpb CLI validate/pack failed, falling back to zip" >&2
  fi
fi

if [[ "$PACKED" -eq 0 ]]; then
  rm -f "$OUT"
  (cd "$STAGE" && zip -X -r -9 "$OUT" .)
fi

python3 - "$OUT" <<'PY'
import re
import sys
import zipfile

path = sys.argv[1]
forbidden = re.compile(
    r'(^|/)(\.env($|\.)|node_modules(/|$)|src(/|$)|\.credentials(/|$))',
    re.IGNORECASE,
)
secret = re.compile(
    rb'sk_live_|sk_test_|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY',
)

with zipfile.ZipFile(path) as zf:
    names = zf.namelist()
    print("bundle files:")
    for name in sorted(names):
        print(f"  {name}")
        if forbidden.search(name.replace("\\", "/")):
            sys.exit(f"error: forbidden path in bundle: {name}")
        data = zf.read(name)
        if secret.search(data):
            sys.exit(f"error: possible credential bytes in {name}")

required = {"manifest.json", "package.json", "server/index.js", "LICENSE", "README.md"}
missing = required - set(n.rstrip("/") for n in names)
if missing:
    sys.exit(f"error: bundle missing {sorted(missing)}")

if any(n.rstrip("/").endswith("src") or "/src/" in n.replace("\\", "/") for n in names):
    sys.exit("error: TypeScript src/ must not ship in the bundle")

print("bundle check: no .env, no node_modules, no src/, no credential bytes")
PY

echo "wrote $OUT"
echo "submit this file on Smithery. Do not npm publish it from this script."
