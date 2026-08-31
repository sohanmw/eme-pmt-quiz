# Quiz — a self-hosted Kahoot-style game

Live multiple-choice and true/false quizzes. One person hosts on a laptop or
projector, other people join from their phones using a PIN or a QR code, and
scores update in real time.

Everything here is open-source and runs on your own machine — there's no
account to create, no paid API, and no database. All game state lives in
memory while the server is running.

## What's in here

```
server.js          the whole backend (Express + Socket.io, one process)
public/
  index.html        landing page (host or join)
  host.html/.js      quiz builder + the screen you present
  player.html/.js    the screen each player uses on their phone
  vendor/qrcode.js   QR code generator, vendored locally (no CDN call)
  style.css          shared look and feel
```

## 1. Install (one-time)

You need [Node.js](https://nodejs.org) installed (any recent LTS version).
Then, in this folder:

```bash
npm install
```

That downloads two small libraries — Express (serves the pages) and
Socket.io (keeps host and players in sync in real time) — onto your own
computer. Nothing is called over the network again after this step.

## 2. Run it

```bash
npm start
```

You'll see something like:

```
Quiz server running.
  On this computer: http://localhost:3000
  On your network:  http://192.168.1.42:3000
```

- Open `http://localhost:3000/host.html` on the computer you're presenting
  from (or just `http://localhost:3000` and click "Go to host screen").
- Build your quiz (or import a saved `quiz.json`) and click **Create game**.
  You'll get a 6-digit PIN and a QR code.
- Everyone else opens the **network** address shown above on their own
  phone (or scans the QR code, which encodes it automatically) and enters
  the PIN plus a nickname.

## Two ways people can "join online"

**A. Same Wi-Fi / office network (simplest, truly zero third parties)**
If everyone is on the same network as the host computer — same office
Wi-Fi, same home network — they just open the `http://192.168.x.x:3000`
address printed in the terminal, or scan the QR code. No internet access
is needed at all, nothing leaves the building. This is the setup the app
is configured for out of the box.

**B. Players anywhere on the internet**
If people need to join from outside your network (different locations,
mobile data), the server needs a public address. The code doesn't change —
only where you run it. You have two free options:
1. **Deploy it yourself** on a free tier of a host like Render, Railway, or
   Fly.io. You'd push these same files there and they run `npm start` for
   you, exactly like on your laptop. These aren't quiz platforms — they're
   general-purpose computers-for-rent, the same category of thing as
   renting a server, and the free tiers don't require a credit card on the
   ones listed. This is still *your* app; nobody else is involved in what
   it does.
2. **Run it on your own computer and open one port** on your router
   (port-forward 3000), then share your public IP. More setup, but keeps
   everything on hardware you own.

If you only ever need option A, you can ignore this section entirely —
just run `npm start` and share the network address.

## How the game works

- **Scoring**: correct answers earn 500–1000 points depending on how fast
  you answer (faster = more points, like Kahoot). Wrong or missed answers
  score 0.
- **Question types**: multiple choice (4 options, shape + color coded) and
  true/false.
- **Flow**: host builds questions → creates game → players join the lobby →
  host starts → each question is shown with a countdown → results and a
  live leaderboard appear after everyone answers (or time runs out) → host
  moves to the next question → final podium at the end.
- **Import/export**: on the quiz-builder screen you can export your
  questions to a `quiz.json` file and import it again later, so you don't
  have to retype a quiz each time (there's no server-side storage).

## Notes and easy extensions

- Restarting the server clears all games — there's no database. If you
  want quizzes and results to persist between runs, the natural next step
  is swapping the in-memory `games` object in `server.js` for a small
  embedded database like SQLite (still free, still no external service).
- The 6-digit PIN is regenerated per game and only exists while that game
  is running.
- Nicknames must be unique within a single game (server enforces this).
- Everything is plain HTML/CSS/JS on the front end — no build step, no
  framework, so it's easy to reskin in `style.css` if you want your own
  branding.
