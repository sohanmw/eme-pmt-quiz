// server.js
// A self-hosted, dependency-light real-time quiz engine (Kahoot-style).
// Features: 2x Double Points, Session Analytics, Saved Library, Avatars, Reconnects, and Sound integration.

const express = require('express');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

let currentPort = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: '10mb' }));

// Forward all admin / presenter endpoints directly to host.html
app.get(['/admin', '/admin.html', '/presenter', '/presenter.html', '/host'], (req, res) => {
  res.redirect('/host.html');
});

// ---------------------------------------------------------------------
// Host Authentication REST API
// ---------------------------------------------------------------------
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@quizlive.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const VALID_AUTH_TOKENS = new Set();

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === ADMIN_EMAIL && String(password).trim() === ADMIN_PASSWORD) {
      const token = 'token_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      VALID_AUTH_TOKENS.add(token);
      return res.json({ ok: true, token, email: ADMIN_EMAIL });
    }

    return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/auth/verify', (req, res) => {
  try {
    const { token } = req.body || {};
    if (token && VALID_AUTH_TOKENS.has(token)) {
      return res.json({ ok: true, email: ADMIN_EMAIL });
    }
    return res.json({ ok: false });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use(express.static('public'));

const QUIZZES_DIR = path.join(__dirname, 'saved_quizzes');
if (!fs.existsSync(QUIZZES_DIR)) {
  fs.mkdirSync(QUIZZES_DIR, { recursive: true });
}

// ---------------------------------------------------------------------
// Laptop Hard Drive Quiz Storage REST API
// ---------------------------------------------------------------------
app.get('/api/quizzes', (req, res) => {
  try {
    const files = fs.readdirSync(QUIZZES_DIR).filter((f) => f.endsWith('.json'));
    const list = files.map((file) => {
      try {
        const content = fs.readFileSync(path.join(QUIZZES_DIR, file), 'utf8');
        return JSON.parse(content);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    // Sort newest first
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json({ ok: true, quizzes: list });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/quizzes', (req, res) => {
  try {
    const { id, title, questions } = req.body;
    if (!title || !Array.isArray(questions)) {
      return res.status(400).json({ ok: false, error: 'Invalid quiz payload' });
    }
    const safeId = (id || `quiz_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const quizData = {
      id: safeId,
      title: title.trim(),
      questions,
      questionCount: questions.length,
      updatedAt: Date.now(),
      dateStr: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
    const filePath = path.join(QUIZZES_DIR, `${safeId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(quizData, null, 2), 'utf8');
    res.json({ ok: true, quiz: quizData });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/quizzes/:id', (req, res) => {
  try {
    const safeId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(QUIZZES_DIR, `${safeId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Tunnel URL status detection
let activeTunnelUrl = null;
let cloudflareProcess = null;

function startCloudflareTunnel(port) {
  const binaryPath = path.join(__dirname, 'bin', 'cloudflared');
  if (!fs.existsSync(binaryPath)) return;
  if (cloudflareProcess) return;

  console.log('Automatically launching Cloudflare Tunnel in background...');
  const logFile = path.join(__dirname, 'tunnel.log');
  const urlFile = path.join(__dirname, 'tunnel.url');

  try {
    const out = fs.openSync(logFile, 'w');
    cloudflareProcess = require('child_process').spawn(
      binaryPath,
      ['tunnel', '--url', `http://localhost:${port}`],
      { detached: false, stdio: ['ignore', out, out] }
    );

    cloudflareProcess.on('exit', (code) => {
      console.log(`Cloudflare tunnel process exited with code ${code}`);
      cloudflareProcess = null;
      activeTunnelUrl = null;
    });

    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        const match = content.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match) {
          activeTunnelUrl = match[0];
          fs.writeFileSync(urlFile, activeTunnelUrl, 'utf8');
          console.log(`\n🎉 Live Public Cloudflare Tunnel: ${activeTunnelUrl}\n`);
          clearInterval(poll);
        }
      }
      if (attempts > 25) clearInterval(poll);
    }, 1000);
  } catch (err) {
    console.error('Failed to spawn Cloudflare tunnel:', err);
  }
}

app.get('/api/tunnel-status', (req, res) => {
  try {
    if (activeTunnelUrl) {
      return res.json({ ok: true, active: true, url: activeTunnelUrl });
    }
    const urlFile = path.join(__dirname, 'tunnel.url');
    if (fs.existsSync(urlFile)) {
      const url = fs.readFileSync(urlFile, 'utf8').trim();
      if (url.startsWith('http')) {
        activeTunnelUrl = url;
        return res.json({ ok: true, active: true, url });
      }
    }
    const logFile = path.join(__dirname, 'tunnel.log');
    if (fs.existsSync(logFile)) {
      const logContent = fs.readFileSync(logFile, 'utf8');
      const match = logContent.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match) {
        activeTunnelUrl = match[0];
        fs.writeFileSync(urlFile, activeTunnelUrl, 'utf8');
        return res.json({ ok: true, active: true, url: activeTunnelUrl });
      }
    }
    res.json({ ok: true, active: false, url: null });
  } catch (e) {
    res.json({ ok: true, active: false, url: null });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// ---------------------------------------------------------------------
// In-memory game state
// ---------------------------------------------------------------------
const games = {};

function generatePin() {
  let pin;
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (games[pin]);
  return pin;
}

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) results.push(net.address);
    }
  }
  return results;
}

function publicPlayerList(game) {
  return Object.values(game.players).map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar || 'cyber_bot',
    score: p.score,
    streak: p.streak || 0,
    maxStreak: p.maxStreak || 0,
    lastMsTaken: p.lastMsTaken || null,
    totalResponseMs: p.totalResponseMs || 0,
    connected: p.connected !== false,
  }));
}

