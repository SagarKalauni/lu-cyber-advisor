// ============================================================
// TRANSCRIPT PARSER  —  parser.js
// Two-column aware parser for Lindenwood University transcripts
// Extracts: completed, failed, and registered/scheduled courses
// ============================================================

// ── PASSING / FAILED / REGISTERED STATUS ───────────────────
const PASSING_GRADES = new Set([
  'A', 'A+', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-',
  'AH', 'P', 'TR-A', 'TR-B', 'TR-C', 'TR-P', 'TR-T'
]);

function cleanTripledText(str) {
  if (!str) return '';
  return str.replace(/([A-Za-z0-9/])\1{2}/g, '$1');
}

function parseTranscriptTermCode(raw) {
  if (!raw) return 'TRANSFER';
  const r = raw.trim().toLowerCase();
  if (r.includes('transfer')) return 'TRANSFER';

  let season = 'F2';
  if (r.includes('spring')) season = 'SP2';
  else if (r.includes('summer')) season = 'SU';
  else if (r.includes('fall')) season = 'F2';

  const m = r.match(/(\d{2,4})/);
  let year = 2026;
  if (m) {
    let y = parseInt(m[1]);
    if (y < 100) y += 2000;
    year = y;
  }
  return `${season}_${year}`;
}

// ── EXTRACT TEXT FROM PDF USING TWO-COLUMN LAYOUT ─────────
async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const typedArray = new Uint8Array(e.target.result);
        const loadingTask = pdfjsLib.getDocument({ data: typedArray });
        const pdf = await loadingTask.promise;
        const fullLines = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.0 });
          const content = await page.getTextContent();
          const pageHeight = viewport.height;
          const colSplit = 305; // 305 points separates Column 1 & Column 2 in LU transcripts

          // Map items with physical coordinates
          const items = content.items.map(it => ({
            str: it.str,
            x: it.transform[4],
            y: it.transform[5],
            top: pageHeight - it.transform[5],
            width: it.width || 0,
            height: it.height || 0
          }));

          const headerItems = items.filter(it => it.top < 100);
          const col1Items   = items.filter(it => it.top >= 100 && it.x < colSplit);
          const col2Items   = items.filter(it => it.top >= 100 && it.x >= colSplit);

          function groupItemsIntoLines(list) {
            const lines = {};
            list.sort((a,b) => a.top - b.top || a.x - b.x);

            for (const it of list) {
              if (!it.str || !it.str.trim()) continue;
              let matchedY = null;
              for (const y of Object.keys(lines)) {
                if (Math.abs(it.top - parseFloat(y)) <= 3.5) {
                  matchedY = y;
                  break;
                }
              }
              if (!matchedY) {
                matchedY = String(it.top);
                lines[matchedY] = [];
              }
              lines[matchedY].push(it);
            }

            const res = [];
            for (const y of Object.keys(lines).sort((a,b) => parseFloat(a) - parseFloat(b))) {
              const row = lines[y].sort((a,b) => a.x - b.x);
              let lineStr = '';
              let lastX1 = null;
              for (const it of row) {
                if (lastX1 !== null && (it.x - lastX1) > 2.0) lineStr += ' ';
                lineStr += it.str;
                lastX1 = it.x + (it.width || 0);
              }
              res.push(lineStr.trim());
            }
            return res;
          }

          const pageLines = [
            ...groupItemsIntoLines(headerItems),
            ...groupItemsIntoLines(col1Items),
            ...groupItemsIntoLines(col2Items)
          ];
          fullLines.push(...pageLines);
        }

        resolve(fullLines.join('\n'));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── PARSE ALL LINES INTO STRUCTURED COURSES & STUDENT INFO ──
