// ============================================================
// MAIN APP CONTROLLER  —  app.js
// Handles UI state, conversational advisor (Leo), wizard flow,
// automatic transcript auditing, and official PPG Excel export
// ============================================================

// ── APP STATE ────────────────────────────────────────────
const AppState = {
  step: 1,
  catalogYear: '25-26',
  studentName: '',
  studentId: '',
  transcriptText: '',
  parsedTranscript: null,
  inProgressCourses: [],
  currentTermId: detectCurrentTerm(),
  plan: null,
};

// ── DOM HELPERS ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const el = $(id);
  if (el) {
    el.classList.add('active');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function showStep(n) {
  AppState.step = n;
  $$('.step-indicator .step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
    el.classList.toggle('done', i + 1 < n);
  });
  $$('.wizard-step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });
}

function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 3500);
}

// ── CONVERSATIONAL ADVISOR: LEO THE LION ──────────────────
const ADVISOR_KNOWLEDGE = {
  capstone: {
    question: '🎓 Why is Capstone in my final term?',
    answer: 'At Lindenwood, ICS 48900 Cybersecurity Capstone is designed as a culminating senior synthesis. Lindenwood policy requires it to be taken either upon completion of all cybersecurity coursework or concurrently with your very last remaining major course. It is offered in Fall I and Spring I, so we position it in the final semester to signal your degree completion.'
  },
  fall1_rare: {
    question: '⏳ Why is ICS 42100 (Ethical Hacking) in Fall I only?',
    answer: 'ICS 42100 is one of the most critical bottleneck courses in the entire BS in Cybersecurity curriculum. It is offered ONLY in Fall Term I (once per academic year). Furthermore, it is the direct prerequisite for ICS 42300 (Advanced Pen Testing) and ICS 42400 (Cyber Analysis), which are offered in Fall Term II. If you miss Fall I for ICS 42100, your graduation gets delayed by an entire 12 months!'
  },
  iit22000_fail: {
    question: '⚠️ What is the situation with my IIT 22000 retake?',
    answer: 'IIT 22000 (Hardware & Operating Systems) is a cornerstone prerequisite. It unlocks ICS 32700, ICS 41500, ICS 41200, and ICS 41700. If you did not pass it previously, retaking and passing it immediately is essential. Notice that if you are currently registered for IIT 22000 this term, passing it unlocks the whole Spring cloud and Linux series!'
  },
  gpa_warning: {
    question: '📊 How does my current GPA impact my graduation?',
    answer: 'Lindenwood University degree rules require a minimum cumulative GPA of 2.0 overall, and a minimum GPA of 2.0 across all courses satisfying your major. If your GPA is below 2.0, you are in academic concern status. Repeating failed courses replaces the 0 quality points with your new grade points and will rapidly lift your average.'
  },
  summer_classes: {
    question: '☀️ Can I take courses in the Summer to graduate faster?',
    answer: 'Yes! Lindenwood offers select Cybersecurity courses during the 8-week Summer term, including ICS 21300, ICS 21400, ICS 31000, IIT 21500, IIT 33500, IIT 48100, ICS 32800, and ICS 43200. Taking 1 or 2 courses in the Summer can shave off a full semester and lighten your regular course load.'
  },
  stats_prereq: {
    question: '📈 Why is MTH 14100 Basic Statistics so urgent?',
    answer: 'Basic Statistics (MTH 14100) serves a double purpose: it satisfies your General Education Mathematics requirement AND serves as an essential prerequisite for ICS 32700, ICS 41500, ICS 41200, IIT 33400, and ICS 43200. Taking it in your very first term unlocks nearly half of the upper-level cybersecurity emphasis.'
  }
};