function leaderboard(game) {
  return publicPlayerList(game).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.totalResponseMs || 0) - (b.totalResponseMs || 0); // Tie-breaker by faster overall reflexes
  });
}

function currentQuestion(game) {
  return game.questions[game.currentIndex];
}

function currentQuestionPayload(game) {
  const q = currentQuestion(game);
  if (!q) return null;
  const activePlayers = Object.values(game.players).filter((p) => p.connected !== false);
  return {
    index: game.currentIndex,
    total: game.questions.length,
    type: q.type,
    text: q.text,
    image: q.image || null,
    isDoublePoints: !!q.isDoublePoints,
    options: q.options.map((o) => o.text),
    limitMs: game.remainingMs !== undefined ? game.remainingMs : q.limitMs,
    totalLimitMs: game.totalLimitMs || q.limitMs,
    timerPaused: !!game.timerPaused,
    playerCount: activePlayers.length,
  };
}

// Points: correct answers earn 500-1000 base points based on speed.
function scoreForAnswer(correct, msTaken, limitMs, isDoublePoints) {
  if (!correct) return 0;
  const ratio = Math.max(0, 1 - msTaken / limitMs);
  let baseScore = Math.round(500 + 500 * ratio);
  if (isDoublePoints) {
    baseScore *= 2;
  }
  return baseScore;
}

function clearGameTimer(game) {
  if (game.timer) {
    clearTimeout(game.timer);
    game.timer = null;
  }
}

