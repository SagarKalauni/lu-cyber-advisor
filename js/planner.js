// ============================================================
// DEGREE PLANNER  —  planner.js
// Core algorithm: builds an optimal semester-by-semester plan
// Handles completed courses, registered courses from transcript,
// failed retakes, and future prerequisite-driven terms
// ============================================================

const MAX_COURSES_PER_TERM = 3;

/**
 * buildDegreePlan(options)
 */
function buildDegreePlan({ catalogYear, currentTermId, allCourses, inProgressIds, studentName, studentId, studentInfo }) {
  const catalog = CATALOGS[catalogYear] || CATALOGS['26-27'];
  const requiredIds = getCatalogCourseIds(catalogYear);

  const completed   = {}; // courseId -> { termId, grade, earned, description }
  const failed      = {}; // courseId -> [{ termId, grade }]
  const inProgress  = {}; // courseId -> termId
  const geCompleted = {}; // slotId -> { course, termId, description }

  const allTranscriptCourses = allCourses || [];

  // ── 1. Process all transcript courses ─────────────────────
  // DEDUP LOGIC: If a course appears multiple times (failed then retaken),
  // we track both but only count credit once (the passed instance).
  // If currently registered for a previously-failed course, show it as inProgress.
  
  // First pass: identify all passed/failed/registered entries
  const passedEntries = {}; // courseId -> best passed entry
  const failedEntries = {}; // courseId -> [fail entries]
  const registeredEntries = {}; // courseId -> termId

  allTranscriptCourses.forEach(c => {
    if (!c.code) return;
    const id = normalizeCode(c.code);

    if (c.passed) {
      // Keep the most recent passed entry (highest term index)
      if (!passedEntries[id] || termIndex(c.term) > termIndex(passedEntries[id].term)) {
        passedEntries[id] = c;
      }
    } else if (c.failed) {
      if (!failedEntries[id]) failedEntries[id] = [];
      failedEntries[id].push(c);
    } else if (c.isRegistered) {
      registeredEntries[id] = c.term || currentTermId;
    }
  });

  // Second pass: build completed/failed/inProgress maps (no double counting)
  Object.entries(passedEntries).forEach(([id, c]) => {
    completed[id] = {
      termId: c.term || 'TRANSFER',
      grade: c.grade,
      earned: c.earnedCredits || 3,
      description: c.description
    };
  });

  Object.entries(failedEntries).forEach(([id, entries]) => {
    // Only add to failed if NOT already passed
    if (!completed[id]) {
      failed[id] = entries.map(e => ({ termId: e.term, grade: e.grade }));
    }
  });

  Object.entries(registeredEntries).forEach(([id, termId]) => {
    // Registered = currently enrolled; takes priority over failed status
    inProgress[id] = termId;
    // If they were in failed list but are now retaking, keep failed entry for display
    // but do NOT include in active-fail-only logic
  });

  // Third pass: Match General Education slots (most restrictive first)
  // Note: ge_div1 and ge_div2 are Human Diversity overlays (ILO 2.5) that double-dip
  // and are populated in the dedicated pass below.
  const GE_PRIORITY_ORDER = [
    'ge_ushist', 'ge_comp1', 'ge_comp2', 'ge_stats',
    'ge_art', 'ge_lit', 'ge_socsci', 'ge_natsci', 'ge_socnat', 'ge_math',
    'ge_nonlit', 'ge_hcelect', 'ge_elec1', 'ge_elec2'
  ];

  const geSlotById = {};
  GE_SLOTS.forEach(slot => { geSlotById[slot.id] = slot; });

  // ── GENERAL EDUCATION MATCHING ────────────────────────────
  // Pass 1: Match passed courses in strict priority order
  const passedCoursesForGE = allTranscriptCourses.filter(c => c.passed);
  const assignedToGE = new Set(); // track course codes assigned to prevent double-counting across different GE slots

  GE_PRIORITY_ORDER.forEach(slotId => {
    if (geCompleted[slotId]) return;
    const slot = geSlotById[slotId];
    if (!slot) return;
    if (slot.credits === 0) return;

    for (const c of passedCoursesForGE) {
      const courseKey = (c.code || '').replace(/[\s-]/g, '').toUpperCase();
      if (assignedToGE.has(courseKey)) continue;
      if (!matchesGESlot(slot, c.code, c.description)) continue;

      geCompleted[slotId] = {
        course: c.displayCode || c.code,
        termId: c.term,
        description: c.description,
        isRegistered: false,
        credits: slot.credits || 3
      };

      assignedToGE.add(courseKey);
      break;
    }
  });

  // Pass 2: If any slot is still unfilled, check currently registered / in-progress courses
  const registeredCoursesForGE = allTranscriptCourses.filter(c => c.isRegistered);

  GE_PRIORITY_ORDER.forEach(slotId => {
    if (geCompleted[slotId]) return;
    const slot = geSlotById[slotId];
    if (!slot) return;
    if (slot.credits === 0) return;

    for (const c of registeredCoursesForGE) {
      const courseKey = (c.code || '').replace(/[\s-]/g, '').toUpperCase();
      if (assignedToGE.has(courseKey)) continue;
      if (!matchesGESlot(slot, c.code, c.description)) continue;

      geCompleted[slotId] = {
        course: c.displayCode || c.code,
        termId: c.term,
        description: c.description,
        isRegistered: true,
        credits: 0 // In-progress courses show 0 credits on official PPG until grade is posted
      };

      assignedToGE.add(courseKey);
      break;
    }
  });

  // MTH 14100 double-dip: if stats is satisfied, and math is still empty, double-count to math
  if (geCompleted['ge_stats'] && !geCompleted['ge_math']) {
    geCompleted['ge_math'] = {
      ...geCompleted['ge_stats'],
      course: geCompleted['ge_stats'].course,
      note: 'Double-counted from MTH 14100 (Required Core)'
    };
  }

  // ── HUMAN DIVERSITY OVERLAY (ILO 2.5) ──────────────────────
  // Human Diversity (ge_div1, ge_div2) can be double-applied to other GE requirements.
  // Two distinct courses meeting ILO 2.5 / HD are needed.
  const hdCandidates = [];
  const cleanCode = (str) => (str || '').replace(/[\s-]/g, '').toUpperCase();

  // 1. Check courses already assigned to primary GE slots
  for (const [sId, info] of Object.entries(geCompleted)) {
    if (sId === 'ge_div1' || sId === 'ge_div2') continue;
    if (matchesGESlot(geSlotById['ge_div1'], info.course, info.description)) {
      if (!hdCandidates.some(cand => cleanCode(cand.course) === cleanCode(info.course))) {
        hdCandidates.push({
          course: info.course,
          termId: info.termId,
          description: info.description,
          isRegistered: !!info.isRegistered,
          note: `Double-applied from ${geSlotById[sId]?.label || sId}`
        });
      }
    }
  }

  // 2. Check any remaining transcript courses (passed or registered)
  allTranscriptCourses.forEach(c => {
    if (c.passed || c.isRegistered) {
      if (matchesGESlot(geSlotById['ge_div1'], c.code, c.description)) {
        if (!hdCandidates.some(cand => cleanCode(cand.course) === cleanCode(c.code))) {
          hdCandidates.push({
            course: c.displayCode || c.code,
            termId: c.term,
            description: c.description,
            isRegistered: !!c.isRegistered,
            note: 'Human Diversity course'
          });
        }
      }
    }
  });

  // Assign up to two distinct HD candidates to ge_div1 and ge_div2
  if (hdCandidates.length > 0) {
    geCompleted['ge_div1'] = {
      ...hdCandidates[0],
      credits: 0 // double-applied overlay
    };
  }
  if (hdCandidates.length > 1) {
    geCompleted['ge_div2'] = {
      ...hdCandidates[1],
      credits: 0 // double-applied overlay
    };
  }

  // Add any explicitly provided in-progress IDs
  (inProgressIds || []).forEach(id => {
    const nid = normalizeCode(id);
    if (!inProgress[nid]) inProgress[nid] = currentTermId;
  });

  // 2. Identify remaining courses needed
  // A course is needed if: not completed AND not in-progress
  const needed = requiredIds.filter(id => !completed[id] && !inProgress[id]);

  // 3. Prerequisite checker
  const scheduled = []; // will be populated below
  
  function prereqsDone(courseId, asOfTermIdx) {
    const course = getCourse(courseId);
    if (!course || !course.prereqs || course.prereqs.length === 0) return { ok: true, missing: [] };
    if (course.prereqs.includes('LAST_TERM')) return { ok: true, missing: [] };

    const missing = [];
    for (const prereqId of course.prereqs) {
      if (prereqId === 'MTH14100') {
        if (completed['MTH14100'] && termIndex(completed['MTH14100'].termId) < asOfTermIdx) continue;
        if (inProgress['MTH14100'] && termIndex(inProgress['MTH14100']) < asOfTermIdx) continue;
        const schM = scheduled.find(s => s.id === 'MTH14100');
        if (schM && termIndex(schM.termId) < asOfTermIdx) continue;
        missing.push('MTH 14100 Basic Statistics');
        continue;
      }
      const cDone = completed[prereqId];
      if (cDone && termIndex(cDone.termId) < asOfTermIdx) continue;
      const cIP = inProgress[prereqId];
      if (cIP && termIndex(cIP) < asOfTermIdx) continue;
      const cSch = scheduled.find(s => s.id === prereqId);
      if (cSch && termIndex(cSch.termId) < asOfTermIdx) continue;

      missing.push(getCourse(prereqId)?.code || prereqId);
    }
    return { ok: missing.length === 0, missing };
  }

  // 4. Scheduling algorithm
  const startTermIdx = termIndex(currentTermId) + 1;
  const termLoad     = {};

  function getLoad(termId) { return termLoad[termId] || 0; }
  function addLoad(termId) { termLoad[termId] = (termLoad[termId] || 0) + 1; }

  // Count in-progress courses against their terms
  Object.entries(inProgress).forEach(([id, termId]) => {
    addLoad(termId);
  });

const MAX_COURSES_PER_8W = 2; // Max 2 courses per 8-week term
const MAX_COURSES_PER_SEM = 4; // Max 4 major courses per regular semester (12 credits)
const MAX_COURSES_SUMMER = 2;  // Max 2 courses in summer

  function findEarliestTerm(courseId, afterTermIdx) {
    const course = getCourse(courseId);
    if (!course) return null;

    const offeredSeasons = course.offered;

    for (let i = Math.max(startTermIdx, afterTermIdx); i < TERM_SEQUENCE.length; i++) {
      const tid = TERM_SEQUENCE[i];
      const season = termSeason(tid);

      if (!offeredSeasons.includes(season)) continue;

      // 8-week sub-term limit
      if (getLoad(tid) >= MAX_COURSES_PER_8W) continue;

      // Full semester balancing limit (Fall / Spring max 4, Summer max 2)
      const semId = termToSemesterId(tid);
      const isSummer = season === 'SU';
      const semLimit = isSummer ? MAX_COURSES_SUMMER : MAX_COURSES_PER_SEM;
      const currentSemCourses = scheduled.filter(s => termToSemesterId(s.termId) === semId).length;
      if (currentSemCourses >= semLimit) continue;

      const { ok } = prereqsDone(courseId, i);
      if (!ok) continue;

      if (course.prereqs.includes('LAST_TERM')) return null;

      return tid;
    }
    return null;
  }

  function constraintScore(courseId) {
    const course = getCourse(courseId);
    if (!course) return 0;
    const offeredCount = course.offered ? course.offered.length : 5;
    const prereqDepth = course.prereqs ? course.prereqs.length : 0;
    return (5 - offeredCount) * 10 + prereqDepth;
  }

  const toSchedule = [...needed].sort((a,b) => constraintScore(b) - constraintScore(a));
  const capstoneId = requiredIds.includes('ICS48900') ? 'ICS48900' : null;
  const withoutCapstone = capstoneId ? toSchedule.filter(id => id !== capstoneId) : toSchedule;

  let maxPasses = 15;
  let remainingToSchedule = [...withoutCapstone];

  while (remainingToSchedule.length > 0 && maxPasses-- > 0) {
    const stillRemaining = [];
    for (const courseId of remainingToSchedule) {
      const earliestTerm = findEarliestTerm(courseId, startTermIdx);
      if (earliestTerm) {
        const course = getCourse(courseId);
        const prereqs = (course.prereqs || []).filter(p => p !== 'LAST_TERM' && p !== 'MTH14100').map(p => getCourse(p)?.code || p);
        const flags = [];
        if (course.offered.length === 1) flags.push(`🚨 Only offered in ${termDisplayShort(earliestTerm).split(' ')[1]} — once per year`);
        if (course.offered.length === 2) flags.push(`⚠️ Offered twice per year`);
        if (failed[courseId] && !inProgress[courseId]) flags.push(`🔴 Retake from previous term`);

        let reason = '';
        if (prereqs.length > 0) {
          reason += `Prerequisites satisfied: ${prereqs.join(', ')}. `;
        }
        reason += course.planningNote;

        scheduled.push({ id: courseId, termId: earliestTerm, reason, flags, course });
        addLoad(earliestTerm);
      } else {
        stillRemaining.push(courseId);
      }
    }
    if (stillRemaining.length === remainingToSchedule.length) break;
    remainingToSchedule = stillRemaining;
  }

  // Schedule Capstone in final semester
  if (capstoneId && !completed[capstoneId] && !inProgress[capstoneId]) {
    const lastScheduledTerm = scheduled.length > 0
      ? scheduled.reduce((max, s) => termIndex(s.termId) > termIndex(max) ? s.termId : max, TERM_SEQUENCE[startTermIdx])
      : TERM_SEQUENCE[startTermIdx];

    const capCourse = getCourse(capstoneId);
    for (let i = termIndex(lastScheduledTerm); i < TERM_SEQUENCE.length; i++) {
      const tid = TERM_SEQUENCE[i];
      if (capCourse.offered.includes(termSeason(tid)) && getLoad(tid) < MAX_COURSES_PER_TERM) {
        scheduled.push({
          id: capstoneId,
          termId: tid,
          reason: 'The Cybersecurity Capstone is scheduled in your final semester concurrent with your last course, as required by Lindenwood degree completion policy. Offered in Fall I and Spring I.',
          flags: ['🎓 FINAL TERM CAPSTONE'],
          course: capCourse
        });
        addLoad(tid);
        break;
      }
    }
  }

  // 5. Build General Education status list
  const geStatus = GE_SLOTS.map(slot => {
    const done = geCompleted[slot.id];
    return { ...slot, satisfied: !!done, satisfiedBy: done || null };
  });

  // 6. Group into semester display objects (COMBINING Fall I + II into Fall [Year], Spring I + II into Spring [Year])
  const semesterMap = {};

  function addToSemester(termId, courseEntry) {
    const semId = termToSemesterId(termId);
    if (!semesterMap[semId]) {
      semesterMap[semId] = {
        semId: semId,
        termId: semId, // for compatibility
        title: semesterTitle(semId),
        courses: []
      };
    }
    // Set subTerm label on entry (e.g. 'Term I' or 'Term II')
    courseEntry.subTerm = termSubLabel(termId);
    courseEntry.rawTermId = termId;

    // Avoid duplicates within same semester
    if (!semesterMap[semId].courses.some(x => x.id === courseEntry.id && x.status === courseEntry.status)) {
      semesterMap[semId].courses.push(courseEntry);
    }
  }

  // Completed courses — show ALL passed courses (including non-major)
  allTranscriptCourses.filter(c => c.passed).forEach(c => {
    const id = normalizeCode(c.code);
    const t = c.term || 'TRANSFER';
    const actualCr = (c.earnedCredits !== undefined && c.earnedCredits !== null) ? c.earnedCredits : (getCourse(id)?.credits || 3);
    addToSemester(t, {
      id,
      termId: t,
      status: 'completed',
      grade: c.grade,
      course: getCourse(id)
        ? { ...getCourse(id), credits: actualCr }
        : { code: c.displayCode || c.code, name: c.description || id, credits: actualCr },
      reason: getCourse(id)?.planningNote || 'Completed course towards degree requirements.'
    });
  });

  // Failed courses — show in the semester they were failed, ONLY if not since passed or in-progress retake
  allTranscriptCourses.filter(c => c.failed).forEach(c => {
    const id = normalizeCode(c.code);
    const t = c.term || 'Unknown';
    addToSemester(t, {
      id,
      termId: t,
      status: 'failed',
      grade: c.grade,
      course: getCourse(id) || { code: c.displayCode || c.code, name: c.description || id, credits: 0 },
      reason: completed[id]
        ? 'Grade of F received. Course was later retaken and passed.'
        : (inProgress[id]
            ? 'Grade of F received. Currently retaking this course.'
            : 'Grade of F received. Must be retaken to earn credit and fulfill degree requirements.')
    });
  });

  // In-progress courses (currently registered from transcript)
  Object.entries(inProgress).forEach(([id, termId]) => {
    const tInfo = allTranscriptCourses.find(c => normalizeCode(c.code) === id && c.isRegistered);
    const actualCr = (tInfo?.attemptCredits !== undefined && tInfo?.attemptCredits !== null)
      ? tInfo.attemptCredits
      : (tInfo?.credits !== undefined ? tInfo.credits : (getCourse(id)?.credits || 3));
    const courseData = getCourse(id)
      ? { ...getCourse(id), credits: actualCr }
      : {
          code: tInfo?.displayCode || id,
          name: tInfo?.description || id,
          credits: actualCr
        };

    addToSemester(termId, {
      id,
      termId,
      status: 'inProgress',
      course: courseData,
      reason: getCourse(id)?.planningNote || 'Currently enrolled course in the active semester. Will count toward degree requirements upon successful completion.'
    });
  });

  // Scheduled future courses
  scheduled.forEach(s => {
    addToSemester(s.termId, {
      id: s.id,
      termId: s.termId,
      status: 'planned',
      reason: s.reason,
      flags: s.flags,
      course: s.course || getCourse(s.id)
    });
  });

  // 7. Calculate stats from official transcript
  let cumGPA = studentInfo?.gpa !== undefined && studentInfo.gpa !== null ? studentInfo.gpa : null;
  let totalEarned = studentInfo?.totalEarned || 0;
  let totalAttempted = studentInfo?.totalAttempted || 0;

  if (totalEarned === 0) {
    // Calculate from passed transcript courses directly
    allTranscriptCourses.forEach(c => {
      if (c.passed) {
        totalEarned += (c.earnedCredits !== undefined ? c.earnedCredits : 0);
        totalAttempted += (c.attemptCredits !== undefined ? c.attemptCredits : 0);
      } else if (c.failed) {
        totalAttempted += (c.attemptCredits !== undefined ? c.attemptCredits : 0);
      }
    });
  }

  const majorCreditsCompleted = requiredIds
    .filter(id => completed[id])
    .reduce((sum, id) => sum + (getCourse(id)?.credits || 3), 0);

  const majorCreditsInProgress = requiredIds
    .filter(id => inProgress[id])
    .reduce((sum, id) => sum + (getCourse(id)?.credits || 3), 0);

  // 8. Generate advising concerns
  const concerns = [];

  if (cumGPA !== null && parseFloat(cumGPA) < 2.0) {
    concerns.push({
      type: 'error',
      icon: '🚨',
      title: `Cumulative GPA Below Lindenwood Standard (${cumGPA})`,
      detail: `Lindenwood University requires a minimum 2.0 GPA both cumulatively and in major coursework for graduation. Repeating failed courses will replace previous 0.0 quality points and significantly lift your GPA.`
    });
  }

  // Active retakes check
  Object.entries(failed).forEach(([id, attempts]) => {
    if (!completed[id] && !inProgress[id]) {
      const cData = getCourse(id);
      concerns.push({
        type: 'warning',
        icon: '⚠️',
        title: `Retake Required: ${cData?.code || id} — ${cData?.name || ''}`,
        detail: `This course was not passed previously and has been scheduled into your upcoming term plan. Please prioritize this course to keep your prerequisites unblocked.`
      });
    }
  });

  let graduationTerm = null;
  const capEntry = scheduled.find(s => s.id === 'ICS48900');
  if (capEntry) graduationTerm = termToSemesterId(capEntry.termId);
  else if (inProgress['ICS48900']) graduationTerm = termToSemesterId(currentTermId);

  // Ensure future regular semesters (Fall & Spring) exist up through graduation + 1 year
  // so advisors have available drop zones to customize their schedule within the 15-credit limit
  const curSemId = termToSemesterId(currentTermId);
  const startYr = termYear(currentTermId) || 2026;
  const gradYr = graduationTerm ? termYear(graduationTerm) : startYr + 2;
  const maxYr = Math.max(gradYr + 1, startYr + 3);

  for (let y = startYr; y <= maxYr; y++) {
    ['SPRING', 'FALL'].forEach(season => {
      const sId = `${season}_${y}`;
      if (semesterSortOrder(sId) >= semesterSortOrder(curSemId)) {
        if (!semesterMap[sId]) {
          semesterMap[sId] = {
            semId: sId,
            title: semesterTitle(sId),
            courses: []
          };
        }
      }
    });
  }

  // Sort semesters chronologically
  const semesters = Object.values(semesterMap).sort((a,b) => {
    return semesterSortOrder(a.semId) - semesterSortOrder(b.semId);
  });

  return {
    studentName: studentName || studentInfo?.name || 'Dummy Student',
    studentId: studentId || studentInfo?.id || 'A000030323244',
    catalogYear,
    catalog,
    currentTermId,
    semesters,
    geStatus,
    concerns,
    stats: {
      cumGPA,
      totalEarned,
      totalAttempted,
      majorCreditsRequired: catalog.majorCredits,
      majorCreditsCompleted,
      majorCreditsInProgress,
      majorCreditsRemaining: Math.max(0, catalog.majorCredits - majorCreditsCompleted - majorCreditsInProgress),
      graduationTerm,
      completedCount: Object.keys(completed).filter(id => requiredIds.includes(id)).length,
      totalRequired: requiredIds.length
    },
    completed,
    inProgress,
    scheduled,
    failed,
    geCompleted,
    requiredIds
  };
}

