#!/bin/bash

# Quiz Live — 1-Click Mac Launcher
# Starts local server and Cloudflare tunnel silently, then opens your browser.

DIR="/Users/sohan/anti/quizhost"
cd "$DIR" || exit 1

# 1. Start Node Server if not already running
if ! lsof -i :3001 > /dev/null 2>&1 && ! lsof -i :3000 > /dev/null 2>&1; then
  echo "Starting Quiz Live server..."
  nohup node server.js > server.log 2>&1 &
  sleep 1.5
fi

# 2. Start Cloudflare Tunnel if not already running
if ! pgrep -f "cloudflared tunnel" > /dev/null 2>&1; then
  echo "Starting Cloudflare tunnel..."
  rm -f tunnel.log tunnel.url
  nohup ./bin/cloudflared tunnel --url http://localhost:3001 > tunnel.log 2>&1 &
fi

# 3. Wait up to 5 seconds to capture the public URL
TUNNEL_URL=""
for i in {1..10}; do
  if [ -f tunnel.url ]; then
    TUNNEL_URL=$(cat tunnel.url | tr -d ' \n\r')
    if [[ "$TUNNEL_URL" == http* ]]; then
      break
    fi
  fi
  if [ -f tunnel.log ]; then
    DETECTED=$(grep -o "https://[a-zA-Z0-9-]*\.trycloudflare\.com" tunnel.log | head -n 1)
    if [ -n "$DETECTED" ]; then
      TUNNEL_URL="$DETECTED"
      echo "$TUNNEL_URL" > tunnel.url
      break
    fi
  fi
  sleep 0.5
done

# 4. Open default web browser directly to the Host page
if [ -n "$TUNNEL_URL" ]; then
  open "$TUNNEL_URL/host.html"
else
  open "http://localhost:3001/host.html"
fi

# 5. Display native macOS notification
osascript -e 'display notification "Host dashboard opened in browser! Ready for participants." with title "Quiz Live"' > /dev/null 2>&1 &

exit 0