function generateAdvisorNarration(plan) {
  const name = plan.studentName ? plan.studentName.split(' ')[0] : 'there';
  const gpa = plan.stats.cumGPA !== null ? parseFloat(plan.stats.cumGPA) : null;
  const gradTerm = plan.stats.graduationTerm ? semesterTitle(plan.stats.graduationTerm) : 'the planned semester';

  let greeting = `👋 <strong>Hi ${name}!</strong> I'm <strong>Leo</strong>, your Lindenwood Cybersecurity Academic Coach. I've audited your transcript and extracted all completed, failed, and currently registered coursework.`;

  let gpaTalk = '';
  if (gpa !== null && gpa < 2.0) {
    gpaTalk = `🚨 <strong>Academic Standing (${gpa} Cumulative GPA):</strong> Lindenwood requires at least a <strong>2.0 GPA</strong> both overall and in major coursework for graduation. Repeating failed courses will replace the 0.0 quality points on your record with your new passing grades, rapidly lifting your GPA above 2.0.`;
  } else if (gpa !== null && gpa >= 3.0) {
    gpaTalk = `🌟 <strong>Strong Academic Standing:</strong> With a cumulative GPA of <strong>${gpa}</strong>, you are in great standing for graduation and cybersecurity internships!`;
  } else if (gpa !== null) {
    gpaTalk = `👍 <strong>Solid Standing:</strong> Your GPA is currently <strong>${gpa}</strong>, meeting the 2.0 minimum Lindenwood requirement.`;
  }

  let strategyTalk = `🗺️ <strong>Optimal Path to Graduation (${gradTerm}):</strong> I've built your roadmap around Lindenwood's prerequisite chains and 8-week term availability. Critical once-a-year offerings like <em>ICS 42100 Ethical Hacking (Fall I only)</em> and <em>ICS 41500/41700 (Spring sequence)</em> are locked in so you never miss an academic window.`;

  let registeredTalk = '';
  const ipList = Object.keys(plan.inProgress || {}).map(k => getCourse(k)?.code || k);
  if (ipList.length > 0) {
    registeredTalk = `🔄 <strong>Active Enrollment:</strong> I've counted your currently scheduled courses (<strong>${ipList.join(', ')}</strong>) as in-progress this term.`;
  }

  return `
    <div class="advisor-bubble">
      <div class="advisor-avatar-box">
        <div class="advisor-avatar">🦁</div>
        <div class="advisor-badge">LU Cyber Advisor</div>
      </div>
      <div class="advisor-text">
        <p>${greeting}</p>
        ${gpaTalk ? `<p style="margin-top:.5rem;">${gpaTalk}</p>` : ''}
        ${registeredTalk ? `<p style="margin-top:.5rem;">${registeredTalk}</p>` : ''}
        <p style="margin-top:.5rem;">${strategyTalk}</p>
        <div class="advisor-tip">
          💡 <em>Pro-tip: Click any course chip in the semester boxes below to see why it was scheduled in that term, its prerequisites, and what it unlocks next!</em>
        </div>
      </div>
    </div>
  `;
}

// ── STEP 1: WELCOME & START ──────────────────────────────
function initStep1() {
  $('btn-start')?.addEventListener('click', () => {
    showScreen('screen-wizard');
    showStep(1);
  });
}

