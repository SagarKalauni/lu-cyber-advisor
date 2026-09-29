// ============================================================
// LINDENWOOD UNIVERSITY — Cybersecurity BS Course Data
// courseData.js  |  All 8-week term codes, prereqs, scheduling info
// ============================================================

// ── 8-WEEK TERM CODES ──────────────────────────────────────
// F1  = Fall Term 1    (Aug–Oct)
// F2  = Fall Term 2    (Oct–Dec)
// SP1 = Spring Term 1  (Jan–Feb)
// SP2 = Spring Term 2  (Mar–Apr)
// SU  = Summer         (May–Jul)

// Linear term sequence used by the planner (index = position in time)
const TERM_SEQUENCE = [
  'F1_2024','F2_2024','SP1_2025','SP2_2025','SU_2025',
  'F1_2025','F2_2025','SP1_2026','SP2_2026','SU_2026',
  'F1_2026','F2_2026','SP1_2027','SP2_2027','SU_2027',
  'F1_2027','F2_2027','SP1_2028','SP2_2028','SU_2028',
  'F1_2028','F2_2028','SP1_2029','SP2_2029','SU_2029',
  'F1_2029','F2_2029','SP1_2030','SP2_2030','SU_2030',
];

function termIndex(termId) { return TERM_SEQUENCE.indexOf(termId); }

function termLabel(termId) {
  if (!termId) return '';
  const [sub, yr] = termId.split('_');
  const map = {
    F1: `Fall ${yr}, Term I (Aug–Oct)`,
    F2: `Fall ${yr}, Term II (Oct–Dec)`,
    SP1: `Spring ${parseInt(yr)+0}, Term I (Jan–Feb)`,
    SP2: `Spring ${parseInt(yr)+0}, Term II (Mar–Apr)`,
    SU: `Summer ${parseInt(yr)+0} (May–Jul)`,
  };
  return map[sub] || termId;
}

function termDisplayShort(termId) {
  if (!termId) return '';
  const [sub, yr] = termId.split('_');
  const map = { F1:`Fall ${yr} I`, F2:`Fall ${yr} II`, SP1:`Spring ${yr} I`, SP2:`Spring ${yr} II`, SU:`Summer ${yr}` };
  return map[sub] || termId;
}

// ── FULL SEMESTER GROUPING HELPERS ─────────────────────────
// Map an 8-week termId (e.g. 'F1_2026', 'F2_2026') to a full semester ID ('FALL_2026')
function termToSemesterId(termId) {
  if (!termId || termId === 'TRANSFER') return 'TRANSFER';
  const parts = termId.split('_');
  if (parts.length === 2) {
    const sub = parts[0];
    const yr = parts[1];
    if (sub.startsWith('F')) return `FALL_${yr}`;
    if (sub.startsWith('SP')) return `SPRING_${yr}`;
    if (sub.startsWith('SU')) return `SUMMER_${yr}`;
  }
  return termId;
}

// Display title for full semester: e.g. "Fall 2026", "Spring 2027"
function semesterTitle(semIdOrTermId) {
  if (!semIdOrTermId || semIdOrTermId === 'TRANSFER') return 'Prior Transfer Credits';
  const semId = termToSemesterId(semIdOrTermId);
  const parts = semId.split('_');
  if (parts.length === 2) {
    const [season, yr] = parts;
    if (season === 'FALL') return `Fall ${yr}`;
    if (season === 'SPRING') return `Spring ${yr}`;
    if (season === 'SUMMER') return `Summer ${yr}`;
  }
  return semIdOrTermId;
}

// Sub-term label inside a semester: e.g. "Term I", "Term II"
function termSubLabel(termId) {
  if (!termId) return '';
  const sub = termSeason(termId);
  if (sub === 'F1' || sub === 'SP1') return 'Term I';
  if (sub === 'F2' || sub === 'SP2') return 'Term II';
  if (sub === 'SU') return 'Summer';
  return '';
}

// Numerical sort order for semesters: Fall 2025 comes before Spring 2026
function semesterSortOrder(semId) {
  if (semId === 'TRANSFER') return -1;
  const parts = (semId || '').split('_');
  if (parts.length === 2) {
    const season = parts[0];
    const yr = parseInt(parts[1]) || 0;
    // Spring of year: yr*10 + 2 (Jan–May)
    // Summer of year: yr*10 + 5 (Jun–Jul)
    // Fall of year: yr*10 + 8 (Aug–Dec)
    if (season === 'SPRING') return yr * 10 + 2;
    if (season === 'SUMMER') return yr * 10 + 5;
    if (season === 'FALL') return yr * 10 + 8;
  }
  return 99999;
}

// Which sub-seasons does a termId have?
function termSeason(termId) { return termId ? termId.split('_')[0] : ''; }
function termYear(termId)   { return termId ? parseInt(termId.split('_')[1]) : 0; }

