# Quiz Live — Self-Hosted Real-Time Quiz Engine

A fast, beautiful, self-hosted Kahoot-style quiz game built with vanilla web technologies, Node.js, and WebSockets.
Zero third-party cloud accounts, no subscriptions, and no database required.

---

## 🚀 Quick Launch (macOS Native App)

Double-click **`Quiz Live.app`** on your Desktop or Applications folder:
- Starts the local server and Cloudflare tunnel silently in the background.
- Automatically opens the **Host Dashboard** in your default web browser.
- Displays an on-screen **QR Code** and public HTTPS link for players to join from any smartphone over 4G/5G or any Wi-Fi worldwide.

---

## 🎯 Key Features

- **Iconic Kahoot Shapes**: Red Triangle (▲), Blue Diamond (◆), Yellow Circle (●), Green Square (■).
- **Cute Character Avatars (DPs)**: 12 zero-dependency offline SVG characters (Cyber Bot, Astro Cat, Chill Dino, Party Penguin, etc.).
- **2x Double Points Multiplier**: High-voltage tiebreaker rounds with glowing multiplier badges and hype audio.
- **Mobile Haptic Feedback**: Tactile vibration triggers (`navigator.vibrate`) on option tap, correct answers, and podium finishes.
- **Mac Hard Drive Quiz Storage**: Saves quiz decks directly to your laptop as `.json` files (`saved_quizzes/`).
- **Session Analytics Dashboard**: Accuracy %, Hardest Question, Speed Demon award, and 1-click **Download CSV** scorecard.
- **Audio & Hype**: Procedural Web Audio ticking countdown, streak chimes, buzzers, and victory fanfare.
- **Zero-Dependency Vector QR Code**: Automatically encodes your public link for instant mobile join.

---

## 📁 Project Structure

```
Quiz Live.app/       # Native macOS application launcher with custom icon
bin/
  cloudflared        # Standalone Cloudflare tunnel binary for public HTTPS access
saved_quizzes/       # Hard drive JSON storage for your saved quiz decks
public/
  audio.js           # Web Audio API sound effects and fanfare
  avatars.js         # 12 cute SVG character avatar generators
  confetti.js        # Canvas celebration confetti
  host.html / .js    # Host presentation and quiz builder
  icons.js           # Vector SVG icons & Kahoot shapes
  index.html         # Landing screen
  player.html / .js  # Mobile player interface & haptics
  style.css          # Obsidian Dark theme and responsive layout
  vendor/qrcode.js   # Offline vector QR code generator
server.js            # Express + Socket.io backend and auto-tunnel manager
```

---

## 💻 Manual CLI Launch (Optional)

If running from terminal:

```bash
# Install dependencies
npm install

# Start local server
npm start
```

Open [http://localhost:3001/host.html](http://localhost:3001/host.html) on your laptop.
