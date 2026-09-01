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
    liveBadge.style.display = (name === 'setup' || name === 'auth') ? 'none' : 'inline-flex';
  }
}

// ---------------------------------------------------------------------
// Host Authentication Management
// ---------------------------------------------------------------------
const AUTH_STORAGE_KEY = 'quiz_host_session_token';
const AUTH_EMAIL_KEY = 'quiz_host_email';

function initHostAuth() {
  const lockIcon = document.getElementById('authLockIcon');
  if (lockIcon && window.Icons) lockIcon.innerHTML = window.Icons.lock(26);

  const token = localStorage.getItem(AUTH_STORAGE_KEY);
  const cachedEmail = localStorage.getItem(AUTH_EMAIL_KEY) || 'sohan@emarketingeye.com';

  if (token) {
    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    .then((res) => res.json())
    .then((data) => {
      if (data.ok) {
        onHostAuthenticated(data.email || cachedEmail, token);
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        showScreen('auth');
      }
    })
    .catch(() => {
      // Local network fallback
      onHostAuthenticated(cachedEmail, token);
    });
  } else {
    showScreen('auth');
  }

  const form = document.getElementById('hostLoginForm');
  const errBox = document.getElementById('authErrorMsg');
  const btnLogin = document.getElementById('btnHostLogin');

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const emailVal = document.getElementById('authEmail').value.trim();
      const passVal = document.getElementById('authPassword').value;

      if (errBox) errBox.style.display = 'none';
      if (btnLogin) {
        btnLogin.disabled = true;
        btnLogin.textContent = 'Verifying…';
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailVal, password: passVal })
        });
        const data = await res.json();
        if (data.ok && data.token) {
          localStorage.setItem(AUTH_STORAGE_KEY, data.token);
          localStorage.setItem(AUTH_EMAIL_KEY, data.email || emailVal);
          onHostAuthenticated(data.email || emailVal, data.token);
        } else {
          if (errBox) {
            errBox.textContent = data.error || 'Invalid credentials. Please try again.';
            errBox.style.display = 'block';
          }
        }
      } catch (err) {
        if (errBox) {
          errBox.textContent = 'Connection error. Please try again.';
          errBox.style.display = 'block';
        }
      } finally {
        if (btnLogin) {
          btnLogin.disabled = false;
          btnLogin.textContent = 'Sign In to Dashboard';
        }
      }
    };
  }

  const btnLogout = document.getElementById('btnHostLogout');
  if (btnLogout) {
    btnLogout.onclick = () => {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_EMAIL_KEY);
      const accountBar = document.getElementById('hostAccountBar');
      if (accountBar) accountBar.style.display = 'none';
      showScreen('auth');
    };
  }
}

function onHostAuthenticated(email) {
  const accountBar = document.getElementById('hostAccountBar');
  const userEmailEl = document.getElementById('hostUserEmail');
  if (accountBar && userEmailEl) {
    userEmailEl.textContent = email;
    accountBar.style.display = 'inline-flex';
  }
  showScreen('setup');
}

initHostAuth();

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

  const kpiQEl = document.getElementById('kpiTotalQuestions');
  if (kpiQEl) kpiQEl.textContent = String(questions.length);

  const titleVal = document.getElementById('quizTitle')?.value?.trim() || 'Untitled Session';
  const ovTitle = document.getElementById('overviewActiveTitle');
  const ovSub = document.getElementById('overviewActiveSubtitle');
  if (ovTitle) ovTitle.textContent = titleVal;
  if (ovSub) ovSub.textContent = `${questions.length} question${questions.length === 1 ? '' : 's'} loaded in memory · Ready to present`;

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
        badge.innerHTML = window.Icons ? window.Icons.shape(oi, 14) : LETTERS[oi];
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
// Saved Quiz Library System (Laptop Hard Drive Disk Storage via /api/quizzes)
// ---------------------------------------------------------------------
const libraryModal = document.getElementById('modalLibrary');
const libraryContainer = document.getElementById('libraryListContainer');