// Get next term in sequence
function nextTerm(termId) {
  const idx = termIndex(termId);
  return idx >= 0 && idx < TERM_SEQUENCE.length - 1 ? TERM_SEQUENCE[idx + 1] : null;
}

// Is termA before termB?
function termBefore(a, b) { return termIndex(a) < termIndex(b); }
function termAtOrBefore(a, b) { return termIndex(a) <= termIndex(b); }

// Detect current term from today's date
function detectCurrentTerm() {
  const now = new Date();
  const m = now.getMonth() + 1; // 1-12
  const yr = now.getFullYear();
  let sub;
  if (m >= 8 && m <= 9)  sub = 'F1';
  else if (m >= 10 && m <= 12) sub = 'F2';
  else if (m >= 1 && m <= 2)  sub = 'SP1';
  else if (m >= 3 && m <= 4)  sub = 'SP2';
  else sub = 'SU';
  return `${sub}_${yr}`;
}

// ── MAJOR COURSES ──────────────────────────────────────────
// Each entry: code, name, credits, section, prereqs[], offered[], description, importance, planningNote
// NOTE: ICS 41100, ICS 41400, ICS 32600, ICS 32601 are NO LONGER OFFERED.
//       ICS 41500 replaced ICS 41100; ICS 41700 replaced ICS 41400.
const MAJOR_COURSES = {

  // ── CORE ──────────────────────────────────────────────
  ICS21300: {
    code: 'ICS 21300', name: 'Foundations of Information Technology',
    credits: 3, section: 'core',
    prereqs: [],
    offered: ['F1','F2','SP1','SP2','SU'],
    badge: '🔑 Gateway',
    description: 'Introduces fundamental IT concepts: hardware, software, operating systems, networks, and the role of technology in modern organizations. The essential starting point for the entire program.',
    importance: 'GATEWAY COURSE — required before almost every other course in the program. Completing this unlocks ICS 21400, IIT 22000, IIT 21500, IIT 48100, ICS 31000, and more.',
    planningNote: 'Offered every single 8-week term — maximum flexibility. Should always be placed in your very first term because delaying it delays everything else.'
  },

  ICS21400: {
    code: 'ICS 21400', name: 'Foundations of Networking',
    credits: 3, section: 'core',
    prereqs: ['ICS21300'],
    offered: ['F1','F2','SP1','SP2','SU'],
    badge: '🔑 Gateway',
    description: 'Covers networking fundamentals: OSI model, TCP/IP, protocols, subnetting, routing, switching, and network infrastructure design. Essential knowledge for all cybersecurity work.',
    importance: 'Critical prerequisite for ICS 31000 (Foundations of Cybersecurity) and ICS 32700 (Network & Cloud Security). Must be completed early in the program.',
    planningNote: 'Offered every term. Scheduled in the first or second term (right after ICS 21300) because it unlocks core cybersecurity courses.'
  },

  ICS31000: {
    code: 'ICS 31000', name: 'Foundations of Cybersecurity',
    credits: 3, section: 'core',
    prereqs: ['ICS21300','ICS21400'],
    offered: ['F1','F2','SP1','SP2','SU'],
    badge: '⚡ Critical',
    description: 'Introduces the CIA triad (Confidentiality, Integrity, Availability), threat landscapes, vulnerability assessment, security frameworks (NIST, ISO 27001), and foundational security tools.',
    importance: 'Unlocks ICS 32700, IIT 33400, ICS 43200, and ICS 43300. This is the conceptual backbone of the cybersecurity emphasis — essential mid-program milestone.',
    planningNote: 'Offered every term. Scheduled as soon as ICS 21300 and ICS 21400 are both complete. Every semester you wait on this delays the advanced courses by one more semester.'
  },

  IIT21500: {
    code: 'IIT 21500', name: 'Programming Logic and Design',
    credits: 3, section: 'core',
    prereqs: ['ICS21300'],
    mathReq: true,
    offered: ['F2','SP1','SU'],
    badge: '📅 3x/year',
    description: 'Covers programming logic, flowcharts, pseudocode, algorithmic thinking, and introductory coding concepts across multiple languages. Focuses on logical problem-solving for technology professionals.',
    importance: 'Required prerequisite for IIT 35100, IIT 33500, ICS 43200, and ICS 43300. Also requires MTH 11000 or passing the math placement test.',
    planningNote: 'Offered only 3 times per year (Fall II, Spring I, Summer). Also requires MTH 11000 or math placement — plan around this. Missing an offering means a 4-month wait for the next one.'
  },

  IIT22000: {
    code: 'IIT 22000', name: 'Hardware and Operating Systems',
    credits: 3, section: 'core',
    prereqs: ['ICS21300'],
    offered: ['F1','F2','SP1','SP2'],
    badge: '⚡ Critical',
    description: 'Covers computer hardware components (CPU, RAM, storage), operating system architecture (Windows and Linux), virtualization fundamentals, and system administration basics.',
    importance: 'Prerequisite for ICS 32700 (Network Security), ICS 41500 (Cloud Computing), ICS 41200 (Linux Server), and ICS 41700 (Hybrid Cloud). A failure here cascades into multiple delays.',
    planningNote: 'Offered 4 times per year (all except Summer). Schedule this as soon as possible after ICS 21300. Failing this course delays at least 4 other courses, potentially adding a full year to your graduation timeline.'
  },

  IIT33500: {
    code: 'IIT 33500', name: 'Blockchain Technology for Business',
    credits: 3, section: 'core',
    prereqs: ['IIT21500'],
    offered: ['F1','SP1','SU'],
    badge: '📅 3x/year',
    description: 'Explores blockchain architecture, distributed ledger technology, consensus mechanisms, smart contracts, cryptocurrency systems, and blockchain applications in security and business.',
    importance: 'Required core course. Offered 3 times per year (Fall I, Spring I, Summer). Prerequisite: IIT 21500.',
    planningNote: 'Offered Fall I, Spring I, and Summer. Schedule in the first available of those terms after completing IIT 21500.'
  },

  IIT35100: {
    code: 'IIT 35100', name: 'Database Analysis and Design Concepts',
    credits: 3, section: 'core',
    prereqs: ['IIT21500'],
    offered: ['F2','SP2'],
    badge: '⚠️ Twice/year',
    description: 'Covers relational database design, entity-relationship modeling, normalization, SQL queries, and database management systems. Critical for understanding data security and storage vulnerabilities.',
    importance: 'Offered ONLY TWICE per year — Fall II and Spring II. Missing an offering means waiting 6 months for the next chance.',
    planningNote: '⚠️ CRITICAL SCHEDULING — Only offered in Fall Term II and Spring Term II. This is one of the most time-sensitive courses in the program. Plan around it carefully — missing an offering is a 6-month setback.'
  },

  IIT48100: {
    code: 'IIT 48100', name: 'Project Management in Information Technology',
    credits: 3, section: 'core',
    prereqs: ['ICS21300'],
    offered: ['F2','SP1','SU'],
    badge: '📅 3x/year',
    description: 'Covers IT project management methodologies (Agile, Scrum, Waterfall), project lifecycle, risk management, budgeting, and stakeholder communication in technology environments.',
    importance: 'Core requirement with minimal prerequisites (only ICS 21300). Can be scheduled flexibly mid-program.',
    planningNote: 'Offered Fall II, Spring I, and Summer. Since it only requires ICS 21300, it can be taken at many points in the program. Often scheduled in a term where there is room alongside other courses.'
  },

  // ── CYBERSECURITY EMPHASIS ──────────────────────────────
  ICS32700: {
    code: 'ICS 32700', name: 'Network and Cloud Security',
    credits: 3, section: 'emphasis',
    prereqs: ['ICS21400','ICS31000','IIT22000','MTH14100'],
    offered: ['F2','SP2'],
    badge: '⚠️ Twice/year + 4 Prereqs',
    description: 'In-depth study of securing networks and cloud environments. Topics include firewall configuration, intrusion detection/prevention systems (IDS/IPS), VPN technologies, cloud security architecture, and continuous security monitoring.',
    importance: 'CRITICAL HUB COURSE — prerequisite for ICS 32800, ICS 42100, and ICS 43300. Requires 4 prerequisites including MTH 14100. This course gates the majority of advanced cybersecurity coursework.',
    planningNote: '⚠️ OFFERED ONLY TWICE/YEAR — Fall II and Spring II. Requires four prerequisites (ICS 21400, ICS 31000, IIT 22000, MTH 14100). All must be completed before this course. Plan all four prerequisites early so you can hit the earliest possible offering of this course.'
  },

  ICS32800: {
    code: 'ICS 32800', name: 'Digital Forensics and Cyber Investigation',
    credits: 3, section: 'emphasis',
    prereqs: ['ICS32700'],
    offered: ['SP1','SU'],
    badge: '📅 Twice/year',
    description: 'Teaches techniques for collecting, preserving, and analyzing digital evidence. Covers forensic tools (Autopsy, FTK), chain of custody procedures, incident response, network forensics, and legal considerations for cyber investigations.',
    importance: 'Core cybersecurity emphasis requirement. Offered in Spring I and Summer only.',
    planningNote: 'Offered Spring I and Summer. Schedule in the first SP1 or SU after completing ICS 32700.'
  },

  // ICS 41500 — replaces the old ICS 41100 (Microsoft Windows Server) for ALL catalogs
  ICS41500: {
    code: 'ICS 41500', name: 'Cloud Computing Essentials and Best Practices',
    credits: 3, section: 'emphasis',
    prereqs: ['ICS21300','IIT22000','MTH14100'],
    offered: ['SP1'],
    badge: '🚨 Spring I ONLY',
    description: 'Covers cloud computing fundamentals including service models (IaaS, PaaS, SaaS), deployment models, major cloud providers (AWS, Azure, GCP), cloud security principles, cost optimization, and deployment best practices.',
    importance: 'Required prerequisite for ICS 41700 (Hybrid Cloud Architecture). Offered ONCE per year — Spring Term I only. Replaces the old ICS 41100 Microsoft Windows Server course.',
    planningNote: '🚨 OFFERED ONLY IN SPRING TERM I — ONCE PER YEAR. This is one of the most scheduling-critical courses in the program. Missing it means waiting a full 12 months. Requires IIT 22000 — make sure that is done beforehand.'
  },

  ICS41200: {
    code: 'ICS 41200', name: 'Linux Server Installation & Configuration',
    credits: 3, section: 'emphasis',
    prereqs: ['ICS21300','IIT22000','MTH14100'],
    offered: ['SP1'],
    badge: '🚨 Spring I ONLY',
    description: 'Hands-on installation, configuration, and administration of Linux servers. Covers bash command line, user and permission management, package management, network configuration, web server setup, and Linux security hardening.',
    importance: 'Fundamental cybersecurity skill set. Offered ONCE per year — Spring Term I only.',
    planningNote: '🚨 OFFERED ONLY IN SPRING TERM I — ONCE PER YEAR. Same semester as ICS 41500. Both ICS 41500 and ICS 41200 can (and should) be taken in the same Spring I term — they share the same prerequisites.'
  },

  // ICS 41700 — replaces the old ICS 41400 (Microsoft Server Identity) for ALL catalogs
  ICS41700: {
    code: 'ICS 41700', name: 'Hybrid Cloud Architecture and Management',
    credits: 3, section: 'emphasis',
    prereqs: ['ICS41500'],
    offered: ['SP2'],
    badge: '🚨 Spring II ONLY',
    description: 'Advanced cloud topics covering hybrid and multi-cloud architectures, cloud migration strategies, enterprise cloud governance, and managing workloads across on-premises and cloud environments. Replaces the old ICS 41400 Microsoft Server Identity course.',
    importance: 'Must follow ICS 41500. Offered ONCE per year — Spring Term II only. Must be taken in the same spring semester as ICS 41500 (SP1 then SP2).',
    planningNote: '🚨 OFFERED ONLY IN SPRING TERM II — ONCE PER YEAR. This must immediately follow ICS 41500 in the same spring. ICS 41500 → ICS 41700 must happen in consecutive Spring I/II terms or you wait an entire year.'
  },

  IIT33400: {
    code: 'IIT 33400', name: 'Ethical Issues in Cybersecurity',
    credits: 3, section: 'emphasis',
    prereqs: ['ICS31000','MTH14100'],
    offered: ['F1','SP2'],
    badge: '📅 Twice/year',
    description: 'Examines ethical, legal, and professional responsibilities in cybersecurity. Topics include privacy law, surveillance ethics, responsible disclosure, intellectual property, professional codes of conduct, and moral frameworks for security decisions.',
    importance: 'Required for the cybersecurity emphasis. Offered twice per year — Fall I and Spring II.',
    planningNote: 'Offered Fall I and Spring II. Can be scheduled after ICS 31000 and MTH 14100 are both complete. Often fits well in semesters where other major courses are being taken.'
  },

  ICS43200: {
    code: 'ICS 43200', name: 'Secure Software Development',
    credits: 3, section: 'emphasis',
    prereqs: ['ICS31000','MTH14100','IIT21500'],
    offered: ['SP1','SU'],
    badge: '📅 Twice/year',
    description: 'Covers security-by-design principles, secure coding practices, OWASP Top 10 vulnerabilities, static and dynamic code analysis, software security testing methodologies, and integrating security into the software development lifecycle (SDLC).',
    importance: 'Requires three prerequisites: ICS 31000, MTH 14100, and IIT 21500. Offered Spring I and Summer.',
    planningNote: 'Offered Spring I and Summer. All three prerequisites must be complete. Schedule in the first available SP1 or SU after meeting all prereqs.'
  },

  ICS43300: {
    code: 'ICS 43300', name: 'Web Based Application Security',
    credits: 3, section: 'emphasis',
    prereqs: ['ICS32700','IIT21500'],
    offered: ['F1','SP2'],
    badge: '📅 Twice/year',
    description: 'Focuses on web application security vulnerabilities including SQL injection, cross-site scripting (XSS), cross-site request forgery (CSRF), authentication flaws, and insecure direct object references. Covers OWASP testing frameworks and web application penetration testing.',
    importance: 'Requires both ICS 32700 and IIT 21500. Offered Fall I and Spring II.',
    planningNote: 'Offered Fall I and Spring II. Can be taken once ICS 32700 is complete. Fits well alongside other courses in the same semester.'
  },

  ICS42100: {
    code: 'ICS 42100', name: 'Ethical Hacking',
    credits: 3, section: 'emphasis',
    prereqs: ['ICS32700'],
    offered: ['F1'],
    badge: '🚨 Fall I ONLY',
    description: 'Teaches penetration testing methodology: reconnaissance, scanning, enumeration, exploitation, post-exploitation, and reporting. Uses industry tools including Nmap, Metasploit, Burp Suite, and Kali Linux. Emphasizes legal and ethical boundaries.',
    importance: '🚨 MOST SCHEDULING-CRITICAL COURSE — prerequisite for ICS 42300 and ICS 42400. Offered ONLY in Fall Term I — ONCE PER YEAR. Missing this delays graduation by a full 12 months.',
    planningNote: '🚨 OFFERED ONLY IN FALL TERM I — ONCE PER YEAR. This is the single most time-sensitive course in the program. Missing it pushes graduation back an entire year. Protect this term slot. Requires ICS 32700 to be done beforehand.'
  },

  ICS42300: {
    code: 'ICS 42300', name: 'Advanced Penetration Testing',
    credits: 3, section: 'emphasis',
    prereqs: ['ICS42100'],
    offered: ['F2'],
    badge: '🚨 Fall II ONLY',
    description: 'Advanced penetration testing techniques: web application exploitation, wireless attacks, privilege escalation, lateral movement, evasion techniques, and professional penetration testing report writing. Prepares students for certifications like CEH and OSCP.',
    importance: 'Follows directly from ICS 42100. Offered ONLY in Fall Term II — in the same fall semester as ICS 42100.',
    planningNote: '🚨 OFFERED ONLY IN FALL TERM II — ONCE PER YEAR. Must immediately follow ICS 42100 (Fall I) in the same fall semester. ICS 42100 (F1) → ICS 42300 (F2) must happen in the same fall.'
  },

  ICS42400: {
    code: 'ICS 42400', name: 'Cybersecurity Analysis',
    credits: 3, section: 'emphasis',
    prereqs: ['ICS42100'],
    offered: ['F2'],
    badge: '🚨 Fall II ONLY',
    description: 'Covers security operations center (SOC) operations, SIEM tools (Splunk, QRadar), threat hunting, malware analysis, threat intelligence frameworks (MITRE ATT&CK), and incident response procedures. Prepares students for SOC analyst and threat intelligence roles.',
    importance: 'Follows directly from ICS 42100. Offered ONLY in Fall Term II — same semester as ICS 42300.',
    planningNote: '🚨 OFFERED ONLY IN FALL TERM II — ONCE PER YEAR. Taken in the same term as ICS 42300. Both can be taken simultaneously in Fall II after ICS 42100 in Fall I.'
  },

  ICS48900: {
    code: 'ICS 48900', name: 'Cybersecurity Capstone',
    credits: 3, section: 'emphasis',
    prereqs: ['LAST_TERM'],
    offered: ['F1','SP1'],
    badge: '🎓 FINAL',
    description: 'Comprehensive capstone project integrating all cybersecurity program knowledge. Students design and implement a real-world security solution, conduct a security assessment, present findings professionally, and demonstrate mastery of program competencies.',
    importance: 'MUST BE YOUR LAST OR CONCURRENT-WITH-LAST COURSE. Cannot be taken until all other ICS and IIT courses are complete (or concurrent with the last one).',
    planningNote: 'Offered Fall I and Spring I. Must be taken in your final semester — concurrent with your very last remaining ICS/IIT course. This signals program completion to the university.'
  }
};

