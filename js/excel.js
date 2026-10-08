// ============================================================
// EXCEL GENERATOR  —  excel.js
// Populates official Lindenwood University PPG Excel templates
// for Catalog Years 23-24, 24-25, 25-26, 26-27
// Fallback: builds formatted LU workbook from scratch if offline
// ============================================================

// ── COLOR FILLS FOR EXCEL CELLS ───────────────────────────
const FILL_COMPLETED   = { fgColor: { rgb: 'C6EFCE' } }; // Light green — completed/passed
const FILL_IN_PROGRESS = { fgColor: { rgb: 'FFEB9C' } }; // Soft yellow — currently enrolled
const FILL_FAILED      = { fgColor: { rgb: 'FFC7CE' } }; // Soft red — failed
const FILL_PLANNED     = { fgColor: { rgb: 'DDEBF7' } }; // Soft blue — planned/future

function styleWithFill(fillRgb) {
  return {
    fill: { patternType: 'solid', fgColor: { rgb: fillRgb } },
    font: { name: 'Calibri', sz: 10 },
    alignment: { vertical: 'center' },
  };
}

// ── GE ROW MAPPING IN LU TEMPLATE ─────────────────────────
// Maps GE slot IDs to row numbers in the official Degree Plan sheet
const GE_ROW_MAP = {
  ge_comp1:  9,  // ENGL 15000 Composition I
  ge_comp2:  10, // ENGL 17000 Composition II
  ge_stats:  11, // MTH 14100 Basic Statistics*
  ge_ushist: 12, // U.S. History/Government
  ge_socsci: 15, // Social Science
  ge_natsci: 16, // Natural Science w/ Lab
  ge_socnat: 17, // Social or Natural Science
  ge_math:   18, // Math* (double-counted)
  ge_art:    21, // Art
  ge_lit:    22, // Literature
  ge_hcelect:23, // Elective in Human Cultures
  ge_nonlit: 24, // Non-Lit, Non-Arts HC Elective
  ge_elec1:  27, // Free Elective 1
  ge_elec2:  28, // Free Elective 2
  ge_div1:   31, // Human Diversity 1
  ge_div2:   32, // Human Diversity 2
};