function computeSessionAnalytics(game) {
  const responses = game.responses || [];
  const totalQuestions = game.questions.length;
  const totalAnswers = responses.length;

  if (totalAnswers === 0) {
    return {
      totalQuestions,
      totalAnswers: 0,
      overallAccuracy: 0,
      hardestQuestion: null,
      fastestPlayer: null,
      longestStreakPlayer: null,
      questionBreakdown: [],
    };
  }

  const correctAnswers = responses.filter((r) => r.correct).length;
  const overallAccuracy = Math.round((correctAnswers / totalAnswers) * 100);

  // Per-question accuracy breakdown
  const questionBreakdown = game.questions.map((q, idx) => {
    const qResponses = responses.filter((r) => r.questionIndex === idx);
    const qCorrect = qResponses.filter((r) => r.correct).length;
    const accuracy = qResponses.length > 0 ? Math.round((qCorrect / qResponses.length) * 100) : 0;
    const avgTimeMs = qResponses.length > 0
      ? Math.round(qResponses.reduce((acc, r) => acc + r.msTaken, 0) / qResponses.length)
      : 0;

    return {
      index: idx + 1,
      text: q.text,
      type: q.type,
      isDoublePoints: !!q.isDoublePoints,
      totalAnswers: qResponses.length,
      correctAnswers: qCorrect,
      accuracy,
      avgTimeMs,
    };
  });

  // Hardest question (question with lowest accuracy among questions with answers)
  const answeredQuestions = questionBreakdown.filter((q) => q.totalAnswers > 0);
  const hardestQuestion = answeredQuestions.length > 0
    ? [...answeredQuestions].sort((a, b) => a.accuracy - b.accuracy)[0]
    : null;

  // Fastest player calculation (average ms taken on correct answers)
  const playerTimes = {};
  responses.forEach((r) => {
    if (!r.correct) return;
    if (!playerTimes[r.playerId]) playerTimes[r.playerId] = { totalMs: 0, count: 0 };
    playerTimes[r.playerId].totalMs += r.msTaken;
    playerTimes[r.playerId].count += 1;
  });

  let fastestPlayer = null;
  let bestAvg = Infinity;
  Object.keys(playerTimes).forEach((pId) => {
    const p = game.players[pId];
    if (!p) return;
    const avg = playerTimes[pId].totalMs / playerTimes[pId].count;
    if (avg < bestAvg) {
      bestAvg = avg;
      fastestPlayer = {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        avgSeconds: (avg / 1000).toFixed(1),
      };
    }
  });

  // Longest streak player
  let longestStreakPlayer = null;
  let maxStreak = 0;
  Object.values(game.players).forEach((p) => {
    if ((p.maxStreak || 0) > maxStreak) {
      maxStreak = p.maxStreak;
      longestStreakPlayer = {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        maxStreak: p.maxStreak,
      };
    }
  });

  return {
    totalQuestions,
    totalAnswers,
    overallAccuracy,
    hardestQuestion,
    fastestPlayer,
    longestStreakPlayer,
    questionBreakdown,
  };
}

function leaderboardWithStandings(game) {
  const list = leaderboard(game);
  return list.map((p, idx) => {
    const rank = idx + 1;
    const prevRank = p.prevRank !== undefined ? p.prevRank : rank;
    const rankDelta = prevRank - rank; // positive = climbed spots!
    const nextPlayer = idx > 0 ? list[idx - 1] : null;
    const pointsBehindNext = nextPlayer ? nextPlayer.score - p.score : 0;
    const pointsBehindLeader = list[0] ? list[0].score - p.score : 0;

    return {
      ...p,
      rank,
      prevRank,
      rankDelta,
      nextPlayerName: nextPlayer ? nextPlayer.name : null,
      pointsBehindNext,
      pointsBehindLeader,
    };
  });
}

function timeUpQuestion(pin, allAnswered = false) {
  const game = games[pin];
  if (!game || game.state !== 'question') return;
  clearGameTimer(game);
  game.state = 'time_up';
  io.to(pin).emit('question:timeUp', { allAnswered });
}

function endQuestion(pin) {
  const game = games[pin];
  if (!game || (game.state !== 'question' && game.state !== 'time_up' && game.state !== 'get_ready')) return;
  clearGameTimer(game);
  game.state = 'reveal';
  game.timerPaused = false;

  const q = currentQuestion(game);
  const counts = new Array(q.options.length).fill(0);
  Object.values(game.players).forEach((p) => {
    const a = p.lastAnswerIndex;
    if (a !== undefined && a !== null && a >= 0) counts[a] += 1;
    if (!p.answeredThisRound) {
      p.streak = 0;
    }
  });

  const lb = leaderboardWithStandings(game);
  lb.forEach((p) => {
    if (game.players[p.id]) game.players[p.id].prevRank = p.rank;
  });

  io.to(pin).emit('question:reveal', {
    correctIndex: q.correctIndex,
    isDoublePoints: !!q.isDoublePoints,
    counts,
    leaderboard: lb,
  });
}

