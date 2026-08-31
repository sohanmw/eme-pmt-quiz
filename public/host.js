const socket = io();

const LETTERS = ['A', 'B', 'C', 'D'];
const OPT_CLASSES = ['a', 'b', 'c', 'd'];

let questions = [];
let qid = 0;
let currentPin = null;
let currentQuestionMeta = null;
let latestSessionData = null;
let isPaused = false;
let hostTimerEnd = 0;
let hostTotalDuration = 20000;
let hostTimerRaf = null;

// ---------------------------------------------------------------------
// Screen switching & Sound Button
// ---------------------------------------------------------------------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  const target = document.getElementById(`screen-${name}`);
  if (target) target.classList.add('active');

  const liveBadge = document.getElementById('hostLiveBadge');
  if (liveBadge) {
    liveBadge.style.display = name === 'setup' ? 'none' : 'inline-flex';
  }
}

const btnSound = document.getElementById('btnSound');
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

// ---------------------------------------------------------------------
// Quiz builder
// ---------------------------------------------------------------------
function newMcq() {
  return {
    id: ++qid,
    type: 'mcq',
    text: '',
    image: null,
    isDoublePoints: false,
    options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
    correctIndex: 0,
    seconds: 20,
  };
}

function newTf() {
  return {
    id: ++qid,
    type: 'tf',
    text: '',
    image: null,
    isDoublePoints: false,
    options: [{ text: 'True' }, { text: 'False' }],
    correctIndex: 0,
    seconds: 15,
  };
}