// ── POPULATE OFFICIAL TEMPLATE WORKBOOK ────────────────────
function populateOfficialTemplate(wb, plan) {
  const wsPlan = wb.Sheets['Degree Plan'];
  const wsPath = wb.Sheets['Degree Path'];

  if (!wsPlan) {
    console.warn('Degree Plan sheet not found in template, falling back');
    return false;
  }

  const sName = plan.studentName || 'Student';
  const sId = plan.studentId || '';
  const gradDate = plan.stats.graduationTerm ? semesterTitle(plan.stats.graduationTerm) : 'TBD';

  // 1. Student Header in GE section (rows 3-6)
  setCellValue(wsPlan, 'C4', sName);
  setCellValue(wsPlan, 'G4', sId);
  setCellValue(wsPlan, 'G5', gradDate);
  setCellValue(wsPlan, 'G3', 'Advisor');

  // 2. Student Header in Major section (rows 38-41)
  setCellValue(wsPlan, 'C39', sName);
  setCellValue(wsPlan, 'G39', sId);
  setCellValue(wsPlan, 'G40', gradDate);
  setCellValue(wsPlan, 'G38', 'Advisor');

  // 3. Populate General Education Rows (rows 9-32)
  // 3. Populate General Education Rows (rows 9-32)
  plan.geStatus.forEach(slot => {
    const row = GE_ROW_MAP[slot.id];
    if (!row) return;

    const cellE = `E${row}`; // Term/Transfer
    const cellF = `F${row}`; // Course Name/Code
    const cellH = `H${row}`; // Credits

    if (slot.satisfied && slot.satisfiedBy) {
      const sat = slot.satisfiedBy;
      const isReg = !!sat.isRegistered;
      const termDisplay = sat.termId === 'TRANSFER'
        ? 'Transfer'
        : (sat.termId ? `${semesterTitle(sat.termId)}${isReg ? ' (scheduled)' : ''}` : 'Completed');
      const courseDesc = sat.course || sat.description || slot.label;
      const fill = isReg ? FILL_IN_PROGRESS : FILL_COMPLETED;
      const cr = isReg ? 0 : (slot.credits || 3);

      wsPlan[cellE] = makeCell(termDisplay, fill);
      wsPlan[cellF] = makeCell(courseDesc, fill);

      // Human diversity rows (rows 31 & 32) do not write credits into column H (they double-apply)
      if (slot.id !== 'ge_div1' && slot.id !== 'ge_div2') {
        wsPlan[cellH] = makeNumCell(cr, fill);
      } else {
        wsPlan[cellH] = makeCell('', fill);
      }

    } else {
      // Pending/unmet slot: fill with official LU template placeholder format
      wsPlan[cellE] = makeCell('___________', {});
      wsPlan[cellF] = makeCell('____________________', {});
      if (slot.id !== 'ge_div1' && slot.id !== 'ge_div2') {
        wsPlan[cellH] = makeNumCell(0, {});
      } else {
        wsPlan[cellH] = makeCell('', {});
      }
    }
  });

  // 4. Populate Major Coursework Rows (rows 45 to 66)
  // The template has course names in column B; we write term info to column F and credits to H
  for (let r = 45; r <= 66; r++) {
    const cellB = wsPlan[`B${r}`];
    if (!cellB || !cellB.v) continue;

    const rowText = String(cellB.v).trim();
    // Extract course code like 'ICS 21300' or 'IIT 22000'
    const match = rowText.match(/^([A-Z]{2,4}\s*\d{4,6})/);
    if (!match) continue;

    const codeRaw = match[1];
    const codeId = normalizeCode(codeRaw);
    const cellF = `F${r}`; // Term/Transfer written here
    const cellH = `H${r}`; // Credits

    if (plan.completed && plan.completed[codeId]) {
      // ✅ COMPLETED — green fill
      const comp = plan.completed[codeId];
      const termStr = comp.termId === 'TRANSFER' ? 'Transfer' : (comp.termId ? termDisplayShort(comp.termId) : 'Completed');
      const gradeStr = comp.grade ? ` [${comp.grade}]` : '';
      wsPlan[cellF] = makeCell(`${termStr}${gradeStr}`, FILL_COMPLETED);
      wsPlan[cellH] = makeNumCell(3, FILL_COMPLETED);

    } else if (plan.inProgress && plan.inProgress[codeId]) {
      // 🟡 IN PROGRESS / CURRENTLY ENROLLED — yellow fill
      const curTerm = plan.inProgress[codeId];
      const termStr = curTerm ? termDisplayShort(curTerm) : 'Current Term';
      wsPlan[cellF] = makeCell(`${termStr} (In Progress)`, FILL_IN_PROGRESS);
      wsPlan[cellH] = makeNumCell(3, FILL_IN_PROGRESS);

    } else if (plan.failed && plan.failed[codeId] && !plan.completed[codeId] && !plan.inProgress[codeId]) {
      // 🔴 FAILED (and not yet retaken) — red fill
      const failInfo = plan.failed[codeId][0];
      const termStr = failInfo && failInfo.termId ? termDisplayShort(failInfo.termId) : 'Previous';
      wsPlan[cellF] = makeCell(`${termStr} (F - Retake Required)`, FILL_FAILED);
      wsPlan[cellH] = makeNumCell(0, FILL_FAILED);

    } else {
      // 🔵 PLANNED — blue fill
      const sch = (plan.scheduled || []).find(s => s.id === codeId);
      if (sch && sch.termId) {
        wsPlan[cellF] = makeCell(`${termDisplayShort(sch.termId)} (Planned)`, FILL_PLANNED);
        wsPlan[cellH] = makeNumCell(3, FILL_PLANNED);
      }
    }
  }

  // Calculate and write official summary totals in Degree Plan sheet:
  // Row 35 (I35): GE Credits Transferred/Completed
  const totalGECredits = (plan.geStatus || [])
    .filter(s => s.satisfied && s.satisfiedBy && !s.satisfiedBy.isRegistered && s.id !== 'ge_div1' && s.id !== 'ge_div2')
    .reduce((sum, s) => sum + (s.credits || 3), 0);
  wsPlan['I35'] = makeNumCell(totalGECredits, {});

  // Row 69 & 70 (I69, I70): Major Credits Completed & Remaining
  wsPlan['I69'] = makeNumCell(plan.stats.majorCreditsCompleted || 0, {});
  wsPlan['I70'] = makeNumCell(plan.stats.majorCreditsRemaining || 0, {});

  // 5. Populate Sheet 2: Degree Path
  if (wsPath) {
    const semSlots = [
      { labelCell: 'A3',  col: 'A', startRow: 4,  endRow: 9 },  // Sem 1
      { labelCell: 'F3',  col: 'F', startRow: 4,  endRow: 9 },  // Sem 2
      { labelCell: 'A11', col: 'A', startRow: 12, endRow: 17 }, // Sem 3
      { labelCell: 'F11', col: 'F', startRow: 12, endRow: 17 }, // Sem 4
      { labelCell: 'A19', col: 'A', startRow: 20, endRow: 25 }, // Sem 5
      { labelCell: 'F19', col: 'F', startRow: 20, endRow: 25 }, // Sem 6
      { labelCell: 'A27', col: 'A', startRow: 28, endRow: 33 }, // Sem 7
      { labelCell: 'F27', col: 'F', startRow: 28, endRow: 33 }, // Sem 8
    ];

    // Filter to university enrollment semesters (exclude pure transfer container from 8 semester path)
    const universitySemesters = (plan.semesters || []).filter(s => s.semId !== 'TRANSFER' && s.courses && s.courses.length > 0);

    semSlots.forEach((slot, idx) => {
      const sem = universitySemesters[idx];
      if (!sem) return;

      const title = `Semester ${idx + 1}: ${sem.title}`;

      wsPath[slot.labelCell] = {
        v: title,
        t: 's',
        s: { font: { bold: true, sz: 11, color: { rgb: '8B1A1A' } } }
      };

      // Courses in this semester (up to 6)
      sem.courses.slice(0, 6).forEach((c, ci) => {
        const row = slot.startRow + ci;
        const cellCoord = `${slot.col}${row}`;
        const courseData = c.course || getCourse(c.id) || { code: c.id, name: '' };
        const gradeStr = c.grade ? ` [${c.grade}]` : '';
        const statusStr = c.status === 'inProgress' ? ' (Current)' : c.status === 'failed' ? ' (Retake)' : '';
        const subStr = c.subTerm ? ` (${c.subTerm})` : '';
        const text = `${courseData.code} ${courseData.name}${gradeStr}${statusStr}${subStr}`;

        let fill = FILL_PLANNED;
        if (c.status === 'completed') fill = FILL_COMPLETED;
        else if (c.status === 'inProgress') fill = FILL_IN_PROGRESS;
        else if (c.status === 'failed') fill = FILL_FAILED;

        wsPath[cellCoord] = {
          v: text,
          t: 's',
          s: { fill, font: { sz: 9 } }
        };
      });
    });
  }

  return true;
}

