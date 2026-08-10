# Inter AI Study Buddy — AITutor 🎓

**The Ultimate AI Study Companion for TS/AP Intermediate (Inter 1st & 2nd Year) Students**

Upload any PDF, scan handwritten notes, and let **AITutor (Gemini-powered)** instantly create summaries, important questions, MCQs, flashcards & solve doubts in English / Telugu / Hinglish — exactly as per **BIE Telangana Board blueprint (2M / 4M / 8M)**.

> Built for MPC, BiPC, CEC, MEC, HEC streams. Works offline + online.

---

### ✨ What Students Actually Need — And What This App Does

| Student Need | App Feature |
|---|---|
| **Upload PDF** of textbooks/guides/previous papers | Drag & drop PDF → auto text extraction with `pdf.js` (supports scanned PDFs) |
| **Autoscan** handwritten notes / blackboard with camera | Camera + OCR via `Tesseract.js` (on-device, offline) — 10 sec to text |
| **Save Library** — all chapters in one place | Persistent library (localStorage) with search, subject filter, stream-aware |
| **Quiz Generation** — MCQs, 2M, 4M, 8M, Mixed | One-click generator → JSON → interactive quiz player with scoring & explanations |
| **Flashcards** for last-minute revision | Auto flashcards from any doc, flip animation |
| **AITutor Chat** — doubt solving | Gemini 1.5 Flash / 2.0 / Pro — context-aware (uses your selected PDF as context) |
| **Summaries & Important Questions** | 10-point summary, formulas, definitions, exam must-remember points |
| **Telugu support** | Ask in Telugu/Hinglish, get answers in same language |

---

### 🚀 Live Demo

Just open `index.html` — no build needed. Or run:

```bash
# Option 1: Simple HTTP server
npx serve .
# or
python -m http.server 8000

# Option 2: VS Code Live Server — right click index.html → Open with Live Server
```

App is 100% client-side. Your PDFs & API keys never leave your browser.

---

### 🔑 Connect Your AI — Bring Your Own Key

App works **without any key** in demo mode (heuristic mock). For real AI:

1. Get a free Gemini API key: https://aistudio.google.com/app/apikey
2. Click **⚙️ Settings** (top-right gear)
3. Paste `AIza...` key → Choose `gemini-1.5-flash` (fast & cheap)
4. **Save → Test Key** — you'll see `Gemini key is working — Inter AITutor ready!`

Your key is stored only in `localStorage` (`gemini_key`) — never sent to any server.

> Also supports OpenAI: paste `sk-...` and model will auto-switch.

**Models supported:**
- `gemini-1.5-flash` (recommended)
- `gemini-1.5-pro`
- `gemini-2.0-flash`

---

### 📚 For Telangana Inter Board

- **Streams:** MPC, BiPC, CEC, MEC, HEC
- **Subjects auto-switch:** e.g. MPC → Maths IA/IB/IIA/IIB, Physics, Chemistry, English, Sanskrit
- **Blueprint:** 2M (10×2=20) + 4M (6×4=24) + 8M (2×8=16) = 60 + 40 internals
- **Languages:** English / Telugu + English / Hinglish

Upload BIE Telangana official PDFs and AITutor auto-generates blueprint-accurate questions.

---

### 🗂️ Project Structure

```
inter-ai-study-buddy/
├── index.html          # Full app — Tailwind + pdf.js + Tesseract.js + Gemini
├── README.md
├── .gitignore
├── LICENSE
└── assets/             # (optional) images, sample PDFs
```

No `node_modules`, no build step — deploy anywhere (GitHub Pages, Netlify, Vercel).

---

### 🌐 Create Your GitHub Repository `AITutor`

#### Option A — GitHub Website (Easiest)
1. Go to https://github.com/new
2. **Repository name:** `AITutor` (or `inter-ai-study-buddy`)
3. Description: `Inter AI Study Buddy — AITutor for TS Inter with PDF Upload, AutoScan & Quiz Gen`
4. Choose **Public** → **Create repository**
5. Copy the HTTPS URL: `https://github.com/Mahicouragw/Help-studies-fish.git`

#### Option B — From This Workspace (Terminal)
```bash
cd inter-ai-study-buddy
git init
git add .
git commit -m "feat: Inter AI Study Buddy — AITutor with PDF, Scan, Library, Quiz"
git branch -M main
git remote add origin https://github.com/Mahicouragw/Help-studies-fish.git
git push -u origin main
```

> **Want me to push for you?** Paste your GitHub URL here and I'll set the remote. You just need to give me the link.

#### Enable GitHub Pages (Free Hosting)
- Repo → **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main` / `(root)` → Save
- Your app will be live at `https://YOUR_USERNAME.github.io/AITutor/`

---

### 🔐 API Keys You Can Use

| Provider | Key Prefix | Where to Get |
|---|---|---|
| **Google Gemini** (Recommended) | `AIza...` | https://aistudio.google.com/app/apikey |
| **OpenAI** | `sk-...` | https://platform.openai.com/api-keys |
| **Any OpenAI-compatible** | varies | Paste in same field |

Add in **Settings** → Save. Test with the **Test Key** button.