async function fetchLibraryDecks() {
  try {
    const res = await fetch('/api/quizzes');
    const data = await res.json();
    if (data.ok && Array.isArray(data.quizzes)) {
      return data.quizzes;
    }
  } catch (e) {}
  // Fallback to localStorage if offline
  try {
    const raw = localStorage.getItem('quiz_library_decks');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

async function saveDeckToDisk(title, deckQuestions) {
  const payload = {
    title,
    questions: deckQuestions.map((q) => ({
      type: q.type,
      text: q.text,
      image: q.image,
      isDoublePoints: !!q.isDoublePoints,
      options: q.options,
      correctIndex: q.correctIndex,
      seconds: q.seconds,
    })),
  };
  try {
    const res = await fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) return data.quiz;
  } catch (e) {}

  // Fallback save to localStorage
  try {
    const decks = JSON.parse(localStorage.getItem('quiz_library_decks') || '[]');
    const newDeck = {
      id: `deck_${Date.now()}`,
      title,
      dateStr: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      questions: payload.questions,
    };
    decks.unshift(newDeck);
    localStorage.setItem('quiz_library_decks', JSON.stringify(decks));
    return newDeck;
  } catch (e) {}
}

async function deleteDeckFromDisk(id) {
  try {
    await fetch(`/api/quizzes/${id}`, { method: 'DELETE' });
  } catch (e) {}
  try {
    const decks = JSON.parse(localStorage.getItem('quiz_library_decks') || '[]');
    const remaining = decks.filter((d) => d.id !== id);
    localStorage.setItem('quiz_library_decks', JSON.stringify(remaining));
  } catch (e) {}
}

// ---------------------------------------------------------------------
// Enterprise Admin Dashboard & Deck Management System
// ---------------------------------------------------------------------
let allSavedDecks = [];

async function renderAdminDecks(searchQuery = '') {
  allSavedDecks = await fetchLibraryDecks();
  
  // 1. Update KPI Counters
  const kpiDecks = document.getElementById('kpiTotalDecks');
  const badgeDecks = document.getElementById('tabDeckCountBadge');
  if (kpiDecks) kpiDecks.textContent = String(allSavedDecks.length);
  if (badgeDecks) badgeDecks.textContent = String(allSavedDecks.length);

  // 2. Render Overview Quick Launch Grid (Top 3 decks)
  const overviewGrid = document.getElementById('overviewRecentDecksGrid');
  if (overviewGrid) {
    overviewGrid.innerHTML = '';
    const recent3 = allSavedDecks.slice(0, 3);
    if (recent3.length === 0) {
      overviewGrid.innerHTML = `
        <div class="card" style="grid-column:1/-1; padding:24px; text-align:center; color:var(--text-muted); font-size:13px;">
          No saved quizzes on your Mac yet. Create a quiz in the Studio or import a spreadsheet.
        </div>
      `;
    } else {
      recent3.forEach((deck) => {
        const card = createQuizDeckCard(deck);
        overviewGrid.appendChild(card);
      });
    }
  }

  // 3. Render All Quizzes Grid (with search filter)
  const allGrid = document.getElementById('allQuizzesGrid');
  if (allGrid) {
    allGrid.innerHTML = '';
    const filtered = allSavedDecks.filter((d) =>
      !searchQuery || d.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filtered.length === 0) {
      allGrid.innerHTML = `
        <div class="card" style="grid-column:1/-1; padding:32px; text-align:center; color:var(--text-muted); font-size:13px;">
          ${searchQuery ? `No quizzes matching "${searchQuery}".` : 'No saved quizzes yet.'}
        </div>
      `;
    } else {
      filtered.forEach((deck) => {
        const card = createQuizDeckCard(deck);
        allGrid.appendChild(card);
      });
    }
  }
}

function createQuizDeckCard(deck) {
  const card = document.createElement('div');
  card.className = 'quiz-card';
  const qCount = deck.questionCount || (deck.questions ? deck.questions.length : 0);
  const dateStr = deck.dateStr || (deck.updatedAt ? new Date(deck.updatedAt).toLocaleDateString() : 'Saved on Mac');

  card.innerHTML = `
    <div>
      <div class="quiz-card-title">${deck.title}</div>
      <div class="quiz-card-meta">
        <span class="pill" style="font-size:11px; padding:2px 8px;">${qCount} Questions</span>
        <span>·</span>
        <span>${dateStr}</span>
      </div>
    </div>
    <div class="row between" style="gap:8px; margin-top:8px;">
      <button class="btn primary" style="flex:1; padding:8px 12px; font-size:13px;" data-launch-deck="${deck.id}">
        Launch ▶
      </button>
      <button class="btn secondary" style="padding:8px 12px; font-size:12px;" data-edit-deck="${deck.id}">
        Edit
      </button>
      <button class="btn danger" style="padding:8px 10px; font-size:12px;" data-delete-deck="${deck.id}">
        ✕
      </button>
    </div>
  `;

  // Launch direct
  const btnLaunch = card.querySelector('[data-launch-deck]');
  if (btnLaunch) {
    btnLaunch.onclick = () => loadDeckIntoSession(deck, true);
  }

  // Edit in studio
  const btnEdit = card.querySelector('[data-edit-deck]');
  if (btnEdit) {
    btnEdit.onclick = () => {
      loadDeckIntoSession(deck, false);
      switchAdminTab('studio');
    };
  }

  // Delete from Mac
  const btnDel = card.querySelector('[data-delete-deck]');
  if (btnDel) {
    btnDel.onclick = async () => {
      if (confirm(`Delete "${deck.title}" from your Mac?`)) {
        await deleteDeckFromDisk(deck.id);
        await renderAdminDecks(document.getElementById('quizSearchInput')?.value || '');
      }
    };
  }

  return card;
}

function loadDeckIntoSession(deck, autoStart = false) {
  document.getElementById('quizTitle').value = deck.title;
  questions = (deck.questions || []).map((q) => ({
    id: ++qid,
    type: q.type,
    text: q.text,
    image: q.image || null,
    isDoublePoints: !!q.isDoublePoints,
    options: q.options.map((o) => ({ text: o.text })),
    correctIndex: q.correctIndex,
    seconds: q.seconds || 20,
  }));
  renderQuestionList();

  if (autoStart) {
    const launchBtn = document.getElementById('createGame');
    if (launchBtn) launchBtn.click();
  }
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.admin-tab-pane').forEach((pane) => {
    pane.classList.toggle('active', pane.id === `pane-${tabName}`);
  });

  if (tabName === 'overview' || tabName === 'quizzes') {
    renderAdminDecks();
  }
}

