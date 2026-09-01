// presenter.js - Clean, public-facing projector stage engine (Kahoot-style)
(function () {
  const socket = io();
  const params = new URLSearchParams(window.location.search);
  let currentPin = params.get('pin');
  let hostToken = params.get('token');

  let currentLobbyPin = currentPin;
  let currentLobbyIps = [];
  let currentLobbyPort = 3001;
  let activePublicUrl = null;

  let currentQuestionMeta = null;
  let currentQuestionIndex = 0;
  let totalQuestionsCount = 0;
  let hostTimerRaf = null;
  let hostTimerStart = null;
  let hostDuration = 20000;
  let hostTotalDuration = 20000;
  let isPaused = false;
  let getReadyInterval = null;
  let prevLeaderboardMap = new Map();
  let sessionAnalyticsData = null;
  let latestLeaderboard = [];

  const OPT_CLASSES = ['a', 'b', 'c', 'd'];
  const LETTERS = ['▲', '◆', '●', '■'];

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const el = document.getElementById(`screen-${name}`);
    if (el) el.classList.add('active');
  }

  // ---------------------------------------------------------------------
  // Audio Mute Toggle (Pure Vector Icons)
  // ---------------------------------------------------------------------
  const btnSound = document.getElementById('btnPresenterSound');
  function updateSoundIcon() {
    if (!btnSound) return;
    const muted = window.QuizAudio ? window.QuizAudio.isMuted() : false;
    btnSound.innerHTML = muted ? (window.Icons ? window.Icons.volumeMute(18) : '') : (window.Icons ? window.Icons.volumeOn(18) : '');
  }
  if (btnSound) {
    btnSound.onclick = () => {
      if (window.QuizAudio) {
        window.QuizAudio.toggleMute();
        updateSoundIcon();
      }
    };
  }
  updateSoundIcon();

  // ---------------------------------------------------------------------
  // Floating Live Reactions
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

  // ---------------------------------------------------------------------
  // Tunnel Status Detection
  // ---------------------------------------------------------------------
  async function checkTunnelStatus() {
    try {
      const res = await fetch('/api/tunnel-status');
      const data = await res.json();
      if (data.ok && data.active && data.url) {
        const prevUrl = activePublicUrl;
        activePublicUrl = data.url;
        if (prevUrl !== activePublicUrl && typeof updateLobbyDisplay === 'function') {
          updateLobbyDisplay();
        }
      }
    } catch (e) {}
  }
  checkTunnelStatus();
  setInterval(checkTunnelStatus, 8000);

  // ---------------------------------------------------------------------
  // Attach to Live Session on Socket Connect
  // ---------------------------------------------------------------------
  socket.on('connect', () => {
    if (!currentPin) {
      document.getElementById('lobbyPin').textContent = 'NO PIN';
      document.getElementById('lobbyUrls').innerHTML = `
        <span style="color:#FB7185; font-weight:600;">No live session attached.</span><br>
        <span style="font-size:13px; color:var(--text-muted);">Please launch a quiz deck from the Admin Dashboard.</span>
        <div style="margin-top:12px;"><a class="btn" href="admin.html">Go to Admin Dashboard</a></div>
      `;
      return;
    }

    socket.emit('host:attach', { pin: currentPin, token: hostToken }, (res) => {
      if (!res.ok) {
        document.getElementById('lobbyPin').textContent = 'ERROR';
        document.getElementById('lobbyUrls').innerHTML = `
          <span style="color:#FB7185; font-weight:600;">${res.error || 'Session not found'}</span><br>
          <div style="margin-top:12px;"><a class="btn" href="admin.html">Return to Admin Dashboard</a></div>
        `;
        return;
      }

      currentPin = res.pin;
      if (res.title) {
        document.getElementById('presenterStageTitle').textContent = res.title;
      }
      if (res.state === 'reveal' && res.revealData) {
        renderRevealScreen(res.revealData);
      } else if (res.state === 'question' && res.currentQuestion) {
        currentQuestionMeta = res.currentQuestion;
        currentQuestionIndex = res.currentQuestion.index;
        totalQuestionsCount = res.currentQuestion.total;
        showScreen('question');
      } else {
        enterLobby(res.pin, res.ips, res.port);
        if (res.players) {
          updateLobbyPlayers(res.players);
        }
      }
    });
  });

  // ---------------------------------------------------------------------
  // Lobby Display & QR Code
  // ---------------------------------------------------------------------
  function renderQrCode(container, text) {
    if (!container) return;
    container.innerHTML = '';
    try {
      if (typeof qrcode === 'function') {
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        container.innerHTML = qr.createSvgTag(3.5, 4);
        return;
      }
    } catch (e) {
      console.error('QR code error:', e);
    }
  }

  function updateLobbyDisplay() {
    if (!currentLobbyPin) return;
    const pin = currentLobbyPin;
    const ips = currentLobbyIps;
    const port = currentLobbyPort;

    let joinUrl = '';
    if (activePublicUrl) {
      joinUrl = `${activePublicUrl}/player.html?pin=${pin}`;
    } else {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const hostIp = isLocal && ips.length > 0 ? ips[0] : window.location.hostname;
      joinUrl = `${window.location.protocol}//${hostIp}:${port}/player.html?pin=${pin}`;
    }

    const qrBox = document.getElementById('qrBox');
    renderQrCode(qrBox, joinUrl);

    const urlsEl = document.getElementById('lobbyUrls');
    if (urlsEl) {
      urlsEl.innerHTML = `
        <div style="margin-bottom:8px;">
          <span class="live-badge" style="font-size:11px; padding:3px 8px; margin-bottom:6px;">JOIN FROM ANY PHONE</span><br>
          <span style="font-size:13px; color:var(--text-muted);">Direct Player Link:</span>
          <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
            <strong style="color:#38BDF8; font-size:13px; word-break:break-all;">${joinUrl}</strong>
            <button type="button" class="btn secondary" id="btnCopyLobbyUrl" style="padding:3px 10px; font-size:11px; height:24px; border-radius:var(--radius-full); flex-shrink:0;">Copy Link</button>
          </div>
        </div>
        <span style="font-size:12px; color:var(--text-muted);">
          Scan QR code or open link in mobile browser.
        </span>
      `;

      const copyBtn = document.getElementById('btnCopyLobbyUrl');
      if (copyBtn) {
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(joinUrl).then(() => {
            copyBtn.textContent = 'Copied!';
            copyBtn.style.color = '#34D399';
            setTimeout(() => {
              copyBtn.textContent = 'Copy Link';
              copyBtn.style.color = '';
            }, 2000);
          });
        };
      }
    }
  }

  function enterLobby(pin, ips, port) {
    showScreen('lobby');
    currentLobbyPin = pin;
    currentLobbyIps = ips || [];
    currentLobbyPort = port || 3001;

    document.getElementById('lobbyPin').textContent = pin;
    if (window.QuizAudio) window.QuizAudio.startLobbyMusic();

    updateLobbyDisplay();
  }

  function updateLobbyPlayers(players) {
    const countEl = document.getElementById('playerCount');
    const chips = document.getElementById('playerChips');
    const startBtn = document.getElementById('startGame');
    if (countEl) countEl.textContent = players.length;

    if (chips) {
      chips.innerHTML = '';
      players.forEach((p) => {
        const chip = document.createElement('span');
        chip.className = 'participant-chip';
        const avatarSvg = window.Avatars ? window.Avatars.getSvg(p.avatar || 'cyber_bot', 28) : '';
        const crossSvg = window.Icons ? window.Icons.cross(11) : '✕';
        chip.innerHTML = `
          <span class="avatar-wrapper">${avatarSvg}</span>
          <span class="player-name-text">${escapeHtml(p.name)}</span>
          <span class="muted" style="opacity:0.5; margin-left:2px; font-size:11px;">${crossSvg}</span>
        `;
        chip.title = 'Click to remove participant';
        chip.onclick = () => {
          if (confirm(`Remove ${p.name} from session?`)) {
            socket.emit('host:kick', { pin: currentPin, playerId: p.id });
          }
        };
        chips.appendChild(chip);
      });
    }

    if (startBtn) {
      if (players.length > 0) {
        startBtn.disabled = false;
        startBtn.textContent = `Start Quiz (${players.length} participant${players.length === 1 ? '' : 's'})`;
      } else {
        startBtn.disabled = true;
        startBtn.textContent = 'Waiting for participants to join…';
      }
    }
  }

  socket.on('lobby:update', (players) => {
    updateLobbyPlayers(players);
  });

  const startBtn = document.getElementById('startGame');
  if (startBtn) {
    startBtn.onclick = () => {
      socket.emit('host:start', { pin: currentPin });
    };
  }

  // ---------------------------------------------------------------------
  // 3-Second "Get Ready" Countdown Screen
  // ---------------------------------------------------------------------
  socket.on('question:get_ready', (q) => {
    if (hostTimerRaf) cancelAnimationFrame(hostTimerRaf);
    if (getReadyInterval) clearInterval(getReadyInterval);

    showScreen('get-ready');
    document.getElementById('getReadyCounter').textContent = `Question ${q.index + 1} / ${q.total}`;
    document.getElementById('getReadyPrompt').textContent = q.text;

    const badge2x = document.getElementById('getReady2xBadge');
    if (badge2x) {
      badge2x.style.display = q.isDoublePoints ? 'inline-flex' : 'none';
    }

    const countdownEl = document.getElementById('getReadyCountdown');
    let remainingSecs = Math.round((q.durationMs || 3000) / 1000);
    if (countdownEl) countdownEl.textContent = String(remainingSecs);

    if (window.QuizAudio) window.QuizAudio.playTick(1);

    getReadyInterval = setInterval(() => {
      remainingSecs -= 1;
      if (remainingSecs > 0) {
        if (countdownEl) countdownEl.textContent = String(remainingSecs);
        if (window.QuizAudio) window.QuizAudio.playTick(1 - (remainingSecs / 3));
      } else {
        if (countdownEl) countdownEl.innerHTML = window.Icons ? window.Icons.zap(28) : '⚡';
        clearInterval(getReadyInterval);
      }
    }, 1000);
  });

  // ---------------------------------------------------------------------
  // Presenting Question Screen
  // ---------------------------------------------------------------------
  function startHostTimer(durationMs, totalMs) {
    if (hostTimerRaf) cancelAnimationFrame(hostTimerRaf);
    hostDuration = durationMs;
    hostTotalDuration = totalMs || durationMs;
    hostTimerStart = performance.now();
    isPaused = false;
    updateControlBarButtons();

    const fill = document.getElementById('timerFill');
    document.getElementById('hostTimerBar').classList.remove('paused');

    function tick(now) {
      if (isPaused) return;
      const elapsed = now - hostTimerStart;
      const remaining = Math.max(0, hostDuration - elapsed);
      const pct = Math.max(0, Math.min(100, (remaining / hostTotalDuration) * 100));

      if (fill) fill.style.width = `${pct}%`;

      if (remaining > 0) {
        hostTimerRaf = requestAnimationFrame(tick);
      }
    }
    hostTimerRaf = requestAnimationFrame(tick);
  }

  function updateControlBarButtons() {
    const pauseBtn = document.getElementById('btnTimerToggle');
    if (pauseBtn) {
      pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
      pauseBtn.style.background = isPaused ? 'rgba(56, 189, 248, 0.2)' : '';
    }
  }

  const btnPause = document.getElementById('btnTimerToggle');
  if (btnPause) {
    btnPause.onclick = () => {
      if (!isPaused) {
        socket.emit('host:pause', { pin: currentPin });
      } else {
        socket.emit('host:resume', { pin: currentPin });
      }
    };
  }

  const btnAddTime = document.getElementById('btnAddTime');
  if (btnAddTime) {
    btnAddTime.onclick = () => {
      socket.emit('host:extend', { pin: currentPin, extraMs: 10000 });
    };
  }

  const skipBtn = document.getElementById('skipQuestion');
  if (skipBtn) {
    skipBtn.onclick = () => {
      socket.emit('host:next', { pin: currentPin });
    };
  }

  socket.on('timer:pause', ({ remainingMs }) => {
    isPaused = true;
    if (hostTimerRaf) cancelAnimationFrame(hostTimerRaf);
    updateControlBarButtons();
    document.getElementById('hostTimerBar').classList.add('paused');
  });

  socket.on('timer:resume', ({ remainingMs }) => {
    isPaused = false;
    updateControlBarButtons();
    document.getElementById('hostTimerBar').classList.remove('paused');
    startHostTimer(remainingMs, hostTotalDuration);
  });

  socket.on('timer:extend', ({ remainingMs, totalLimitMs }) => {
    hostTotalDuration = totalLimitMs;
    if (!isPaused) {
      startHostTimer(remainingMs, totalLimitMs);
    } else {
      const pct = Math.max(0, Math.min(100, (remainingMs / totalLimitMs) * 100));
      document.getElementById('timerFill').style.width = `${pct}%`;
    }
  });

  socket.on('question:show', (q) => {
    if (getReadyInterval) clearInterval(getReadyInterval);
    currentQuestionMeta = q;
    currentQuestionIndex = q.index;
    totalQuestionsCount = q.total;

    showScreen('question');

    if (window.QuizAudio) window.QuizAudio.startQuestionTheme();

    document.getElementById('qCounter').textContent = `Question ${q.index + 1} / ${q.total}`;
    document.getElementById('qText').textContent = q.text;

    const ansEl = document.getElementById('answeredCount');
    const totEl = document.getElementById('totalPlayers');
    if (ansEl) ansEl.textContent = '0';
    if (totEl) totEl.textContent = String(q.playerCount || 0);

    const badge2x = document.getElementById('host2xBadge');
    if (badge2x) {
      badge2x.style.display = q.isDoublePoints ? 'inline-flex' : 'none';
    }

    const mediaWrap = document.getElementById('qMediaWrap');
    const imgEl = document.getElementById('qImg');
    if (q.image) {
      imgEl.src = q.image;
      mediaWrap.style.display = 'flex';
    } else {
      mediaWrap.style.display = 'none';
    }

    const optDiv = document.getElementById('qOptions');
    optDiv.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = q.type === 'tf' ? 'tf-grid' : 'opt-grid';

    q.options.forEach((text, i) => {
      const el = document.createElement('div');
      if (q.type === 'tf') {
        el.className = `opt ${i === 0 ? 'tf-true' : 'tf-false'}`;
        const checkOrCross = i === 0 && window.Icons ? window.Icons.check(16) : (window.Icons ? window.Icons.cross(16) : (i === 0 ? '✓' : '✕'));
        el.innerHTML = `<span class="opt-badge">${checkOrCross}</span><span>${escapeHtml(text)}</span>`;
      } else {
        el.className = `opt ${OPT_CLASSES[i]}`;
        const shapeSvg = window.Icons ? window.Icons.shape(i, 16) : LETTERS[i];
        el.innerHTML = `<span class="opt-badge">${shapeSvg}</span><span>${escapeHtml(text)}</span>`;
      }
      grid.appendChild(el);
    });
    optDiv.appendChild(grid);

    if (skipBtn) {
      skipBtn.textContent = 'Reveal Results';
      skipBtn.style.background = '';
      skipBtn.style.color = '';
      skipBtn.style.boxShadow = '';
      skipBtn.style.transform = '';
    }

    startHostTimer(q.limitMs, q.totalLimitMs);
  });

  socket.on('question:progress', ({ answered, total }) => {
    const ansEl = document.getElementById('answeredCount');
    const totEl = document.getElementById('totalPlayers');
    if (ansEl) ansEl.textContent = answered;
    if (totEl) totEl.textContent = total;
  });

  socket.on('question:timeUp', ({ allAnswered } = {}) => {
    if (hostTimerRaf) cancelAnimationFrame(hostTimerRaf);
    const fill = document.getElementById('timerFill');
    if (fill) fill.style.width = '0%';

    if (skipBtn) {
      skipBtn.textContent = allAnswered ? 'All Answered — Reveal Results' : 'Time Expired — Reveal Results';
      skipBtn.style.background = '#6366F1';
      skipBtn.style.color = '#fff';
      skipBtn.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.6)';
      skipBtn.style.transform = 'scale(1.05)';
    }
  });

  // ---------------------------------------------------------------------
  // Step 1: Kahoot Vertical Bar Graph Snapshot
  // ---------------------------------------------------------------------
  function renderRevealScreen({ question, correctIndex, isDoublePoints, counts, leaderboard }) {
    if (hostTimerRaf) cancelAnimationFrame(hostTimerRaf);
    if (question) {
      currentQuestionMeta = question;
      currentQuestionIndex = question.index;
      totalQuestionsCount = question.total;
    }
    if (leaderboard) {
      latestLeaderboard = leaderboard;
    }
    showScreen('reveal');

    if (window.QuizAudio) window.QuizAudio.stopQuestionMusic();

    const q = currentQuestionMeta;
    const qTextEl = document.getElementById('revealQText');
    if (qTextEl) qTextEl.textContent = q ? (q.text || '') : '';

    const badge2x = document.getElementById('reveal2xBadge');
    if (badge2x) {
      badge2x.style.display = isDoublePoints ? 'inline-flex' : 'none';
    }

    const container = document.getElementById('revealBars');
    if (!container) return;
    container.innerHTML = '';

    const options = (q && Array.isArray(q.options) && q.options.length) 
      ? q.options.map((o) => (typeof o === 'string' ? o : (o.text || '')))
      : ['Option 1', 'Option 2', 'Option 3', 'Option 4'];

    const isTf = q ? q.type === 'tf' : false;
    const wrapper = document.createElement('div');
    wrapper.className = 'kahoot-bars-wrapper';

    const grid = document.createElement('div');
    grid.className = `kahoot-bars-grid ${isTf ? 'tf-mode' : ''}`;

    const safeCounts = counts || new Array(options.length).fill(0);
    const maxCount = Math.max(...safeCounts, 1);

    const fillTargets = [];

    options.forEach((text, i) => {
      const isCorrect = i === correctIndex;
      const count = safeCounts[i] || 0;
      const fillHeightPct = maxCount > 0 && count > 0 ? Math.max(25, Math.round((count / maxCount) * 92)) : 0;

      const col = document.createElement('div');
      col.className = `kahoot-bar-column ${isCorrect ? 'is-correct' : (count === 0 ? '' : 'is-wrong')}`;

      const countWrap = document.createElement('div');
      countWrap.className = 'kahoot-bar-count-wrap';
      if (isCorrect) {
        countWrap.innerHTML = `
          <span class="kahoot-bar-check">✓</span>
          <span class="kahoot-bar-count" style="color:#34D399;">${count}</span>
        `;
      } else {
        countWrap.innerHTML = `
          <span class="kahoot-bar-count">${count}</span>
        `;
      }

      const track = document.createElement('div');
      track.className = 'kahoot-bar-track';

      const fill = document.createElement('div');
      const optClass = isTf ? (i === 0 ? 'tf-true' : 'tf-false') : OPT_CLASSES[i];
      fill.className = `kahoot-bar-fill ${optClass}`;
      fill.style.height = '0%'; // Start at 0, animate after DOM append

      track.appendChild(fill);
      fillTargets.push({ fill, fillHeightPct });

      const footer = document.createElement('div');
      footer.className = `kahoot-bar-footer ${optClass}`;
      if (isTf) {
        const checkOrCross = i === 0 && window.Icons ? window.Icons.check(14) : (window.Icons ? window.Icons.cross(14) : (i === 0 ? '✓' : '✕'));
        footer.innerHTML = `<span class="shape-icon">${checkOrCross}</span> <span>${escapeHtml(text)}</span>`;
      } else {
        const shapeSvg = window.Icons ? window.Icons.shape(i, 16) : LETTERS[i];
        footer.innerHTML = `<span class="shape-icon" style="font-size:16px;">${shapeSvg}</span> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px;" title="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
      }

      col.appendChild(countWrap);
      col.appendChild(track);
      col.appendChild(footer);
      grid.appendChild(col);
    });

    wrapper.appendChild(grid);
    container.appendChild(wrapper);

    // Animate bars AFTER DOM is appended — two rAF frames ensures layout is flushed
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fillTargets.forEach(({ fill, fillHeightPct }) => {
          fill.style.height = `${fillHeightPct}%`;
        });
      });
    });

    const btnGoScoreboard = document.getElementById('btnGoToScoreboard');
    if (btnGoScoreboard) {
      btnGoScoreboard.onclick = () => {
        showAnimatedScoreboard(latestLeaderboard);
      };
    }
  }

  socket.on('question:reveal', (data) => {
    renderRevealScreen(data);
  });

  // ---------------------------------------------------------------------
  // Step 2: Animated Top 10 Scoreboard
  // ---------------------------------------------------------------------
  function showAnimatedScoreboard(leaderboard) {
    const list = (leaderboard && leaderboard.length) ? leaderboard : (latestLeaderboard || []);
    latestLeaderboard = list;
    showScreen('scoreboard');
    const listEl = document.getElementById('scoreboardList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (list.length === 0) {
      listEl.innerHTML = '<p class="muted" style="text-align:center; padding:24px;">No player scores recorded yet.</p>';
    }

    const top10 = list.slice(0, 10);
    const rowElements = [];

    top10.forEach((p, newRankIdx) => {
      const newRank = newRankIdx + 1;
      const prevData = prevLeaderboardMap.get(p.id);
      const prevRank = prevData ? prevData.rank : newRank;
      const prevScore = prevData ? prevData.score : p.score;
      const scoreDelta = p.score - prevScore;
      const rankDelta = prevRank - newRank;

      const row = document.createElement('div');
      row.className = 'scoreboard-row';
      row.id = `sb-row-${p.id}`;

      const avatarSvg = window.Avatars ? window.Avatars.getSvg(p.avatar, 28) : '';
      const flameSvg = window.Icons ? window.Icons.flame(14) : '';
      const streakHtml = p.streak >= 2 ? `<span class="streak-flame-badge">${flameSvg} ${p.streak}</span>` : '';

      row.innerHTML = `
        <div class="row-left">
          <div class="rank-box" id="sb-rank-${p.id}">#${prevRank}</div>
          <div class="avatar-box">${avatarSvg}</div>
          <div class="name-box">
            <span class="player-name">${escapeHtml(p.name)}</span>
            ${streakHtml}
          </div>
          <div class="rank-shift" id="sb-shift-${p.id}"></div>
        </div>
        <div class="row-right">
          ${scoreDelta > 0 ? `<span class="score-floater" id="sb-float-${p.id}">+${scoreDelta} pts</span>` : ''}
          <div class="score-box" id="sb-score-${p.id}">${prevScore}</div>
        </div>
      `;

      listEl.appendChild(row);
      rowElements.push({ p, row, newRank, prevRank, prevScore, targetScore: p.score, scoreDelta, rankDelta, hasPrev: !!prevData });
    });

    setTimeout(() => {
      rowElements.forEach(({ p, targetScore, prevScore, scoreDelta, rankDelta, newRank, hasPrev }) => {
        const scoreEl = document.getElementById(`sb-score-${p.id}`);
        const floatEl = document.getElementById(`sb-float-${p.id}`);
        const rankEl = document.getElementById(`sb-rank-${p.id}`);
        const shiftEl = document.getElementById(`sb-shift-${p.id}`);

        if (floatEl) floatEl.classList.add('show');

        if (scoreEl && scoreDelta > 0) {
          animateScoreCount(scoreEl, prevScore, targetScore, 900);
        }

        if (rankEl) rankEl.textContent = `#${newRank}`;

        if (shiftEl && hasPrev) {
          if (rankDelta > 0) {
            shiftEl.className = 'rank-shift up';
            const arrowSvg = window.Icons ? window.Icons.arrowUp(12) : '▲';
            shiftEl.innerHTML = `${arrowSvg} +${rankDelta}`;
          } else if (rankDelta < 0) {
            shiftEl.className = 'rank-shift down';
            const arrowSvg = window.Icons ? window.Icons.arrowDown(12) : '▼';
            shiftEl.innerHTML = `${arrowSvg} ${rankDelta}`;
          }
        }
      });

      leaderboard.forEach((p, idx) => {
        prevLeaderboardMap.set(p.id, { rank: idx + 1, score: p.score });
      });
    }, 350);

    const btnNext = document.getElementById('btnScoreboardNext');
    if (btnNext) {
      const isLastQuestion = currentQuestionIndex >= totalQuestionsCount - 1;
      btnNext.textContent = isLastQuestion ? 'View Final Results & Podium' : 'Next Question ➔';
      btnNext.onclick = () => {
        socket.emit('host:next', { pin: currentPin });
      };
    }
  }

  function animateScoreCount(el, start, end, duration) {
    const startTime = performance.now();
    function update(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const val = Math.round(start + (end - start) * progress);
      el.textContent = String(val);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  // ---------------------------------------------------------------------
  // Step 3: Final Standings & Podium
  // ---------------------------------------------------------------------
  socket.on('game:ended', ({ leaderboard, analytics }) => {
    if (hostTimerRaf) cancelAnimationFrame(hostTimerRaf);
    showScreen('final');
    sessionAnalyticsData = analytics;

    if (window.QuizConfetti) window.QuizConfetti.celebrate(4500);
    if (window.QuizAudio) window.QuizAudio.playPodiumFanfare();

    const podiumArea = document.getElementById('podiumArea');
    podiumArea.innerHTML = '';

    const top3 = leaderboard.slice(0, 3);
    const podiumGrid = document.createElement('div');
    podiumGrid.className = 'podium-grid';

    const order = [1, 0, 2];
    order.forEach((placeIdx) => {
      const p = top3[placeIdx];
      const step = document.createElement('div');
      const placeNum = placeIdx + 1;
      step.className = `podium-step step-${placeNum}`;

      if (p) {
        const avatarSvg = window.Avatars ? window.Avatars.getSvg(p.avatar, placeNum === 1 ? 52 : 44) : '';
        step.innerHTML = `
          <div class="podium-avatar-wrap">${avatarSvg}</div>
          <div class="podium-name">${escapeHtml(p.name)}</div>
          <div class="podium-score">${p.score} pts</div>
          <div class="podium-block">
            <span class="podium-rank-num">${placeNum === 1 ? '1ST' : (placeNum === 2 ? '2ND' : '3RD')}</span>
          </div>
        `;
      } else {
        step.innerHTML = `<div class="podium-block"><span class="podium-rank-num">-</span></div>`;
      }
      podiumGrid.appendChild(step);
    });
    podiumArea.appendChild(podiumGrid);

    const runnersUp = leaderboard.slice(3, 10);
    const listEl = document.getElementById('finalLeaderboard');
    listEl.innerHTML = '';

    if (runnersUp.length === 0) {
      listEl.innerHTML = '<p class="muted" style="font-size:13px;">No other participants.</p>';
    } else {
      runnersUp.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'card row between';
        row.style.padding = '12px 18px';
        row.style.marginBottom = '8px';
        const rank = idx + 4;
        const avatarSvg = window.Avatars ? window.Avatars.getSvg(p.avatar, 24) : '';
        row.innerHTML = `
          <div class="row" style="gap:12px; align-items:center;">
            <span class="pill" style="font-weight:700; width:36px; text-align:center;">#${rank}</span>
            ${avatarSvg}
            <span style="font-weight:600; font-size:15px;">${escapeHtml(p.name)}</span>
          </div>
          <div class="row" style="gap:10px; align-items:center;">
            <span style="font-weight:700; font-size:16px; color:var(--text-primary);">${p.score} PTS</span>
          </div>
        `;
        listEl.appendChild(row);
      });
    }

    renderAnalyticsGrid(analytics);
  });

  function renderAnalyticsGrid(an) {
    const grid = document.getElementById('analyticsGrid');
    if (!grid || !an) return;
    grid.innerHTML = `
      <div class="analytics-card">
        <span class="analytics-label">Overall Accuracy</span>
        <span class="analytics-val">${an.overallAccuracyPct}%</span>
        <span class="analytics-sub">${an.totalAnswers} total responses</span>
      </div>
      <div class="analytics-card">
        <span class="analytics-label">Hardest Question</span>
        <span class="analytics-val" style="font-size:14px; color:#FB7185;">${escapeHtml(an.hardestQuestion || 'N/A')}</span>
        <span class="analytics-sub">${an.hardestAccuracyPct !== undefined ? an.hardestAccuracyPct + '% accuracy' : ''}</span>
      </div>
      <div class="analytics-card">
        <span class="analytics-label">Speed Demon</span>
        <span class="analytics-val" style="font-size:18px; color:#38BDF8;">${escapeHtml(an.speedDemonName || 'None')}</span>
        <span class="analytics-sub">${an.speedDemonAvgSec ? an.speedDemonAvgSec + 's avg reflex' : 'Fastest reflex'}</span>
      </div>
      <div class="analytics-card">
        <span class="analytics-label">Longest Streak</span>
        <span class="analytics-val" style="font-size:18px; color:#FBBF24;">${escapeHtml(an.longestStreakPlayer || 'None')}</span>
        <span class="analytics-sub">${an.longestStreakCount ? an.longestStreakCount + ' in a row' : 'Top run'}</span>
      </div>
    `;
  }

  const btnDownloadCsv = document.getElementById('btnDownloadCsv');
  if (btnDownloadCsv) {
    btnDownloadCsv.onclick = () => {
      if (!sessionAnalyticsData) return;
      const csv = generateCsvReport(sessionAnalyticsData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz_session_${currentPin}_report.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
  }

  function generateCsvReport(an) {
    let csv = `Quiz Session Report: ${an.title || 'Live Session'}\nPIN: ${an.pin}\nCompleted: ${new Date().toISOString()}\n\n`;
    csv += `Rank,Player Name,Final Score,Correct Answers,Total Responses,Accuracy %,Avg Response Time (sec)\n`;
    (an.playerStats || []).forEach((p, idx) => {
      const avgSec = p.answeredCount > 0 ? (p.totalResponseMs / p.answeredCount / 1000).toFixed(2) : 0;
      csv += `${idx + 1},"${p.name.replace(/"/g, '""')}",${p.score},${p.correctCount},${p.answeredCount},${p.accuracyPct}%,${avgSec}s\n`;
    });
    return csv;
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
