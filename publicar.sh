#!/bin/bash
# Uploads the latest changes to GitHub and clears the jsDelivr cache so /academy shows them right away.
# Usage: ./publicar.sh "what changed"
set -euo pipefail
cd "$(dirname "$0")"

msg="${1:-Update Blue Sierra Academy}"
for f in academy-app.js academy-calls.js academy-content.js portal-app.js; do node --check "$f"; done

git add -A
if git diff --cached --quiet; then
  echo "Nothing new to upload."
else
  git commit -q -m "$msg"
  git push -q origin main
  echo "Uploaded: $msg"
fi

base="https://purge.jsdelivr.net/gh/planscope/bluesierra-academy@main"
for f in academy.css academy-content.js academy-calls.js academy-app.js portal.css portal-app.js; do
  status=$(curl -s -o /dev/null -w '%{http_code}' "$base/$f")
  echo "cache cleared $f ($status)"
done