// ── HELPER: safely set a cell value preserving existing style ─
function setCellValue(ws, addr, value) {
  if (ws[addr]) {
    ws[addr] = { ...ws[addr], v: value, t: 's' };
  } else {
    ws[addr] = { v: value, t: 's' };
  }
}

// ── HELPER: create a styled text cell ─────────────────────
function makeCell(value, fillObj) {
  return {
    v: value,
    t: 's',
    s: {
      fill: { patternType: 'solid', ...fillObj },
      font: { name: 'Calibri', sz: 10 },
      alignment: { vertical: 'center', wrapText: true }
    }
  };
}

// ── HELPER: create a styled numeric cell ──────────────────
function makeNumCell(value, fillObj) {
  return {
    v: value,
    t: 'n',
    s: {
      fill: { patternType: 'solid', ...fillObj },
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' }
    }
  };
}

// ── STANDALONE FALLBACK GENERATOR (OFFLINE / STRICT NO-CORS) ─
function buildSheet1Fallback(plan) {
  const ws = {};
  let r = 0;

  function setCell(col, row, val, style, type) {
    const addr = XLSXStyle.utils.encode_cell({ c: col, r: row });
    ws[addr] = { v: val, t: type || (typeof val === 'number' ? 'n' : 's'), s: style || {} };
  }

  function addMerge(r1, c1, r2, c2) {
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
  }

  const HDR = {
    fill: { patternType: 'solid', fgColor: { rgb: '8B1A1A' } },
    font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  const SUBHDR = {
    fill: { patternType: 'solid', fgColor: { rgb: 'D9D9D9' } },
    font: { name: 'Calibri', sz: 10, bold: true },
    alignment: { vertical: 'center' }
  };
  const BOLD10 = { font: { name: 'Calibri', sz: 10, bold: true } };
  const NORM10 = { font: { name: 'Calibri', sz: 10 } };

  // Title
  setCell(0, r, `Lindenwood University — BS in Cybersecurity — Program Planning Guide (${plan.catalogYear})`, HDR);
  addMerge(r, 0, r, 7);
  r++;

  // Student header
  setCell(0, r, 'Student Name:', BOLD10); setCell(1, r, plan.studentName || '_______________', NORM10);
  setCell(4, r, 'Student ID:', BOLD10);   setCell(5, r, plan.studentId || '_______________', NORM10);
  r++;
  setCell(0, r, 'Catalog Year:', BOLD10); setCell(1, r, plan.catalog?.label || plan.catalogYear, NORM10);
  setCell(4, r, 'Anticipated Grad:', BOLD10);
  setCell(5, r, plan.stats.graduationTerm ? semesterTitle(plan.stats.graduationTerm) : 'TBD', NORM10);
  r++;
  r++;

  // General Education Section
  setCell(0, r, 'GENERAL EDUCATION REQUIREMENTS', HDR);
  addMerge(r, 0, r, 7);
  r++;

  setCell(0, r, 'Category', SUBHDR); addMerge(r, 0, r, 2);
  setCell(3, r, 'Course', SUBHDR);   addMerge(r, 3, r, 4);
  setCell(5, r, 'Term', SUBHDR);
  setCell(6, r, 'CR', SUBHDR);
  r++;

  plan.geStatus.forEach(slot => {
    setCell(0, r, slot.label, BOLD10); addMerge(r, 0, r, 2);
    if (slot.satisfied && slot.satisfiedBy) {
      const sat = slot.satisfiedBy;
      const isReg = !!sat.isRegistered;
      const fill = isReg ? FILL_IN_PROGRESS : FILL_COMPLETED;
      const termDisplay = sat.termId === 'TRANSFER'
        ? 'Transfer'
        : (sat.termId ? `${semesterTitle(sat.termId)}${isReg ? ' (scheduled)' : ''}` : 'Completed');
      const cr = isReg ? 0 : (slot.credits || 3);
      setCell(3, r, sat.description || sat.course || 'Completed', { fill }); addMerge(r, 3, r, 4);
      setCell(5, r, termDisplay, { fill });
      setCell(6, r, cr, { fill }, 'n');
    } else {
      setCell(3, r, 'Pending', NORM10); addMerge(r, 3, r, 4);
      setCell(5, r, '___________', NORM10);
      setCell(6, r, 0, NORM10, 'n');
    }
    r++;
  });

  r++;
  // Major Coursework
  setCell(0, r, `MAJOR COURSEWORK (${plan.catalog?.label || plan.catalogYear})`, HDR);
  addMerge(r, 0, r, 7);
  r++;

  setCell(0, r, 'Course', SUBHDR); addMerge(r, 0, r, 2);
  setCell(3, r, 'Status / Term', SUBHDR); addMerge(r, 3, r, 4);
  setCell(5, r, 'CR', SUBHDR);
  setCell(6, r, 'Notes', SUBHDR);
  r++;

  const catIds = getCatalogCourseIds(plan.catalogYear);
  catIds.forEach(id => {
    const course = getCourse(id);
    if (!course) return;

    setCell(0, r, `${course.code} ${course.name}`, BOLD10);
    addMerge(r, 0, r, 2);

    if (plan.completed && plan.completed[id]) {
      const comp = plan.completed[id];
      const termStr = comp.termId === 'TRANSFER' ? 'Transfer' : semesterTitle(comp.termId);
      setCell(3, r, `Completed: ${termStr}${comp.grade ? ` [${comp.grade}]` : ''}`, { fill: FILL_COMPLETED });
      setCell(5, r, 3, { fill: FILL_COMPLETED }, 'n');
    } else if (plan.inProgress && plan.inProgress[id]) {
      // 🟡 SHOW IN-PROGRESS COURSES WITH YELLOW
      const curTerm = plan.inProgress[id];
      setCell(3, r, `In Progress (${semesterTitle(curTerm)})`, { fill: FILL_IN_PROGRESS });
      setCell(5, r, 3, { fill: FILL_IN_PROGRESS }, 'n');
    } else if (plan.failed && plan.failed[id] && !plan.completed[id] && !plan.inProgress[id]) {
      setCell(3, r, 'Retake Needed (Failed)', { fill: FILL_FAILED });
      setCell(5, r, 0, { fill: FILL_FAILED }, 'n');
    } else {
      const sch = (plan.scheduled || []).find(s => s.id === id);
      const termStr = sch ? semesterTitle(sch.termId) : 'Planned';
      setCell(3, r, `Planned: ${termStr}`, { fill: FILL_PLANNED });
      setCell(5, r, 3, { fill: FILL_PLANNED }, 'n');
    }
    addMerge(r, 3, r, 4);
    setCell(6, r, course.badge || '', NORM10);
    r++;
  });

  ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r, c: 7 } });
  ws['!cols'] = [
    { wch: 14 }, { wch: 20 }, { wch: 10 },
    { wch: 20 }, { wch: 14 }, { wch: 14 },
    { wch: 8 },  { wch: 25 }
  ];
  return ws;
}