function handleImageUpload(file, callback) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDimension = 600;
      let width = img.width;
      let height = img.height;
      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', 0.82);
      callback(compressed);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderQuestionList() {
  const list = document.getElementById('questionList');
  list.innerHTML = '';

  const totalCountEl = document.getElementById('totalQuestionsCount');
  if (totalCountEl) {
    totalCountEl.textContent = questions.length === 0
      ? '0 questions configured'
      : `${questions.length} question${questions.length === 1 ? '' : 's'} configured`;
  }

  // If no questions exist, render inviting empty state card
  if (questions.length === 0) {
    const emptyCard = document.createElement('div');
    emptyCard.className = 'card';
    emptyCard.style.textAlign = 'center';
    emptyCard.style.padding = '44px 24px';
    emptyCard.style.border = '1px dashed var(--border-muted)';
    emptyCard.style.background = 'rgba(255, 255, 255, 0.02)';
    emptyCard.style.marginBottom = '20px';

    emptyCard.innerHTML = `
      <h3 style="font-size:16px; font-weight:700; margin:0 0 6px;">No questions added yet</h3>
      <p class="muted" style="margin:0 auto 20px; font-size:14px; max-width:380px;">
        Add your questions manually using the buttons below, or load the curated Digital Marketing sample trivia pack.
      </p>
      <div class="row" style="justify-content:center; gap:10px; flex-wrap:wrap;">
        <button type="button" class="btn secondary" id="emptyAddMcq">+ Multiple Choice</button>
        <button type="button" class="btn secondary" id="emptyAddTf">+ True / False</button>
        <button type="button" class="btn" id="emptyLoadSample">Load Sample Trivia</button>
      </div>
    `;
    list.appendChild(emptyCard);

    document.getElementById('emptyAddMcq').onclick = () => {
      questions.push(newMcq());
      renderQuestionList();
    };
    document.getElementById('emptyAddTf').onclick = () => {
      questions.push(newTf());
      renderQuestionList();
    };
    document.getElementById('emptyLoadSample').onclick = () => {
      loadDigitalMarketingTrivia('replace');
    };
    return;
  }

  questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'q-editor-card';

    // 1. Header with metadata and delete button
    const header = document.createElement('div');
    header.className = 'q-card-header';

    const meta = document.createElement('div');
    meta.className = 'q-header-meta';

    const indexPill = document.createElement('span');
    indexPill.className = 'q-index-pill';
    indexPill.textContent = `Question ${idx + 1}`;
    meta.appendChild(indexPill);

    // Type selector
    const typeSelect = document.createElement('select');
    typeSelect.className = 'q-select-clean';
    typeSelect.innerHTML = `
      <option value="mcq" ${q.type === 'mcq' ? 'selected' : ''}>Multiple Choice (4 Options)</option>
      <option value="tf" ${q.type === 'tf' ? 'selected' : ''}>True / False</option>
    `;
    typeSelect.onchange = () => {
      q.type = typeSelect.value;
      if (q.type === 'tf') {
        q.options = [{ text: 'True' }, { text: 'False' }];
        q.correctIndex = 0;
        q.seconds = 15;
      } else {
        q.options = [{ text: '' }, { text: '' }, { text: '' }, { text: '' }];
        q.correctIndex = 0;
        q.seconds = 20;
      }
      renderQuestionList();
    };
    meta.appendChild(typeSelect);

    // Time limit selector
    const timeSelect = document.createElement('select');
    timeSelect.className = 'q-select-clean';
    const durations = [10, 15, 20, 30, 45, 60];
    durations.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = `${s} Seconds`;
      if (q.seconds === s) opt.selected = true;
      timeSelect.appendChild(opt);
    });
    timeSelect.onchange = () => {
      q.seconds = Number(timeSelect.value);
    };
    meta.appendChild(timeSelect);

    // ⚡ 2x Double Points Toggle
    const multLabel = document.createElement('label');
    multLabel.className = `multiplier-toggle-label ${q.isDoublePoints ? 'active' : ''}`;
    const multCheck = document.createElement('input');
    multCheck.type = 'checkbox';
    multCheck.checked = !!q.isDoublePoints;
    multCheck.onchange = () => {
      q.isDoublePoints = multCheck.checked;
      multLabel.classList.toggle('active', multCheck.checked);
    };
    multLabel.appendChild(multCheck);
    multLabel.appendChild(document.createTextNode(' 2x Points'));
    meta.appendChild(multLabel);

    header.appendChild(meta);

    // Delete Button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn danger';
    removeBtn.style.padding = '6px 12px';
    removeBtn.style.fontSize = '12px';
    removeBtn.innerHTML = `${window.Icons ? window.Icons.trash(13) : ''} Delete`;
    removeBtn.onclick = () => {
      questions = questions.filter((x) => x.id !== q.id);
      renderQuestionList();
    };
    header.appendChild(removeBtn);
    card.appendChild(header);

    // 2. Question prompt section
    const promptSec = document.createElement('div');
    promptSec.className = 'q-prompt-section';

    const promptLabel = document.createElement('label');
    promptLabel.className = 'q-label';
    promptLabel.textContent = 'Question Prompt';
    promptSec.appendChild(promptLabel);

    const textInput = document.createElement('textarea');
    textInput.placeholder = 'Enter the question to display to participants…';
    textInput.value = q.text;
    textInput.rows = 2;
    textInput.oninput = () => { q.text = textInput.value; };
    promptSec.appendChild(textInput);

    // Media attachment row
    const mediaBar = document.createElement('div');
    mediaBar.className = 'q-media-bar';

    const imgInput = document.createElement('input');
    imgInput.type = 'file';
    imgInput.accept = 'image/*';
    imgInput.style.display = 'none';
    imgInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        handleImageUpload(file, (dataUrl) => {
          q.image = dataUrl;
          renderQuestionList();
        });
      }
    };

    const addImgBtn = document.createElement('button');
    addImgBtn.className = 'btn secondary';
    addImgBtn.style.padding = '6px 12px';
    addImgBtn.style.fontSize = '13px';
    addImgBtn.innerHTML = `${window.Icons ? window.Icons.image(14) : ''} ${q.image ? 'Replace Diagram' : 'Attach Diagram / Image'}`;
    addImgBtn.onclick = () => imgInput.click();
    mediaBar.appendChild(addImgBtn);
    mediaBar.appendChild(imgInput);

    if (q.image) {
      const preview = document.createElement('img');
      preview.src = q.image;
      preview.style.height = '36px';
      preview.style.borderRadius = '6px';
      preview.style.border = '1px solid var(--border-subtle)';
      mediaBar.appendChild(preview);

      const delImgBtn = document.createElement('button');
      delImgBtn.className = 'btn secondary';
      delImgBtn.style.padding = '6px 10px';
      delImgBtn.style.fontSize = '12px';
      delImgBtn.textContent = 'Remove Image';
      delImgBtn.onclick = () => {
        q.image = null;
        renderQuestionList();
      };
      mediaBar.appendChild(delImgBtn);
    }
    promptSec.appendChild(mediaBar);
    card.appendChild(promptSec);

    // 3. Options builder section
    const optLabel = document.createElement('label');
    optLabel.className = 'q-label';
    optLabel.textContent = 'Answer Options (Select the correct answer)';
    card.appendChild(optLabel);

    const optGrid = document.createElement('div');
    optGrid.className = 'q-options-builder-grid';

    q.options.forEach((opt, oi) => {
      const isCorrect = q.correctIndex === oi;
      const optItem = document.createElement('div');
      optItem.className = `q-opt-builder-item ${isCorrect ? 'is-correct' : ''}`;

      const badge = document.createElement('span');
      badge.className = 'opt-badge';
      if (q.type === 'tf') {
        badge.innerHTML = oi === 0 && window.Icons ? window.Icons.check(14) : (window.Icons ? window.Icons.cross(14) : (oi === 0 ? '✓' : '✕'));
      } else {
        badge.textContent = LETTERS[oi];
      }
      optItem.appendChild(badge);

      if (q.type === 'tf') {
        const textSpan = document.createElement('span');
        textSpan.style.flex = '1';
        textSpan.style.fontSize = '15px';
        textSpan.style.fontWeight = '600';
        textSpan.textContent = opt.text;
        optItem.appendChild(textSpan);
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Option ${LETTERS[oi]} text…`;
        input.value = opt.text;
        input.style.flex = '1';
        input.oninput = () => { opt.text = input.value; };
        optItem.appendChild(input);
      }

      const radioLabel = document.createElement('label');
      radioLabel.className = 'correct-radio-label';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `correct-${q.id}`;
      radio.checked = isCorrect;
      radio.onchange = () => {
        q.correctIndex = oi;
        renderQuestionList();
      };
      radioLabel.appendChild(radio);
      radioLabel.appendChild(document.createTextNode(' Correct'));
      optItem.appendChild(radioLabel);

      optGrid.appendChild(optItem);
    });

    card.appendChild(optGrid);
    list.appendChild(card);
  });
}

document.getElementById('addMcq').onclick = () => {
  questions.push(newMcq());
  renderQuestionList();
};
document.getElementById('addTf').onclick = () => {
  questions.push(newTf());
  renderQuestionList();
};

// ---------------------------------------------------------------------
// 10 Curated Digital Marketing Trivia Sample Questions
// ---------------------------------------------------------------------
const DIGITAL_MARKETING_TRIVIA = [
  {
    type: 'mcq',
    text: 'What does "ROAS" stand for in performance marketing?',
    image: null,
    isDoublePoints: false,
    options: [{ text: 'Return on Ad Spend' }, { text: 'Rate of Acquisition Scale' }, { text: 'Revenue over Annual Sales' }, { text: 'Reach of Audience Segment' }],
    correctIndex: 0,
    seconds: 20,
  },
  {
    type: 'mcq',
    text: 'Which core metric is calculated by dividing total clicks by total ad impressions?',
    image: null,
    isDoublePoints: false,
    options: [{ text: 'Conversion Rate (CR)' }, { text: 'Click-Through Rate (CTR)' }, { text: 'Cost Per Mille (CPM)' }, { text: 'Bounce Rate' }],
    correctIndex: 1,
    seconds: 20,
  },
  {
    type: 'tf',
    text: 'In SEO, a "NoFollow" rel attribute tells search engines not to pass PageRank to the destination URL.',
    image: null,
    isDoublePoints: false,
    options: [{ text: 'True' }, { text: 'False' }],
    correctIndex: 0,
    seconds: 15,
  },
  {
    type: 'mcq',
    text: 'What is the primary function of a Meta (Facebook) "Lookalike Audience"?',
    image: null,
    isDoublePoints: false,
    options: [
      { text: 'Target only current email newsletter subscribers' },
      { text: 'Reach new prospects whose behaviors mirror your best customers' },
      { text: 'Retarget users who abandoned their shopping carts' },
      { text: 'Block competitor IP addresses from seeing your campaigns' }
    ],
    correctIndex: 1,
    seconds: 20,
  },
  {
    type: 'mcq',
    text: 'Which HTTP status code signifies a permanent redirect for SEO link equity transfer?',
    image: null,
    isDoublePoints: false,
    options: [{ text: '301 Moved Permanently' }, { text: '302 Found' }, { text: '404 Not Found' }, { text: '500 Server Error' }],
    correctIndex: 0,
    seconds: 20,
  },
  {
    type: 'tf',
    text: 'Google Analytics 4 (GA4) utilizes an event-based tracking model instead of the session-based model of Universal Analytics.',
    image: null,
    isDoublePoints: false,
    options: [{ text: 'True' }, { text: 'False' }],
    correctIndex: 0,
    seconds: 15,
  },
  {
    type: 'mcq',
    text: 'In marketing attribution, which model attributes 100% of conversion credit to the very first touchpoint?',
    image: null,
    isDoublePoints: false,
    options: [{ text: 'Last Touch' }, { text: 'First Touch' }, { text: 'Linear' }, { text: 'Time Decay' }],
    correctIndex: 1,
    seconds: 20,
  },
  {
    type: 'tf',
    text: 'Implementing SPF and DKIM DNS records is essential for email authentication and maximizing inbox deliverability.',
    image: null,
    isDoublePoints: false,
    options: [{ text: 'True' }, { text: 'False' }],
    correctIndex: 0,
    seconds: 15,
  },
  {
    type: 'mcq',
    text: 'What does "CAC" stand for in growth marketing unit economics?',
    image: null,
    isDoublePoints: false,
    options: [{ text: 'Customer Acquisition Cost' }, { text: 'Cumulative Audience Count' }, { text: 'Churn After Conversion' }, { text: 'Channel Attribution Coefficient' }],
    correctIndex: 0,
    seconds: 20,
  },
  {
    type: 'mcq',
    text: 'In Conversion Rate Optimization (CRO), what characterizes an "A/B/n test"?',
    image: null,
    isDoublePoints: true, // 2x Double points round for the grand finale!
    options: [
      { text: 'A multivariate test limited strictly to 2 variations' },
      { text: 'A split test evaluating multiple variations (A, B, C, D...) against a control' },
      { text: 'A test conducted exclusively on desktop users' },
      { text: 'An organic SEO split test for title tags' }
    ],
    correctIndex: 1,
    seconds: 20,
  }
];

function loadDigitalMarketingTrivia(mode = 'replace') {
  const titleInput = document.getElementById('quizTitle');
  if (!titleInput.value.trim() || mode === 'replace') {
    titleInput.value = 'Digital Marketing & Growth Trivia';
  }

  const sampleItems = DIGITAL_MARKETING_TRIVIA.map((q) => ({
    id: ++qid,
    type: q.type,
    text: q.text,
    image: q.image || null,
    isDoublePoints: !!q.isDoublePoints,
    options: q.options.map((o) => ({ text: o.text })),
    correctIndex: q.correctIndex,
    seconds: q.seconds,
  }));

  if (mode === 'replace') {
    questions = sampleItems;
  } else if (mode === 'append') {
    questions = questions.concat(sampleItems);
  }

  renderQuestionList();
}

// Modal handling for Sample Trivia
const sampleModal = document.getElementById('modalSampleTrivia');
function openSampleModal() {
  if (!sampleModal) return;
  const countEl = document.getElementById('modalExistingCount');
  if (countEl) {
    countEl.textContent = `${questions.length} question${questions.length === 1 ? '' : 's'}`;
  }
  sampleModal.style.display = 'flex';
}
function closeSampleModal() {
  if (sampleModal) sampleModal.style.display = 'none';
}

document.getElementById('btnSampleAppend').onclick = () => {
  loadDigitalMarketingTrivia('append');
  closeSampleModal();
};
document.getElementById('btnSampleReplace').onclick = () => {
  loadDigitalMarketingTrivia('replace');
  closeSampleModal();
};
document.getElementById('btnSampleCancel').onclick = closeSampleModal;

document.getElementById('btnSampleTrivia').onclick = () => {
  if (questions.length === 0) {
    loadDigitalMarketingTrivia('replace');
  } else {
    openSampleModal();
  }
};

// ---------------------------------------------------------------------
// Saved Quiz Library System (localStorage)
// ---------------------------------------------------------------------
const libraryModal = document.getElementById('modalLibrary');
const libraryContainer = document.getElementById('libraryListContainer');

function getLibraryDecks() {
  try {
    const raw = localStorage.getItem('quiz_library_decks');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLibraryDecks(decks) {
  try {
    localStorage.setItem('quiz_library_decks', JSON.stringify(decks));
  } catch (e) {}
}

function renderLibraryList() {
  if (!libraryContainer) return;
  const decks = getLibraryDecks();
  libraryContainer.innerHTML = '';

  if (decks.length === 0) {
    libraryContainer.innerHTML = `
      <div style="text-align:center; padding:32px 16px; border:1px dashed var(--border-subtle); border-radius:var(--radius-md);">
        <p class="muted" style="margin:0 0 10px;">No saved quizzes yet.</p>
        <span style="font-size:12px; color:var(--text-muted);">Create questions and click "Save Current Deck" to store templates.</span>
      </div>
    `;
    return;
  }

  decks.forEach((deck) => {
    const item = document.createElement('div');
    item.className = 'library-item';
    item.innerHTML = `
      <div>
        <div class="library-item-title">${deck.title}</div>
        <div class="library-item-meta">${deck.questions.length} questions · Saved ${deck.date}</div>
      </div>
      <div class="row" style="gap:8px;">
        <button type="button" class="btn" style="padding:6px 12px; font-size:12px;" data-load-id="${deck.id}">Load</button>
        <button type="button" class="btn danger" style="padding:6px 10px; font-size:12px;" data-delete-id="${deck.id}">✕</button>
      </div>
    `;
    libraryContainer.appendChild(item);
  });

  libraryContainer.querySelectorAll('[data-load-id]').forEach((btn) => {
    btn.onclick = () => {
      const deck = decks.find((d) => d.id === btn.dataset.loadId);
      if (deck) {
        document.getElementById('quizTitle').value = deck.title;
        questions = deck.questions.map((q) => ({
          id: ++qid,
          type: q.type,
          text: q.text,
          image: q.image || null,
          isDoublePoints: !!q.isDoublePoints,
          options: q.options.map((o) => ({ text: o.text })),
          correctIndex: q.correctIndex,
          seconds: q.seconds,
        }));
        renderQuestionList();
        libraryModal.style.display = 'none';
      }
    };
  });

  libraryContainer.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.onclick = () => {
      const remaining = decks.filter((d) => d.id !== btn.dataset.deleteId);
      saveLibraryDecks(remaining);
      renderLibraryList();
    };
  });
}

document.getElementById('btnOpenLibrary').onclick = () => {
  renderLibraryList();
  libraryModal.style.display = 'flex';
};
document.getElementById('btnCloseLibrary').onclick = () => {
  libraryModal.style.display = 'none';
};

document.getElementById('btnSaveCurrentToLibrary').onclick = () => {
  if (questions.length === 0) {
    alert('Please add at least one question before saving to the library.');
    return;
  }
  const title = document.getElementById('quizTitle').value.trim() || 'Untitled Session';
  const decks = getLibraryDecks();
  const newDeck = {
    id: `deck_${Date.now()}`,
    title,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    questions: questions.map((q) => ({
      type: q.type,
      text: q.text,
      image: q.image,
      isDoublePoints: !!q.isDoublePoints,
      options: q.options,
      correctIndex: q.correctIndex,
      seconds: q.seconds,
    })),
  };
  decks.unshift(newDeck);
  saveLibraryDecks(decks);
  renderLibraryList();
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSampleModal();
    if (libraryModal) libraryModal.style.display = 'none';
  }
});

// Starts with NO questions by default (empty state)
questions = [];
renderQuestionList();

// ---------------------------------------------------------------------
// Create Game
// ---------------------------------------------------------------------
document.getElementById('createGame').onclick = () => {
  const err = document.getElementById('setupError');
  err.textContent = '';

  if (questions.length === 0) {
    err.textContent = 'Please add at least one question or load sample trivia before launching.';
    return;
  }

  const invalid = questions.find((q) => {
    if (!q.text.trim()) return true;
    if (q.options.some((o) => !o.text.trim())) return true;
    return false;
  });
  if (invalid) {
    err.textContent = 'Please complete all question prompt and option text fields.';
    return;
  }

  const payload = {
    title: document.getElementById('quizTitle').value.trim() || 'Untitled Session',
    questions: questions.map((q) => ({
      type: q.type,
      text: q.text.trim(),
      image: q.image || null,
      isDoublePoints: !!q.isDoublePoints,
      options: q.options.map((o) => ({ text: o.text.trim() })),
      correctIndex: q.correctIndex,
      limitMs: (q.seconds || 20) * 1000,
    })),
  };

  socket.emit('host:create', payload, (res) => {
    if (!res.ok) {
      err.textContent = res.error;
      return;
    }
    currentPin = res.pin;
    enterLobby(res.pin, res.ips, res.port);
  });
};

function enterLobby(pin, ips, port) {
  showScreen('lobby');
  document.getElementById('lobbyPin').textContent = pin;

  if (window.QuizAudio) window.QuizAudio.startLobbyMusic();

  const origin = window.location.origin;
  const joinUrl = `${origin}/player.html?pin=${pin}`;

  const qrBox = document.getElementById('qrBox');
  qrBox.innerHTML = '';
  if (window.QRCode) {
    new QRCode(qrBox, {
      text: joinUrl,
      width: 140,
      height: 140,
      colorDark: '#0B0F17',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  const urlsEl = document.getElementById('lobbyUrls');
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) {
    urlsEl.innerHTML = `Direct Link: <strong>${joinUrl}</strong><br><span style="font-size:13px; color:var(--text-muted);">Local Network: ` +
      ips.map((ip) => `http://${ip}:${port}`).join(' · ') + '</span>';
  } else {
    urlsEl.innerHTML = `Direct Link: <strong>${joinUrl}</strong>`;
  }
}

socket.on('lobby:update', (players) => {
  const countEl = document.getElementById('playerCount');
  const chips = document.getElementById('playerChips');
  const startBtn = document.getElementById('startGame');
  countEl.textContent = players.length;

  chips.innerHTML = '';
  players.forEach((p) => {
    const chip = document.createElement('span');
    chip.className = 'pill';
    chip.style.cursor = 'pointer';
    chip.style.display = 'inline-flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '8px';
    chip.title = 'Click to remove participant';

    const avatarSvg = window.Avatars ? window.Avatars.getSvg(p.avatar || 'cyber_bot', 24) : '';
    const flameIcon = p.streak >= 2 && window.Icons ? window.Icons.flame(12) : '';
    const crossIcon = window.Icons ? window.Icons.cross(10) : '✕';

    chip.innerHTML = `
      <span class="avatar-badge-sm" style="width:24px; height:24px;">${avatarSvg}</span>
      <span>${p.name}</span>
      ${flameIcon ? `<span style="color:#FBBF24;">${flameIcon}</span>` : ''}
      <span class="muted" style="margin-left:2px;">${crossIcon}</span>
    `;
    chip.onclick = () => {
      if (confirm(`Remove participant ${p.name}?`)) {
        socket.emit('host:kick', { pin: currentPin, playerId: p.id });
      }
    };
    chips.appendChild(chip);
  });

  startBtn.disabled = players.length === 0;
  startBtn.textContent = players.length === 0 ? 'Waiting for participants to join…' : `Start Session (${players.length} participant${players.length === 1 ? '' : 's'})`;
});

// ---------------------------------------------------------------------
// Start Game & Host Controls
// ---------------------------------------------------------------------
document.getElementById('startGame').onclick = () => {
  if (currentPin) socket.emit('host:start', { pin: currentPin });
};

const btnTimerToggle = document.getElementById('btnTimerToggle');
const btnAddTime = document.getElementById('btnAddTime');

function updateControlBarButtons() {
  if (!btnTimerToggle || !btnAddTime || !window.Icons) return;
  btnTimerToggle.innerHTML = isPaused
    ? `${window.Icons.play(14)} Resume`
    : `${window.Icons.pause(14)} Pause`;
  btnAddTime.innerHTML = `${window.Icons.plusTime(14)} +10s`;
}

btnTimerToggle.onclick = () => {
  if (!currentPin) return;
  if (isPaused) {
    socket.emit('host:resume', { pin: currentPin });
  } else {
    socket.emit('host:pause', { pin: currentPin });
  }
};

btnAddTime.onclick = () => {
  if (currentPin) socket.emit('host:addTime', { pin: currentPin });
};

document.getElementById('skipQuestion').onclick = () => {
  if (currentPin) socket.emit('host:next', { pin: currentPin });
};

// ---------------------------------------------------------------------
// Timer synchronization & Question Presentation
// ---------------------------------------------------------------------
function startHostTimer(durationMs, totalMs) {
  if (hostTimerRaf) cancelAnimationFrame(hostTimerRaf);
  isPaused = false;
  hostTotalDuration = totalMs || durationMs;
  hostTimerEnd = Date.now() + durationMs;
  updateControlBarButtons();

  const fill = document.getElementById('timerFill');
  const timerBar = document.getElementById('hostTimerBar');
  timerBar.classList.remove('paused');

  let lastTickSecond = -1;

  function update() {
    if (isPaused) return;
    const remaining = Math.max(0, hostTimerEnd - Date.now());
    const pct = Math.max(0, Math.min(100, (remaining / hostTotalDuration) * 100));
    fill.style.width = `${pct}%`;

    const sec = Math.ceil(remaining / 1000);
    if (sec !== lastTickSecond && sec >= 0) {
      lastTickSecond = sec;
      if (window.QuizAudio && sec <= 5 && sec > 0) {
        window.QuizAudio.playTick(sec / 5);
      }
    }

    if (remaining > 0) {
      hostTimerRaf = requestAnimationFrame(update);
    }
  }

  hostTimerRaf = requestAnimationFrame(update);
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
  currentQuestionMeta = q;
  showScreen('question');

  if (window.QuizAudio) window.QuizAudio.startQuestionTheme();

  document.getElementById('qCounter').textContent = `Question ${q.index + 1} / ${q.total}`;
  document.getElementById('qText').textContent = q.text;
  document.getElementById('answeredCount').textContent = '0';
  document.getElementById('totalPlayers').textContent = '0';

  // 2X Double Points Badge
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
      el.innerHTML = `<span class="opt-badge">${checkOrCross}</span><span>${text}</span>`;
    } else {
      el.className = `opt ${OPT_CLASSES[i]}`;
      el.innerHTML = `<span class="opt-badge">${LETTERS[i]}</span><span>${text}</span>`;
    }
    grid.appendChild(el);
  });
  optDiv.appendChild(grid);

  startHostTimer(q.limitMs, q.totalLimitMs);
});