---

### 🧩 How It Works (Tech)

- **PDF Upload:** `pdf.js` extracts text per page → saves to `localStorage.inter_docs`
- **AutoScan:** `getUserMedia` camera → canvas capture → `Tesseract.js` OCR → editable text → save
- **Library:** `localStorage` persistence, search & filter, no backend
- **Quiz Gen:** Prompt → Gemini JSON → validated → renderer with `answerIndex`, score, review
- **Flashcards:** CSS 3D flip, generated from sentences
- **AITutor Chat:** Context injection (`"""document text"""` + prompt) → Gemini `generateContent`
- **Styling:** Tailwind CDN + custom glassmorphism, fully responsive (mobile → desktop)

---

### 📱 Screenshots (App)

- Dashboard with stream selector, stats, recent docs
- Upload PDF with drag-drop & progress
- AutoScan with camera + OCR
- Library grid with Quiz/Summary/Flashcards/AITutor actions
- Quiz Zone with MCQ & short answer, live scoring
- Flashcards flip
- AITutor Chat (floating + full page + right rail)

---

### 🛣️ Roadmap (Next)

- [ ] Export quizzes to PDF (printable)
- [ ] Voice input for doubts (Telugu speech-to-text)
- [ ] Leaderboard & daily streaks
- [ ] Teacher mode — share library via link
- [ ] Offline PWA install

---

### 🤝 Contributing

PRs welcome! Open an issue for bugs / feature requests.

### 📄 License

MIT — free for students & teachers.

---

**Made with ❤️ in Secunderabad for Inter toppers.**  
Questions? Paste your GitHub URL and your Gemini API key (or ask me to guide you) — I'll wire it up.


---

## 🆕 v2 — Accessibility, TTS, Pomodoro & SQL Auth

### ♿ Accessibility (ARIA)
- All buttons/inputs have `aria-label`, `role="dialog"`, `aria-live` regions
- Skip link, focus-visible outlines, keyboard navigable
- Screen-reader announcements for quiz, TTS, timer

### 🔊 Auto TTS + Translate + Language Detect
- **Web Speech API** TTS engine with voice/speed/pitch controls
- **Translate** via MyMemory API — English ↔ Telugu / Tamil / Hindi
- **Auto-detect**: Unicode range detection (Telugu U+0C00, Tamil U+0B80, Hindi U+0900) — badge shows `English • Auto` etc.
- Read any PDF/OCR text aloud in detected language; translate button shows translated copy + “Read Translated”

### ⏱️ Pomodoro 25/5 with Water-Photo Break Lock
- **25 min Study → 5 min Break** (very important)
- Floating widget (desktop bottom-left, mobile bottom bar) with Start/Pause/Reset
- After 25 min, **full-screen lock** → must drink water & show photo (camera capture) or wait 5 min auto-unlock
- Countdown `05:00` with progress bar; early unlock via photo verification (on-device demo)
- Toggle in **⚙️ Settings → Study Reminder** (enabled by default, can disable)
- Notifications + title bar countdown + break sound

### 🗄️ Own SQL Database (No Supabase)
- **SQLite** at `backend/database.db` — created automatically via `backend/db.js`
- Tables: `users`, `otps`, `sessions`, `documents`, `quiz_attempts`, `study_sessions`
- Check health: `GET /api/health` & `GET /api/admin/users`
- Not Supabase / no external DB — your own file, frustrating? No, simple!

### 🔐 Auth — Email + OTP (Real Email)
- **Signup**: name, email, password, confirm → 409 if email exists → OTP 6-digit (10 min) → verify → JWT
- **Login**: email, password → 404 “Your account is not found” if no user → 401 if wrong pass → 403 if not verified
- **Forgot**: email → 404 if not found → OTP → new password + confirm → reset
- Emails via **Gmail App Password** (one domain) using `nodemailer` — set `GMAIL_USER` & `GMAIL_APP_PASSWORD` in `backend/.env`
- JWT stored in `localStorage` (`inter_token` + `inter_user`), 7-day expiry
- OTPs logged to console in dev mode if Gmail not configured

### 🔍 Google Search Console — Auto
- `GET /sitemap.xml` & `/robots.txt` dynamic (also static files for GH Pages)
- Set `GSC_VERIFICATION_TOKEN` & `DOMAIN` in `backend/.env` → auto meta + verification file
- Sitemap submitted to `https://mahicouragw.github.io/Help-studies-fish/sitemap.xml`

### 🔧 Backend API (Express + SQLite)
- `POST /api/auth/signup`, `/verify-otp`, `/resend-otp`, `/login`, `/forgot-password`, `/reset-password`
- `GET /api/auth/me` (Bearer JWT), `GET /api/health`, `GET /api/admin/users`
- CORS, Helmet, Rate-limit, bcrypt, JWT

**Run backend:**
```bash
cd backend
npm install
cp .env.example .env  # set GMAIL_USER & GMAIL_APP_PASSWORD
npm start  # http://localhost:3001 also serves frontend
```
Frontend auto-detects `API_BASE` (e2b preview, localhost, GH Pages fallback to demo).

