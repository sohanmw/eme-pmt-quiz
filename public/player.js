const socket = io();

const LETTERS = ['A', 'B', 'C', 'D'];
const OPT_CLASSES = ['a', 'b', 'c', 'd'];

let currentPin = null;
let myPlayerId = null;
let myName = '';
let myAvatar = 'cyber_bot';
let myScore = 0;
let myStreak = 0;
let hasAnswered = false;
let lastQuestionMeta = null;
let isTimerPaused = false;
let pTimerEnd = 0;
let pTotalDuration = 20000;
let pTimerRaf = null;

// ---------------------------------------------------------------------
// Mobile Haptic Feedback Helper
// ---------------------------------------------------------------------
function vibrate(pattern) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

// ---------------------------------------------------------------------
// Avatar Selection & Carousel
// ---------------------------------------------------------------------
function initAvatarPicker() {
  if (!window.Avatars) return;

  myAvatar = window.Avatars.getRandom();
  updateAvatarPreview();

  const dock = document.getElementById('avatarPickerDock');
  if (!dock) return;

  dock.innerHTML = '';
  window.Avatars.list().forEach((av) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `avatar-pick-item ${av.id === myAvatar ? 'active' : ''}`;
    item.dataset.avatarId = av.id;
    item.innerHTML = av.svg(40);
    item.onclick = () => {
      myAvatar = av.id;
      vibrate(15);
      updateAvatarPreview();
    };
    dock.appendChild(item);
  });

  const previewBox = document.getElementById('avatarPreviewBox');
  if (previewBox) {
    previewBox.onclick = shuffleAvatar;
  }

  const shuffleBtn = document.getElementById('btnShuffleAvatar');
  if (shuffleBtn) {
    shuffleBtn.onclick = shuffleAvatar;
  }
}

function shuffleAvatar() {
  if (!window.Avatars) return;
  myAvatar = window.Avatars.getRandom();
  vibrate(20);
  updateAvatarPreview();
}

function updateAvatarPreview() {
  if (!window.Avatars) return;
  const av = window.Avatars.get(myAvatar);

  const previewBox = document.getElementById('avatarPreviewBox');
  if (previewBox) previewBox.innerHTML = av.svg(68);

  const nameBadge = document.getElementById('avatarNameBadge');
  if (nameBadge) nameBadge.textContent = av.name;

  document.querySelectorAll('.avatar-pick-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.avatarId === myAvatar);
  });
}

function renderPlayerAvatars() {
  if (!window.Avatars) return;
  const svgSmall = window.Avatars.getSvg(myAvatar, 26);
  const svgMedium = window.Avatars.getSvg(myAvatar, 64);
  const svgLarge = window.Avatars.getSvg(myAvatar, 76);

  const waitingBox = document.getElementById('waitingAvatarBox');
  if (waitingBox) waitingBox.innerHTML = svgMedium;

  const answerBox = document.getElementById('answerAvatarBox');
  if (answerBox) answerBox.innerHTML = svgSmall;

  const resultBox = document.getElementById('resultAvatarBox');
  if (resultBox) resultBox.innerHTML = svgMedium;

  const finalBox = document.getElementById('finalAvatarBox');
  if (finalBox) finalBox.innerHTML = svgLarge;
}

// ---------------------------------------------------------------------
// Screen switching & Sound Button
// ---------------------------------------------------------------------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  const target = document.getElementById(`screen-${name}`);
  if (target) target.classList.add('active');

  const tray = document.getElementById('reactionTray');
  if (tray) {
    tray.style.display = name === 'join' || name === 'gone' ? 'none' : 'flex';
  }

  const lockedIcon = document.getElementById('lockedIconBox');
  if (lockedIcon && window.Icons && name === 'locked') {
    lockedIcon.innerHTML = window.Icons.lock(36);
  }

  renderPlayerAvatars();
}

const btnSound = document.getElementById('btnPlayerSound');
function updateSoundBtn() {
  const muted = window.QuizAudio ? window.QuizAudio.isMuted() : false;
  if (btnSound && window.Icons) {
    btnSound.innerHTML = muted ? window.Icons.volumeMute(18) : window.Icons.volumeOn(18);
  }
}
if (btnSound) {
  btnSound.onclick = () => {
    if (window.QuizAudio) {
      window.QuizAudio.toggleMute();
      updateSoundBtn();
    }
  };
  updateSoundBtn();
}