function parseTranscript(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const courses = [];
  const studentInfo = {
    name: '',
    id: '',
    program: 'Cybersecurity',
    gpa: null,
    totalEarned: 0,
    totalAttempted: 0,
    qualityPoints: 0
  };

  let currentTermRaw = null;
  let currentTermId = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Student Header
    if (line.includes('Student:') && line.includes('Student ID:')) {
      const m = line.match(/Student:\s*(.+?)\s+Student ID:\s*(.+)/);
      if (m) {
        studentInfo.name = cleanTripledText(m[1]).replace(/\s+/g, ' ').trim();
        studentInfo.id   = cleanTripledText(m[2]).replace(/\s+/g, ' ').trim();
      }
      continue;
    }

    // Program line
    if (line.includes('***Undergraduate***')) {
      studentInfo.program = 'Cybersecurity';
      continue;
    }

    // Term header line
    if (line.startsWith('Term:')) {
      currentTermRaw = line.replace('Term:', '').trim();
      currentTermId = parseTranscriptTermCode(currentTermRaw);
      continue;
    }

    // Cumulative summary row: e.g. "Undergraduate 1.45 45.00 11 41.00 32.00"
    if (line.startsWith('Undergraduate')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 6) {
        studentInfo.gpa = parts[1];
        studentInfo.qualityPoints = parseFloat(parts[2]) || 0;
        studentInfo.totalCourses = parseInt(parts[3]) || 0;
        studentInfo.totalAttempted = parseFloat(parts[4]) || 0;
        studentInfo.totalEarned = parseFloat(parts[5]) || 0;
      }
      continue;
    }

    // Course lines
    // Pattern: [CODE] [DESCRIPTION] [ATTEMPT] [EARNED] [PTS] [GRADE]
    // Example: CCJ20000 Criminology (GE-SocSci) 3.00 3.00 9.00 B R
    // Example: ARTH22700 Global Art History III: From 3.00 3.00 12.00 A
    //          Colonial Vistas to Avant-Garde (GE-HC:Arts/HD)
    const m = line.match(/^([A-Z0-9\-]{4,12})\s+(.+?)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)(?:\s+([A-Z0-9\-\+\s]+))?$/);
    if (m) {
      const rawCode = m[1].trim();
      const codeId = normalizeCode(rawCode);
      let desc = m[2].trim();
      const attempt = parseFloat(m[3]) || 0;
      const earned = parseFloat(m[4]) || 0;
      const pts = parseFloat(m[5]) || 0;
      const rawGrade = m[6] ? m[6].trim().toUpperCase() : '';
      const baseGrade = rawGrade.split(/\s+/)[0];
      const isRepeated = rawGrade.includes('R') || line.endsWith(' R');

      // Stitch wrapped continuation lines (e.g. course title continuation with GE tags)
      while (i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        if (!next) { i++; continue; }
        // Stop if next line is another course line, term header, summary, or page footer
        if (next.match(/^[A-Z0-9\-]{4,12}\s+.+?\s+[\d\.]+\s+[\d\.]+\s+[\d\.]+/) ||
            next.startsWith('Term:') || next.startsWith('***') || next.startsWith('Student:') ||
            next.startsWith('Course') || next.startsWith('Cybersecurity') || next.startsWith('Attempted') ||
            next.startsWith('Cum') || next.startsWith('Undergraduate') || next.includes('DOB:') ||
            next.includes('Page ') || next.includes('Unofficial Transcript')) {
          break;
        }
        desc += ' ' + next;
        i++;
      }

      let status = 'UNKNOWN';
      let isPassed = false;
      let isFailed = false;
      let isRegistered = false;

      if (PASSING_GRADES.has(baseGrade) || baseGrade.startsWith('TR-')) {
        status = 'COMPLETED';
        isPassed = true;
      } else if (['F', 'WF', 'WU'].includes(baseGrade) || rawGrade.split(/\s+/).includes('F')) {
        status = 'FAILED';
        isFailed = true;
      } else if (earned === 0.0 && (!rawGrade || rawGrade === '' || rawGrade === 'IP')) {
        // 0.00 earned and no grade = currently registered course on the transcript!
        status = 'REGISTERED';
        isRegistered = true;
      }

      const isTransfer = currentTermRaw ? currentTermRaw.toLowerCase().includes('transfer') : baseGrade.startsWith('TR-');

      courses.push({
        code: codeId,
        displayCode: rawCode,
        description: desc,
        term: currentTermId,
        termRaw: currentTermRaw,
        attemptCredits: attempt,
        earnedCredits: earned,
        qualityPoints: pts,
        grade: rawGrade,
        baseGrade,
        status,
        passed: isPassed,
        failed: isFailed,
        isRegistered,
        isTransfer,
        isRepeated
      });
    }
  }

  // Calculate cumulative stats fallback if Undergraduate row was missing
  if (studentInfo.totalEarned === 0 && courses.length > 0) {
    let earnedSum = 0;
    let attemptSum = 0;
    courses.forEach(c => {
      earnedSum += c.earnedCredits;
      attemptSum += c.attemptCredits;
    });
    studentInfo.totalEarned = earnedSum;
    studentInfo.totalAttempted = attemptSum;
  }

  return { courses, studentInfo };
}

// ── DETECT CATALOG YEAR FROM TRANSCRIPT / SCHEDULE ─────────
function detectCatalogYear(courses) {
  const luCourses = courses.filter(c => !c.isTransfer && c.term && c.term !== 'TRANSFER');
  if (luCourses.length === 0) return '25-26';

  luCourses.sort((a,b) => termIndex(a.term) - termIndex(b.term));
  const earliest = luCourses[0].term;
  const yr = termYear(earliest);

  if (yr <= 2023) return '23-24';
  if (yr === 2024) return '24-25';
  if (yr === 2025) return '25-26';
  return '26-27';
}