// ── GE REQUIREMENTS ────────────────────────────────────────
const GE_SLOTS = [
  { id:'ge_comp1',  label:'ENGL 15000 Composition I',          code:'ENGL15000', credits:3, category:'Required Core',
    matchCodes:['ENGL15000'], note:'First required writing course — academic writing fundamentals.' },
  { id:'ge_comp2',  label:'ENGL 17000 Composition II',         code:'ENGL17000', credits:3, category:'Required Core',
    matchCodes:['ENGL17000'], note:'Advanced writing. Requires Composition I first.' },
  { id:'ge_stats',  label:'MTH 14100 Basic Statistics*',       code:'MTH14100',  credits:3, category:'Required Core',
    matchCodes:['MTH14100'], majorReq:true, doubleCountAs:'ge_math',
    note:'Also satisfies the Math GE slot AND is a prerequisite for many major courses. Take EARLY!' },
  { id:'ge_ushist', label:'U.S. History/Government',            credits:3, category:'Required Core',
    matchCodes:['HIST11100','HIST11200','HIST11300','POLS10000','POLS11000'],
    matchPatterns:[/GOVT.*POLI/i, /AP.*GOVT/i, /AP.*GOV/i, /USHisGov/i, /ushisgov/i],
    note:'Satisfied by AP Government exam credit or any US History/Government course (GE-HC:USHisGov).' },
  { id:'ge_socsci', label:'Social Science',                     credits:3, category:'Natural/Social Science & Math',
    matchPatterns:[/GE-SocSci/i],
    note:'Psychology, Sociology, Criminology, Economics, Anthropology, or similar. Must have GE-SocSci designation.' },
  { id:'ge_natsci', label:'Natural Science w/ Lab',             credits:3, category:'Natural/Social Science & Math',
    matchPatterns:[/GE-NatSci.*Lab/i, /GE-NatSci:.*Lab/i],
    note:'Biology, Chemistry, Physics, Environmental Science with a lab component.' },
  { id:'ge_socnat', label:'Social or Natural Science Elective', credits:3, category:'Natural/Social Science & Math',
    matchPatterns:[/GE-NatSci/i, /GE-SocSci/i],
    note:'An additional social or natural science course.' },
  { id:'ge_math',   label:'Math* (must be MTH course)',         credits:3, category:'Natural/Social Science & Math',
    matchPatterns:[/GE-Math/i, /MTH\d+/i],
    note:'For Cybersecurity: MTH 14100 already satisfies this — it double-dips from Required Core.' },
  { id:'ge_art',    label:'Art',                                credits:3, category:'Human Cultures',
    matchPatterns:[/GE-HC:Art/i, /GE-Art/i],
    note:'Art, Music, Theatre, Dance, or other fine arts course with GE-HC:Art designation.' },
  { id:'ge_lit',    label:'Literature',                         credits:3, category:'Human Cultures',
    matchPatterns:[/GE-HC:Lit/i, /GE-Lit/i],
    note:'Literature course (not Composition). Often ENGL 200-level literature courses.' },
  { id:'ge_hcelect',label:'Elective in Human Cultures',         credits:3, category:'Human Cultures',
    matchPatterns:[/GE-HC/i],
    note:'History, religion, philosophy, international studies, or other Human Cultures course.' },
  { id:'ge_nonlit', label:'Non-Lit, Non-Arts HC Elective',      credits:3, category:'Human Cultures',
    matchPatterns:[/HIST\d+/i, /RELS\d+/i, /PHIL\d+/i, /RELI\d+/i],
    note:'History, religion, or philosophy course (not art or literature).' },
  { id:'ge_div1',   label:'Human Diversity Elective 1',         credits:0, category:'Human Diversity',
    note:'Can double-count from another GE category. Must have ILO 2.5 / HD designation on transcript.' },
  { id:'ge_div2',   label:'Human Diversity Elective 2',         credits:0, category:'Human Diversity',
    note:'Can double-count from another GE category. Must have ILO 2.5 / HD designation on transcript.' },
  { id:'ge_elec1',  label:'Free Elective 1',                    credits:3, category:'Electives',
    note:'Any college-level course (numbered 10000–49999). Great spot for certifications prep courses or minors.' },
  { id:'ge_elec2',  label:'Free Elective 2',                    credits:3, category:'Electives',
    note:'Any college-level course (numbered 10000–49999).' },
];