// ---------------------------------------------------------------------
// Floating live reactions (User reaction emojis float on screen)
// ---------------------------------------------------------------------
function spawnFloatingReaction(emoji) {
  const container = document.getElementById('reactions-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'floating-reaction';
  el.textContent = emoji;

  const leftPct = 15 + Math.random() * 70;
  const rot = (Math.random() - 0.5) * 30;
  el.style.left = `${leftPct}vw`;
  el.style.setProperty('--rot', `${rot}deg`);

  container.appendChild(el);
  if (window.QuizAudio) window.QuizAudio.playPop();

  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 2700);
}

socket.on('reaction:spawn', ({ emoji }) => {
  spawnFloatingReaction(emoji);
});

// Wire reaction tray buttons
document.querySelectorAll('.reaction-btn').forEach((btn) => {
  btn.onclick = () => {
    vibrate(20);
    const emoji = btn.dataset.emoji || btn.textContent.trim();
    if (currentPin) {
      socket.emit('player:reaction', { pin: currentPin, emoji });
    } else {
      spawnFloatingReaction(emoji);
    }
  };
});

// ---------------------------------------------------------------------
// Session Persistence & Auto-Reconnect
// ---------------------------------------------------------------------
function saveSession(pin, playerId, name, avatar) {
  try {
    sessionStorage.setItem('quiz_session', JSON.stringify({ pin, playerId, name, avatar }));
  } catch (e) {}
}

function clearSession() {
  try {
    sessionStorage.removeItem('quiz_session');
  } catch (e) {}
}

function checkReconnect() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('quiz_session') || '{}');
    if (saved.pin && saved.playerId) {
      socket.emit('player:reconnect', { pin: saved.pin, playerId: saved.playerId }, (res) => {
        if (res && res.ok) {
          currentPin = saved.pin;
          myPlayerId = saved.playerId;
          myName = res.name || saved.name;
          myAvatar = res.avatar || saved.avatar || 'cyber_bot';
          myScore = res.score || 0;
          myStreak = res.streak || 0;

          if (res.title) document.getElementById('playerBrandTitle').textContent = res.title;
          document.getElementById('waitingName').textContent = myName;

          if (res.state === 'lobby') {
            showScreen('waiting');
          } else if (res.state === 'question' && res.question) {
            handleShowQuestion(res.question);
            if (res.hasAnswered) {
              hasAnswered = true;
              showScreen('locked');
            }
          } else if (res.state === 'reveal') {
            showScreen('waiting');
          } else {
            showScreen('waiting');
          }
        } else {
          clearSession();
        }
      });
    }
  } catch (e) {}
}

const params = new URLSearchParams(window.location.search);
if (params.get('pin')) {
  document.getElementById('pinInput').value = params.get('pin');
}

// ---------------------------------------------------------------------
// Join Form
// ---------------------------------------------------------------------
document.getElementById('joinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const pin = document.getElementById('pinInput').value.trim();
  const name = document.getElementById('nameInput').value.trim();
  const err = document.getElementById('joinError');
  err.textContent = '';
  if (!pin || !name) {
    err.textContent = 'Please enter both a PIN and your nickname.';
    return;
  }

  socket.emit('player:join', { pin, name, avatar: myAvatar }, (res) => {
    if (!res.ok) {
      err.textContent = res.error;
      vibrate(60);
      return;
    }
    vibrate(30);
    currentPin = pin;
    myPlayerId = res.playerId;
    myName = name;
    myScore = 0;
    myStreak = 0;
    saveSession(pin, res.playerId, name, myAvatar);

    if (res.title) document.getElementById('playerBrandTitle').textContent = res.title;
    document.getElementById('waitingName').textContent = name;
    showScreen('waiting');
  });
});

// ---------------------------------------------------------------------
// Timer synchronization & Question Flow
// ---------------------------------------------------------------------
function startPlayerTimer(durationMs, totalMs) {
  if (pTimerRaf) cancelAnimationFrame(pTimerRaf);
  isTimerPaused = false;
  pTotalDuration = totalMs || durationMs;
  pTimerEnd = Date.now() + durationMs;

  const fill = document.getElementById('pTimerFill');
  const bar = document.getElementById('pTimerBar');
  bar.classList.remove('paused');

  let lastTickSec = -1;

  function update() {
    if (isTimerPaused) return;
    const remaining = Math.max(0, pTimerEnd - Date.now());
    const pct = Math.max(0, Math.min(100, (remaining / pTotalDuration) * 100));
    fill.style.width = `${pct}%`;

    const sec = Math.ceil(remaining / 1000);
    if (sec !== lastTickSec && sec >= 0) {
      lastTickSec = sec;
      if (window.QuizAudio && sec <= 5 && sec > 0) {
        window.QuizAudio.playTick(sec / 5);
        if (sec <= 3) vibrate(20);
      }
    }

    if (remaining > 0) {
      pTimerRaf = requestAnimationFrame(update);
    }
  }

  pTimerRaf = requestAnimationFrame(update);
}

