#!/bin/bash
# Uploads the latest changes to GitHub and GitHub Pages publishes them for /academy and /portal (about 10 minutes).
# Usage: ./publicar.sh "what changed"
set -euo pipefail
cd "$(dirname "$0")"

msg="${1:-Update Blue Sierra Academy}"
for f in academy-app.js academy-phone.js academy-workspace.js academy-content.js portal-app.js; do node --check "$f"; done

git add -A
if git diff --cached --quiet; then
  echo "Nothing new to upload."
else
  git commit -q -m "$msg"
  git push -q origin main
  echo "Uploaded: $msg"
fi

echo "GitHub Pages updates the live files within about 10 minutes."