function initAdminDashboard() {
  // 1. Populate Vector SVG Icons across Admin Tabs & KPI Boxes
  if (window.Icons) {
    const setIcon = (id, iconSvg) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = iconSvg;
    };
    setIcon('tabIconOverview', window.Icons.grid(15));
    setIcon('tabIconQuizzes', window.Icons.layers(15));
    setIcon('tabIconStudio', window.Icons.edit(15));
    setIcon('tabIconReports', window.Icons.chart(15));
    setIcon('tabIconSettings', window.Icons.gear(15));

    setIcon('kpiIconDecks', window.Icons.folder(22));
    setIcon('kpiIconQuestions', window.Icons.fileText(22));
    setIcon('kpiIconNetwork', window.Icons.zap(22));
    setIcon('kpiIconReady', window.Icons.play(22));

    setIcon('saveQuizIconStudio', window.Icons.disk(14));
  }

  // 2. Tab Navigation Listeners
  document.querySelectorAll('.admin-nav-btn').forEach((btn) => {
    btn.onclick = () => switchAdminTab(btn.dataset.tab);
  });

  // 3. Overview Actions
  const btnOvStudio = document.getElementById('btnOverviewOpenStudio');
  if (btnOvStudio) btnOvStudio.onclick = () => switchAdminTab('studio');

  const btnOvLaunch = document.getElementById('btnOverviewLaunch');
  if (btnOvLaunch) {
    btnOvLaunch.onclick = () => {
      const launchBtn = document.getElementById('createGame');
      if (launchBtn) launchBtn.click();
    };
  }

  const btnOvAll = document.getElementById('btnOverviewViewAllQuizzes');
  if (btnOvAll) btnOvAll.onclick = () => switchAdminTab('quizzes');

  // 4. Quizzes Tab Actions
  const btnNewQuiz = document.getElementById('btnQuizzesCreateNew');
  if (btnNewQuiz) {
    btnNewQuiz.onclick = () => {
      questions = [];
      document.getElementById('quizTitle').value = '';
      renderQuestionList();
      switchAdminTab('studio');
    };
  }

  const btnQuizzesCsv = document.getElementById('btnQuizzesImportCsv');
  if (btnQuizzesCsv) btnQuizzesCsv.onclick = openCsvModal;

  const searchInput = document.getElementById('quizSearchInput');
  if (searchInput) {
    searchInput.oninput = (e) => renderAdminDecks(e.target.value.trim());
  }

  // 5. Studio Save Action
  const btnSaveStudio = document.getElementById('btnSaveCurrentToMac');
  if (btnSaveStudio) {
    btnSaveStudio.onclick = async () => {
      if (questions.length === 0) {
        alert('Please add at least one question before saving.');
        return;
      }
      const title = document.getElementById('quizTitle').value.trim() || 'Untitled Session';
      btnSaveStudio.disabled = true;
      btnSaveStudio.textContent = 'Saving…';

      await saveDeckToDisk(title, questions);

      btnSaveStudio.disabled = false;
      const diskSvg = window.Icons ? window.Icons.disk(14) : '';
      btnSaveStudio.innerHTML = `<span id="saveQuizIconStudio">${diskSvg}</span> Save Quiz to Mac`;
      await renderAdminDecks();
      alert(`Quiz "${title}" successfully saved to your Mac.`);
    };
  }

  // 6. Settings Copy Tunnel
  const btnCopyTunnel = document.getElementById('btnCopySettingsTunnel');
  if (btnCopyTunnel) {
    btnCopyTunnel.onclick = () => {
      const input = document.getElementById('settingsTunnelUrl');
      if (input && input.value && input.value.startsWith('http')) {
        navigator.clipboard.writeText(input.value);
        btnCopyTunnel.textContent = 'Copied!';
        setTimeout(() => { btnCopyTunnel.textContent = 'Copy Link'; }, 2000);
      }
    };
  }

  // Initial Decks Render
  renderAdminDecks();
}

initAdminDashboard();

// ---------------------------------------------------------------------
// Cloudflare Tunnel Live Status Polling & Link Copying
// ---------------------------------------------------------------------
let activePublicUrl = null;

async function checkTunnelStatus() {
  try {
    const res = await fetch('/api/tunnel-status');
    const data = await res.json();
    const badge = document.getElementById('tunnelStatusBadge');
    const text = document.getElementById('tunnelUrlText');

    if (data.ok && data.active && data.url) {
      const prevUrl = activePublicUrl;
      activePublicUrl = data.url;
      const settingsTunnel = document.getElementById('settingsTunnelUrl');
      if (settingsTunnel) settingsTunnel.value = data.url;

      if (badge && text) {
        badge.style.display = 'inline-flex';
        try {
          const u = new URL(data.url);
          text.textContent = u.hostname;
          text.title = data.url;
        } catch (e) {
          text.textContent = 'Public Online';
        }
      }
      if (prevUrl !== activePublicUrl && typeof updateLobbyDisplay === 'function') {
        updateLobbyDisplay();
      }
    } else {
      if (badge) badge.style.display = 'none';
    }
  } catch (e) {}
}

const btnCopyLink = document.getElementById('btnCopyPublicLink');
if (btnCopyLink) {
  btnCopyLink.onclick = () => {
    if (!activePublicUrl) return;
    const playerUrl = `${activePublicUrl}/player.html`;
    navigator.clipboard.writeText(playerUrl).then(() => {
      const orig = btnCopyLink.textContent;
      btnCopyLink.textContent = 'Copied!';
      btnCopyLink.style.color = '#34D399';
      setTimeout(() => {
        btnCopyLink.textContent = orig;
        btnCopyLink.style.color = '';
      }, 2000);
    });
  };
}

checkTunnelStatus();
setInterval(checkTunnelStatus, 8000);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSampleModal();
    if (libraryModal) libraryModal.style.display = 'none';
    const modalCsvEl = document.getElementById('modalCsvImport');
    if (modalCsvEl) modalCsvEl.style.display = 'none';
  }
});