socket.on('timer:pause', ({ remainingMs }) => {
  isTimerPaused = true;
  if (pTimerRaf) cancelAnimationFrame(pTimerRaf);
  document.getElementById('pTimerBar').classList.add('paused');
});

socket.on('timer:resume', ({ remainingMs }) => {
  isTimerPaused = false;
  document.getElementById('pTimerBar').classList.remove('paused');
  startPlayerTimer(remainingMs, pTotalDuration);
});

socket.on('timer:extend', ({ remainingMs, totalLimitMs }) => {
  pTotalDuration = totalLimitMs;
  if (!isTimerPaused) {
    startPlayerTimer(remainingMs, totalLimitMs);
  } else {
    const pct = Math.max(0, Math.min(100, (remainingMs / totalLimitMs) * 100));
    document.getElementById('pTimerFill').style.width = `${pct}%`;
  }
});

function handleShowQuestion(q) {
  lastQuestionMeta = q;
  hasAnswered = false;
  showScreen('answer');

  document.getElementById('pTypeLabel').textContent = q.type === 'tf' ? 'True or False' : 'Multiple Choice';
  document.getElementById('pScore').textContent = `${myScore} PTS`;

  const badge2x = document.getElementById('player2xBadge');
  if (badge2x) {
    badge2x.style.display = q.isDoublePoints ? 'inline-flex' : 'none';
    if (q.isDoublePoints) vibrate([30, 40, 30]);
  }

  const streakBadge = document.getElementById('playerStreakBadge');
  if (myStreak >= 2) {
    streakBadge.style.display = 'inline-flex';
    const flameIcon = window.Icons ? window.Icons.flame(12) : '';
    streakBadge.innerHTML = `${flameIcon} Streak ${myStreak}`;
  } else {
    streakBadge.style.display = 'none';
  }

  const optDiv = document.getElementById('pOptions');
  optDiv.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = q.type === 'tf' ? 'tf-grid' : 'opt-grid';

  q.options.forEach((text, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    if (q.type === 'tf') {
      el.className = `opt ${i === 0 ? 'tf-true' : 'tf-false'}`;
      const checkOrCross = i === 0 && window.Icons ? window.Icons.check(16) : (window.Icons ? window.Icons.cross(16) : (i === 0 ? '✓' : '✕'));
      el.innerHTML = `<span class="opt-badge">${checkOrCross}</span><span>${text}</span>`;
    } else {
      el.className = `opt ${OPT_CLASSES[i]}`;
      const shapeSvg = window.Icons ? window.Icons.shape(i, 18) : LETTERS[i];
      el.innerHTML = `<span class="opt-badge">${shapeSvg}</span><span>${text}</span>`;
    }
    el.onclick = () => submitAnswer(i);
    grid.appendChild(el);
  });
  optDiv.appendChild(grid);

  startPlayerTimer(q.limitMs, q.totalLimitMs);
}

socket.on('question:show', (q) => {
  handleShowQuestion(q);
});

function submitAnswer(index) {
  if (hasAnswered || !currentPin) return;
  hasAnswered = true;
  vibrate(25);
  showScreen('locked');

  let myLastMs = null;
  socket.emit('player:answer', { pin: currentPin, answerIndex: index }, (res) => {
    if (res && res.ok) {
      if (res.streak !== undefined) myStreak = res.streak;
      if (res.msTaken !== undefined) myLastMs = res.msTaken;
    }
  });
}