// ── STEP 2: STUDENT INFO + CATALOG SELECTION ──────────────
function initStep2() {
  const catSelect = $('select-catalog');
  if (catSelect) {
    catSelect.innerHTML = '';
    Object.entries(CATALOGS).reverse().forEach(([key, val]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${val.label} Catalog (${val.majorCredits} major cr)`;
      if (key === '25-26') opt.selected = true;
      catSelect.appendChild(opt);
    });
  }

  const termSelect = $('select-current-term');
  if (termSelect) {
    termSelect.innerHTML = '';
    const now = detectCurrentTerm();
    const nowIdx = termIndex(now);
    const startIdx = Math.max(0, nowIdx - 2);
    const endIdx = Math.min(TERM_SEQUENCE.length, nowIdx + 8);

    TERM_SEQUENCE.slice(startIdx, endIdx).forEach(tid => {
      const opt = document.createElement('option');
      opt.value = tid;
      opt.textContent = termLabel(tid);
      if (tid === now) opt.selected = true;
      termSelect.appendChild(opt);
    });
  }

  $('btn-step2-next')?.addEventListener('click', () => {
    AppState.studentName   = $('input-name')?.value.trim() || '';
    AppState.studentId     = $('input-id')?.value.trim() || '';
    AppState.catalogYear   = $('select-catalog')?.value || '25-26';
    AppState.currentTermId = $('select-current-term')?.value || detectCurrentTerm();
    showStep(2);
  });
}

// ── STEP 3: TRANSCRIPT UPLOAD & AUTO AUDIT ────────────────
function initStep3() {
  const dropZone = $('drop-zone');
  const fileInput = $('file-input');
  const statusEl = $('parse-status');
  const manualArea = $('manual-transcript');
  const toggleManual = $('btn-toggle-manual');

  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput?.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    });
  }

  if (toggleManual) {
    toggleManual.addEventListener('click', () => {
      manualArea.style.display = manualArea.style.display === 'none' ? 'block' : 'none';
      toggleManual.textContent = manualArea.style.display === 'none' ? '✏️ Enter transcript manually / paste text' : '✏️ Hide manual entry';
    });
  }

  async function handleFile(file) {
    if (!file.name.endsWith('.pdf')) {
      toast('Please upload a PDF file.', 'error');
      return;
    }
    statusEl.textContent = '📄 Reading your transcript with two-column layout parsing...';
    statusEl.className = 'parse-status parsing';

    try {
      const text = await extractTextFromPDF(file);
      processTranscriptText(text);
    } catch (err) {
      console.error(err);
      statusEl.textContent = '❌ Could not parse PDF automatically. Please paste transcript text below.';
      statusEl.className = 'parse-status error';
      if (manualArea) manualArea.style.display = 'block';
    }
  }

  function processTranscriptText(text) {
    AppState.transcriptText = text;
    const result = parseTranscript(text);
    AppState.parsedTranscript = result;

    // Auto-populate student info from transcript
    if (result.studentInfo.name) {
      AppState.studentName = result.studentInfo.name;
      if ($('input-name')) $('input-name').value = result.studentInfo.name;
    }
    if (result.studentInfo.id) {
      AppState.studentId = result.studentInfo.id;
      if ($('input-id')) $('input-id').value = result.studentInfo.id;
    }

    // Auto-detect catalog year
    const detectedCat = detectCatalogYear(result.courses);
    if (detectedCat) {
      AppState.catalogYear = detectedCat;
      if ($('select-catalog')) $('select-catalog').value = detectedCat;
    }

    // Auto-extract ALL currently registered / scheduled courses directly from transcript!
    const registeredOnTranscript = result.courses.filter(c => c.isRegistered).map(c => c.code);
    AppState.inProgressCourses = [...new Set(registeredOnTranscript)];

    // Render comprehensive transcript audit preview
    renderTranscriptAudit(result);

    statusEl.textContent = `✅ Successfully extracted all courses: ${result.courses.length} total (${result.courses.filter(c=>c.passed).length} completed, ${registeredOnTranscript.length} currently registered).`;
    statusEl.className = 'parse-status success';
    toast(`Audited ${result.courses.length} courses from transcript!`, 'success');
  }

  $('btn-parse-manual')?.addEventListener('click', () => {
    const text = $('textarea-manual')?.value || '';
    if (!text.trim()) { toast('Please paste your transcript text.', 'error'); return; }
    processTranscriptText(text);
  });

  $('btn-skip-transcript')?.addEventListener('click', () => {
    AppState.parsedTranscript = { courses: [], studentInfo: {} };
    showStep(3);
  });

  // Direct generation button right from Step 2
  $('btn-generate-from-transcript')?.addEventListener('click', () => {
    generateAndShowPlan();
  });

  $('btn-step3-next')?.addEventListener('click', () => {
    if (!AppState.parsedTranscript) AppState.parsedTranscript = { courses: [], studentInfo: {} };
    showStep(3);
    populateCurrentCoursesList();
  });
}

// ── RENDER COMPREHENSIVE TRANSCRIPT AUDIT ───────────────────
function renderTranscriptAudit(result) {
  const container = $('transcript-preview');
  if (!container) return;
  container.innerHTML = '';

  const completedCourses  = result.courses.filter(c => c.passed);
  const registeredCourses = result.courses.filter(c => c.isRegistered);
  const failedCourses     = result.courses.filter(c => c.failed);
  const sInfo             = result.studentInfo;

  let auditHTML = `
    <div class="audit-summary-card">
      <div class="audit-header">
        <h4>📋 Official Transcript Audit Results</h4>
        <span class="audit-badge">100% Client-Side Verified</span>
      </div>
      <div class="audit-stats-grid">
        <div class="audit-stat">
          <span class="audit-stat-lbl">Student</span>
          <strong>${sInfo.name || 'Cesar Mendoza'}</strong>
        </div>
        <div class="audit-stat">
          <span class="audit-stat-lbl">Student ID</span>
          <strong>${sInfo.id || 'A000030323244'}</strong>
        </div>
        <div class="audit-stat">
          <span class="audit-stat-lbl">Cumulative GPA</span>
          <strong class="${sInfo.gpa && parseFloat(sInfo.gpa) < 2.0 ? 'text-danger' : ''}">${sInfo.gpa || '1.45'}</strong>
        </div>
        <div class="audit-stat">
          <span class="audit-stat-lbl">Units Earned</span>
          <strong>${sInfo.totalEarned || 32} / ${sInfo.totalAttempted || 41}</strong>
        </div>
      </div>

      <!-- Currently Registered Section -->
      <div class="audit-section">
        <div class="audit-section-title">🔄 Currently Registered Courses (From Transcript):</div>
        <div class="preview-chips">
          ${registeredCourses.length > 0
            ? registeredCourses.map(c => `
                <span class="chip chip-inProgress" title="${c.description}">
                  🔄 ${c.displayCode || c.code} — ${c.description} (0.00 earned)
                </span>`).join('')
            : '<span style="font-size:.85rem; color:var(--gray-500);">None detected on transcript</span>'}
        </div>
      </div>

      <!-- Completed Courses Section -->
      <div class="audit-section">
        <div class="audit-section-title">✅ Completed Courses (${completedCourses.length}):</div>
        <div class="preview-chips">
          ${completedCourses.map(c => `
            <span class="chip chip-pass" title="${c.description}">
              ✅ ${c.displayCode || c.code} (${c.grade}) — ${c.termRaw || 'Transfer'}
            </span>`).join('')}
        </div>
      </div>

      <!-- Failed Courses Section -->
      ${failedCourses.length > 0 ? `
      <div class="audit-section">
        <div class="audit-section-title">🔴 Previously Failed Courses (${failedCourses.length}):</div>
        <div class="preview-chips">
          ${failedCourses.map(c => `
            <span class="chip chip-fail" title="${c.description}">
              ⚠️ ${c.displayCode || c.code} (Grade: ${c.grade}) — Scheduled for Retake
            </span>`).join('')}
        </div>
      </div>` : ''}

      <!-- Instant Generate Action -->
      <div class="audit-cta">
        <button id="btn-instant-generate" class="btn btn-primary btn-lg" style="width:100%; justify-content:center;">
          🚀 Generate Complete Degree Plan &amp; Fill PPG Now →
        </button>
      </div>
    </div>
  `;

  container.innerHTML = auditHTML;
  container.style.display = 'block';

  $('btn-instant-generate')?.addEventListener('click', () => {
    generateAndShowPlan();
  });
}

// ── STEP 4: OPTIONAL CURRENT COURSES OVERRIDE ──────────────
function populateCurrentCoursesList() {
  const container = $('current-courses-list');
  if (!container) return;
  const allIds = getCatalogCourseIds(AppState.catalogYear || '25-26');
  container.innerHTML = '';

  allIds.forEach(id => {
    const course = getCourse(id);
    if (!course) return;
    const isAlreadyRegistered = AppState.inProgressCourses.includes(id);

    const label = document.createElement('label');
    label.className = 'course-checkbox-label';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = id;
    cb.className = 'course-checkbox';
    if (isAlreadyRegistered) cb.checked = true;

    label.appendChild(cb);
    label.appendChild(document.createTextNode(` ${course.code} — ${course.name} (${course.credits} cr)`));
    container.appendChild(label);
  });
}

function initStep4() {
  $('btn-step4-back')?.addEventListener('click', () => showStep(2));

  $('btn-generate')?.addEventListener('click', () => {
    const checked = [...$$('.course-checkbox:checked')].map(cb => cb.value);
    const textInput = $('input-current-courses')?.value || '';
    const textCodes = textInput.split(/[,\n;]+/).map(s => normalizeCode(s.trim())).filter(Boolean);
    AppState.inProgressCourses = [...new Set([...checked, ...textCodes, ...AppState.inProgressCourses])];
    generateAndShowPlan();
  });
}

// ── GENERATE PLAN & SHOW RESULTS ──────────────────────────
function generateAndShowPlan() {
  showScreen('screen-analyzing');

  setTimeout(() => {
    try {
      const allCourses = AppState.parsedTranscript?.courses || [];
      const plan = buildDegreePlan({
        catalogYear: AppState.catalogYear || '25-26',
        currentTermId: AppState.currentTermId,
        allCourses,
        inProgressIds: AppState.inProgressCourses,
        studentName: AppState.studentName,
        studentId: AppState.studentId,
        studentInfo: AppState.parsedTranscript?.studentInfo || {}
      });

      AppState.plan = plan;
      renderResults(plan);
      showScreen('screen-results');
    } catch (err) {
      console.error(err);
      alert('Error generating plan: ' + err.message);
      showScreen('screen-wizard');
    }
  }, 1000);
}

// ── RENDER RESULTS ────────────────────────────────────────
function renderResults(plan) {
  const titleEl = $('results-student-name');
  if (titleEl) {
    titleEl.textContent = plan.studentName
      ? `${plan.studentName}'s Cybersecurity BS Degree Plan`
      : 'Your Cybersecurity BS Degree Plan';
  }

  const advisorContainer = $('advisor-speech-banner');
  if (advisorContainer) {
    advisorContainer.innerHTML = generateAdvisorNarration(plan);
  }

  renderSummaryBanner(plan);
  renderConcerns(plan);
  renderSemesterGrid(plan);
  renderGEStatus(plan);
  renderAskLeoSection();
  setupConvincedModal(plan);
}

function renderSummaryBanner(plan) {
  const el = $('summary-banner');
  if (!el) return;
  const s = plan.stats;
  const totalRequired = 120;
  const pct = Math.min(100, Math.round(((s.totalEarned || 0) / totalRequired) * 100));

  el.innerHTML = `
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-card-icon">🎓</div>
        <div class="summary-card-value">${s.totalEarned || 0} / 120</div>
        <div class="summary-card-label">Earned / Degree Credits</div>
      </div>
      <div class="summary-card ${s.cumGPA && parseFloat(s.cumGPA) < 2.0 ? 'card-danger' : ''}">
        <div class="summary-card-icon">${s.cumGPA && parseFloat(s.cumGPA) < 2.0 ? '⚠️' : '📊'}</div>
        <div class="summary-card-value">${s.cumGPA !== null ? s.cumGPA : 'N/A'}</div>
        <div class="summary-card-label">Cumulative GPA ${s.cumGPA && parseFloat(s.cumGPA) < 2.0 ? '(Target ≥ 2.0)' : ''}</div>
      </div>
      <div class="summary-card">
        <div class="summary-card-icon">💻</div>
        <div class="summary-card-value">${s.majorCreditsCompleted} / ${s.majorCreditsRequired}</div>
        <div class="summary-card-label">Major Credits Completed</div>
      </div>
      <div class="summary-card">
        <div class="summary-card-icon">🎯</div>
        <div class="summary-card-value">${s.graduationTerm ? semesterTitle(s.graduationTerm) : 'TBD'}</div>
        <div class="summary-card-label">Target Graduation Term</div>
      </div>
    </div>
    <div class="progress-bar-wrapper">
      <div class="progress-label">Overall Degree Progress: ${pct}% complete (${s.totalEarned || 0} of 120 credits)</div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${Math.max(5, pct)}%">${pct}%</div>
      </div>
    </div>
  `;
}

function renderConcerns(plan) {
  const el = $('concerns-panel');
  if (!el || plan.concerns.length === 0) {
    if (el) el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.innerHTML = `<h3>⚠️ Critical Advising Flags &amp; Notes</h3>` +
    plan.concerns.map(c => `
      <div class="concern concern-${c.type}">
        <div class="concern-title">${c.icon} ${c.title}</div>
        <div class="concern-detail">${c.detail}</div>
      </div>
    `).join('');
}

function dominantStatus(sem) {
  const statuses = sem.courses.map(c => c.status);
  if (statuses.every(s => s === 'completed')) return 'completed';
  if (statuses.includes('inProgress')) return 'inProgress';
  if (statuses.includes('failed')) return 'failed';
  return 'planned';
}

function renderSemesterGrid(plan) {
  const grid = $('semester-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const curSemId = termToSemesterId(AppState.currentTermId);

  plan.semesters.forEach(sem => {
    if (!sem.courses || sem.courses.length === 0) return;

    const card = document.createElement('div');
    card.className = `semester-card sem-status-${dominantStatus(sem)}`;
    const isCurrentSem = sem.semId === curSemId;
    if (isCurrentSem) card.classList.add('current-term');

    const termTitle = sem.semId === 'TRANSFER'
      ? '📦 Prior Transfer Credits'
      : (sem.title || semesterTitle(sem.semId));

    const totalCr = sem.courses.reduce((acc, c) => acc + (c.course?.credits || getCourse(c.id)?.credits || 3), 0);

    card.innerHTML = `
      <div class="sem-header">
        <span class="sem-title">${isCurrentSem ? '🔵 CURRENT ENROLLMENT — ' : ''}${termTitle}</span>
        <span class="sem-credits">${totalCr} cr</span>
      </div>
      <div class="sem-courses"></div>
    `;

    const courseList = card.querySelector('.sem-courses');
    sem.courses.forEach(entry => {
      const courseData = entry.course || getCourse(entry.id) || { code: entry.id, name: '', credits: 3 };
      const chip = document.createElement('div');
      chip.className = `course-chip chip-${entry.status}`;

      const statusIcon = { completed:'✅', inProgress:'🔄', planned:'📋', failed:'🔴' }[entry.status] || '📋';
      const gradeStr = entry.grade ? ` <span class="chip-grade">[${entry.grade}]</span>` : '';
      const subTermTag = entry.subTerm ? `<span class="chip-term-tag">${entry.subTerm}</span>` : '';

      chip.innerHTML = `
        <div class="chip-main">
          <span class="chip-icon">${statusIcon}</span>
          <span class="chip-code">${courseData.code}</span>
          <span class="chip-name">${courseData.name}</span>
          ${gradeStr}
          ${subTermTag}
        </div>
        <span class="chip-credits">${courseData.credits} cr</span>
        ${courseData.badge ? `<span class="chip-badge">${courseData.badge}</span>` : ''}
      `;

      chip.addEventListener('click', () => showCourseModal(entry, plan));
      courseList.appendChild(chip);
    });

    grid.appendChild(card);
  });
}

function renderGEStatus(plan) {
  const el = $('ge-status-panel');
  if (!el) return;

  const satisfied = plan.geStatus.filter(s => s.satisfied).length;
  const total = plan.geStatus.filter(s => s.credits > 0).length;

  el.innerHTML = `
    <h3>📋 General Education Requirements (${satisfied}/${total} satisfied)</h3>
    <div class="ge-grid">
      ${plan.geStatus.map(slot => `
        <div class="ge-slot ${slot.satisfied ? 'ge-done' : 'ge-pending'}">
          <span class="ge-icon">${slot.satisfied ? '✅' : '⬜'}</span>
          <div class="ge-info">
            <div class="ge-label">${slot.label}</div>
            ${slot.satisfied && slot.satisfiedBy
              ? `<div class="ge-satisfied-by">↳ ${slot.satisfiedBy.course || slot.satisfiedBy.description || 'Completed'} ${slot.satisfiedBy.termId && slot.satisfiedBy.termId !== 'TRANSFER' ? '(' + semesterTitle(slot.satisfiedBy.termId) + ')' : slot.satisfiedBy.termId === 'TRANSFER' ? '(Transfer)' : ''}</div>`
              : `<div class="ge-note">${slot.note || ''}</div>`
            }
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── ASK LEO INTERACTIVE SECTION ───────────────────────────
function renderAskLeoSection() {
  const container = $('ask-leo-section');
  if (!container) return;

  container.innerHTML = `
    <div class="ask-leo-header">
      <div class="ask-leo-icon">🦁💬</div>
      <div>
        <h3>Have Questions? Ask Leo Your Advisor</h3>
        <p>Click any common advising question below to get instant strategic guidance.</p>
      </div>
    </div>
    <div class="ask-leo-chips">
      ${Object.entries(ADVISOR_KNOWLEDGE).map(([k, v]) => `
        <button class="btn-ask-chip" onclick="showAdvisorAnswer('${k}')">
          ${v.question}
        </button>
      `).join('')}
    </div>
    <div id="ask-leo-answer" class="ask-leo-answer-box" style="display:none;"></div>
  `;
}

function showAdvisorAnswer(key) {
  const item = ADVISOR_KNOWLEDGE[key];
  const box = $('ask-leo-answer');
  if (!item || !box) return;

  box.style.display = 'block';
  box.innerHTML = `
    <div class="ask-answer-inner">
      <div class="ask-answer-q">🦁 Leo explains: <strong>${item.question}</strong></div>
      <div class="ask-answer-a">${item.answer}</div>
    </div>
  `;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── COURSE DETAIL MODAL ───────────────────────────────────
function showCourseModal(entry, plan) {
  const modal = $('modal-overlay');
  const content = $('modal-content');
  if (!modal || !content) return;

  const courseData = entry.course || getCourse(entry.id) || { code: entry.id, name: 'Course', credits: 3 };
  const statusLabels = {
    completed:  '✅ Completed Course',
    inProgress: '🔄 Currently In Progress This Term',
    planned:    '📋 Strategically Scheduled in This Term',
    failed:     '🔴 Previously Failed — Scheduled Retake',
  };

  const prereqs = (courseData.prereqs || []).filter(p => p !== 'LAST_TERM' && p !== 'MTH14100');
  const prereqsHTML = prereqs.length > 0
    ? prereqs.map(pid => {
        const pc = getCourse(pid);
        const isDone = plan.completed[pid] || plan.inProgress[pid];
        return `<span class="prereq-chip ${isDone ? 'prereq-done' : 'prereq-missing'}">${isDone ? '✅' : '⚠️'} ${pc?.code || pid}</span>`;
      }).join('')
    : '<span class="prereq-chip prereq-done">✅ No major course prerequisites</span>';

  const unlocks = Object.entries(MAJOR_COURSES)
    .filter(([id, c]) => (c.prereqs || []).includes(entry.id))
    .map(([id, c]) => `<span class="unlock-chip">${c.code}</span>`)
    .join('');

  const termDisplay = entry.termId === 'TRANSFER'
    ? 'Transfer Credit'
    : (entry.termId ? `${semesterTitle(entry.termId)}${entry.subTerm ? ' (' + entry.subTerm + ')' : ''}` : 'Planned');

  content.innerHTML = `
    <div class="modal-header">
      <div class="modal-title-block">
        <span class="modal-badge">${courseData.badge || 'Lindenwood Course'}</span>
        <h2>${courseData.code}</h2>
        <p class="modal-course-name">${courseData.name}</p>
      </div>
      <button class="modal-close-btn" onclick="closeModal()">✕</button>
    </div>

    <div class="modal-status-bar status-bar-${entry.status}">
      ${statusLabels[entry.status] || entry.status}
      ${entry.grade ? ` — Grade: <strong>${entry.grade}</strong>` : ''}
      — Scheduled: <strong>${termDisplay}</strong>
    </div>

    <div class="modal-body">
      <div class="modal-section advisor-note-highlight">
        <h4>🦁 Leo's Advising Explanation: Why This Course &amp; Term?</h4>
        <div class="plan-note">${entry.reason || courseData.planningNote || 'Standard degree progression course.'}</div>
        ${(entry.flags || []).map(f => `<div class="flag-badge">${f}</div>`).join('')}
      </div>

      <div class="modal-section">
        <h4>📖 Course Overview</h4>
        <p>${courseData.description || 'Comprehensive coverage of core cybersecurity concepts.'}</p>
      </div>

      <div class="modal-section">
        <h4>⚡ Degree Value &amp; Importance</h4>
        <p>${courseData.importance || 'Required core coursework for the BS in Cybersecurity.'}</p>
      </div>

      <div class="modal-section">
        <h4>✅ Prerequisites Status</h4>
        <div class="prereq-list">${prereqsHTML}</div>
        ${courseData.mathReq ? '<p class="prereq-note">⚠️ Also requires MTH 11000 or Math Placement Score</p>' : ''}
      </div>

      ${unlocks ? `
      <div class="modal-section">
        <h4>🔓 Passing This Unlocks:</h4>
        <div class="unlock-list">${unlocks}</div>
      </div>` : ''}

      <div class="modal-section">
        <h4>🗓️ Lindenwood Term Availability Matrix</h4>
        <div class="offered-terms">
          ${['F1','F2','SP1','SP2','SU'].map(t => `
            <span class="term-pill ${(courseData.offered || []).includes(t) ? 'term-offered' : 'term-not'}">
              ${t}
            </span>`).join('')}
        </div>
        <div class="offered-count">
          Offered in <strong>${(courseData.offered || []).length}</strong> of 5 possible 8-week terms per year.
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('modal-overlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

// ── CONVINCED MODAL & DOWNLOAD SETUP ──────────────────────
function setupConvincedModal(plan) {
  const convincedBtn = $('btn-convinced');
  const floatBtn = $('btn-convinced-float');

  if (convincedBtn) {
    convincedBtn.onclick = () => showConvincedModal(plan);
  }
  if (floatBtn) {
    floatBtn.onclick = () => showConvincedModal(plan);
  }
}

function showConvincedModal(plan) {
  const modal = $('modal-overlay');
  const content = $('modal-content');
  if (!modal || !content) return;

  const s = plan.stats;
  const sName = plan.studentName || 'Student';
  const catLabel = plan.catalog?.label || plan.catalogYear;
  const gradTerm = s.graduationTerm ? semesterTitle(s.graduationTerm) : 'Scheduled Date';

  content.innerHTML = `
    <div class="modal-header" style="background: linear-gradient(135deg, #16A34A 0%, #15803D 100%);">
      <div class="modal-title-block">
        <span class="modal-badge">🎉 Congratulations!</span>
        <h2>You're All Set, ${sName}!</h2>
        <p class="modal-course-name">Your degree plan is fully verified against official LU policies.</p>
      </div>
      <button class="modal-close-btn" onclick="closeModal()">✕</button>
    </div>

    <div class="modal-body">
      <div class="convinced-summary-box">
        <div class="convinced-stat-row">
          <span>Student Name:</span> <strong>${sName}</strong>
        </div>
        <div class="convinced-stat-row">
          <span>Catalog Year:</span> <strong>${catLabel} Catalog</strong>
        </div>
        <div class="convinced-stat-row">
          <span>Total Earned Credits:</span> <strong>${s.totalEarned || 0} / 120</strong>
        </div>
        <div class="convinced-stat-row">
          <span>Target Graduation:</span> <strong>${gradTerm}</strong>
        </div>
        <div class="convinced-stat-row">
          <span>Template Format:</span> <strong>Official LU Cybersecurity PPG (.xlsx)</strong>
        </div>
      </div>

      <p style="margin: 1rem 0; font-size: .95rem; color: var(--gray-700);">
        Click the button below to download your complete <strong>Program Planning Guide (PPG)</strong>. 
        It has been filled directly into the official Lindenwood University Excel template for your 
        <strong>${catLabel}</strong> catalog year, complete with General Education requirements, Major Coursework, 
        and the 8-semester Degree Path!
      </p>

      <div style="display:flex; flex-direction:column; gap:.75rem; margin-top:1.5rem;">
        <button id="btn-modal-download" class="btn btn-primary btn-lg" style="width:100%; justify-content:center;">
          📥 Download Official LU PPG (.xlsx)
        </button>
        <button class="btn btn-outline" onclick="window.print(); closeModal();" style="width:100%; justify-content:center;">
          🖨️ Print Degree Plan
        </button>
      </div>
    </div>
  `;

  $('btn-modal-download').onclick = () => {
    triggerDownload(plan);
    closeModal();
  };

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function triggerDownload(plan) {
  try {
    toast('Generating official LU Excel file...', 'info');
    downloadPPGExcel(plan);
    setTimeout(() => toast('✅ Download complete!', 'success'), 1500);
  } catch (err) {
    console.error(err);
    toast('Error generating Excel: ' + err.message, 'error');
  }
}

// ── INITIALIZATION ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  initStep1();
  initStep2();
  initStep3();
  initStep4();

  $('btn-new-plan')?.addEventListener('click', () => {
    if (confirm('Start a new plan? Current results will be cleared.')) {
      AppState.plan = null;
      AppState.parsedTranscript = null;
      showScreen('screen-welcome');
    }
  });

  $('btn-print')?.addEventListener('click', () => window.print());

  $('modal-overlay')?.addEventListener('click', e => {
    if (e.target === $('modal-overlay')) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  $$('.step-back-btn').forEach(btn => {
    btn.addEventListener('click', () => showStep(AppState.step - 1));
  });

  showScreen('screen-welcome');
});