// ---------------------------------------------------------------------
// CSV & Spreadsheet Import Modal Logic
// ---------------------------------------------------------------------
const modalCsv = document.getElementById('modalCsvImport');
const btnOpenCsv = document.getElementById('btnOpenCsvModal');
const btnCloseCsv = document.getElementById('btnCloseCsvModal');
const btnCancelCsv = document.getElementById('btnCancelCsvImport');
const btnConfirmCsv = document.getElementById('btnConfirmCsvImport');
const btnDownloadTemplate = document.getElementById('btnDownloadCsvTemplate');
const csvDropzone = document.getElementById('csvDropzone');
const csvFileInput = document.getElementById('csvFileInput');
const csvTextInput = document.getElementById('csvTextInput');
const csvParseStatus = document.getElementById('csvParseStatus');

let parsedCsvQuestions = [];

function openCsvModal() {
  if (modalCsv) modalCsv.style.display = 'flex';
  if (csvTextInput) csvTextInput.value = '';
  if (csvParseStatus) csvParseStatus.innerHTML = '';
  const dropIcon = document.getElementById('csvDropzoneIcon');
  if (dropIcon && window.Icons) dropIcon.innerHTML = window.Icons.upload(36);
  parsedCsvQuestions = [];
  if (btnConfirmCsv) {
    btnConfirmCsv.disabled = true;
    btnConfirmCsv.textContent = 'Import Questions (0)';
  }
}

function closeCsvModal() {
  if (modalCsv) modalCsv.style.display = 'none';
}

const saveIconEl = document.getElementById('saveQuizIcon');
if (saveIconEl && window.Icons) saveIconEl.innerHTML = window.Icons.disk(14);
const closeCsvEl = document.getElementById('btnCloseCsvModal');
if (closeCsvEl && window.Icons) closeCsvEl.innerHTML = window.Icons.cross(14);

if (btnOpenCsv) btnOpenCsv.onclick = openCsvModal;
if (btnCloseCsv) btnCloseCsv.onclick = closeCsvModal;
if (btnCancelCsv) btnCancelCsv.onclick = closeCsvModal;

// Template download
if (btnDownloadTemplate) {
  btnDownloadTemplate.onclick = () => {
    const templateContent = `Question,Option 1,Option 2,Option 3,Option 4,Correct Option (1-4 or text),Time (sec),2X Points (yes/no)
"What is the capital of Japan?","Tokyo","Kyoto","Osaka","Nagoya","1","20","no"
"Which planet is closest to the Sun?","Venus","Mercury","Earth","Mars","Mercury","15","yes"
"The sun rises in the east.","True","False","","","True","10","no"
"Which HTML tag is used for javascript?","<js>","<scripting>","<script>","<javascript>","3","20","no"
"A byte consists of 8 bits.","True","False","","","1","10","yes"`;
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quiz_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
}

// Robust CSV Parser (supports quotes, commas, tabs, headers)
function parseCsvText(rawText) {
  const text = rawText.trim();
  if (!text) return [];

  // Split lines safely handling quotes
  const lines = [];
  let curLine = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      curLine += c;
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (curLine.trim()) lines.push(curLine.trim());
      curLine = '';
      if (c === '\r' && text[i+1] === '\n') i++;
    } else {
      curLine += c;
    }
  }
  if (curLine.trim()) lines.push(curLine.trim());

  const parsedRows = [];
  for (const line of lines) {
    let delim = ',';
    if (line.includes('\t') && (!line.includes(',') || line.split('\t').length > line.split(',').length)) {
      delim = '\t';
    } else if (line.includes(';') && (!line.includes(',') || line.split(';').length > line.split(',').length)) {
      delim = ';';
    }

    const cols = [];
    let curCol = '';
    let inColQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inColQuotes = !inColQuotes;
      } else if (c === delim && !inColQuotes) {
        cols.push(curCol.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        curCol = '';
      } else {
        curCol += c;
      }
    }
    cols.push(curCol.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    parsedRows.push(cols);
  }

  if (parsedRows.length === 0) return [];

  let startIdx = 0;
  const firstRowLower = parsedRows[0].map(s => s.toLowerCase());
  if (firstRowLower.some(h => h.includes('question') || h.includes('prompt') || h.includes('option'))) {
    startIdx = 1;
  }

  const results = [];
  for (let r = startIdx; r < parsedRows.length; r++) {
    const row = parsedRows[r];
    if (!row || row.length < 2 || !row[0]) continue;

    const qText = row[0].trim();
    if (!qText) continue;

    const opt1 = row[1] ? row[1].trim() : '';
    const opt2 = row[2] ? row[2].trim() : '';
    const opt3 = row[3] ? row[3].trim() : '';
    const opt4 = row[4] ? row[4].trim() : '';
    const correctRaw = row[5] ? row[5].trim() : (row[3] && !row[4] ? row[3].trim() : '1');
    const timeRaw = row[6] ? parseInt(row[6].trim(), 10) : 20;
    const doubleRaw = row[7] ? row[7].trim().toLowerCase() : '';

    const isTf = (!opt3 && !opt4 && (opt1.toLowerCase() === 'true' || opt1.toLowerCase() === 'false' || opt2.toLowerCase() === 'false' || opt2.toLowerCase() === 'true'));

    let correctIndex = 0;
    let options = [];
    if (isTf) {
      options = [{ text: 'True' }, { text: 'False' }];
      const crLower = correctRaw.toLowerCase();
      if (crLower === '2' || crLower === 'false' || crLower === 'f' || crLower === 'b') {
        correctIndex = 1;
      } else {
        correctIndex = 0;
      }
    } else {
      const validOpts = [opt1, opt2, opt3, opt4].filter(o => o);
      if (validOpts.length < 2) continue;
      options = [
        { text: opt1 || 'Option 1' },
        { text: opt2 || 'Option 2' },
        { text: opt3 || 'Option 3' },
        { text: opt4 || 'Option 4' },
      ];

      const crLower = correctRaw.toLowerCase();
      if (crLower === '1' || crLower === 'a' || crLower === opt1.toLowerCase()) correctIndex = 0;
      else if (crLower === '2' || crLower === 'b' || crLower === opt2.toLowerCase()) correctIndex = 1;
      else if (crLower === '3' || crLower === 'c' || crLower === opt3.toLowerCase()) correctIndex = 2;
      else if (crLower === '4' || crLower === 'd' || crLower === opt4.toLowerCase()) correctIndex = 3;
      else {
        const matchIdx = options.findIndex(o => o.text.toLowerCase() === crLower);
        correctIndex = matchIdx >= 0 ? matchIdx : 0;
      }
    }

    const seconds = !isNaN(timeRaw) && timeRaw >= 5 && timeRaw <= 120 ? timeRaw : 20;
    const isDoublePoints = doubleRaw === 'yes' || doubleRaw === 'true' || doubleRaw === '1' || doubleRaw === '2x';

    results.push({
      id: `q_${Date.now()}_${r}`,
      type: isTf ? 'tf' : 'mcq',
      text: qText,
      options,
      correctIndex,
      seconds,
      isDoublePoints,
    });
  }

  return results;
}