// ---------------------------------------------------------------------
// Round Results & Feedback with Haptics
// ---------------------------------------------------------------------
socket.on('question:reveal', ({ correctIndex, isDoublePoints, leaderboard }) => {
  if (pTimerRaf) cancelAnimationFrame(pTimerRaf);

  const me = leaderboard.find((p) => p.id === myPlayerId || p.name.toLowerCase() === myName.toLowerCase());
  const beforeScore = myScore;
  if (me) {
    myScore = me.score;
    myStreak = me.streak || 0;
  }
  const gained = myScore - beforeScore;

  const headline = document.getElementById('resultHeadline');
  const detail = document.getElementById('resultDetail');
  const scoreBadge = document.getElementById('resultScore');
  const streakBadge = document.getElementById('resultStreakBadge');

  if (!hasAnswered) {
    headline.textContent = "Time Elapsed";
    headline.style.color = 'var(--text-primary)';
    detail.textContent = "You did not submit an answer in time.";
    scoreBadge.textContent = `${myScore} PTS (+0)`;
    streakBadge.style.display = 'none';
    vibrate(60);
    if (window.QuizAudio) window.QuizAudio.playWrong();
  } else if (gained > 0) {
    headline.textContent = isDoublePoints ? '⚡ 2X Correct Response!' : 'Correct Response';
    headline.style.color = '#34D399';
    detail.textContent = `+${gained} points earned for speed & accuracy${isDoublePoints ? ' (2x Multiplier Applied)' : ''}`;
    scoreBadge.textContent = `Total: ${myScore} PTS`;

    vibrate([40, 50, 50]);

    if (myStreak >= 2) {
      streakBadge.style.display = 'inline-flex';
      streakBadge.className = 'streak-badge';
      const flameIcon = window.Icons ? window.Icons.flame(12) : '';
      streakBadge.innerHTML = `${flameIcon} ${myStreak} in a row (+${Math.min(myStreak - 1, 5) * 100} streak bonus)`;
      if (window.QuizAudio) window.QuizAudio.playStreak(myStreak);
    } else {
      streakBadge.style.display = 'none';
      if (window.QuizAudio) window.QuizAudio.playCorrect();
    }

    if (window.QuizConfetti) window.QuizConfetti.burst();
  } else {
    headline.textContent = 'Incorrect Response';
    headline.style.color = '#FB7185';
    detail.textContent = lastQuestionMeta ? `Correct response was: ${lastQuestionMeta.options[correctIndex]}` : '';
    scoreBadge.textContent = `Total: ${myScore} PTS`;
    streakBadge.style.display = 'none';
    vibrate(80);
    if (window.QuizAudio) window.QuizAudio.playWrong();
  }

  showScreen('result');
});

// ---------------------------------------------------------------------
// Game Over & Cleanup Handlers
// ---------------------------------------------------------------------
socket.on('game:ended', ({ leaderboard }) => {
  if (pTimerRaf) cancelAnimationFrame(pTimerRaf);
  clearSession();
  showScreen('final');

  const rankIdx = leaderboard.findIndex((p) => p.id === myPlayerId || p.name.toLowerCase() === myName.toLowerCase());
  const rank = rankIdx >= 0 ? rankIdx + 1 : leaderboard.length;
  const total = leaderboard.length;

  document.getElementById('finalScoreVal').textContent = `${myScore} PTS`;
  document.getElementById('finalRankVal').textContent = `Rank #${rank} of ${total}`;

  if (rank === 1) {
    document.getElementById('finalHeadline').textContent = '1st Place Winner';
    document.getElementById('finalDetail').textContent = `Top ranking in session, ${myName}!`;
    vibrate([100, 50, 100, 50, 200]);
    if (window.QuizAudio) window.QuizAudio.playPodiumFanfare();
    if (window.QuizConfetti) window.QuizConfetti.celebrate(4000);
  } else if (rank <= 3) {
    document.getElementById('finalHeadline').textContent = 'Top 3 Finish';
    document.getElementById('finalDetail').textContent = `Great performance, ${myName}!`;
    vibrate([80, 40, 80]);
    if (window.QuizAudio) window.QuizAudio.playPodiumFanfare();
    if (window.QuizConfetti) window.QuizConfetti.celebrate(3000);
  } else {
    document.getElementById('finalHeadline').textContent = 'Session Complete';
    document.getElementById('finalDetail').textContent = `Thank you for participating, ${myName}!`;
  }
});

document.getElementById('btnPlayAgain').onclick = () => {
  clearSession();
  window.location.reload();
};

socket.on('player:kicked', () => {
  clearSession();
  document.getElementById('goneHeadline').textContent = 'Removed from Session';
  document.getElementById('goneDetail').textContent = 'The host has removed you from this session.';
  showScreen('gone');
});

socket.on('game:hostLeft', () => {
  clearSession();
  document.getElementById('goneHeadline').textContent = 'Session Concluded';
  document.getElementById('goneDetail').textContent = 'The host ended the session.';
  showScreen('gone');
});

// Initialize avatar picker and check reconnects
initAvatarPicker();
socket.on('connect', () => {
  checkReconnect();
});
