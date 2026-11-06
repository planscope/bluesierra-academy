#!/bin/bash
# Uploads the latest changes to GitHub and GitHub Pages publishes them for /academy and /portal (about 10 minutes).
# Usage: ./publicar.sh "what changed"
set -euo pipefail
cd "$(dirname "$0")"

msg="${1:-Update Blue Sierra Academy}"
for f in academy-app.js academy-phone.js academy-workspace.js academy-content.js portal-app.js; do node --check "$f"; done

git add -A
if ! git diff --cached --quiet; then git commit -q -m "$msg"; fi
git fetch -q origin main
if [ -n "$(git log origin/main..HEAD --oneline)" ]; then
  git push -q origin main
  echo "Uploaded: $(git log -1 --format=%s)"
else
  echo "Nothing new to upload."
fi

echo "GitHub Pages updates the live files within about 10 minutes."
