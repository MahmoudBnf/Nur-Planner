#!/usr/bin/env bash
# One-click start for Linux: installs if needed, builds if needed, starts the server.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it first: https://nodejs.org"
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run)..."
  npm install || exit 1
fi
if [ ! -f client/dist/index.html ] || [ -n "$(find client/src client/index.html shared -newer client/dist/index.html 2>/dev/null | head -1)" ]; then
  echo "Building the UI..."
  npm run build || exit 1
fi

# Open the browser shortly after the server starts.
( sleep 1.5; xdg-open "http://localhost:${PORT:-4000}" >/dev/null 2>&1 ) &
npm start