function startQuestion(pin) {
  const game = games[pin];
  if (!game) return;
  const q = currentQuestion(game);
  if (!q) return endGame(pin);

  clearGameTimer(game);
  game.state = 'get_ready';
  game.questionStartedAt = null;

  Object.values(game.players).forEach((p) => {
    p.answeredThisRound = false;
    p.lastAnswerIndex = null;
  });

  const activePlayers = Object.values(game.players).filter((p) => p.connected !== false);

  io.to(pin).emit('question:get_ready', {
    index: game.currentIndex,
    total: game.questions.length,
    text: q.text,
    image: q.image || null,
    type: q.type,
    isDoublePoints: !!q.isDoublePoints,
    durationMs: 3000,
    playerCount: activePlayers.length,
  });

  // After 3-second "Get Ready" teaser, transition to active question
  game.timer = setTimeout(() => {
    if (!games[pin] || game.state !== 'get_ready') return;
    game.state = 'question';
    game.questionStartedAt = Date.now();
    game.totalLimitMs = q.limitMs || 20000;
    game.remainingMs = game.totalLimitMs;
    game.timerPaused = false;

    io.to(pin).emit('question:show', currentQuestionPayload(game));
    io.to(pin).emit('question:progress', { answered: 0, total: activePlayers.length });

    clearGameTimer(game);
    game.timer = setTimeout(() => timeUpQuestion(pin), game.remainingMs + 300);
  }, 3000);
}

function endGame(pin) {
  const game = games[pin];
  if (!game) return;
  clearGameTimer(game);
  game.state = 'ended';

  const analytics = computeSessionAnalytics(game);
  io.to(pin).emit('game:ended', {
    leaderboard: leaderboardWithStandings(game),
    analytics,
  });
}

