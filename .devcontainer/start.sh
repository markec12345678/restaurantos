#!/bin/bash
# Start dev server in background
echo "[start] Starting RestaurantOS dev server..."
npm run dev &

# Wait for server to be ready
sleep 25
echo "[start] Waiting for compile..."

# Try to make port public using gh CLI (pre-installed in codespace)
if command -v gh &> /dev/null; then
  echo "[start] Making port 3000 public via gh CLI..."
  gh codespace ports visibility 3000:public -c "$CODESPACE_NAME" 2>/dev/null || true
fi

# Alternative: use curl to make port public via GitHub API
if [ -n "$GITHUB_TOKEN" ]; then
  echo "[start] Making port 3000 public via API..."
  curl -s -X PATCH \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/user/codespaces/$CODESPACE_NAME/ports/3000" \
    -d '{"visibility":"public"}' 2>/dev/null || true
fi

echo "[start] Done. Dev server should be running on port 3000."