// ── CUSTOMIZATION & DRAG-AND-DROP HELPERS ──────────────────
// Validates whether courseId can be moved from sourceSemId into targetSemId
function validateCourseMove(plan, courseId, targetSemId, sourceSemId) {
  if (targetSemId === sourceSemId) {
    return { ok: false, reason: 'Course is already in this semester.' };
  }

  // Disallow moving into past completed terms or transfer box
  const curSemId = termToSemesterId(plan.currentTermId);
  if (targetSemId === 'TRANSFER' || semesterSortOrder(targetSemId) < semesterSortOrder(curSemId)) {
    return { ok: false, reason: 'Cannot move courses into past completed semesters.' };
  }

  // 1. Offering Constraint (Fall vs Spring vs Summer)
  if (!isCourseOfferedInSemester(courseId, targetSemId)) {
    const course = getCourse(courseId);
    const offeredDesc = getCourseOfferedDescription(courseId);
    const targetTitle = semesterTitle(targetSemId);
    return {
      ok: false,
      reason: `Offering Constraint: ${course?.code || courseId} is NOT offered in ${targetTitle}. It is offered in: ${offeredDesc}.`
    };
  }

  // 2. Maximum 15 Credit Hours per Semester Constraint
  const targetSem = plan.semesters.find(s => s.semId === targetSemId);
  const currentTargetCredits = (targetSem?.courses || []).reduce((sum, c) => {
    return sum + (c.course?.credits || getCourse(c.id)?.credits || 3);
  }, 0);
  const courseCredits = getCourse(courseId)?.credits || 3;

  if (currentTargetCredits + courseCredits > 15) {
    return {
      ok: false,
      reason: `Credit Limit Exceeded: Maximum 15 credit hours allowed per semester. ${semesterTitle(targetSemId)} currently has ${currentTargetCredits} credits (+${courseCredits} = ${currentTargetCredits + courseCredits} credits).`
    };
  }

  // 3. Prerequisite check (Upstream): Course CANNOT be moved to a semester if its prerequisite has not been completed in an earlier or the same semester
  const courseObj = getCourse(courseId);
  const prereqs = courseObj?.prereqs || [];
  const targetOrder = semesterSortOrder(targetSemId);

  for (const pid of prereqs) {
    if (pid === 'LAST_TERM') continue;
    const pCourse = getCourse(pid) || { code: pid };

    // Passed in previous semester or transfer credit?
    if (plan.completed && plan.completed[pid]) {
      const cDone = plan.completed[pid];
      const doneSem = cDone.termId === 'TRANSFER' ? 'TRANSFER' : termToSemesterId(cDone.termId);
      if (doneSem === 'TRANSFER' || semesterSortOrder(doneSem) <= targetOrder) {
        continue; // Satisfied
      }
    }

    // Currently in-progress this term?
    if (plan.inProgress && plan.inProgress[pid]) {
      if (semesterSortOrder(curSemId) <= targetOrder) {
        continue; // Satisfied (concurrent or earlier)
      }
    }

    // Scheduled in degree plan?
    const semWherePrereq = plan.semesters.find(s => (s.courses || []).some(c => c.id === pid));
    if (semWherePrereq) {
      const prereqOrder = semesterSortOrder(semWherePrereq.semId);
      // Prerequisite must NEVER be placed after the course that requires it
      if (prereqOrder > targetOrder) {
        return {
          ok: false,
          reason: `Prerequisite Violation: ${courseObj?.code || courseId} requires ${pCourse.code}, which is scheduled in ${semWherePrereq.title || semesterTitle(semWherePrereq.semId)}. A prerequisite must be in an earlier semester or the same semester.`
        };
      }
      // If prereqOrder <= targetOrder: satisfied (earlier or concurrent in same semester)
      continue;
    }

    // Prerequisite missing completely
    return {
      ok: false,
      reason: `Prerequisite Violation: ${courseObj?.code || courseId} requires ${pCourse.code}, which is not yet completed or scheduled.`
    };
  }

  // 4. Prerequisite check (Downstream): A prerequisite must NEVER be placed after the course that requires it
  for (const sem of plan.semesters) {
    if (!sem.courses) continue;
    const semOrder = semesterSortOrder(sem.semId);
    for (const entry of sem.courses) {
      if (entry.id === courseId) continue;
      const downCourse = getCourse(entry.id);
      if (downCourse && downCourse.prereqs && downCourse.prereqs.includes(courseId)) {
        // downCourse requires courseId!
        // If moving courseId to targetSemId places it AFTER downCourse (targetOrder > semOrder), reject!
        if (targetOrder > semOrder) {
          return {
            ok: false,
            reason: `Prerequisite Violation: Cannot move ${courseObj?.code || courseId} to ${semesterTitle(targetSemId)} because ${downCourse.code} is scheduled in ${sem.title || semesterTitle(sem.semId)} and requires it as a prerequisite. A prerequisite must never be placed after the course that requires it.`
          };
        }
      }
    }
  }

  // 5. Capstone Constraint: ICS 48900 must be in the final graduating semester
  if (courseId === 'ICS48900') {
    const laterCourse = plan.semesters.find(s => semesterSortOrder(s.semId) > targetOrder && (s.courses || []).some(c => c.id !== 'ICS48900' && (c.status === 'planned' || c.status === 'failed')));
    if (laterCourse) {
      return {
        ok: false,
        reason: `Prerequisite Violation: ICS 48900 Cybersecurity Capstone must be taken in your final graduating semester (${semesterTitle(laterCourse.semId)} still has remaining major coursework scheduled).`
      };
    }
  } else {
    // If moving another course past Capstone:
    const capSem = plan.semesters.find(s => (s.courses || []).some(c => c.id === 'ICS48900'));
    if (capSem && targetOrder > semesterSortOrder(capSem.semId)) {
      return {
        ok: false,
        reason: `Prerequisite Violation: Cannot move ${courseObj?.code || courseId} after ICS 48900 Cybersecurity Capstone. All major coursework must be completed prior to or concurrently with Capstone.`
      };
    }
  }

  return { ok: true, warning: null };
}