// ---------------------------------------------------------------------
// Socket.io wiring
// ---------------------------------------------------------------------
io.on('connection', (socket) => {
  // ---- HOST ----
  socket.on('host:create', ({ title, questions }, ack) => {
    if (!Array.isArray(questions) || questions.length === 0) {
      return ack && ack({ ok: false, error: 'Add at least one question first.' });
    }
    const pin = generatePin();
    games[pin] = {
      pin,
      hostId: socket.id,
      title: title || 'Untitled Session',
      questions,
      state: 'lobby',
      currentIndex: -1,
      players: {},
      responses: [],
      timer: null,
      totalLimitMs: 0,
      remainingMs: 0,
      timerPaused: false,
    };
    socket.join(pin);
    socket.data.pin = pin;
    socket.data.role = 'host';
    ack && ack({ ok: true, pin, ips: getLocalIPs(), port: currentPort });
  });

  socket.on('host:start', ({ pin }) => {
    const game = games[pin];
    if (!game || game.hostId !== socket.id) return;
    game.currentIndex = 0;
    startQuestion(pin);
  });

  socket.on('host:pause', ({ pin }) => {
    const game = games[pin];
    if (!game || game.hostId !== socket.id || game.state !== 'question') return;
    if (game.timerPaused) return;

    clearGameTimer(game);
    const elapsed = Date.now() - game.questionStartedAt;
    game.remainingMs = Math.max(0, game.remainingMs - elapsed);
    game.timerPaused = true;

    io.to(pin).emit('timer:pause', { remainingMs: game.remainingMs });
  });

  socket.on('host:resume', ({ pin }) => {
    const game = games[pin];
    if (!game || game.hostId !== socket.id || game.state !== 'question') return;
    if (!game.timerPaused) return;

    game.timerPaused = false;
    game.questionStartedAt = Date.now();
    clearGameTimer(game);
    game.timer = setTimeout(() => endQuestion(pin), game.remainingMs + 300);

    io.to(pin).emit('timer:resume', { remainingMs: game.remainingMs });
  });

  socket.on('host:addTime', ({ pin }) => {
    const game = games[pin];
    if (!game || game.hostId !== socket.id || game.state !== 'question') return;

    const addMs = 10000;
    if (!game.timerPaused) {
      const elapsed = Date.now() - game.questionStartedAt;
      game.remainingMs = Math.max(0, game.remainingMs - elapsed) + addMs;
      game.totalLimitMs += addMs;
      game.questionStartedAt = Date.now();
      clearGameTimer(game);
      game.timer = setTimeout(() => timeUpQuestion(pin), game.remainingMs + 300);
    } else {
      game.remainingMs += addMs;
      game.totalLimitMs += addMs;
    }

    io.to(pin).emit('timer:extend', {
      addedMs: addMs,
      remainingMs: game.remainingMs,
      totalLimitMs: game.totalLimitMs,
    });
  });

  socket.on('host:next', ({ pin }) => {
    const game = games[pin];
    if (!game || game.hostId !== socket.id) return;
    if (game.state === 'question' || game.state === 'time_up') {
      endQuestion(pin);
      return;
    }
    game.currentIndex += 1;
    if (game.currentIndex >= game.questions.length) {
      endGame(pin);
    } else {
      startQuestion(pin);
    }
  });

  socket.on('host:kick', ({ pin, playerId }) => {
    const game = games[pin];
    if (!game || game.hostId !== socket.id) return;
    const player = game.players[playerId];
    if (player) {
      io.to(player.socketId).emit('player:kicked');
      delete game.players[playerId];
      io.to(pin).emit('lobby:update', publicPlayerList(game));
    }
  });

  // ---- PLAYER ----
  socket.on('player:join', ({ pin, name, avatar, playerId: requestedPlayerId }, ack) => {
    const game = games[pin];
    if (!game) return ack && ack({ ok: false, error: 'No game with that PIN.' });
    if (game.state !== 'lobby') return ack && ack({ ok: false, error: 'That session has already started.' });
    const clean = String(name || '').trim().slice(0, 20);
    if (!clean) return ack && ack({ ok: false, error: 'Enter your nickname.' });

    const taken = Object.values(game.players).some(
      (p) => p.name.toLowerCase() === clean.toLowerCase() && p.id !== requestedPlayerId
    );
    if (taken) return ack && ack({ ok: false, error: 'That nickname is already taken in this session.' });

    const playerId = requestedPlayerId || `p_${Math.random().toString(36).slice(2, 11)}`;
    game.players[playerId] = {
      id: playerId,
      socketId: socket.id,
      name: clean,
      avatar: avatar || 'cyber_bot',
      score: 0,
      streak: 0,
      maxStreak: 0,
      lastAnswerIndex: null,
      answeredThisRound: false,
      connected: true,
    };

    socket.join(pin);
    socket.data.pin = pin;
    socket.data.playerId = playerId;
    socket.data.role = 'player';

    ack && ack({
      ok: true,
      playerId,
      title: game.title,
      avatar: game.players[playerId].avatar,
    });
    io.to(pin).emit('lobby:update', publicPlayerList(game));
  });

  socket.on('player:reconnect', ({ pin, playerId }, ack) => {
    const game = games[pin];
    if (!game) return ack && ack({ ok: false, error: 'Session not found or finished.' });
    const player = game.players[playerId];
    if (!player) return ack && ack({ ok: false, error: 'Session expired.' });

    player.socketId = socket.id;
    player.connected = true;

    socket.join(pin);
    socket.data.pin = pin;
    socket.data.playerId = playerId;
    socket.data.role = 'player';

    ack && ack({
      ok: true,
      title: game.title,
      name: player.name,
      avatar: player.avatar || 'cyber_bot',
      score: player.score,
      streak: player.streak || 0,
      state: game.state,
      question: game.state === 'question' ? currentQuestionPayload(game) : null,
      hasAnswered: player.answeredThisRound,
      lastAnswerIndex: player.lastAnswerIndex,
    });

    io.to(pin).emit('lobby:update', publicPlayerList(game));
  });

  socket.on('player:answer', ({ pin, answerIndex }, ack) => {
    const game = games[pin];
    if (!game || game.state !== 'question') return;
    const playerId = socket.data.playerId;
    const player = game.players[playerId];
    if (!player || player.answeredThisRound) return;

    const q = currentQuestion(game);
    const msTaken = Math.max(0, Date.now() - game.questionStartedAt);
    const correct = answerIndex === q.correctIndex;
    let gained = scoreForAnswer(correct, msTaken, game.totalLimitMs || q.limitMs, q.isDoublePoints);

    let streakBonus = 0;
    if (correct) {
      player.streak = (player.streak || 0) + 1;
      if (player.streak > (player.maxStreak || 0)) {
        player.maxStreak = player.streak;
      }
      if (player.streak >= 2) {
        streakBonus = Math.min(player.streak - 1, 5) * 100;
        gained += streakBonus;
      }
    } else {
      player.streak = 0;
    }

    player.answeredThisRound = true;
    player.lastAnswerIndex = answerIndex;
    player.lastMsTaken = msTaken;
    player.totalResponseMs = (player.totalResponseMs || 0) + msTaken;
    player.score += gained;

    // Track response for session analytics
    game.responses.push({
      questionIndex: game.currentIndex,
      playerId,
      playerName: player.name,
      correct,
      msTaken,
      isDoublePoints: !!q.isDoublePoints,
      pointsGained: gained,
    });

    // Acknowledge answer submission without leaking correctness or score yet
    ack && ack({
      ok: true,
      locked: true,
    });

    const activePlayers = Object.values(game.players).filter((p) => p.connected !== false);
    const answeredCount = Object.values(game.players).filter((p) => p.answeredThisRound).length;

    io.to(pin).emit('question:progress', {
      answered: answeredCount,
      total: activePlayers.length,
    });

    if (answeredCount >= activePlayers.length && activePlayers.length > 0) {
      timeUpQuestion(pin, true);
    }
  });

  // Floating live emoji reactions
  socket.on('player:reaction', ({ pin, emoji }) => {
    if (games[pin]) {
      io.to(pin).emit('reaction:spawn', {
        emoji: emoji || '🔥',
        from: socket.data.playerId,
      });
    }
  });

  socket.on('disconnect', () => {
    const pin = socket.data.pin;
    const game = games[pin];
    if (!game) return;

    if (socket.data.role === 'player') {
      const playerId = socket.data.playerId;
      if (game.players[playerId]) {
        game.players[playerId].connected = false;
        io.to(pin).emit('lobby:update', publicPlayerList(game));

        if (game.state === 'question') {
          const activePlayers = Object.values(game.players).filter((p) => p.connected !== false);
          const answeredCount = Object.values(game.players).filter((p) => p.answeredThisRound && p.connected !== false).length;
          io.to(pin).emit('question:progress', {
            answered: answeredCount,
            total: activePlayers.length,
          });
          if (answeredCount >= activePlayers.length && activePlayers.length > 0) {
            timeUpQuestion(pin, true);
          }
        }
      }
    }

    if (socket.data.role === 'host' && game.hostId === socket.id) {
      clearGameTimer(game);
      io.to(pin).emit('game:hostLeft');
      delete games[pin];
    }
  });
});

function startServer(port) {
  const onListening = () => {
    server.removeListener('error', onError);
    currentPort = port;
    const ips = getLocalIPs();
    console.log(`\nQuiz server running.`);
    console.log(`  On this computer: http://localhost:${currentPort}`);
    ips.forEach((ip) => console.log(`  On your network:  http://${ip}:${currentPort}`));
    console.log(`\nOpen /host.html on the host computer and /player.html on player devices.\n`);
    startCloudflareTunnel(currentPort);
  };

  const onError = (err) => {
    server.removeListener('listening', onListening);
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  };

  server.once('listening', onListening);
  server.once('error', onError);
  server.listen(port);
}

startServer(currentPort);