function updateCsvParsedState() {
  const raw = csvTextInput ? csvTextInput.value : '';
  parsedCsvQuestions = parseCsvText(raw);
  if (parsedCsvQuestions.length > 0) {
    if (csvParseStatus) {
      csvParseStatus.innerHTML = `<span style="color:#34D399;">✓ Successfully detected ${parsedCsvQuestions.length} question(s) ready to import.</span>`;
    }
    if (btnConfirmCsv) {
      btnConfirmCsv.disabled = false;
      btnConfirmCsv.textContent = `Import ${parsedCsvQuestions.length} Questions`;
    }
  } else {
    if (csvParseStatus) {
      csvParseStatus.innerHTML = raw.trim() ? `<span style="color:#FB7185;">Could not detect valid questions. Check columns format.</span>` : '';
    }
    if (btnConfirmCsv) {
      btnConfirmCsv.disabled = true;
      btnConfirmCsv.textContent = 'Import Questions (0)';
    }
  }
}

if (csvTextInput) {
  csvTextInput.oninput = updateCsvParsedState;
}

// File Upload / Dropzone
if (csvDropzone && csvFileInput) {
  csvDropzone.onclick = () => csvFileInput.click();
  csvFileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (csvTextInput) {
        csvTextInput.value = evt.target.result;
        updateCsvParsedState();
      }
    };
    reader.readAsText(file);
  };

  csvDropzone.ondragover = (e) => {
    e.preventDefault();
    csvDropzone.classList.add('dragover');
  };
  csvDropzone.ondragleave = () => {
    csvDropzone.classList.remove('dragover');
  };
  csvDropzone.ondrop = (e) => {
    e.preventDefault();
    csvDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (csvTextInput) {
          csvTextInput.value = evt.target.result;
          updateCsvParsedState();
        }
      };
      reader.readAsText(file);
    }
  };
}

// Confirm Import
if (btnConfirmCsv) {
  btnConfirmCsv.onclick = () => {
    if (parsedCsvQuestions.length === 0) return;
    questions = questions.concat(parsedCsvQuestions);
    renderQuestionList();
    closeCsvModal();
  };
}

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

let currentLobbyPin = null;
let currentLobbyIps = [];
let currentLobbyPort = 3001;

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
    console.error('QR code generation error:', e);
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
    if (activePublicUrl) {
      urlsEl.innerHTML = `
        <div style="margin-bottom:8px;">
          <span class="live-badge" style="font-size:11px; padding:3px 8px; margin-bottom:6px;">PUBLIC INTERNET ACTIVE</span><br>
          <span style="font-size:13px; color:var(--text-muted);">Direct Player Link:</span>
          <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
            <strong style="color:#38BDF8; font-size:13px; word-break:break-all;">${joinUrl}</strong>
            <button type="button" class="btn secondary" id="btnCopyLobbyUrl" style="padding:3px 10px; font-size:11px; height:24px; border-radius:var(--radius-full); flex-shrink:0;">Copy Link</button>
          </div>
        </div>
        <span style="font-size:12px; color:var(--text-muted);">
          Scan QR code or open link from any phone worldwide.
        </span>
      `;
    } else {
      urlsEl.innerHTML = `
        Direct Link:
        <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
          <strong style="color:#38BDF8; font-size:13px; word-break:break-all;">${joinUrl}</strong>
          <button type="button" class="btn secondary" id="btnCopyLobbyUrl" style="padding:3px 10px; font-size:11px; height:24px; border-radius:var(--radius-full); flex-shrink:0;">Copy Link</button>
        </div>
        <span style="font-size:12px; color:var(--text-muted); display:inline-block; margin-top:4px;">
          Local Wi-Fi Network · Cloudflare tunnel connecting…
        </span>
      `;
    }

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
    const secEl = document.getElementById('hostTimerSeconds');
    if (secEl) secEl.textContent = sec;

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