function buildSheet2Fallback(plan) {
  const ws = {};
  let r = 0;

  function setCell(col, row, val, style, type) {
    const addr = XLSXStyle.utils.encode_cell({ c: col, r: row });
    ws[addr] = { v: val, t: type || (typeof val === 'number' ? 'n' : 's'), s: style || {} };
  }
  function addMerge(r1, c1, r2, c2) {
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
  }

  const HDR = {
    fill: { patternType: 'solid', fgColor: { rgb: '8B1A1A' } },
    font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  const SEM_HDR = {
    fill: { patternType: 'solid', fgColor: { rgb: '2F5496' } },
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { vertical: 'center' }
  };

  setCell(0, r, 'Lindenwood University — Cybersecurity Degree Path', HDR);
  addMerge(r, 0, r, 8);
  r++;
  setCell(0, r, `Student: ${plan.studentName || 'Student'} | Catalog: ${plan.catalog?.label || plan.catalogYear}`, { font: { bold: true } });
  addMerge(r, 0, r, 8);
  r++;
  r++;

  const universitySems = (plan.semesters || []).filter(s => s.semId !== 'TRANSFER' && s.courses && s.courses.length > 0);

  for (let i = 0; i < universitySems.length; i += 2) {
    const left = universitySems[i];
    const right = universitySems[i + 1];

    if (left) {
      setCell(0, r, `Semester ${i+1}: ${left.title}`, SEM_HDR);
      addMerge(r, 0, r, 3);
    }
    if (right) {
      setCell(5, r, `Semester ${i+2}: ${right.title}`, SEM_HDR);
      addMerge(r, 5, r, 8);
    }
    r++;

    const leftCourses = left ? left.courses : [];
    const rightCourses = right ? right.courses : [];
    const maxCourses = Math.max(leftCourses.length, rightCourses.length);

    for (let c = 0; c < maxCourses; c++) {
      if (leftCourses[c]) {
        const item = leftCourses[c];
        const cd = item.course || getCourse(item.id) || { code: item.id, name: '' };
        let fill = FILL_PLANNED;
        if (item.status === 'completed') fill = FILL_COMPLETED;
        else if (item.status === 'inProgress') fill = FILL_IN_PROGRESS;
        else if (item.status === 'failed') fill = FILL_FAILED;
        const gradeStr = item.grade ? ` [${item.grade}]` : '';
        const statusStr = item.status === 'inProgress' ? ' (Current)' : '';
        const subStr = item.subTerm ? ` (${item.subTerm})` : '';
        setCell(0, r, `${cd.code} ${cd.name}${gradeStr}${statusStr}${subStr}`, { fill });
        addMerge(r, 0, r, 3);
      }
      if (rightCourses[c]) {
        const item = rightCourses[c];
        const cd = item.course || getCourse(item.id) || { code: item.id, name: '' };
        let fill = FILL_PLANNED;
        if (item.status === 'completed') fill = FILL_COMPLETED;
        else if (item.status === 'inProgress') fill = FILL_IN_PROGRESS;
        else if (item.status === 'failed') fill = FILL_FAILED;
        const gradeStr = item.grade ? ` [${item.grade}]` : '';
        const statusStr = item.status === 'inProgress' ? ' (Current)' : '';
        const subStr = item.subTerm ? ` (${item.subTerm})` : '';
        setCell(5, r, `${cd.code} ${cd.name}${gradeStr}${statusStr}${subStr}`, { fill });
        addMerge(r, 5, r, 8);
      }
      r++;
    }
    r++;
  }

  ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r, c: 8 } });
  ws['!cols'] = [
    { wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 5 }, { wch: 2 },
    { wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 5 }
  ];
  return ws;
}

