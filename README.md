# 🦁 Lindenwood University — Cybersecurity Degree Advisor & PPG Generator

An interactive, client-side web application designed specifically for **Lindenwood University BS in Cybersecurity** advising.

Students and faculty advisors can upload an unofficial transcript (or enter courses manually), specify the catalog year, and immediately receive:
1. **Interactive Degree Map**: Color-coded semester boxes with every remaining course scheduled optimally.
2. **Conversational Advisor ("Leo the Lion")**: Explains in plain English why each course is placed in its specific semester, prerequisite bottlenecks, GPA standing, and rare term offerings (e.g. Fall I-only or Spring I-only courses).
3. **Interactive "Ask Leo" Q&A Assistant**: Instant answers to common advising questions based on official Lindenwood policies.
4. **"I'm Convinced!" Official Excel Download**: Populates the **exact official Lindenwood University Program Planning Guide (PPG)** Excel template for the selected catalog year (23-24, 24-25, 25-26, or 26-27).

---

## 🚀 How to Host on GitHub Pages (Free, 2 Minutes)

1. **Create a new GitHub repository** (e.g., `lu-cyber-advisor`).
2. **Upload/push the contents** of the `lu-cyber-advisor/` folder to the root of the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of LU Cybersecurity Advisor"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/lu-cyber-advisor.git
   git push -u origin main
   ```
3. In your GitHub repository settings:
   - Go to **Settings** → **Pages** (under Code and automation).
   - Under **Build and deployment**, set **Source** to `Deploy from a branch`.
   - Select the `main` branch and `/ (root)` folder, then click **Save**.
4. In ~60 seconds, your site will be live at:
   `https://YOUR_USERNAME.github.io/lu-cyber-advisor/`

---

## 💻 How to Run Locally

You can run this app locally using any static web server:

### Option A: Using Python (Recommended)
```bash
cd lu-cyber-advisor
python -m http.server 8085
```
Then open: [http://localhost:8085](http://localhost:8085)

### Option B: Using VS Code Live Server
Right-click `index.html` in VS Code and select **"Open with Live Server"**.

---

## 🧠 Core Architecture & Features

```
lu-cyber-advisor/
├── index.html           # Main Single Page App shell
├── css/
│   └── style.css        # Lindenwood maroon (#8B1A1A) & gold (#FFD700) design system
├── js/
│   ├── courseData.js    # Complete course catalog, prereqs, 8-week term matrices, descriptions
│   ├── parser.js        # Client-side PDF transcript reader using PDF.js
│   ├── planner.js       # Topological prerequisite & term-constrained scheduling engine
│   ├── excel.js         # Official LU template populator (with styled offline fallback)
│   └── app.js           # Conversational advisor UI controller & interaction logic
└── templates/           # Official Lindenwood University PPG Excel workbooks
    ├── 23-24 Cybersecurity, BS.xlsx
    ├── 24-25 Cybersecurity, BS.xlsx
    ├── 25-26 Cybersecurity, BS.xlsx
    └── 26-27 Cybersecurity, BS.xlsx
```

### 🔒 100% Client-Side Privacy
No student data, names, IDs, or transcript files are ever sent to an external server or cloud backend. All PDF parsing, scheduling algorithms, and Excel generation run entirely in the user's web browser.

---

## 🎓 Lindenwood Cybersecurity Rules Enforced
- **Prerequisite Sequences**: Enforces all dependencies (e.g., `ICS 21300` → `ICS 21400` → `ICS 31000` → `ICS 32700`).
- **Rare Offering Constraints**:
  - `ICS 42100` (Ethical Hacking) is offered **only in Fall Term I** (once per year).
  - `ICS 42300` & `ICS 42400` are offered **only in Fall Term II** (consecutive cohort).
  - `ICS 41500` & `ICS 41200` are offered **only in Spring Term I**.
  - `ICS 41700` is offered **only in Spring Term II**.
- **Capstone Policy**: `ICS 48900 Cybersecurity Capstone` must be taken in the student's final semester concurrent with their last remaining major course.
- **GPA Standard**: Minimum 2.0 cumulative GPA and 2.0 major GPA required for graduation.
- **Double-Dipping**: `MTH 14100 Basic Statistics` satisfies both the General Education Mathematics slot and major prerequisite requirements.

---

*Developed for Lindenwood University College of Science, Technology & Health.*
