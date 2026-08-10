# 🚀 Push to GitHub — Help-studies-fish

Your repo is ready locally. Since the sandbox can't push without your GitHub login, do ONE of these:

### Option 1: Fastest — Download ZIP + Upload via GitHub Web

1. Download `Help-studies-fish.zip` from workspace
2. Go to https://github.com/Mahicouragw/Help-studies-fish
3. Click **Add file → Upload files** → drag all files from `inter-ai-study-buddy/` (index.html, README.md, etc.)
4. Commit directly to `main`

### Option 2: Git on Your Laptop (1 command)

```bash
# Download or git clone from this workspace, then:
git clone https://github.com/Mahicouragw/Help-studies-fish.git
# Copy files from inter-ai-study-buddy into Help-studies-fish/
cp -r inter-ai-study-buddy/* Help-studies-fish/
cd Help-studies-fish
git add .
git commit -m "feat: Inter AI Study Buddy AITutor"
git push
```
> If it asks for password, use a **Personal Access Token** (classic):
> GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic) → scope: `repo` → use token as password.

### Option 3: GitHub CLI (easiest if you have `gh`)

```bash
gh auth login
cd inter-ai-study-buddy
gh repo create Mahicouragw/Help-studies-fish --public --source=. --push
```

### Enable Free Hosting (GitHub Pages)
Repo → Settings → Pages → Source: `Deploy from a branch` → Branch: `main` → /(root) → Save
Live at: https://mahicouragw.github.io/Help-studies-fish/

### OpenRouter Key
1. In app: ⚙️ Settings → AI Provider: `OpenRouter`
2. Paste: `sk-or-v1-...` (your key tested ✅)
3. Model: `openai/gpt-4o-mini` (verified working) or `google/gemini-2.0-flash-001`
4. Save → Test Key → "OpenRouter key is working — Inter AITutor ready!"

### Verify AI
Tested on 2026-08-10:
```
Model: openai/gpt-4o-mini via OpenRouter
Response: "OpenRouter key is working — Inter AITutor ready! Focus on understanding concepts..."
Cost: $0.000026
```