let prevLeaderboardMap = new Map();
let currentQuestionIndex = 0;
let totalQuestionsCount = 0;
let getReadyInterval = null;

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
      if (countdownEl) countdownEl.textContent = 'GO!';
      clearInterval(getReadyInterval);
    }
  }, 1000);
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
      const shapeSvg = window.Icons ? window.Icons.shape(i, 16) : LETTERS[i];
      el.innerHTML = `<span class="opt-badge">${shapeSvg}</span><span>${text}</span>`;
    }
    grid.appendChild(el);
  });
  optDiv.appendChild(grid);

  const skipBtn = document.getElementById('skipQuestion');
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

  const skipBtn = document.getElementById('skipQuestion');
  if (skipBtn) {
    skipBtn.textContent = allAnswered ? 'All Answered — Reveal Results' : 'Time Expired — Reveal Results';
    skipBtn.style.background = '#6366F1';
    skipBtn.style.color = '#fff';
    skipBtn.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.6)';
    skipBtn.style.transform = 'scale(1.05)';
  }
});

// ---------------------------------------------------------------------
// SCREEN 1: Solid Vibrant Kahoot Bar Graph Snapshot
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
    const wrapper = document.createElement('div');
    wrapper.className = 'kahoot-bars-wrapper';

    const grid = document.createElement('div');
    grid.className = `kahoot-bars-grid ${isTf ? 'tf-mode' : ''}`;

    const maxCount = Math.max(...counts, 1);

    currentQuestionMeta.options.forEach((text, i) => {
      const isCorrect = i === correctIndex;
      const count = counts[i] || 0;
      // Solid height: if 0 votes => 0%, if >0 votes => proportional height
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
      fill.style.height = `${fillHeightPct}%`;

      track.appendChild(fill);

      const footer = document.createElement('div');
      footer.className = `kahoot-bar-footer ${optClass}`;
      if (isTf) {
        const checkOrCross = i === 0 && window.Icons ? window.Icons.check(14) : (window.Icons ? window.Icons.cross(14) : (i === 0 ? '✓' : '✕'));
        footer.innerHTML = `<span class="shape-icon">${checkOrCross}</span> <span>${text}</span>`;
      } else {
        const shapeSvg = window.Icons ? window.Icons.shape(i, 16) : LETTERS[i];
        footer.innerHTML = `<span class="shape-icon" style="font-size:16px;">${shapeSvg}</span> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px;" title="${text}">${text}</span>`;
      }

      col.appendChild(countWrap);
      col.appendChild(track);
      col.appendChild(footer);
      grid.appendChild(col);
    });

    wrapper.appendChild(grid);
    bars.appendChild(wrapper);
  }

  // Next button: on last question, leads directly to Grand Podium; otherwise, to animated scoreboard
  const btnScoreboard = document.getElementById('btnGoToScoreboard');
  if (btnScoreboard) {
    const isLastQ = currentQuestionIndex + 1 >= totalQuestionsCount;
    if (isLastQ) {
      btnScoreboard.textContent = 'Reveal Grand Podium ➔';
      btnScoreboard.onclick = () => {
        if (currentPin) socket.emit('host:next', { pin: currentPin });
      };
    } else {
      btnScoreboard.textContent = 'View Scoreboard ➔';
      btnScoreboard.onclick = () => showAnimatedScoreboard(leaderboard);
    }
  }
});

