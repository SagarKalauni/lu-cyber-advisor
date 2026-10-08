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
  transcriptResult: null,   // From PDF Transcript
  scheduleResult: null,     // From Excel Course Schedules
  parsedTranscript: null,   // Reconciled unified dataset
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
  const name = (plan.studentName && !plan.studentName.toLowerCase().includes('dummy')) ? plan.studentName.split(' ')[0] : 'there';
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

// ── STEP 3: DUAL FILE UPLOAD & RECONCILIATION ──────────────
function initStep3() {
  const dropPdf = $('drop-zone-pdf');
  const fileInputPdf = $('file-input-pdf');
  const dropExcel = $('drop-zone-excel');
  const fileInputExcel = $('file-input-excel');
  const dropCombined = $('drop-zone-combined');
  const statusEl = $('parse-status');
  const manualArea = $('manual-transcript');
  const toggleManual = $('btn-toggle-manual');

  // PDF Dropzone & Browse Button
  $('btn-browse-pdf')?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInputPdf?.click();
  });
  if (dropPdf) {
    dropPdf.addEventListener('click', (e) => {
      fileInputPdf?.click();
    });
    dropPdf.addEventListener('dragover', e => { e.preventDefault(); dropPdf.classList.add('drag-over'); });
    dropPdf.addEventListener('dragleave', () => dropPdf.classList.remove('drag-over'));
    dropPdf.addEventListener('drop', e => {
      e.preventDefault();
      dropPdf.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handlePdfFile(e.dataTransfer.files[0]);
    });
  }
    if (fileInputPdf) {
      fileInputPdf.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) {
          const f = e.target.files[0];
          e.target.value = '';
          handlePdfFile(f);
        }
      });
    }

    // Excel Dropzone & Browse Button
    $('btn-browse-excel')?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInputExcel?.click();
    });
    if (dropExcel) {
      dropExcel.addEventListener('click', () => {
        fileInputExcel?.click();
      });
      dropExcel.addEventListener('dragover', e => { e.preventDefault(); dropExcel.classList.add('drag-over'); });
      dropExcel.addEventListener('dragleave', () => dropExcel.classList.remove('drag-over'));
      dropExcel.addEventListener('drop', e => {
        e.preventDefault();
        dropExcel.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleExcelFile(e.dataTransfer.files[0]);
      });
    }
    if (fileInputExcel) {
      fileInputExcel.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) {
          const f = e.target.files[0];
          e.target.value = '';
          handleExcelFile(f);
        }
      });
    }

    // Combined Drop Area (Accepts both at once)
    if (dropCombined) {
      dropCombined.addEventListener('dragover', e => { e.preventDefault(); dropCombined.classList.add('drag-over'); });
      dropCombined.addEventListener('dragleave', () => dropCombined.classList.remove('drag-over'));
      dropCombined.addEventListener('drop', e => {
        e.preventDefault();
        dropCombined.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files || []);
        files.forEach(f => {
          if (/\.pdf$/i.test(f.name)) handlePdfFile(f);
          else if (/\.(xlsx|xls)$/i.test(f.name)) handleExcelFile(f);
        });
      });
    }

    if (toggleManual) {
      toggleManual.addEventListener('click', () => {
        manualArea.style.display = manualArea.style.display === 'none' ? 'block' : 'none';
        toggleManual.textContent = manualArea.style.display === 'none' ? '✏️ Enter transcript manually / paste text' : '✏️ Hide manual entry';
      });
    }

    async function handlePdfFile(file) {
      if (!file || !/\.pdf$/i.test(file.name)) {
        toast('Please upload a PDF (.pdf) transcript.', 'error');
        return;
      }
      const pill = $('status-pill-pdf');
      const textSpan = $('status-text-pdf');
      if (pill) pill.className = 'file-status-pill status-loading';
      if (textSpan) textSpan.textContent = `Reading ${file.name}...`;

      try {
        const text = await extractTextFromPDF(file);
        AppState.transcriptText = text;
        const result = parseTranscript(text);
        AppState.transcriptResult = result;

        if (pill) pill.className = 'file-status-pill status-success';
        if (textSpan) textSpan.textContent = `✅ ${file.name} (${result.courses.length} courses audited, GPA: ${result.studentInfo.gpa || 'N/A'})`;
        $('card-upload-pdf')?.classList.add('uploaded-ready');
        toast(`Loaded PDF Transcript: ${result.courses.length} courses!`, 'success');

        reconcileAndApply();
      } catch (err) {
        console.error(err);
        if (pill) pill.className = 'file-status-pill status-error';
        if (textSpan) textSpan.textContent = `❌ PDF parse failed: ${err.message}`;
        toast('Could not parse PDF. Paste text if needed.', 'error');
      }
    }

    async function handleExcelFile(file) {
      if (!file || !/\.(xlsx|xls)$/i.test(file.name)) {
        toast('Please upload an Excel (.xlsx/.xls) schedule file.', 'error');
        return;
      }
      const pill = $('status-pill-excel');
      const textSpan = $('status-text-excel');
      if (pill) pill.className = 'file-status-pill status-loading';
      if (textSpan) textSpan.textContent = `Reading ${file.name}...`;

      try {
        const result = await parseScheduleExcel(file);
        AppState.scheduleResult = result;

        if (pill) pill.className = 'file-status-pill status-success';
        const cur = result.courses.filter(c => c.isCurrent).length;
        const sch = result.courses.filter(c => c.isScheduled).length;
        if (textSpan) textSpan.textContent = `✅ ${file.name} (${result.courses.length} courses, ${cur} current, ${sch} scheduled)`;
        $('card-upload-excel')?.classList.add('uploaded-ready');
        toast(`Loaded Excel Schedule: ${result.courses.length} courses!`, 'success');

        reconcileAndApply();
      } catch (err) {
        console.error(err);
        if (pill) pill.className = 'file-status-pill status-error';
        if (textSpan) textSpan.textContent = `❌ Excel parse failed: ${err.message}`;
        toast('Could not parse Excel schedule: ' + err.message, 'error');
      }
    }

    function reconcileAndApply() {
      const pdfRes = AppState.transcriptResult;
      const xlsRes = AppState.scheduleResult;

      if (!pdfRes && !xlsRes) return;

      let mergedResult;
      if (pdfRes && !xlsRes) {
        mergedResult = sanitizeResult(pdfRes);
      } else if (!pdfRes && xlsRes) {
        mergedResult = sanitizeResult(xlsRes);
      } else {
        // Reconcile BOTH files strictly according to advising rule:
        // PDF is master truth for past courses and GPA;
        // Excel provides active current & scheduled courses for current term.
        mergedResult = reconcilePdfAndExcel(pdfRes, xlsRes);
      }

      processParsedResult(mergedResult);
    }

    function sanitizeResult(res) {
      if (res && res.studentInfo) {
        let name = res.studentInfo.name || '';
        if (/mendoza|ceaser|cesar/i.test(name)) {
          res.studentInfo.name = 'Dummy Student';
        }
      }
      return res;
    }

    function reconcilePdfAndExcel(pdfRes, xlsRes) {
      // PDF is the primary source of truth for all past completed coursework,
      // transfer credits, letter grades, course descriptions (with GE tags), and GPA.
      // The ONLY thing taken from Excel is active courses for the current semester (isCurrent & isScheduled).
      // Keep EVERY single course from the PDF transcript in EVERY term intact — do NOT collapse into a Map!
      const mergedCourses = (pdfRes.courses || []).map(c => ({ ...c, source: 'PDF' }));

      // Extract ONLY active courses (isCurrent or isScheduled) from Excel
      const activeExcelCourses = (xlsRes.courses || []).filter(c => c.isCurrent || c.isScheduled);
      const currentTermPdfCourseCodes = new Set(
        mergedCourses.filter(c => c.isRegistered).map(c => normalizeCode(c.code))
      );

      activeExcelCourses.forEach(c => {
        const norm = normalizeCode(c.code);
        if (!norm) return;

        // Find the active/current registered instance in mergedCourses
        const activePdfCourse = mergedCourses.find(mc => normalizeCode(mc.code) === norm && mc.isRegistered);
        if (activePdfCourse) {
          activePdfCourse.term = c.term || activePdfCourse.term;
          activePdfCourse.termRaw = c.termRaw || activePdfCourse.termRaw;
          activePdfCourse.credits = c.credits > 0 ? c.credits : (activePdfCourse.credits || 3);
          activePdfCourse.attemptCredits = c.credits > 0 ? c.credits : (activePdfCourse.attemptCredits || 3);
          activePdfCourse.isCurrent = !!c.isCurrent;
          activePdfCourse.isScheduled = !!c.isScheduled;
          activePdfCourse.source = 'PDF+EXCEL_ACTIVE';
        } else if (!currentTermPdfCourseCodes.has(norm)) {
          // Scheduled course present in Excel but NOT in PDF current term (e.g. Fall II scheduled)
          mergedCourses.push({
            code: norm,
            displayCode: c.displayCode || norm,
            title: c.title,
            description: c.title || c.description,
            term: c.term,
            termRaw: c.termRaw,
            credits: c.credits || 3,
            attemptCredits: c.credits || 3,
            earnedCredits: 0,
            qualityPoints: 0,
            grade: '',
            baseGrade: '',
            status: 'REGISTERED',
            passed: false,
            failed: false,
            isRegistered: true,
            isCurrent: !!c.isCurrent,
            isScheduled: !!c.isScheduled,
            isTransfer: false,
            source: 'EXCEL_SCHEDULED'
          });
          currentTermPdfCourseCodes.add(norm);
        }
      });

      // Student info strictly from PDF (the official academic record)
      let sName = pdfRes.studentInfo?.name || xlsRes.studentInfo?.name || 'Dummy Student';
      if (/mendoza|ceaser|cesar/i.test(sName)) {
        sName = 'Dummy Student';
      }

      const transferEarned = pdfRes.studentInfo?.transferEarned !== undefined
        ? pdfRes.studentInfo.transferEarned
        : (xlsRes.studentInfo?.transferEarned || 0);

      const studentInfo = {
        name: sName,
        id: pdfRes.studentInfo?.id || xlsRes.studentInfo?.id || '',
        program: pdfRes.studentInfo?.program || 'Cybersecurity',
        gpa: pdfRes.studentInfo?.gpa || xlsRes.studentInfo?.gpa || '3.00',
        totalEarned: pdfRes.studentInfo?.totalEarned !== undefined ? pdfRes.studentInfo.totalEarned : (xlsRes.studentInfo?.totalEarned || 0),
        totalAttempted: pdfRes.studentInfo?.totalAttempted !== undefined ? pdfRes.studentInfo.totalAttempted : (xlsRes.studentInfo?.totalAttempted || 0),
        qualityPoints: pdfRes.studentInfo?.qualityPoints !== undefined ? pdfRes.studentInfo.qualityPoints : (xlsRes.studentInfo?.qualityPoints || 0),
        totalCourses: pdfRes.studentInfo?.totalCourses || mergedCourses.length,
        transferEarned: transferEarned
      };

      return { courses: mergedCourses, studentInfo };
    }

    function processParsedResult(result) {
      AppState.parsedTranscript = result;

      // Auto-populate student info
      if (result.studentInfo.name) {
        let cleanName = result.studentInfo.name;
        if (/mendoza|ceaser|cesar/i.test(cleanName)) cleanName = 'Dummy Student';
        AppState.studentName = cleanName;
        if ($('input-name')) $('input-name').value = cleanName;
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

      // Auto-detect current term from registered courses if available
      const registeredCourses = result.courses.filter(c => c.isRegistered);
      if (registeredCourses.length > 0) {
        const curCourse = registeredCourses.find(c => c.isCurrent) || registeredCourses[0];
        if (curCourse && curCourse.term) {
          AppState.currentTermId = curCourse.term;
          if ($('select-current-term')) $('select-current-term').value = curCourse.term;
        }
      }

      // Auto-extract ALL currently registered / scheduled courses
      const registeredOnRecord = result.courses.filter(c => c.isRegistered).map(c => c.code);
      AppState.inProgressCourses = [...new Set(registeredOnRecord)];

      // Render comprehensive transcript audit preview
      renderTranscriptAudit(result);

      const completedCount = result.courses.filter(c => c.passed).length;
      const currentCount = result.courses.filter(c => c.isCurrent).length;
      const scheduledCount = result.courses.filter(c => c.isScheduled).length;

      const sources = [];
      if (AppState.transcriptResult) sources.push('PDF Transcript');
      if (AppState.scheduleResult) sources.push('Excel Schedule');

      if (statusEl) {
        statusEl.textContent = `✅ Successfully loaded from ${sources.join(' + ')}: ${result.courses.length} total courses (${completedCount} completed, ${currentCount} current, ${scheduledCount} scheduled).`;
        statusEl.className = 'parse-status success';
      }
    }

  function processTranscriptText(text) {
    AppState.transcriptText = text;
    const result = parseTranscript(text);
    AppState.transcriptResult = result;
    $('card-upload-pdf')?.classList.add('uploaded-ready');
    const textSpan = $('status-text-pdf');
    if (textSpan) textSpan.textContent = `✅ Pasted text (${result.courses.length} courses audited)`;
    processParsedResult(result);
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

  const transferCourses   = result.courses.filter(c => (c.isTransfer || c.term === 'TRANSFER') && c.passed);
  const completedLUCourses= result.courses.filter(c => !c.isTransfer && c.term !== 'TRANSFER' && c.passed);
  const currentCourses    = result.courses.filter(c => c.isCurrent);
  const scheduledCourses  = result.courses.filter(c => c.isScheduled);
  const registeredOther   = result.courses.filter(c => c.isRegistered && !c.isCurrent && !c.isScheduled);
  const failedCourses     = result.courses.filter(c => c.failed);
  const sInfo             = result.studentInfo;

  let auditHTML = `
    <div class="audit-summary-card">
      <div class="audit-header">
        <h4>📋 Official Student Audit Results</h4>
        <span class="audit-badge">100% Client-Side Verified</span>
      </div>
      <div class="audit-stats-grid">
        <div class="audit-stat">
          <span class="audit-stat-lbl">Student</span>
          <strong>${sInfo.name || AppState.studentName || 'Student Record'}</strong>
        </div>
        <div class="audit-stat">
          <span class="audit-stat-lbl">Student ID</span>
          <strong>${sInfo.id || AppState.studentId || 'N/A'}</strong>
        </div>
        <div class="audit-stat">
          <span class="audit-stat-lbl">Cumulative GPA</span>
          <strong class="${sInfo.gpa && parseFloat(sInfo.gpa) < 2.0 ? 'text-danger' : ''}">${sInfo.gpa || 'N/A'}</strong>
        </div>
        <div class="audit-stat">
          <span class="audit-stat-lbl">Total Earned Credits</span>
          <strong>${sInfo.totalEarned || 0} / ${sInfo.totalAttempted || 0} CR</strong>
        </div>
        <div class="audit-stat">
          <span class="audit-stat-lbl">Prior Transfer Credits</span>
          <strong style="color:var(--teal-700, #0D9488);">${sInfo.transferEarned || 0} CR</strong>
        </div>
      </div>

      <!-- Prior Transfer Credits Section -->
      ${transferCourses.length > 0 ? `
      <div class="audit-section">
        <div class="audit-section-title">📦 Prior Transfer Credits (${transferCourses.length} courses • ${sInfo.transferEarned || 0} CR):</div>
        <div class="preview-chips">
          ${transferCourses.map(c => `
            <span class="chip chip-pass" style="background:#F0FDFA; border-color:#99F6E4; color:#0F766E;" title="${c.description}">
              📦 ${c.displayCode || c.code} (${c.grade || 'TR'}) — ${c.description} (${c.earnedCredits || 3} CR)
            </span>`).join('')}
        </div>
      </div>` : ''}

      <!-- Currently Enrolled Section -->
      ${(currentCourses.length > 0 || registeredOther.length > 0) ? `
      <div class="audit-section">
        <div class="audit-section-title">🔄 Currently Enrolled Courses (${currentCourses.length || registeredOther.length}):</div>
        <div class="preview-chips">
          ${(currentCourses.length > 0 ? currentCourses : registeredOther).map(c => `
            <span class="chip chip-inProgress" title="${c.description}">
              🔄 ${c.displayCode || c.code} — ${c.description} (${c.termRaw || 'Current Term'})
            </span>`).join('')}
        </div>
      </div>` : ''}

      <!-- Future Scheduled Courses Section -->
      ${scheduledCourses.length > 0 ? `
      <div class="audit-section">
        <div class="audit-section-title">📅 Future Scheduled Courses (${scheduledCourses.length}):</div>
        <div class="preview-chips">
          ${scheduledCourses.map(c => `
            <span class="chip chip-inProgress" style="background:#EEF2FF; border-color:#C7D2FE; color:#3730A3;" title="${c.description}">
              📅 ${c.displayCode || c.code} — ${c.description} (${c.termRaw || 'Scheduled Term'})
            </span>`).join('')}
        </div>
      </div>` : ''}

      <!-- Lindenwood Completed Courses Section -->
      ${completedLUCourses.length > 0 ? `
      <div class="audit-section">
        <div class="audit-section-title">✅ Lindenwood Completed Courses (${completedLUCourses.length}):</div>
        <div class="preview-chips">
          ${completedLUCourses.map(c => `
            <span class="chip chip-pass" title="${c.description}">
              ✅ ${c.displayCode || c.code} (${c.grade}) — ${c.termRaw || 'Completed'}
            </span>`).join('')}
        </div>
      </div>` : ''}

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
      AppState.originalPlan = JSON.parse(JSON.stringify(plan));
      renderResults(plan);
      showScreen('screen-results');
    } catch (err) {
      console.error(err);
      alert('Error generating plan: ' + err.message);
      showScreen('screen-wizard');
    }
  }, 1000);
}

// Reset customized plan back to algorithm default
function resetPlanToDefault() {
  if (!AppState.originalPlan) return;
  AppState.plan = JSON.parse(JSON.stringify(AppState.originalPlan));
  renderResults(AppState.plan);
  const resetBtn = $('btn-reset-plan');
  if (resetBtn) resetBtn.style.display = 'none';
  toast('Degree plan reset to default schedule.', 'info');
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
        <div class="summary-card-label">Total Earned Credits</div>
      </div>
      <div class="summary-card">
        <div class="summary-card-icon">📦</div>
        <div class="summary-card-value">${s.transferEarned || 0} CR</div>
        <div class="summary-card-label">Prior Transfer Credits</div>
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
      <div class="progress-label">Overall Degree Progress: ${pct}% complete (${s.totalEarned || 0} of 120 credits${s.transferEarned > 0 ? ` • Includes ${s.transferEarned} Prior Transfer Credits` : ''})</div>
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
    // Only skip if empty AND it's a past semester or transfer
    const isPast = sem.semId === 'TRANSFER' || semesterSortOrder(sem.semId) < semesterSortOrder(curSemId);
    if (isPast && (!sem.courses || sem.courses.length === 0)) return;

    const card = document.createElement('div');
    card.className = `semester-card sem-status-${dominantStatus(sem)}`;
    const isCurrentSem = sem.semId === curSemId;
    if (isCurrentSem) card.classList.add('current-term');

    const isTransferCard = sem.semId === 'TRANSFER';
    const termTitle = isTransferCard
      ? '📦 Prior Transfer Credits'
      : (sem.title || semesterTitle(sem.semId));

    const totalCr = (sem.courses || []).reduce((acc, c) => acc + (c.course?.credits !== undefined ? c.course.credits : (getCourse(c.id)?.credits || 3)), 0);
    const crPillClass = isTransferCard
      ? 'cr-transfer'
      : (totalCr === 15 ? 'cr-max' : (totalCr > 15 ? 'cr-over' : ''));

    const crPillText = isTransferCard
      ? `${totalCr} CR Transferred`
      : `${totalCr} / 15 CR`;

    card.setAttribute('data-sem-id', sem.semId);

    // Drop target eligibility: regular current or future semesters
    const canReceiveDrop = !isPast;

    card.innerHTML = `
      <div class="sem-header">
        <span class="sem-title">${isCurrentSem ? '🔵 CURRENT ENROLLMENT — ' : ''}${termTitle}</span>
        <span class="sem-cr-pill ${crPillClass}">${crPillText}</span>
      </div>
      <div class="sem-courses"></div>
    `;

    const courseList = card.querySelector('.sem-courses');

    if (!sem.courses || sem.courses.length === 0) {
      if (canReceiveDrop) {
        const emptyDz = document.createElement('div');
        emptyDz.className = 'sem-empty-dropzone';
        emptyDz.innerHTML = `
          <div style="font-size:1.3rem; margin-bottom:4px;">📥</div>
          <div>Drag &amp; drop courses here</div>
          <div style="font-size:.74rem; opacity:.75; margin-top:2px;">(Up to 15 credit hours)</div>
        `;
        courseList.appendChild(emptyDz);
      }
    } else {
      sem.courses.forEach(entry => {
        const courseData = entry.course || getCourse(entry.id) || { code: entry.id, name: '', credits: 3 };
        const chip = document.createElement('div');
        chip.className = `course-chip chip-${entry.status}`;

        // Only planned courses (or retakes) in current/future terms can be dragged
        const isMovable = !isPast && (entry.status === 'planned' || entry.status === 'failed');
        if (isMovable) {
          chip.classList.add('is-draggable');
          chip.setAttribute('draggable', 'true');
          chip.setAttribute('data-course-id', entry.id);
          chip.setAttribute('data-sem-id', sem.semId);

          chip.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
              courseId: entry.id,
              sourceSemId: sem.semId
            }));
            e.dataTransfer.effectAllowed = 'move';
            chip.classList.add('is-dragging');
          });

          chip.addEventListener('dragend', () => {
            chip.classList.remove('is-dragging');
            $$('.semester-card').forEach(c => c.classList.remove('drag-target-valid', 'drag-target-invalid'));
          });
        }

        const statusIcon = { completed:'✅', inProgress:'🔄', planned:'📋', failed:'🔴' }[entry.status] || '📋';
        const gradeStr = entry.grade ? ` <span class="chip-grade">[${entry.grade}]</span>` : '';
        const subTermTag = entry.subTerm ? `<span class="chip-term-tag">${entry.subTerm}</span>` : '';
        const dragHandle = isMovable ? `<span class="drag-handle" title="Drag to move semester">⠿</span>` : '';

        chip.innerHTML = `
          <div class="chip-main">
            ${dragHandle}
            <span class="chip-icon">${statusIcon}</span>
            <span class="chip-code">${courseData.code}</span>
            <span class="chip-name">${courseData.name}</span>
            ${gradeStr}
            ${subTermTag}
          </div>
          <span class="chip-credits">${courseData.credits} cr</span>
          ${courseData.badge ? `<span class="chip-badge">${courseData.badge}</span>` : ''}
        `;

        chip.addEventListener('click', () => {
          if (chip.classList.contains('is-dragging')) return;
          showCourseModal(entry, plan);
        });

        courseList.appendChild(chip);
      });
    }

    // Attach drag & drop listeners to card if it can receive drops
    if (canReceiveDrop) {
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-target-valid');
      });

      card.addEventListener('dragleave', (e) => {
        if (!card.contains(e.relatedTarget)) {
          card.classList.remove('drag-target-valid', 'drag-target-invalid');
        }
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-target-valid', 'drag-target-invalid');

        let data;
        try {
          data = JSON.parse(e.dataTransfer.getData('text/plain'));
        } catch (err) {
          return;
        }

        if (!data || !data.courseId || !data.sourceSemId) return;

        const { courseId, sourceSemId } = data;
        const targetSemId = sem.semId;

        const validation = validateCourseMove(AppState.plan, courseId, targetSemId, sourceSemId);
        if (!validation.ok) {
          toast('❌ ' + validation.reason, 'error');
          return;
        }

        if (validation.warning) {
          toast('⚠️ ' + validation.warning, 'warning');
        }

        const success = moveCourseInDegreePlan(AppState.plan, courseId, targetSemId, sourceSemId);
        if (success) {
          const courseObj = getCourse(courseId);
          toast(`✅ Moved ${courseObj?.code || courseId} to ${sem.title || semesterTitle(targetSemId)}!`, 'success');
          const resetBtn = $('btn-reset-plan');
          if (resetBtn) resetBtn.style.display = 'inline-flex';

          // Re-render UI with updated plan
          renderSemesterGrid(AppState.plan);
          renderSummaryBanner(AppState.plan);
          renderGEStatus(AppState.plan);
          setupConvincedModal(AppState.plan);
        }
      });
    }

    grid.appendChild(card);
  });
}

function renderGEStatus(plan) {
  const el = $('ge-status-panel');
  if (!el) return;

  const satisfiedList = plan.geStatus.filter(s => s.satisfied);
  const remainingList = plan.geStatus.filter(s => !s.satisfied);
  const totalSlots = plan.geStatus.filter(s => s.credits > 0).length;
  const totalCredits = plan.geStatus.reduce((sum, s) => sum + (s.credits || 0), 0);
  const satisfiedCredits = satisfiedList.reduce((sum, s) => sum + (s.credits || 0), 0);
  const remainingCredits = remainingList.reduce((sum, s) => sum + (s.credits || 0), 0);
  const pct = Math.min(100, Math.round((satisfiedCredits / (totalCredits || 1)) * 100));

  el.innerHTML = `
    <div class="ge-panel-header">
      <div class="ge-panel-title-block">
        <h3>📋 General Education Degree Requirements Audit</h3>
        <p class="ge-panel-subtitle">
          Lindenwood University requires <strong>${totalCredits} General Education credits</strong> across essential foundational disciplines.
        </p>
      </div>
      <div class="ge-progress-pill">
        ${satisfiedList.length} of ${totalSlots} Categories Satisfied (${satisfiedCredits} / ${totalCredits} Credits • ${pct}%)
      </div>
    </div>

    <div class="ge-progress-track-wrapper">
      <div class="ge-progress-track">
        <div class="ge-progress-fill" style="width:${Math.max(6, pct)}%">${pct}% Completed</div>
      </div>
    </div>

    <!-- 1. REMAINING GEN-ED REQUIREMENTS (PROMINENT AT TOP) -->
    <div class="ge-section ge-remaining-section">
      <div class="ge-section-header remaining-header">
        <span class="ge-section-icon">⏳</span>
        <h4>Remaining General Education Courses Required (${remainingList.length} Categories • ${remainingCredits} Credits Needed)</h4>
      </div>
      ${remainingList.length === 0 ? `
        <div class="ge-all-satisfied-card">
          <span style="font-size:1.5rem;">🎉</span>
          <div>
            <strong>Outstanding!</strong> All Lindenwood General Education requirements have been 100% satisfied.
          </div>
        </div>
      ` : `
        <div class="ge-grid">
          ${remainingList.map(slot => `
            <div class="ge-slot ge-slot-remaining">
              <div class="ge-slot-top">
                <span class="ge-icon-badge badge-pending">⏳ TO BE COMPLETED</span>
                <span class="ge-slot-cr">${slot.credits || 3} Credits</span>
              </div>
              <div class="ge-info">
                <div class="ge-label">${slot.label}</div>
                <div class="ge-note">
                  💡 <em>Advising Guidance:</em> ${slot.note || 'Choose any approved Lindenwood General Education course in this category.'}
                </div>
                ${slot.approvedCourses && slot.approvedCourses.length > 0 ? `
                  <div class="ge-approved-container">
                    <div class="ge-approved-title">🎯 Recommended Lindenwood Courses:</div>
                    <div class="ge-approved-list">
                      ${slot.approvedCourses.map(c => `<span class="ge-course-pill">${c}</span>`).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <!-- 2. SATISFIED GEN-ED REQUIREMENTS -->
    <div class="ge-section ge-satisfied-section">
      <div class="ge-section-header satisfied-header">
        <span class="ge-section-icon">✅</span>
        <h4>Satisfied General Education Requirements (${satisfiedList.length} Categories • ${satisfiedCredits} Credits Completed)</h4>
      </div>
      <div class="ge-grid">
        ${satisfiedList.map(slot => `
          <div class="ge-slot ge-slot-done">
            <div class="ge-slot-top">
              <span class="ge-icon-badge badge-done">✅ SATISFIED</span>
              <span class="ge-slot-cr">${slot.credits || 3} Credits</span>
            </div>
            <div class="ge-info">
              <div class="ge-label">${slot.label}</div>
              <div class="ge-satisfied-by">
                ↳ <strong>${slot.satisfiedBy?.course || slot.satisfiedBy?.description || 'Completed'}</strong>
                ${slot.satisfiedBy?.termId && slot.satisfiedBy.termId !== 'TRANSFER' ? '— ' + semesterTitle(slot.satisfiedBy.termId) : (slot.satisfiedBy?.termId === 'TRANSFER' ? '— Prior Transfer Credit' : '')}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
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
          <span>Prior Transfer Credits:</span> <strong>${s.transferEarned || 0} CR</strong>
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
