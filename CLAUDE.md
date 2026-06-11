# Deep Vault — Project Instructions

This file is automatically loaded by Claude Code at the start of every session.
Read and apply every rule here before making any change to the project.

---

## 1. Cross-Platform Mandate

**Every script, command, and instruction must work on Windows, Linux, and macOS without modification.**

### Rules

- **Never write platform-specific file operations** (`cp`, `mkdir -p`, `copy /Y`, `xcopy`).
  Use `node scripts/deploy.js` or an equivalent Node.js script instead.
- **Never write shell-specific syntax** in documentation or npm scripts
  (`bash` one-liners with `&&`, `||`, `$VAR`, `%VAR%`, backtick substitution).
- **`npm run <script>` is the canonical command** for every build/test/deploy operation.
  Always document it as the primary form; platform scripts are convenience wrappers only.
- **Platform-specific scripts** (`build.sh`, `deploy.bat`) must delegate their core logic
  to a Node.js script under `scripts/`. They must not re-implement what the Node script already does.
- **When adding a new automation task**, create it as `scripts/<task>.js` first,
  then wire it into `package.json`, then optionally wrap it in `build.sh`/`deploy.bat`.

### Canonical Commands (use these in all documentation)

| Task | Command |
|---|---|
| Install dependencies | `npm install` |
| Development build (watch) | `npm run dev` |
| Production build | `npm run build` |
| Run unit tests | `npm run test` |
| Deploy to Obsidian vault | `npm run deploy -- /path/to/vault` |

---

## 2. Critical Invariants — Check These Before Every Commit

| Invariant | Rule |
|---|---|
| **Version sync** | `package.json` `"version"` must equal `manifest.json` `"version"` — always |
| **No secrets in code** | API keys, tokens, passwords must never appear in any source file or `.env` |
| **No secrets in git history** | Run `git log --all` before any push to a public remote; one leaked key invalidates the release |
| **No `console.log` in production** | Remove all debug statements from `src/` before committing to `main` |
| **No `eval()` or dynamic code execution** | Obsidian security policy — any use of `eval()`, `Function()`, or `new Function()` will cause community submission rejection |
| **No unhandled promise rejections** | Every Anthropic API call must have a `.catch()` or `try/catch` — rate limits, network failures, and context exhaustion must surface as UI notices, not crashes |
| **`main.js` is intentionally tracked** | It is the Obsidian release artifact — do not add it to `.gitignore` |
| **`tsconfig.json` `moduleResolution`** | Must stay `"node"` — changing to `"bundler"` breaks esbuild |
| **`obsidian` is a devDependency** | Never move it to `dependencies` — it is provided by the Obsidian runtime |

---

## 3. Before You Start Coding

1. Read `MyDocs.md` — invariants, build pipeline, known gotchas.
2. Read `MyNextSteps.md` — pick the highest-priority incomplete item (P0 → P1 → Debt).
3. Check out a feature branch: `git checkout -b feature/<short-description>` from `dev`.
4. Confirm `npm run build` passes on the current branch before making changes.
5. If your change involves a new module, check `NextSteps.md` for the planned module structure.

---

## 4. Code Quality Standards

- **No comments that describe what code does** — well-named identifiers do that.
  Only comment WHY: a hidden constraint, a workaround, a non-obvious invariant.
- **No multi-line comment blocks or docstrings.**
- **No error handling for impossible cases** — trust TypeScript types and Obsidian API guarantees.
  Only validate at boundaries: user input fields, API responses.
- **No dead code** — remove unused variables, imports, and functions immediately.
- **No `eval()` or `Function()` constructor** — banned outright; see Section 2.
- **All API calls must handle errors explicitly** — catch rate limits (`429`), context window exhaustion, network failures. Show a `new Notice(...)` to the user. Never let a rejected promise propagate silently.
- **Single-line placeholder strings** — multiline template literals in HTML attributes cause TypeScript parse errors in this project.
- **Single-line comments only** — a comment on its own line starting with `// - text` is parsed as code by esbuild. Write `// text` instead.

---

## 5. File Change Rules

| File changed | Also update |
|---|---|
| `manifest.json` version | `package.json` version (must match) |
| `package.json` version | `manifest.json` version (must match) |
| Any `npm` script | `MyDocs.md` Scripts table + `CLAUDE.md` Canonical Commands table |
| New `scripts/*.js` file | `package.json` scripts + `memory.md` files table |
| New feature shipped | `README.md` Features + `memory.md` Features Built table + `MyNextSteps.md` Completed log + add row to `TESTING.md` regression matrix |
| Any bug fix with non-obvious root cause | `MyDocs.md` Known Gotchas table |
| Any change to build tooling | Run `npm run build` and confirm `main.js` is regenerated without errors |
| Any new `src/` module extracted | `memory.md` files table + `MyDocs.md` Planned Module Split section |
| Any new `src/utils/` pure function | Add test cases to `test/helpers.test.ts` before merging |
| Pre-release | Execute full regression matrix in `TESTING.md` before merging to `main` |

---

## 6. Testing Requirements