socket.on('question:progress', ({ answered, total }) => {
  document.getElementById('answeredCount').textContent = answered;
  document.getElementById('totalPlayers').textContent = total;
});

// ---------------------------------------------------------------------
// Question Reveal & Clean Leaderboard Animation
// ---------------------------------------------------------------------
socket.on('question:reveal', ({ correctIndex, isDoublePoints, counts, leaderboard }) => {
  if (hostTimerRaf) cancelAnimationFrame(hostTimerRaf);
  if (window.QuizAudio) window.QuizAudio.stopAllMusic();

  showScreen('reveal');
  document.getElementById('revealQText').textContent = currentQuestionMeta ? currentQuestionMeta.text : '';

  const reveal2x = document.getElementById('reveal2xBadge');
  if (reveal2x) reveal2x.style.display = isDoublePoints ? 'inline-flex' : 'none';

  const bars = document.getElementById('revealBars');
  bars.innerHTML = '';

  const totalVotes = counts.reduce((a, b) => a + b, 0);

  if (currentQuestionMeta) {
    const isTf = currentQuestionMeta.type === 'tf';
    const grid = document.createElement('div');
    grid.className = isTf ? 'tf-grid' : 'opt-grid';

    currentQuestionMeta.options.forEach((text, i) => {
      const isCorrect = i === correctIndex;
      const count = counts[i] || 0;
      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

      const el = document.createElement('div');
      if (isTf) {
        el.className = `opt ${i === 0 ? 'tf-true' : 'tf-false'} ${isCorrect ? 'correct' : 'dimmed'}`;
        const checkOrCross = i === 0 && window.Icons ? window.Icons.check(16) : (window.Icons ? window.Icons.cross(16) : (i === 0 ? '✓' : '✕'));
        el.innerHTML = `
          <span class="opt-badge">${checkOrCross}</span>
          <span style="flex:1;">${text}</span>
          <span class="pill" style="font-weight:700;">${count} (${pct}%)</span>
        `;
      } else {
        el.className = `opt ${OPT_CLASSES[i]} ${isCorrect ? 'correct' : 'dimmed'}`;
        el.innerHTML = `
          <span class="opt-badge">${LETTERS[i]}</span>
          <span style="flex:1;">${text}</span>
          <span class="pill" style="font-weight:700;">${count} (${pct}%)</span>
        `;
      }
      grid.appendChild(el);
    });
    bars.appendChild(grid);
  }

  // Leaderboard Rendering with Cute Avatars
  const ol = document.getElementById('revealLeaderboard');
  ol.innerHTML = '';

  leaderboard.slice(0, 8).forEach((p, idx) => {
    const li = document.createElement('li');
    li.dataset.playerId = p.id;
    if (idx === 0) li.classList.add('top-1');

    const avatarSvg = window.Avatars ? window.Avatars.getSvg(p.avatar || 'cyber_bot', 28) : '';
    const flameIcon = p.streak >= 2 && window.Icons ? window.Icons.flame(12) : '';

    li.innerHTML = `
      <div class="player-name">
        <span class="rank">#${idx + 1}</span>
        <span class="avatar-badge-sm">${avatarSvg}</span>
        <span>${p.name}</span>
        ${p.streak >= 2 ? `<span class="streak-badge">${flameIcon} Streak ${p.streak}</span>` : ''}
      </div>
      <div><strong>${p.score}</strong> <span class="muted" style="font-size:12px;">PTS</span></div>
    `;
    ol.appendChild(li);
  });
});