// ---------------------------------------------------------------------
// SCREEN 2: Live Animated Top 10 Scoreboard (FLIP Rank Shift Animation)
// ---------------------------------------------------------------------
function showAnimatedScoreboard(leaderboard) {
  showScreen('scoreboard');
  const counter = document.getElementById('scoreboardRoundCounter');
  if (counter) counter.textContent = `Question ${currentQuestionIndex + 1} / ${totalQuestionsCount}`;

  const top10New = leaderboard.slice(0, 10);
  const ol = document.getElementById('revealLeaderboard');
  ol.innerHTML = '';

  // 1. Initial State: Render in PREVIOUS rank order so the user sees scores increment first
  const displayList = [...top10New].sort((a, b) => {
    const prevA = prevLeaderboardMap.get(a.id)?.rank || 999;
    const prevB = prevLeaderboardMap.get(b.id)?.rank || 999;
    return prevA - prevB;
  });

  const itemInfoMap = new Map();

  displayList.forEach((p, initialIdx) => {
    const prev = prevLeaderboardMap.get(p.id) || { score: 0, rank: initialIdx + 1 };
    const gained = p.score - prev.score;
    const newRank = leaderboard.findIndex((x) => x.id === p.id) + 1;
    const rankDiff = prev.rank - newRank;

    const li = document.createElement('li');
    li.className = `scoreboard-item ${prev.rank === 1 ? 'rank-1' : ''}`;
    li.dataset.playerId = p.id;
    li.id = `sbItem_${p.id}`;

    const avatarSvg = window.Avatars ? window.Avatars.getSvg(p.avatar || 'cyber_bot', 28) : '';
    const flameIcon = p.streak >= 2 && window.Icons ? window.Icons.flame(12) : '';

    li.innerHTML = `
      <div class="scoreboard-left">
        <span class="scoreboard-rank" id="rankBadge_${p.id}">#${prev.rank}</span>
        <span class="avatar-badge-sm">${avatarSvg}</span>
        <span class="scoreboard-name">${p.name}</span>
        ${p.streak >= 2 ? `<span class="streak-badge">${flameIcon} Streak ${p.streak}</span>` : ''}
        <span id="rankShiftBadge_${p.id}"></span>
      </div>
      <div class="scoreboard-right">
        ${gained > 0 ? `<span class="score-floater">+${gained}</span>` : ''}
        <div><strong class="score-num" id="scoreNum_${p.id}">${prev.score}</strong> <span class="muted" style="font-size:12px;">PTS</span></div>
      </div>
    `;
    ol.appendChild(li);

    itemInfoMap.set(p.id, {
      prevScore: prev.score,
      newScore: p.score,
      gained,
      prevRank: prev.rank,
      newRank,
      rankDiff,
    });
  });

  // Phase 1: Animate score tickers
  displayList.forEach((p, idx) => {
    const info = itemInfoMap.get(p.id);
    if (info && info.gained > 0) {
      setTimeout(() => {
        const scoreNum = document.getElementById(`scoreNum_${p.id}`);
        if (scoreNum) animateScoreCount(scoreNum, info.prevScore, info.newScore, 650);
      }, 250 + idx * 50);
    }
  });

  // Phase 2: After scores update (~850ms), execute physical FLIP slide animation
  setTimeout(() => {
    // Step A: Record initial bounding positions (First)
    const firstPositions = new Map();
    ol.querySelectorAll('.scoreboard-item').forEach((el) => {
      firstPositions.set(el.id, el.getBoundingClientRect().top);
    });

    // Step B: Reorder DOM elements according to new ranks (Last)
    top10New.forEach((p, newIdx) => {
      const el = document.getElementById(`sbItem_${p.id}`);
      if (el) {
        ol.appendChild(el);
        el.className = `scoreboard-item ${newIdx === 0 ? 'rank-1' : ''}`;
      }
    });

    // Step C: Invert and Play FLIP animation
    top10New.forEach((p, newIdx) => {
      const el = document.getElementById(`sbItem_${p.id}`);
      const info = itemInfoMap.get(p.id);
      if (!el || !info) return;

      const firstTop = firstPositions.get(el.id) || 0;
      const lastTop = el.getBoundingClientRect().top;
      const deltaY = firstTop - lastTop;

      if (deltaY !== 0) {
        // Invert
        el.style.transform = `translateY(${deltaY}px)`;
        el.style.transition = 'none';
        el.offsetHeight; // Force reflow

        // Play
        el.style.transition = 'transform 0.85s cubic-bezier(0.34, 1.35, 0.64, 1)';
        el.style.transform = 'translateY(0)';
      }

      // Update rank badge and shift badge
      const rankBadge = document.getElementById(`rankBadge_${p.id}`);
      if (rankBadge) rankBadge.textContent = `#${newIdx + 1}`;

      const rankShift = document.getElementById(`rankShiftBadge_${p.id}`);
      if (rankShift && info.rankDiff !== 0) {
        if (info.rankDiff > 0) {
          rankShift.className = 'rank-shift up';
          rankShift.innerHTML = `▲ +${info.rankDiff}`;
          if (window.QuizAudio && info.rankDiff >= 2) window.QuizAudio.playTick(1.2);
        } else {
          rankShift.className = 'rank-shift down';
          rankShift.innerHTML = `▼ ${Math.abs(info.rankDiff)}`;
        }
      }
    });

    // Save current leaderboard state for next round's delta animation
    prevLeaderboardMap.clear();
    leaderboard.forEach((p, idx) => {
      prevLeaderboardMap.set(p.id, { score: p.score, rank: idx + 1 });
    });
  }, 900);

  const nextBtn = document.getElementById('nextQuestion');
  if (nextBtn) {
    const isLastQ = currentQuestionIndex + 1 >= totalQuestionsCount;
    nextBtn.textContent = isLastQ ? 'View Final Results ➔' : 'Next Question ➔';
  }
}

function animateScoreCount(el, start, end, duration) {
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * ease);
    el.textContent = current;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

document.getElementById('nextQuestion').onclick = () => {
  if (currentPin) socket.emit('host:next', { pin: currentPin });
};