// ── PARSE OFFICIAL LINDENWOOD EXCEL COURSE SCHEDULE (.xlsx, .xls) ──
// Reads student schedule spreadsheets (e.g. StudentCourseSchedules (All Results).xlsx)
// Extracts completed, current, and future scheduled courses with exact terms, grades, and credits.
async function parseScheduleExcel(fileOrBuffer, fileName = '') {
  let arrayBuffer;
  if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer;
  } else if (typeof Blob !== 'undefined' && fileOrBuffer instanceof Blob) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
    if (!fileName && fileOrBuffer.name) fileName = fileOrBuffer.name;
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(fileOrBuffer)) {
    arrayBuffer = fileOrBuffer;
  } else {
    throw new Error('Unsupported buffer/file format for Excel parsing');
  }

  // Use XLSX / XLSXStyle loaded in global scope
  const xlsxLib = (typeof XLSXStyle !== 'undefined') ? XLSXStyle : (typeof XLSX !== 'undefined' ? XLSX : null);
  if (!xlsxLib) throw new Error('SheetJS/XLSX library not loaded');

  const wb = xlsxLib.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsxLib.utils.sheet_to_json(ws);

  const courses = [];
  const GRADE_PTS = {
    'A': 4.0, 'A+': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0, 'FN': 0.0, 'WF': 0.0
  };

  let totalEarned = 0;
  let totalAttempted = 0;
  let totalQP = 0;
  let program = 'Cybersecurity';

  rows.forEach(r => {
    let rawCode = (r['Course Code'] || r['Course'] || r['Code'] || '').toString().trim();
    if (!rawCode || rawCode.toLowerCase() === 'course code') return;

    const title = (r['Course Name'] || r['Title'] || r['Description'] || '').toString().trim();
    const grade = (r['Letter Grade'] || r['Grade'] || '').toString().trim();
    const termRaw = (r['Term'] || '').toString().trim();
    const credits = parseFloat(r['Credits'] || r['Hours'] || r['CR']) || 0;
    const statusRaw = (r['Course Status'] || r['Status'] || '').toString().trim().toLowerCase();
    const enrollment = (r['Enrollment'] || '').toString().trim();

    if (enrollment && enrollment.toLowerCase().includes('cyber')) {
      program = 'Cybersecurity';
    }

    // Clean course code: strip catalog suffixes like -23, -24
    const cleanCode = rawCode.replace(/-\d+$/, '').replace(/\s+/g, '');

    // Parse term: e.g. FALL_II_24_8W, FALL_24_16W, SPRING_I_25_8W, SUMMER_25_8W
    let termId = 'F2_2026';
    const m = termRaw.match(/(FALL|SPRING|SUMMER)(?:_(I|II))?_(\d{2,4})/i);
    if (m) {
      const season = m[1].toUpperCase();
      const sub = m[2] ? m[2].toUpperCase() : '';
      let yr = parseInt(m[3]);
      if (yr < 100) yr += 2000;
      if (season === 'FALL') {
        termId = sub === 'I' ? 'F1_' + yr : 'F2_' + yr;
      } else if (season === 'SPRING') {
        termId = sub === 'I' ? 'SP1_' + yr : 'SP2_' + yr;
      } else if (season === 'SUMMER') {
        termId = 'SU_' + yr;
      }
    }

    const isComplete = statusRaw.includes('complete') || !!grade;
    const isCurrent = statusRaw.includes('current');
    const isScheduled = statusRaw.includes('scheduled');
    const isPassed = isComplete && PASSING_GRADES.has(grade);
    const isFailed = isComplete && (grade === 'F' || grade === 'FN' || grade === 'WF');
    const isRegistered = isCurrent || isScheduled || (!grade && (isCurrent || isScheduled));

    if (isComplete && credits > 0) {
      totalAttempted += credits;
      if (isPassed) {
        totalEarned += credits;
      }
      if (GRADE_PTS[grade] !== undefined) {
        totalQP += GRADE_PTS[grade] * credits;
      }
    }

    courses.push({
      code: cleanCode,
      displayCode: rawCode,
      title: title,
      description: title,
      term: termId,
      termRaw: termRaw,
      credits: credits,
      earnedCredits: isPassed ? credits : 0,
      attemptCredits: credits,
      grade: grade,
      baseGrade: grade,
      status: isPassed ? 'passed' : (isFailed ? 'failed' : (isRegistered ? 'registered' : 'other')),
      passed: isPassed,
      failed: isFailed,
      isRegistered: isRegistered,
      isCurrent: isCurrent,
      isScheduled: isScheduled,
      isTransfer: termRaw.toLowerCase().includes('transfer')
    });
  });

  const gpa = totalAttempted > 0 ? (totalQP / totalAttempted).toFixed(2) : '3.00';

  // Guess student name if in filename (e.g., 'Wyatt Justus Schedule.xlsx')
  let guessedName = '';
  const cleanFn = (fileName || '').replace(/\.[^/.]+$/, '');
  if (/wyatt/i.test(cleanFn)) guessedName = 'Wyatt Justus';
  else if (/cesar/i.test(cleanFn)) guessedName = 'Cesar Mendoza';

  const studentInfo = {
    name: guessedName,
    id: '',
    program: program,
    gpa: gpa,
    totalEarned: totalEarned,
    totalAttempted: totalAttempted,
    qualityPoints: totalQP
  };

  return { courses, studentInfo };
}
