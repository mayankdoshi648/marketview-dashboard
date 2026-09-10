#!/usr/bin/env bash
# One-time push of this repo to GitHub.
# Usage:  export GH_TOKEN=github_pat_xxx   (fine-grained PAT with "repo" scope)
#         ./push-to-github.sh <your-username> <repo-name, default: marketview-dashboard>
set -e
USER="${1:?GitHub username required}"; REPO="${2:-marketview-dashboard}"
GH="${GH:-gh}"   # point to a local gh binary if not on PATH

$GH auth status >/dev/null 2>&1 || $GH auth login --with-token <<< "$GH_TOKEN"

$GH repo create "$USER/$REPO" --public --source=. --remote=origin --push \
  && echo "✓ https://github.com/$USER/$REPO"

echo "Next: enable GitHub Pages → Settings → Pages → Deploy from branch → main /(root)"