- **Never merge to `main` without running `npm run test`** and getting a clean pass.
- **Never merge to `main` without completing the manual regression matrix** in `TESTING.md` (TC-01 → TC-09).
- **New pure functions** (no Obsidian API calls) must have corresponding test cases in `test/helpers.test.ts`.
- **Obsidian-dependent code** goes in `src/main.ts` and is covered by Tier 3 manual testing.
- **Do not mock the Obsidian API inside `src/`** — keep `src/utils/` pure so Vitest can test it without mocks.
- If you add a new helper function to `src/utils/helpers.ts`, add tests for it before the PR is merged.
- **In CI always use `npm ci --legacy-peer-deps`**, not `npm install` — it is deterministic, faster, and fails fast on lockfile drift. `npm install` is for local setup only.
- **Pre-commit linting** (planned): once eslint and prettier are configured, run them before every commit. Do not configure them without also wiring them into the GitHub Actions workflow.

---

## 7. Branch & Merge Rules

```
main     ← stable releases only — tagged, GitHub release published
  └── dev     ← integration — all features merge here first
        └── feature/<name>   ← one branch per feature or fix
```

- **Never commit directly to `main` or `dev`** — always use a feature branch.
- **Never force-push** to `main` or `dev`.
- Feature branch → `dev` merge requires: `npm run build` passing + `npm run test` passing.
- `dev` → `main` merge requires: all of the above + Tier 3 regression matrix signed off.
- **Every merge to `main` must be followed by a GitHub Release** tagged with the exact version in `manifest.json`, with `main.js`, `manifest.json`, and `styles.css` attached as release assets. A `main` commit without a release tag is incomplete.
- Commit message format: `type: short description` where type is `feat`, `fix`, `docs`, `refactor`, `test`, or `chore`.

---

## 8. Adding a New Automation Script

When a new task needs scripting:

1. Create `scripts/<task>.js` using only Node.js built-ins (`fs`, `path`, `child_process`).
2. Make it cross-platform — no bash syntax, no Windows-only APIs.
3. Add a clear `--help` / missing-arg error message.
4. Add it to `package.json` `"scripts"`.
5. Update `MyDocs.md` Canonical Commands table.
6. Update `memory.md` files table.
7. Wrap in `build.sh` / `deploy.bat` only if it's part of the standard build-deploy flow.

---

## 9. Obsidian Plugin-Specific Rules

- **`isDesktopOnly` must stay `false`** — mobile support is a core feature.
- **Touch targets** must remain 44px minimum for mobile usability.
- **Safe-area insets** must be preserved — do not remove `env(safe-area-inset-*)` CSS.
- **The `hasSeenWizard` setting flag** controls first-launch wizard display — do not repurpose it.
- **Web search** uses the beta header `anthropic-beta: web-search-2025-03-05` — monitor Anthropic docs for when this graduates to stable.
- **Model strings** (`claude-sonnet-4-20250514`, `claude-haiku-4-5-20251001`) — update both `DEFAULT_MODEL` in `src/main.ts` and the settings dropdown when Anthropic deprecates a model.
- **After every deploy, reload Obsidian** — `Ctrl+P` → "Reload app without saving". Changes are not live until this is done.
- **After any change to plugin lifecycle code** (load, unload, settings), toggle enable → disable → enable in Obsidian Settings and confirm no errors appear in the console.
- **First checkout on Linux/macOS** — run `chmod +x build.sh` before first use. The executable bit is not preserved by git on all systems.

---

## 10. Release Gate — Non-Negotiable Checklist

Every single item below must be complete before tagging a release on `main`. No exceptions.

**Code**
- [ ] `npm run build` passes with zero errors
- [ ] `npm run test` passes with zero failures
- [ ] No `console.log`, `eval()`, or hardcoded secrets in `src/`
- [ ] All Anthropic API calls have error handling

**Version**
- [ ] `manifest.json` version updated
- [ ] `package.json` version updated to match
- [ ] Git tag matches the version string exactly

**Testing**
- [ ] Tier 3 regression matrix (TC-01 → TC-09) fully signed off in `TESTING.md`
- [ ] Tested on Windows
- [ ] Tested on Linux (via `build.sh`)
- [ ] Tested on Obsidian Mobile (iOS or Android)
- [ ] Tested with empty vault (no notes)
- [ ] Tested with no API key set
- [ ] Tested with invalid API key
- [ ] Plugin loads and unloads cleanly (toggle enable/disable)

**GitHub Release**
- [ ] Release created and tagged with the version number
- [ ] `main.js` attached to the release
- [ ] `manifest.json` attached to the release
- [ ] `styles.css` attached to the release

**Documentation**
- [ ] `README.md` reflects all new features
- [ ] `memory.md` Features Built table updated
- [ ] `MyNextSteps.md` Completed log updated

---

## 11. Key Files Quick Reference

| File | What it governs |
|---|---|
| `CLAUDE.md` | **This file** — session-start rules and Release Gate; read first every session |
| `MyDocs.md` | Invariants, build details, known gotchas, architecture decisions |
| `MyNextSteps.md` | Prioritised backlog — P0 blockers → P1 → P2 → P3 → Tech Debt |
| `NextSteps.md` | Phased testing implementation plan (Vitest → CI → Playwright) |
| `TESTING.md` | QA protocol — Vitest setup, GitHub Actions YAML, regression matrix |
| `PUBLISHING.md` | Obsidian community submission guide |
| `scripts/deploy.js` | Cross-platform deploy — canonical source of deploy logic |
| `src/utils/helpers.ts` | Pure helper functions — must remain free of Obsidian imports |
| `test/helpers.test.ts` | Unit tests for `src/utils/helpers.ts` |
| `test/__mocks__/obsidian.ts` | Obsidian API stubs used by Vitest |

---

*This file must be kept current. If a rule changes, update it here first, then propagate to `MyDocs.md`.*