document.getElementById('nextQuestion').onclick = () => {
  if (currentPin) socket.emit('host:next', { pin: currentPin });
};

// ---------------------------------------------------------------------
// Final Podium Screen & Analytics Dashboard
// ---------------------------------------------------------------------
socket.on('game:ended', ({ leaderboard, analytics }) => {
  latestSessionData = { leaderboard, analytics, date: new Date().toISOString() };

  if (hostTimerRaf) cancelAnimationFrame(hostTimerRaf);
  if (window.QuizAudio) {
    window.QuizAudio.stopAllMusic();
    window.QuizAudio.playPodiumFanfare();
  }
  if (window.QuizConfetti) {
    window.QuizConfetti.celebrate(4500);
  }

  showScreen('final');

  const podium = document.getElementById('podium');
  podium.innerHTML = '';

  const trophyIcon = window.Icons ? window.Icons.trophy(24) : '';
  const medalIcon = window.Icons ? window.Icons.medal(22) : '';

  const top3 = [
    { p: leaderboard[1], place: 'silver', icon: medalIcon, label: '2nd' },
    { p: leaderboard[0], place: 'gold', icon: trophyIcon, label: '1st' },
    { p: leaderboard[2], place: 'bronze', icon: medalIcon, label: '3rd' },
  ];

  top3.forEach(({ p, place, icon, label }) => {
    if (!p) return;
    const step = document.createElement('div');
    step.className = `step ${place}`;

    const avatarSvg = window.Avatars ? window.Avatars.getSvg(p.avatar || 'cyber_bot', 52) : '';

    step.innerHTML = `
      <div class="podium-avatar-wrap">${avatarSvg}</div>
      <span class="name">${p.name}</span>
      <span class="score">${p.score} pts</span>
      <span class="pill" style="font-size:11px; padding:2px 8px;">${icon} ${label} Place</span>
    `;
    podium.appendChild(step);
  });

  // Render Post-Session Analytics Grid
  const analyticsSec = document.getElementById('finalAnalyticsSection');
  const analyticsGrid = document.getElementById('finalAnalyticsGrid');
  if (analyticsSec && analyticsGrid && analytics) {
    analyticsSec.style.display = 'block';
    analyticsGrid.innerHTML = `
      <div class="analytics-card">
        <span class="analytics-card-label">Session Accuracy</span>
        <div class="analytics-card-val" style="color:#34D399;">${analytics.overallAccuracy}%</div>
        <span class="muted" style="font-size:11px;">${analytics.totalAnswers} total responses</span>
      </div>
      <div class="analytics-card">
        <span class="analytics-card-label">Hardest Question</span>
        <div class="analytics-card-val" style="font-size:15px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${analytics.hardestQuestion ? analytics.hardestQuestion.text : 'N/A'}">
          ${analytics.hardestQuestion ? `Q${analytics.hardestQuestion.index}: ${analytics.hardestQuestion.accuracy}% Correct` : 'N/A'}
        </div>
        <span class="muted" style="font-size:11px;">Lowest accuracy rate</span>
      </div>
      <div class="analytics-card">
        <span class="analytics-card-label">Speed Demon</span>
        <div class="analytics-card-val" style="font-size:16px; color:#38BDF8;">
          ${analytics.fastestPlayer ? `${analytics.fastestPlayer.name} (${analytics.fastestPlayer.avgSeconds}s)` : 'N/A'}
        </div>
        <span class="muted" style="font-size:11px;">Fastest correct responses</span>
      </div>
      <div class="analytics-card">
        <span class="analytics-card-label">Longest Streak</span>
        <div class="analytics-card-val" style="font-size:16px; color:#FBBF24;">
          ${analytics.longestStreakPlayer ? `${analytics.longestStreakPlayer.name} (${analytics.longestStreakPlayer.maxStreak} in a row)` : 'N/A'}
        </div>
        <span class="muted" style="font-size:11px;">Best consecutive streak</span>
      </div>
    `;
  }

  // Full Leaderboard
  const ol = document.getElementById('finalLeaderboard');
  ol.innerHTML = '';
  leaderboard.forEach((p, idx) => {
    const li = document.createElement('li');
    const avatarSvg = window.Avatars ? window.Avatars.getSvg(p.avatar || 'cyber_bot', 28) : '';
    const flameIcon = p.streak >= 2 && window.Icons ? window.Icons.flame(12) : '';

    li.innerHTML = `
      <div class="player-name">
        <span class="rank">#${idx + 1}</span>
        <span class="avatar-badge-sm">${avatarSvg}</span>
        <span>${p.name}</span>
        ${p.streak >= 2 ? `<span class="streak-badge">${flameIcon} Streak ${p.streak}</span>` : ''}
      </div>
      <div><strong>${p.score}</strong> <span class="muted" style="font-size:12px;">PTS</span></div>
    `;
    ol.appendChild(li);
  });
});