// ── MAIN DOWNLOAD ENTRY POINT ─────────────────────────────
async function downloadPPGExcel(plan) {
  if (typeof XLSXStyle === 'undefined') {
    alert('Excel styling library not loaded. Please ensure you are connected to the internet.');
    return;
  }

  const catalogYear = plan.catalogYear || '25-26';
  const studentSafe = (plan.studentName || 'Student').replace(/\s+/g, '_');
  const filename = `PPG_${studentSafe}_${catalogYear}_Cybersecurity.xlsx`;

  // First: try fetching the official Lindenwood template
  const templatePath = `templates/${catalogYear} Cybersecurity, BS.xlsx`;

  try {
    const resp = await fetch(templatePath);
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      const wb = XLSXStyle.read(buffer, { type: 'array', cellStyles: true });

      const success = populateOfficialTemplate(wb, plan);
      if (success) {
        XLSXStyle.writeFile(wb, filename);
        console.log('Successfully generated official template PPG:', filename);
        return;
      }
    }
  } catch (err) {
    console.warn('Official template fetch skipped (running in offline/file sandbox):', err.message);
  }

  // Fallback: build beautiful formatted workbook from scratch
  console.log('Generating fallback styled PPG workbook...');
  const fallbackWb = XLSXStyle.utils.book_new();
  const ws1 = buildSheet1Fallback(plan);
  const ws2 = buildSheet2Fallback(plan);

  XLSXStyle.utils.book_append_sheet(fallbackWb, ws1, 'Degree Plan');
  XLSXStyle.utils.book_append_sheet(fallbackWb, ws2, 'Degree Path');

  XLSXStyle.writeFile(fallbackWb, filename);
}