// ── CATALOG YEAR CONFIGURATIONS ─────────────────────────────
// NOTE: ICS 41100 and ICS 41400 are NO LONGER OFFERED.
//       ALL catalogs now use ICS 41500 and ICS 41700 as replacements.
const CATALOGS = {
  '23-24': {
    label: '2023–2024',
    majorCredits: 60,
    coreIds:     ['ICS21300','ICS21400','ICS31000','IIT21500','IIT22000','IIT33500','IIT35100','IIT48100'],
    emphasisIds:  ['ICS41500','ICS41200','ICS41700','IIT33400','ICS43200','ICS32700','ICS43300','ICS32800','ICS42100','ICS42300','ICS42400','ICS48900'],
    note: 'Uses current courses ICS 41500 and ICS 41700 (ICS 41100 and ICS 41400 are no longer offered).'
  },
  '24-25': {
    label: '2024–2025',
    majorCredits: 60,
    coreIds:     ['ICS21300','ICS21400','ICS31000','IIT21500','IIT22000','IIT33500','IIT35100','IIT48100'],
    emphasisIds:  ['ICS41500','ICS41200','ICS41700','IIT33400','ICS43200','ICS32700','ICS43300','ICS32800','ICS42100','ICS42300','ICS42400','ICS48900'],
    note: 'Uses current courses ICS 41500 and ICS 41700 (ICS 41100 and ICS 41400 are no longer offered).'
  },
  '25-26': {
    label: '2025–2026',
    majorCredits: 60,
    coreIds:     ['ICS21300','ICS21400','ICS31000','IIT21500','IIT22000','IIT33500','IIT35100','IIT48100'],
    emphasisIds:  ['ICS41500','ICS41200','ICS41700','IIT33400','ICS43200','ICS32700','ICS43300','ICS32800','ICS42100','ICS42300','ICS42400','ICS48900'],
    note: 'Current curriculum with ICS 41500 (Cloud Computing) and ICS 41700 (Hybrid Cloud).'
  },
  '26-27': {
    label: '2026–2027',
    majorCredits: 66,
    coreIds:     ['ICS21300','ICS21400','ICS31000','IIT21500','IIT22000','IIT33500','IIT35100','IIT48100'],
    emphasisIds:  ['ICS41500','ICS41200','ICS41700','IIT33400','ICS43200','ICS32700','ICS43300','ICS32800','ICS42100','ICS42300','ICS42400','ICS48900'],
    note: 'Current curriculum structure with updated major credit requirements.'
  }
};

