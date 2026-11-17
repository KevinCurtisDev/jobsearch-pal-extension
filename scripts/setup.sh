#!/usr/bin/env bash
# One-time setup for this project on Ubuntu/WSL. Safe to re-run.
#   bash scripts/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

case "$PWD" in
  /mnt/[a-z]/*) echo "⚠ This folder is on the Windows drive (/mnt/...). npm and git are much faster under ~/ (the Linux filesystem)." ;;
esac

need="$(node -p 'JSON.parse(require("fs").readFileSync(".nvmrc","utf8"))' 2>/dev/null || echo 24)"
have="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$have" -lt 22 ]; then
  echo "✖ Node $need is required (found ${have}). Install it with nvm: nvm install $need && nvm use $need"
  exit 1
fi

if [ -f package-lock.json ]; then
  echo "▶ npm ci (exact versions from package-lock.json)"
  npm ci
else
  echo "▶ npm install (creates package-lock.json: commit it)"
  npm install
fi

if [ ! -d .git ]; then
  echo "▶ git init"
  git init -q -b main
fi
git config core.hooksPath .githooks
chmod +x .githooks/* scripts/*.sh

echo "▶ npm run verify"
npm run verify

cat <<'MSG'

✔ Ready. Next steps:
  1. git add -A && git commit -m "chore: initial project from chrome-extension-factory"
  2. Load dist/ in Chrome: chrome://extensions → Developer mode → Load unpacked →
     \\wsl.localhost\Ubuntu<this folder's path>\dist   (run `pwd` to see the path)
  3. claude   (open Claude Code here, then run /plan-feature)
MSG
