# 🔍 Deep Vault — Session Memory
*Last updated: May 2026*

---

## 💬 How to Resume

Start a new session and say:

> **"resume Deep Vault"**

Claude will read this file and `CLAUDE.md` first, then pick up exactly where we left off.

---

## ⏸ Where We Left Off (May 2026 Break)

### Last thing completed
`CLAUDE.md` — the session-start best practices file — was finalised with all non-negotiables from every source document audited and consolidated into 11 sections including a Release Gate checklist.

### What is partially done — needs local run to confirm
| Item | What's needed |
|---|---|
| Vitest unit tests (Phase 1) | All files written. **14/14 tests confirmed passing locally.** ✅ |

### Immediate next actions (in order)
1. **Run `npm install && npm run test`** locally — confirm 16 Vitest tests pass green
2. **Create `.github/workflows/test.yml`** — YAML already written in `TESTING.md` Section 3, just needs the file created
3. **Pick up `MyNextSteps.md` at P0-01** — GitHub Release v3.1.2 still needs to be tagged

### Open tech debt to watch
- `TD-03` — no CI wired up yet (`.github/workflows/` doesn't exist)
- `TD-04` — `deploy.bat` vault path is still hardcoded (`E:\Obsidian\MyVault`)
- `TD-05` — `docs/screenshots/` directory doesn't exist yet
- `TD-06` — Vitest config lives in `package.json`; extract to `vitest.config.ts` when it grows

---

## 👤 About the Developer

- **Name:** Sunny Santhosh
- **GitHub:** github.com/sunnys-santhosh
- **OS:** Windows laptop (primary dev) + Linux Desktop (Obsidian installed)
- **Working directory (current):** `c:\sunny\DEV\MyDeepVault`

---

## 🗂 Project Location

| Item | Path |
|---|---|
| Plugin source (current) | `c:\sunny\DEV\MyDeepVault\` |
| Obsidian vault (Windows) | `E:\Obsidian\MyVault\` |
| Plugin deployed to | `E:\Obsidian\MyVault\.obsidian\plugins\deep-vault\` |
| GitHub repo | `github.com/sunnys-santhosh/deep-vault` |

---

## 🌿 Git Branch Structure

```
main          ← stable releases — every commit here must have a GitHub Release tag
  └── dev     ← integration branch
        └── feature/*   ← one branch per feature
```

### Branch Workflow
```
git checkout dev
git checkout -b feature/new-feature
npm run build
npm run test
git add .
git commit -m "feat: description"
git push
git checkout dev
git merge feature/new-feature
git push
git checkout main
git merge dev
git push
```

---

## 📦 Current Version: 4.0.3

### Canonical Build & Deploy Commands (cross-platform)
```
npm install                              # install / update dependencies
npm run dev                              # watch mode
npm run build                            # production build
npm run test                             # unit tests
npm run deploy -- /path/to/vault         # deploy to Obsidian
```

### Windows convenience wrapper
```cmd
deploy.bat    (edit VAULT_DIR inside the file to match your vault path)
```

### Linux/macOS convenience wrapper
```bash
chmod +x build.sh          # first time only
./build.sh                 # build only
./build.sh /path/to/vault  # build + deploy
```

### Reload Obsidian after deploy
`Ctrl+P` → "Reload app without saving"

---

## ✅ Features Built

| Version | Feature | Status |
|---|---|---|
| v1.0 | Basic sidebar, 4 quick actions, Claude API | ✅ Done |
| v2.0 | Tabbed UI, chat history, markdown rendering | ✅ Done |
| v2.3 | Synthesis, export to notes, web search, history | ✅ Done |
| v3.0.1 | Custom prompt templates + editor modal | ✅ Done |
| v3.0.2 | Auto-tag notes with frontmatter writing | ✅ Done |
| v3.0.3 | Vault-wide natural language search | ✅ Done |
| v3.0.4 | Daily research digest (24hr/7d/30d) | ✅ Done |
| v3.1.0 | Setup wizard + 14 keyboard commands | ✅ Done |
| v3.1.1 | Mobile support + touch swipe | ✅ Done |
| v3.1.2 | README polish + PUBLISHING.md guide | ✅ Done |
| v4.0.0 | CI/CD overhaul — Vitest, GitHub Actions, deploy script, src/utils split | ✅ Done |
| v4.0.1 | Fix "Please open a note first" — `getLeavesOfType("markdown")` lookup | ✅ Done |
| v4.0.2 | Fix "Failed to fetch" — `requestUrl()` replaces `fetch()` | ✅ Done |
| v4.0.3 | Fix Daily Digest overlap — removed `flex:1` from `.dv-response-wrap` | ✅ Done |

---

## 🗺 Remaining Roadmap

**Single source of truth for all pending work is `MyNextSteps.md`.**
Summary of top priorities:

| Priority | Item |
|---|---|
| 🔴 P0 | GitHub Release v4.0.3 — push tag `v4.0.3`, release workflow auto-publishes |
| 🔴 P0 | Execute manual regression TC-01 → TC-09 |
| 🔴 P0 | Test on Linux, Mobile, empty vault, no API key |
| 🟠 P1 | Screenshots + demo GIF |
| 🟠 P1 | GitHub Actions CI (`.github/workflows/test.yml`) |
| 🟠 P1 | Submit community-plugins.json PR |
| 🟢 Future | Topic graph, streaks, collaborative templates |

---

## 🔑 Key Technical Details

### API
- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Model (default):** `claude-sonnet-4-20250514`
- **Model (fast):** `claude-haiku-4-5-20251001`
- **Web search header:** `anthropic-beta: web-search-2025-03-05`
- **API key:** stored in Obsidian plugin settings — never in code or git

### Plugin Architecture
- **Language:** TypeScript → compiled to `main.js` via esbuild
- **Framework:** Obsidian Plugin API (ItemView, Modal, SuggestModal)
- **Tabs:** Research · Chat · Synthesis · Templates · Search · More
- **Settings interface:** `DeepVaultSettings` with `hasSeenWizard` flag
- **Mobile detection:** `app.isMobile` + `.dv-mobile` CSS class
- **Touch swipe:** `touchstart` / `touchend` listeners on root element

### Known Issues Fixed
- Multiline placeholder strings cause TS errors — always use single line strings
- Code comments with `- a` on their own line parsed as code by esbuild — keep comments on one line
- `obsidian` package must be installed as devDependency: `npm install --save-dev obsidian`
- `tsconfig.json` must use `"moduleResolution": "node"` not `"bundler"`

---

## 📁 Important Files in Repo

| File | Purpose |
|---|---|
| `CLAUDE.md` | **Read first every session** — auto-loaded best practices, all mandates, Release Gate checklist |
| `src/main.ts` | All plugin code — TypeScript source |
| `src/utils/helpers.ts` | Pure helper functions (slugify, formatDate, formatTime) — no Obsidian imports |
| `styles.css` | All UI styles |
| `manifest.json` | Plugin metadata — version source of truth for Obsidian |
| `package.json` | npm deps, build/test/deploy scripts — version must match manifest.json |
| `esbuild.config.mjs` | Bundler configuration |
| `tsconfig.json` | TypeScript compiler settings |
| `scripts/deploy.js` | Cross-platform deploy — canonical deploy logic (all platforms) |
| `deploy.bat` | Windows convenience wrapper — calls scripts/deploy.js |
| `build.sh` | Linux/macOS convenience wrapper — build + optional deploy |
| `test/helpers.test.ts` | Vitest unit tests for src/utils/helpers.ts (14 test cases) |
| `test/__mocks__/obsidian.ts` | Obsidian API stubs for Vitest |
| `MyDocs.md` | Living developer reference — invariants, gotchas, build pipeline |
| `MyNextSteps.md` | **Master backlog** — P0 blockers, P1–P3 features, tech debt, completed log |
| `NextSteps.md` | Phased testing implementation plan — Vitest → CI → Playwright |
| `build.md` | Internal build architecture, pipeline, and testing tier specs |
| `TESTING.md` | Full QA protocol — Vitest setup, GitHub Actions YAML, regression matrix |
| `TestRun.md` | **Fill this in during testing** — detailed steps, pass/fail, notes for each of the 14 test cases |
| `PUBLISHING.md` | Step-by-step Obsidian community submission guide |
| `README.md` | Public-facing documentation |

---

## 🛠 Session Work Log (May 2026)

| Task | Status |
|---|---|
| Sync `package.json` version `1.0.0` → `3.1.2` | ✅ Done |
| Fix `esbuild.config.mjs` placeholder GitHub URL | ✅ Done |
| Fix `deploy.bat` hardcoded source paths → `%~dp0` | ✅ Done |
| Fix `TESTING.md` broken absolute Linux file path | ✅ Done |
| Add `vitest` + `npm run test` to `package.json` | ✅ Done |
| Add `build.sh` to `README.md` development section | ✅ Done |
| Create `MyDocs.md` — living developer reference | ✅ Done |
| Create `NextSteps.md` — phased testing plan | ✅ Done |
| Create `MyNextSteps.md` — master prioritised backlog | ✅ Done |
| Extract `src/utils/helpers.ts` from `src/main.ts` | ✅ Done |
| Create `test/__mocks__/obsidian.ts` | ✅ Done |
| Create `test/helpers.test.ts` (14 test cases) | ✅ Done |
| Add Vitest alias config to `package.json` | ✅ Done |
| Create `scripts/deploy.js` — cross-platform Node.js deploy | ✅ Done |
| Add `npm run deploy` to `package.json` | ✅ Done |
| Refactor `build.sh` to delegate deploy to `scripts/deploy.js` | ✅ Done |
| Refactor `deploy.bat` to delegate to `scripts/deploy.js` | ✅ Done |
| Create `CLAUDE.md` — session-start best practices + Release Gate | ✅ Done |
| Run `npm install && npm run test` to confirm 14 tests pass | ✅ Done — 14/14 green |

---

*Updated: May 2026 — v3.1.2*
