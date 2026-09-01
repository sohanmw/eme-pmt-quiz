// admin.js - Enterprise Host Management Dashboard & Quiz Builder
(function () {
  const AUTH_KEY = 'quiz_admin_token';
  let authToken = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
  let savedQuizzes = [];
  let currentEditingQuizId = null;
  let builderQuestions = [];

  const OPT_CLASSES = ['a', 'b', 'c', 'd'];
  const LETTERS = ['▲', '◆', '●', '■'];

  // Views
  const viewAuth = document.getElementById('view-auth');
  const viewDashboard = document.getElementById('view-dashboard');
  const viewBuilder = document.getElementById('view-builder');

  function showView(viewName) {
    if (viewAuth) viewAuth.style.display = viewName === 'auth' ? 'flex' : 'none';
    if (viewDashboard) viewDashboard.style.display = viewName === 'dashboard' ? 'block' : 'none';
    if (viewBuilder) viewBuilder.style.display = viewName === 'builder' ? 'block' : 'none';
  }

  // ---------------------------------------------------------------------
  // API Fetch Helper with Auth Header
  // ---------------------------------------------------------------------
  async function apiFetch(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      clearAuth();
      showView('auth');
      throw new Error('Unauthorized');
    }
    return res.json();
  }

  function setAuth(token, email) {
    authToken = token;
    localStorage.setItem(AUTH_KEY, token);
    const badge = document.getElementById('adminUserBadge');
    if (badge && email) badge.textContent = email;
  }

  function clearAuth() {
    authToken = null;
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
  }

  // ---------------------------------------------------------------------
  // Auth Form & Handlers
  // ---------------------------------------------------------------------
  const authForm = document.getElementById('authForm');
  const authError = document.getElementById('authError');
  const btnLogout = document.getElementById('btnLogout');

  if (authForm) {
    authForm.onsubmit = async (e) => {
      e.preventDefault();
      if (authError) authError.style.display = 'none';

      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (data.ok && data.token) {
          setAuth(data.token, data.email);
          showView('dashboard');
          loadDashboard();
        } else {
          if (authError) {
            authError.textContent = data.error || 'Invalid credentials';
            authError.style.display = 'block';
          }
        }
      } catch (err) {
        if (authError) {
          authError.textContent = 'Connection error. Please try again.';
          authError.style.display = 'block';
        }
      }
    };
  }

  if (btnLogout) {
    btnLogout.onclick = async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } catch (e) {}
      clearAuth();
      showView('auth');
    };
  }

  // ---------------------------------------------------------------------
  // Dashboard Management
  // ---------------------------------------------------------------------
  async function loadDashboard() {
    try {
      const data = await apiFetch('/api/quizzes');
      if (data.ok) {
        savedQuizzes = data.quizzes || [];
        renderDashboard();
      }
    } catch (e) {
      console.error('Failed to load dashboard quizzes:', e);
    }
  }

  function renderDashboard() {
    const grid = document.getElementById('adminQuizGrid');
    const metricQuiz = document.getElementById('metricQuizCount');
    const metricQ = document.getElementById('metricQuestionCount');

    let totalQuestions = 0;
    savedQuizzes.forEach((q) => {
      totalQuestions += (q.questions || []).length;
    });

    if (metricQuiz) metricQuiz.textContent = savedQuizzes.length;
    if (metricQ) metricQ.textContent = totalQuestions;

    if (!grid) return;
    grid.innerHTML = '';

    if (savedQuizzes.length === 0) {
      grid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align:center; padding:48px 20px;">
          <div style="font-size:36px; margin-bottom:12px;">📁</div>
          <h3 style="margin:0 0 8px; font-size:18px; font-weight:800;">No Saved Quizzes Found</h3>
          <p class="muted" style="margin:0 auto 20px; max-width:400px; font-size:14px;">
            Create your first quiz deck, import from CSV, or load the pre-built sample trivia deck.
          </p>
          <div class="row" style="justify-content:center; gap:10px;">
            <button class="btn" onclick="window.AdminApp.openNewQuizBuilder()">+ Create First Quiz</button>
            <button class="btn secondary" onclick="window.AdminApp.loadSampleTrivia()">+ Load Sample Trivia</button>
          </div>
        </div>
      `;
      return;
    }

    savedQuizzes.forEach((quiz) => {
      const card = document.createElement('div');
      card.className = 'quiz-deck-card';

      const count = (quiz.questions || []).length;
      const estSec = (quiz.questions || []).reduce((acc, cur) => acc + (cur.seconds || 20), 0);
      const estMin = Math.ceil(estSec / 60);

      card.innerHTML = `
        <div>
          <h3 class="quiz-deck-title">${escapeHtml(quiz.title || 'Untitled Session')}</h3>
          <div class="quiz-deck-meta">
            <span class="pill" style="font-size:11px; padding:3px 8px;">${count} Questions</span>
            <span>⏱️ ~${estMin} min</span>
            <span>📅 ${quiz.dateStr || 'Saved'}</span>
          </div>
        </div>
        <div class="quiz-deck-actions">
          <button class="btn btn-live" style="flex:1; padding:8px 12px; font-size:12px;" onclick="window.AdminApp.launchQuiz('${quiz.id}')">
            🚀 Go Live
          </button>
          <button class="btn secondary" style="padding:8px 12px; font-size:12px;" onclick="window.AdminApp.editQuiz('${quiz.id}')">
            ✏️ Edit
          </button>
          <button class="btn secondary" style="padding:8px 10px; font-size:12px;" title="Duplicate Quiz" onclick="window.AdminApp.duplicateQuiz('${quiz.id}')">
            📋
          </button>
          <button class="btn secondary" style="padding:8px 10px; font-size:12px; color:#FB7185;" title="Delete Quiz" onclick="window.AdminApp.deleteQuiz('${quiz.id}')">
            🗑️
          </button>
        </div>
      `;

      grid.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------
  // Launch Quiz (Opens Clean Presenter View in New Tab)
  // ---------------------------------------------------------------------
  async function launchQuiz(quizId, quizData = null) {
    try {
      const payload = quizData ? { quizData } : { quizId };
      const res = await apiFetch('/api/games/launch', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.ok && res.presenterUrl) {
        // Open the clean projector view in a new browser tab!
        const win = window.open(res.presenterUrl, '_blank');
        if (!win) {
          window.location.href = res.presenterUrl;
        }
      } else {
        alert(res.error || 'Failed to launch live session.');
      }
    } catch (err) {
      alert('Error launching session: ' + err.message);
    }
  }

  // ---------------------------------------------------------------------
  // Quiz Builder / Editor
  // ---------------------------------------------------------------------
  function openNewQuizBuilder() {
    currentEditingQuizId = null;
    builderQuestions = [];
    document.getElementById('builderQuizTitle').value = '';
    document.getElementById('builderModeBadge').textContent = 'New Quiz Deck';
    showView('builder');
    renderBuilderQuestions();
  }

  function editQuiz(quizId) {
    const target = savedQuizzes.find((q) => q.id === quizId);
    if (!target) return;
    currentEditingQuizId = quizId;
    document.getElementById('builderQuizTitle').value = target.title || '';
    document.getElementById('builderModeBadge').textContent = `Editing: ${target.title}`;

    builderQuestions = JSON.parse(JSON.stringify(target.questions || [])).map((q, i) => ({
      id: q.id || `q_${Date.now()}_${i}`,
      type: q.type || 'mcq',
      text: q.text || '',
      image: q.image || null,
      isDoublePoints: !!q.isDoublePoints,
      options: q.options || (q.type === 'tf' ? [{ text: 'True' }, { text: 'False' }] : [{ text: '' }, { text: '' }, { text: '' }, { text: '' }]),
      correctIndex: Number(q.correctIndex) || 0,
      seconds: q.seconds || (q.limitMs ? Math.round(q.limitMs / 1000) : 20),
    }));

    showView('builder');
    renderBuilderQuestions();
  }

  async function duplicateQuiz(quizId) {
    const target = savedQuizzes.find((q) => q.id === quizId);
    if (!target) return;
    const copy = JSON.parse(JSON.stringify(target));
    copy.id = `quiz_${Date.now()}`;
    copy.title = `${copy.title} (Copy)`;
    try {
      await apiFetch('/api/quizzes', {
        method: 'POST',
        body: JSON.stringify(copy),
      });
      loadDashboard();
    } catch (e) {
      alert('Failed to duplicate quiz.');
    }
  }

  async function deleteQuiz(quizId) {
    const target = savedQuizzes.find((q) => q.id === quizId);
    const title = target ? target.title : 'this quiz';
    if (!confirm(`Are you sure you want to delete "${title}" from your Mac?`)) return;

    try {
      await apiFetch(`/api/quizzes/${quizId}`, { method: 'DELETE' });
      loadDashboard();
    } catch (e) {
      alert('Failed to delete quiz.');
    }
  }

  async function saveCurrentQuiz() {
    const title = document.getElementById('builderQuizTitle').value.trim() || 'Untitled Session';
    const err = document.getElementById('builderError');
    if (err) err.textContent = '';

    if (builderQuestions.length === 0) {
      if (err) err.textContent = 'Please add at least one question before saving.';
      return null;
    }

    const invalid = builderQuestions.find((q) => {
      if (!q.text.trim()) return true;
      if (q.options.some((o) => !o.text.trim())) return true;
      return false;
    });

    if (invalid) {
      if (err) err.textContent = 'Please fill in all question prompt and option text fields.';
      return null;
    }

    const payload = {
      id: currentEditingQuizId || `quiz_${Date.now()}`,
      title,
      questions: builderQuestions.map((q) => ({
        type: q.type,
        text: q.text.trim(),
        image: q.image || null,
        isDoublePoints: !!q.isDoublePoints,
        options: q.options.map((o) => ({ text: o.text.trim() })),
        correctIndex: q.correctIndex,
        seconds: q.seconds || 20,
        limitMs: (q.seconds || 20) * 1000,
      })),
    };

    try {
      const res = await apiFetch('/api/quizzes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        currentEditingQuizId = res.quiz.id;
        document.getElementById('builderModeBadge').textContent = `Saved: ${res.quiz.title}`;
        return res.quiz;
      }
    } catch (e) {
      if (err) err.textContent = 'Failed to save quiz to disk.';
    }
    return null;
  }

  function renderBuilderQuestions() {
    const container = document.getElementById('builderQuestionList');
    const countLabel = document.getElementById('builderTotalCount');
    if (countLabel) countLabel.textContent = `${builderQuestions.length} Question${builderQuestions.length === 1 ? '' : 's'}`;
    if (!container) return;

    container.innerHTML = '';
    builderQuestions.forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = 'q-item';

      const isTf = q.type === 'tf';
      const shapeSvg0 = window.Icons ? window.Icons.shape(0, 14) : '▲';
      const shapeSvg1 = window.Icons ? window.Icons.shape(1, 14) : '◆';
      const shapeSvg2 = window.Icons ? window.Icons.shape(2, 14) : '●';
      const shapeSvg3 = window.Icons ? window.Icons.shape(3, 14) : '■';

      card.innerHTML = `
        <div class="q-head">
          <div class="row" style="gap:8px;">
            <span class="pill" style="font-size:11px; padding:2px 8px;">#${idx + 1}</span>
            <span class="q-type-badge">${isTf ? 'True / False' : 'Multiple Choice'}</span>
            <label class="q-double-toggle ${q.isDoublePoints ? 'active' : ''}">
              <input type="checkbox" ${q.isDoublePoints ? 'checked' : ''} onchange="window.AdminApp.toggle2x(${idx}, this.checked)">
              ⚡ 2X Double Points
            </label>
          </div>
          <div class="q-actions">
            <button class="btn-icon" title="Move Up" ${idx === 0 ? 'disabled' : ''} onclick="window.AdminApp.moveQ(${idx}, -1)">↑</button>
            <button class="btn-icon" title="Move Down" ${idx === builderQuestions.length - 1 ? 'disabled' : ''} onclick="window.AdminApp.moveQ(${idx}, 1)">↓</button>
            <button class="btn-icon" title="Delete Question" style="color:#FB7185;" onclick="window.AdminApp.deleteQ(${idx})">✕</button>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <input type="text" class="q-input" placeholder="Type question prompt here..." value="${escapeHtml(q.text)}" oninput="window.AdminApp.updateQText(${idx}, this.value)">
        </div>

        <div class="row between" style="margin-bottom:12px; gap:12px; flex-wrap:wrap;">
          <div class="row" style="gap:8px; align-items:center;">
            <label class="q-label" style="margin:0;">Time Limit:</label>
            <select class="q-select" onchange="window.AdminApp.updateQSec(${idx}, this.value)">
              <option value="10" ${q.seconds === 10 ? 'selected' : ''}>10 seconds</option>
              <option value="15" ${q.seconds === 15 ? 'selected' : ''}>15 seconds</option>
              <option value="20" ${q.seconds === 20 || !q.seconds ? 'selected' : ''}>20 seconds</option>
              <option value="30" ${q.seconds === 30 ? 'selected' : ''}>30 seconds</option>
              <option value="60" ${q.seconds === 60 ? 'selected' : ''}>60 seconds</option>
            </select>
          </div>
          <div class="row" style="gap:8px; align-items:center;">
            <label class="q-label" style="margin:0;">Image URL:</label>
            <input type="text" placeholder="https://... (optional)" value="${escapeHtml(q.image || '')}" style="font-size:12px; padding:6px 10px; width:220px;" oninput="window.AdminApp.updateQImage(${idx}, this.value)">
          </div>
        </div>

        <div class="q-opts-grid ${isTf ? 'tf' : ''}">
          ${isTf ? `
            <div class="q-opt-row">
              <input type="radio" name="corr_${idx}" value="0" ${q.correctIndex === 0 ? 'checked' : ''} onchange="window.AdminApp.updateQCorrect(${idx}, 0)">
              <span class="q-opt-badge tf-true">✓</span>
              <input type="text" class="q-opt-input" value="True" readonly>
            </div>
            <div class="q-opt-row">
              <input type="radio" name="corr_${idx}" value="1" ${q.correctIndex === 1 ? 'checked' : ''} onchange="window.AdminApp.updateQCorrect(${idx}, 1)">
              <span class="q-opt-badge tf-false">✕</span>
              <input type="text" class="q-opt-input" value="False" readonly>
            </div>
          ` : `
            <div class="q-opt-row">
              <input type="radio" name="corr_${idx}" value="0" ${q.correctIndex === 0 ? 'checked' : ''} onchange="window.AdminApp.updateQCorrect(${idx}, 0)">
              <span class="q-opt-badge a">${shapeSvg0}</span>
              <input type="text" class="q-opt-input" placeholder="Option 1" value="${escapeHtml(q.options[0]?.text || '')}" oninput="window.AdminApp.updateQOpt(${idx}, 0, this.value)">
            </div>
            <div class="q-opt-row">
              <input type="radio" name="corr_${idx}" value="1" ${q.correctIndex === 1 ? 'checked' : ''} onchange="window.AdminApp.updateQCorrect(${idx}, 1)">
              <span class="q-opt-badge b">${shapeSvg1}</span>
              <input type="text" class="q-opt-input" placeholder="Option 2" value="${escapeHtml(q.options[1]?.text || '')}" oninput="window.AdminApp.updateQOpt(${idx}, 1, this.value)">
            </div>
            <div class="q-opt-row">
              <input type="radio" name="corr_${idx}" value="2" ${q.correctIndex === 2 ? 'checked' : ''} onchange="window.AdminApp.updateQCorrect(${idx}, 2)">
              <span class="q-opt-badge c">${shapeSvg2}</span>
              <input type="text" class="q-opt-input" placeholder="Option 3" value="${escapeHtml(q.options[2]?.text || '')}" oninput="window.AdminApp.updateQOpt(${idx}, 2, this.value)">
            </div>
            <div class="q-opt-row">
              <input type="radio" name="corr_${idx}" value="3" ${q.correctIndex === 3 ? 'checked' : ''} onchange="window.AdminApp.updateQCorrect(${idx}, 3)">
              <span class="q-opt-badge d">${shapeSvg3}</span>
              <input type="text" class="q-opt-input" placeholder="Option 4" value="${escapeHtml(q.options[3]?.text || '')}" oninput="window.AdminApp.updateQOpt(${idx}, 3, this.value)">
            </div>
          `}
        </div>
      `;

      container.appendChild(card);
    });
  }

  // Builder event buttons
  document.getElementById('btnCreateNewQuiz').onclick = openNewQuizBuilder;
  document.getElementById('btnBackToDashboard').onclick = () => {
    showView('dashboard');
    loadDashboard();
  };
  document.getElementById('btnSaveQuiz').onclick = async () => {
    const saved = await saveCurrentQuiz();
    if (saved) alert('✓ Quiz saved to your Mac hard drive!');
  };
  document.getElementById('btnSaveQuizBottom').onclick = async () => {
    const saved = await saveCurrentQuiz();
    if (saved) alert('✓ Quiz saved to your Mac hard drive!');
  };

  document.getElementById('btnLaunchLiveFromBuilder').onclick = async () => {
    const saved = await saveCurrentQuiz();
    if (saved) launchQuiz(null, saved);
  };
  document.getElementById('btnLaunchLiveBottom').onclick = async () => {
    const saved = await saveCurrentQuiz();
    if (saved) launchQuiz(null, saved);
  };

  document.getElementById('btnAddMcq').onclick = () => {
    builderQuestions.push({
      id: `q_${Date.now()}`,
      type: 'mcq',
      text: '',
      image: null,
      isDoublePoints: false,
      options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
      correctIndex: 0,
      seconds: 20,
    });
    renderBuilderQuestions();
  };

  document.getElementById('btnAddTf').onclick = () => {
    builderQuestions.push({
      id: `q_${Date.now()}`,
      type: 'tf',
      text: '',
      image: null,
      isDoublePoints: false,
      options: [{ text: 'True' }, { text: 'False' }],
      correctIndex: 0,
      seconds: 20,
    });
    renderBuilderQuestions();
  };

  // ---------------------------------------------------------------------
  // CSV Import Modal
  // ---------------------------------------------------------------------
  const modalCsv = document.getElementById('modalCsvImport');
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
    parsedCsvQuestions = [];
    if (btnConfirmCsv) {
      btnConfirmCsv.disabled = true;
      btnConfirmCsv.textContent = 'Import Questions (0)';
    }
  }

  function closeCsvModal() {
    if (modalCsv) modalCsv.style.display = 'none';
  }

  document.getElementById('btnDashImportCsv').onclick = () => {
    openNewQuizBuilder();
    openCsvModal();
  };
  document.getElementById('btnBuilderImportCsv').onclick = openCsvModal;
  if (btnCloseCsv) btnCloseCsv.onclick = closeCsvModal;
  if (btnCancelCsv) btnCancelCsv.onclick = closeCsvModal;

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

  function parseCsvText(rawText) {
    const text = rawText.trim();
    if (!text) return [];

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

  if (csvTextInput) csvTextInput.oninput = updateCsvParsedState;

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
  }

  if (btnConfirmCsv) {
    btnConfirmCsv.onclick = () => {
      if (parsedCsvQuestions.length === 0) return;
      builderQuestions = builderQuestions.concat(parsedCsvQuestions);
      renderBuilderQuestions();
      closeCsvModal();
    };
  }

  // Load sample deck helper
  document.getElementById('btnLoadSampleDecks').onclick = async () => {
    const sampleDeck = {
      id: `sample_growth_trivia`,
      title: 'Digital Marketing & Growth Trivia (Sample)',
      questions: [
        {
          type: 'mcq',
          text: 'What does "ROAS" stand for in performance marketing?',
          options: [{ text: 'Return on Ad Spend' }, { text: 'Rate of Acquisition Spend' }, { text: 'Revenue over Annual Sales' }, { text: 'Reach of Audience Size' }],
          correctIndex: 0,
          seconds: 20,
          isDoublePoints: false,
        },
        {
          type: 'tf',
          text: 'Google Analytics 4 uses an event-based data model rather than session-based.',
          options: [{ text: 'True' }, { text: 'False' }],
          correctIndex: 0,
          seconds: 15,
          isDoublePoints: false,
        },
        {
          type: 'mcq',
          text: 'Which email metric is most directly impacted by Apple Mail Privacy Protection (MPP)?',
          options: [{ text: 'Click-Through Rate (CTR)' }, { text: 'Open Rate' }, { text: 'Spam Complaint Rate' }, { text: 'Unsubscribe Rate' }],
          correctIndex: 1,
          seconds: 20,
          isDoublePoints: true,
        },
        {
          type: 'mcq',
          text: 'What is the primary objective of a Lookalike Audience in Meta Ads?',
          options: [{ text: 'Retarget abandoned carts' }, { text: 'Find new prospects resembling existing customers' }, { text: 'Block competitor IP addresses' }, { text: 'Target only current email newsletter subscribers' }],
          correctIndex: 1,
          seconds: 20,
          isDoublePoints: false,
        }
      ]
    };
    try {
      await apiFetch('/api/quizzes', {
        method: 'POST',
        body: JSON.stringify(sampleDeck),
      });
      loadDashboard();
      alert('✓ Sample deck added to your Mac library!');
    } catch (e) {
      alert('Failed to save sample deck.');
    }
  };

  // Helper utils
  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Global methods for inline event handlers
  window.AdminApp = {
    openNewQuizBuilder,
    editQuiz,
    duplicateQuiz,
    deleteQuiz,
    launchQuiz,
    loadSampleTrivia: () => document.getElementById('btnLoadSampleDecks').click(),
    toggle2x: (idx, val) => {
      if (builderQuestions[idx]) builderQuestions[idx].isDoublePoints = val;
    },
    moveQ: (idx, dir) => {
      const target = idx + dir;
      if (target < 0 || target >= builderQuestions.length) return;
      const temp = builderQuestions[idx];
      builderQuestions[idx] = builderQuestions[target];
      builderQuestions[target] = temp;
      renderBuilderQuestions();
    },
    deleteQ: (idx) => {
      builderQuestions.splice(idx, 1);
      renderBuilderQuestions();
    },
    updateQText: (idx, val) => {
      if (builderQuestions[idx]) builderQuestions[idx].text = val;
    },
    updateQSec: (idx, val) => {
      if (builderQuestions[idx]) builderQuestions[idx].seconds = Number(val) || 20;
    },
    updateQImage: (idx, val) => {
      if (builderQuestions[idx]) builderQuestions[idx].image = val.trim() || null;
    },
    updateQCorrect: (idx, optIdx) => {
      if (builderQuestions[idx]) builderQuestions[idx].correctIndex = optIdx;
    },
    updateQOpt: (idx, optIdx, val) => {
      if (builderQuestions[idx] && builderQuestions[idx].options[optIdx]) {
        builderQuestions[idx].options[optIdx].text = val;
      }
    },
  };

  // Check current auth status on load
  (async function checkInitialAuth() {
    if (!authToken) {
      showView('auth');
      return;
    }
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        setAuth(authToken, res.email);
        showView('dashboard');
        loadDashboard();
      } else {
        clearAuth();
        showView('auth');
      }
    } catch (e) {
      clearAuth();
      showView('auth');
    }
  })();
})();