// Move course in degree plan and recalculate graduation term
function moveCourseInDegreePlan(plan, courseId, targetSemId, sourceSemId) {
  const sourceSem = plan.semesters.find(s => s.semId === sourceSemId);
  const targetSem = plan.semesters.find(s => s.semId === targetSemId);

  if (!sourceSem || !targetSem) return false;

  const idx = sourceSem.courses.findIndex(c => c.id === courseId);
  if (idx === -1) return false;

  const [entry] = sourceSem.courses.splice(idx, 1);

  // Determine appropriate subTerm and termId for target semester
  const subTerm = getCourseSubTermForSemester(courseId, targetSemId);
  const parts = targetSemId.split('_');
  const season = parts[0];
  const yr = parts[1];

  let termCode = 'F1';
  if (season === 'FALL') termCode = subTerm === 'Term II' ? 'F2' : 'F1';
  else if (season === 'SPRING') termCode = subTerm === 'Term II' ? 'SP2' : 'SP1';
  else if (season === 'SUMMER') termCode = 'SU';

  entry.subTerm = subTerm;
  entry.termId = `${termCode}_${yr}`;

  targetSem.courses.push(entry);

  // Update plan.scheduled
  const sch = (plan.scheduled || []).find(s => s.id === courseId);
  if (sch) {
    sch.termId = entry.termId;
    sch.subTerm = subTerm;
  }

  // Recalculate graduation term (semester with ICS 48900 or last semester with courses)
  const capSem = plan.semesters.find(s => (s.courses || []).some(c => c.id === 'ICS48900'));
  if (capSem) {
    plan.stats.graduationTerm = capSem.semId;
  } else {
    const activeSems = plan.semesters.filter(s => s.semId !== 'TRANSFER' && s.courses && s.courses.length > 0);
    if (activeSems.length > 0) {
      plan.stats.graduationTerm = activeSems[activeSems.length - 1].semId;
    }
  }

  return true;
}