// ── HELPER: get course object by ID ─────────────────────────
function getCourse(id) {
  if (MAJOR_COURSES[id]) return MAJOR_COURSES[id];
  return null;
}

// ── HELPER: get all required course IDs for a catalog year ──
function getCatalogCourseIds(catalogYear) {
  const cat = CATALOGS[catalogYear] || CATALOGS['26-27'];
  return [...cat.coreIds, ...cat.emphasisIds];
}

// ── TRANSCRIPT COURSE CODE NORMALIZATION ────────────────────
// Maps various transcript formats → internal IDs
const CODE_NORMALIZE = {
  'ICS21300':'ICS21300','ICS 21300':'ICS21300',
  'ICS21400':'ICS21400','ICS 21400':'ICS21400',
  'ICS31000':'ICS31000','ICS 31000':'ICS31000',
  'IIT21500':'IIT21500','IIT 21500':'IIT21500',
  'IIT22000':'IIT22000','IIT 22000':'IIT22000',
  'IIT33500':'IIT33500','IIT 33500':'IIT33500',
  'IIT35100':'IIT35100','IIT 35100':'IIT35100',
  'IIT48100':'IIT48100','IIT 48100':'IIT48100',
  'ICS32700':'ICS32700','ICS 32700':'ICS32700',
  'ICS32800':'ICS32800','ICS 32800':'ICS32800',
  'ICS41500':'ICS41500','ICS 41500':'ICS41500',
  // Legacy codes — map them to their current replacements
  'ICS41100':'ICS41500','ICS 41100':'ICS41500',  // No longer offered → replaced by ICS 41500
  'ICS41200':'ICS41200','ICS 41200':'ICS41200',
  'ICS41700':'ICS41700','ICS 41700':'ICS41700',
  'ICS41400':'ICS41700','ICS 41400':'ICS41700',  // No longer offered → replaced by ICS 41700
  'IIT33400':'IIT33400','IIT 33400':'IIT33400',
  'ICS43200':'ICS43200','ICS 43200':'ICS43200',
  'ICS43300':'ICS43300','ICS 43300':'ICS43300',
  'ICS42100':'ICS42100','ICS 42100':'ICS42100',
  'ICS42300':'ICS42300','ICS 42300':'ICS42300',
  'ICS42400':'ICS42400','ICS 42400':'ICS42400',
  'ICS48900':'ICS48900','ICS 48900':'ICS48900',
  'MTH14100':'MTH14100','MTH 14100':'MTH14100',
  'MTH11000':'MTH11000','MTH 11000':'MTH11000',
  'ENGL15000':'ENGL15000','ENGL 15000':'ENGL15000',
  'ENGL17000':'ENGL17000','ENGL 17000':'ENGL17000',
  // Deprecated courses — ICS 32600 and ICS 32601 are no longer required
  'ICS32600':'ICS32600','ICS 32600':'ICS32600',
  'ICS32601':'ICS32601','ICS 32601':'ICS32601',
};