// CSV Export Logic
document.getElementById('btnDownloadCsv').onclick = () => {
  if (!latestSessionData) return;
  const { leaderboard, analytics } = latestSessionData;

  let csvContent = 'data:text/csv;charset=utf-8,';
  csvContent += '=== SESSION LEADERBOARD ===\r\n';
  csvContent += 'Rank,Player Name,Final Score,Avatar\r\n';
  leaderboard.forEach((p, idx) => {
    csvContent += `${idx + 1},"${p.name.replace(/"/g, '""')}",${p.score},${p.avatar || 'cyber_bot'}\r\n`;
  });

  if (analytics && Array.isArray(analytics.questionBreakdown)) {
    csvContent += '\r\n=== QUESTION ACCURACY & SPEED BREAKDOWN ===\r\n';
    csvContent += 'Question Number,Question Prompt,Type,2x Points,Total Responses,Accuracy %,Avg Response Time (ms)\r\n';
    analytics.questionBreakdown.forEach((q) => {
      csvContent += `${q.index},"${q.text.replace(/"/g, '""')}",${q.type},${q.isDoublePoints ? 'Yes' : 'No'},${q.totalAnswers},${q.accuracy}%,${q.avgTimeMs}\r\n`;
    });
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `quiz_results_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

document.getElementById('newGame').onclick = () => {
  currentPin = null;
  questions = [];
  document.getElementById('quizTitle').value = '';
  renderQuestionList();
  showScreen('setup');
};