// ---------------------------------------------------------------------
// FINAL SCREEN: Staged 3-Step Spotlight Podium (3rd ➔ 2nd ➔ 1st)
// ---------------------------------------------------------------------
socket.on('game:ended', ({ leaderboard, analytics }) => {
  latestSessionData = { leaderboard, analytics, date: new Date().toISOString() };

  if (hostTimerRaf) cancelAnimationFrame(hostTimerRaf);
  if (window.QuizAudio) window.QuizAudio.stopAllMusic();

  showScreen('final');

  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

  // Render Spotlight Podium Grid Structure
  const podiumGrid = document.getElementById('podiumGrid');
  podiumGrid.innerHTML = `
    <!-- Rank 2: Silver (Left) -->
    <div class="podium-col rank-2" id="podiumCol2" style="order:1;">
      <div class="podium-avatar-card">
        <div class="avatar-badge-lg" style="width:58px; height:58px;">
          ${top2 ? window.Avatars.getSvg(top2.avatar || 'cyber_bot', 54) : ''}
        </div>
        <div class="podium-player-name">${top2 ? top2.name : '—'}</div>
        <div class="podium-player-score">${top2 ? top2.score + ' PTS' : '0 PTS'}</div>
      </div>
      <div class="podium-pedestal">
        <span class="podium-rank-num">2</span>
      </div>
    </div>

    <!-- Rank 1: Gold Champion (Center) -->
    <div class="podium-col rank-1" id="podiumCol1" style="order:2;">
      <div class="podium-avatar-card">
        <div class="podium-crown-badge">${window.Icons ? window.Icons.crown(28) : ''}</div>
        <div class="avatar-badge-lg" style="width:68px; height:68px; box-shadow:0 0 24px rgba(245, 158, 11, 0.6); border:2px solid #FCD34D;">
          ${top1 ? window.Avatars.getSvg(top1.avatar || 'astro_cat', 64) : ''}
        </div>
        <div class="podium-player-name" style="font-size:18px; font-weight:900; color:#FCD34D;">${top1 ? top1.name : '—'}</div>
        <div class="podium-player-score" style="color:#FFFFFF; font-size:15px; font-weight:800;">${top1 ? top1.score + ' PTS' : '0 PTS'}</div>
      </div>
      <div class="podium-pedestal">
        <span class="podium-rank-num">1</span>
      </div>
    </div>

    <!-- Rank 3: Bronze (Right) -->
    <div class="podium-col rank-3" id="podiumCol3" style="order:3;">
      <div class="podium-avatar-card">
        <div class="avatar-badge-lg" style="width:54px; height:54px;">
          ${top3 ? window.Avatars.getSvg(top3.avatar || 'turbo_fox', 50) : ''}
        </div>
        <div class="podium-player-name">${top3 ? top3.name : '—'}</div>
        <div class="podium-player-score">${top3 ? top3.score + ' PTS' : '0 PTS'}</div>
      </div>
      <div class="podium-pedestal">
        <span class="podium-rank-num">3</span>
      </div>
    </div>
  `;

  // Reset spotlights and finalists visibility
  const spotBronze = document.getElementById('spotlightBronze');
  const spotSilver = document.getElementById('spotlightSilver');
  const spotGold = document.getElementById('spotlightGold');
  const runnerUpsSec = document.getElementById('finalRunnerUpsSection');
  const analyticsSec = document.getElementById('finalAnalyticsSection');

  if (spotBronze) spotBronze.classList.remove('active');
  if (spotSilver) spotSilver.classList.remove('active');
  if (spotGold) spotGold.classList.remove('active');
  if (runnerUpsSec) runnerUpsSec.style.opacity = '0';
  if (analyticsSec) analyticsSec.style.opacity = '0';

  // Dramatic 3-Stage Timeline Reveal (3rd ➔ 2nd ➔ 1st)
  // Stage 1: 3rd Place Bronze (t = 600ms)
  setTimeout(() => {
    if (top3) {
      const col3 = document.getElementById('podiumCol3');
      if (col3) col3.classList.add('revealed');
      if (spotBronze) spotBronze.classList.add('active');
      if (window.QuizAudio) window.QuizAudio.playCorrect();
    }
  }, 600);

  // Stage 2: 2nd Place Silver (t = 2400ms)
  setTimeout(() => {
    if (top2) {
      const col2 = document.getElementById('podiumCol2');
      if (col2) col2.classList.add('revealed');
      if (spotSilver) spotSilver.classList.add('active');
      if (window.QuizAudio) window.QuizAudio.playStreak(3);
    }
  }, 2400);

  // Stage 3: 1st Place Gold Champion (t = 4400ms)
  setTimeout(() => {
    if (top1) {
      const col1 = document.getElementById('podiumCol1');
      if (col1) col1.classList.add('revealed');
      if (spotGold) spotGold.classList.add('active');
      if (window.QuizAudio) window.QuizAudio.playPodiumFanfare();
      if (window.QuizConfetti) window.QuizConfetti.celebrate(5500);
    }
  }, 4400);

  // Stage 4: Reveal Finalists (#4 to #10) & Session Analytics (t = 5600ms)
  setTimeout(() => {
    const runnerUps = leaderboard.slice(3, 10);
    const finalOl = document.getElementById('finalLeaderboard');
    if (finalOl) {
      finalOl.innerHTML = '';
      if (runnerUps.length > 0) {
        runnerUps.forEach((p, idx) => {
          const li = document.createElement('li');
          li.className = 'scoreboard-item';
          const avatarSvg = window.Avatars ? window.Avatars.getSvg(p.avatar || 'cyber_bot', 26) : '';
          const flameIcon = p.streak >= 2 && window.Icons ? window.Icons.flame(12) : '';

          li.innerHTML = `
            <div class="scoreboard-left">
              <span class="scoreboard-rank" style="font-weight:700;">#${idx + 4}</span>
              <span class="avatar-badge-sm">${avatarSvg}</span>
              <span class="scoreboard-name">${p.name}</span>
              ${p.streak >= 2 ? `<span class="streak-badge">${flameIcon} Streak ${p.streak}</span>` : ''}
            </div>
            <div><strong class="score-num">${p.score}</strong> <span class="muted" style="font-size:12px;">PTS</span></div>
          `;
          finalOl.appendChild(li);
        });
      }
    }
    if (runnerUpsSec) runnerUpsSec.style.opacity = runnerUps.length > 0 ? '1' : '0';

    if (analytics) {
      const analyticsGrid = document.getElementById('finalAnalyticsGrid');
      if (analyticsGrid) {
        renderAnalyticsCards(analytics);
        if (analyticsSec) {
          analyticsSec.style.display = 'block';
          analyticsSec.style.opacity = '1';
        }
      }
    }
  }, 5600);
});

function renderAnalyticsCards(analytics) {
  const grid = document.getElementById('finalAnalyticsGrid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="analytics-card">
      <span class="analytics-card-label">Session Accuracy</span>
      <div class="analytics-card-val" style="color:#34D399;">${analytics.overallAccuracy || 0}%</div>
      <span class="muted" style="font-size:11px;">${analytics.totalAnswers || 0} total responses</span>
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