function normalizeCode(raw) {
  const stripped = raw.replace(/\s+/g,'');
  if (CODE_NORMALIZE[raw]) return CODE_NORMALIZE[raw];
  if (CODE_NORMALIZE[stripped]) return CODE_NORMALIZE[stripped];
  return stripped.toUpperCase();
}

// GE slot matching — does a course code/description satisfy a GE slot?
// IMPORTANT: Fill more restrictive slots FIRST to avoid incorrect assignment.
// Order of priority: ge_ushist > ge_comp1/2 > ge_stats > ge_art > ge_lit > ge_socsci > ge_natsci > ge_hcelect > ...
function matchesGESlot(slot, code, description) {
  const desc = (description || '').toLowerCase();
  const c = (code || '').toUpperCase().replace(/\s/g,'');

  // Explicit code matches (highest priority)
  if (slot.matchCodes && slot.matchCodes.some(mc => c === mc.replace(/\s/g,''))) return true;

  // ── HARD SLOT GUARDS ──────────────────────────────────────
  // These prevent wrong slot assignments from broad pattern matching

  // ge_comp1 and ge_comp2: ONLY match their specific course codes
  if (slot.id === 'ge_comp1') {
    return c === 'ENGL15000' || desc.includes('composition i') || (desc.includes('comp i') && !desc.includes('comp ii'));
  }
  if (slot.id === 'ge_comp2') {
    return c === 'ENGL17000' || desc.includes('composition ii') || desc.includes('comp ii');
  }

  // ge_ushist: matches USHisGov GE code or specific history/govt codes
  if (slot.id === 'ge_ushist') {
    if (desc.includes('ushisgov') || desc.includes('us history') || desc.includes('us hist') ||
        desc.includes('ge-hc:ushisgov') || desc.includes('american century') || desc.includes('american military') ||
        c.startsWith('HIST111') || c.startsWith('HIST112') || c.startsWith('HIST113') || c.startsWith('HIST117') ||
        c === 'POLS10000' || c === 'POLS11000' || c === 'PS15500' || c.startsWith('APGOVT') || c.startsWith('AP-GOVT')) return true;
    if (slot.matchPatterns && slot.matchPatterns.some(p => p.test(code) || p.test(description))) return true;
    return false;
  }

  // ge_stats: MTH 14100 or sub MTH 24100
  if (slot.id === 'ge_stats') {
    return (c === 'MTH14100' || c === 'MTH24100' || desc.includes('basic statistics') || desc.includes('statistics'));
  }

  // ge_art: Art, Art History, Music, Theatre, Dance
  if (slot.id === 'ge_art') {
    if (desc.includes('ge-hc:art') || desc.includes('ge-hc:arts') || desc.includes('ge-art')) return true;
    if (c.startsWith('ARTH') || c.startsWith('ART')) return true;
    if ((c.startsWith('MUS') || c.startsWith('THTR') || c.startsWith('DANC')) &&
        (desc.includes('ge-hc') || desc.includes('appreciation') || desc.includes('history'))) return true;
    return false;
  }

  // ge_lit: Literature courses
  if (slot.id === 'ge_lit') {
    if (desc.includes('ge-hc:lit') || desc.includes('ge-lit') || desc.includes('ge-hc:literature') || desc.includes('literature')) return true;
    if (c === 'ENG20101' || c === 'ENGL20100' || c === 'ENGL20101' || c.startsWith('LIT')) return true;
    return false;
  }

  // ge_socsci: Social Science (CCJ, PSY, SOC, ECON, ANTH, POLS)
  if (slot.id === 'ge_socsci') {
    return desc.includes('ge-socsci') || c.startsWith('CCJ') || c.startsWith('PSY') || c.startsWith('SOC') || c.startsWith('ECON') || c.startsWith('ANTH');
  }

  // ge_natsci: Natural Science with Lab
  if (slot.id === 'ge_natsci') {
    if ((desc.includes('ge-natsci') || desc.includes('science')) && desc.includes('lab')) return true;
    if (c.startsWith('BSC') || c.startsWith('BIO') || c.startsWith('CHM') || c.startsWith('PHY') || c.startsWith('ESC') || c.startsWith('ENV')) {
      if (desc.includes('lab') || c.includes('/') || desc.includes('w/lab') || desc.includes('w/ lab')) return true;
    }
    return false;
  }

  // ge_socnat: Second Social or Natural Science
  if (slot.id === 'ge_socnat') {
    return desc.includes('ge-natsci') || desc.includes('ge-socsci') ||
      c.startsWith('BSC') || c.startsWith('BIO') || c.startsWith('CHM') || c.startsWith('PHY') || c.startsWith('ESC') ||
      c.startsWith('CCJ') || c.startsWith('PSY') || c.startsWith('SOC') || c.startsWith('ECON') || c.startsWith('ANTH');
  }

  // ge_math: Math courses (College Algebra, Calc, etc.)
  if (slot.id === 'ge_math') {
    if (desc.includes('ge-math')) return true;
    if (c.startsWith('MTH')) return true;
    return false;
  }

  // ge_hcelect: Any Human Cultures course
  if (slot.id === 'ge_hcelect') {
    return desc.includes('ge-hc') || c.startsWith('HIST') || c.startsWith('ARTH') || c.startsWith('LIT') || c.startsWith('PHIL') || c.startsWith('RELS');
  }

  // ge_nonlit: Non-Lit, Non-Arts HC Elective (History, Philosophy, Religion)
  if (slot.id === 'ge_nonlit') {
    if (c.startsWith('HIST') || c.startsWith('RELS') || c.startsWith('PHIL') || c.startsWith('PHL') || c.startsWith('RELI')) return true;
    if (desc.includes('history') || desc.includes('religion') || desc.includes('philosophy')) return true;
    return false;
  }

  // ge_div1, ge_div2: Human Diversity courses (can double-apply!)
  if (slot.id === 'ge_div1' || slot.id === 'ge_div2') {
    return /hd|\bhd\b|ge-hd|-hd|\/hd|human diversity|ilo\s*2\.5/i.test(desc) ||
           c === 'ARTH22700' || c === 'ENGL20100' || c === 'ENG20101';
  }

  // ge_elec1, ge_elec2: Any GE course
  if (slot.id === 'ge_elec1' || slot.id === 'ge_elec2') {
    return desc.includes('ge-') || c.startsWith('MTH') || c.startsWith('CHM') || c.startsWith('BSC') ||
           c.startsWith('BIO') || c.startsWith('PHY') || c.startsWith('MUS') || c.startsWith('HIST');
  }

  return false;
}
