# Deep Vault — Master Backlog & Tracker
*Single source of truth for all pending work: features, requirements, and tech debt.*
*Keep this file updated as items are completed or reprioritized.*

---

## Priority Legend

| Label | Meaning |
|---|---|
| 🔴 P0 | **Release blocker** — must be done before v4.0.0 goes live on GitHub |
| 🟠 P1 | **High** — needed before community submission |
| 🟡 P2 | **Medium** — valuable, schedule within the next 1-2 releases |
| 🟢 P3 | **Future** — roadmap item, no fixed deadline |
| 🔧 Debt | **Tech debt** — code quality, no user-visible change |

---

## 🔴 P0 — Release Blockers (v4.2.x)

These block the GitHub Release from being published. Do not push the tag until all are checked.
Release is now automated — push tag `v4.2.x` (current: `4.2.5`) and `.github/workflows/release.yml` handles the rest.

| # | Item | Detail | Done |
|---|---|---|:---:|
| P0-01 | Publish GitHub Release v4.2.5 | Push tag `v4.2.5` — release workflow auto-builds and attaches assets | `[ ]` |
| P0-02 | Execute manual regression (TC-01 → TC-09) | Windows desktop pass complete 2026-06-12 — TC-01–07, TC-09 pass (3 bugs found & fixed as v4.0.3/4.0.4/4.0.5). TC-08 (mobile) deferred to P0-04 | `[~]` |
| P0-03 | Test on Linux (Obsidian desktop) | Verified via `build.sh` deploy | `[ ]` |
| P0-04 | Test on Obsidian Mobile (iOS or Android) | Swipe, touch targets, safe-area spacing — also covers TC-08 | `[ ]` |
| P0-05 | Test with empty vault (no notes) | All 6 quick actions + search show graceful empty states | `[ ]` |
| P0-06 | Test with no API key set | Every action shows a clear, non-crashing warning | `[ ]` |
| P0-07 | Test with invalid API key | Error surfaces gracefully without unhandled rejections | `[ ]` |

---

## 🟠 P1 — Required Before Community Submission

The Obsidian team will reject the PR without these. Complete after P0.

| # | Item | Detail | Done |
|---|---|---|:---:|
| P1-01 | Take all 9 screenshots | Per `PUBLISHING.md` table (`01-research-tab.png` → `09-mobile.png`) | `[ ]` |
| P1-02 | Record demo GIF | 20-30 sec, ScreenToGif, 800×600 @ 15fps, max 5MB | `[ ]` |
| P1-03 | Save screenshots to `docs/screenshots/` | Create directory, commit all image files | `[ ]` |
| P1-04 | Update README with actual screenshots | Replace placeholder screenshot guide text with `![…](docs/screenshots/…)` links | `[ ]` |
| P1-05 | Implement Vitest unit tests (Phase 1) | Extract helpers, create `test/`, write `helpers.test.ts` — see `NextSteps.md` Phase 1 | `[x]` |
| P1-06 | Create GitHub Actions CI workflow | `.github/workflows/test.yml` — spec in `TESTING.md` Section 3 | `[x]` |
| P1-07 | Add CI badge to README | After first green run on `dev` branch | `[x]` |
| P1-08 | Audit for `console.log` in production code | Removed stray `console.log` from `onload()` | `[x]` done as v4.2.5 |
| P1-09 | Verify plugin loads/unloads cleanly | Toggle enable → disable → enable in Obsidian Settings, no errors | `[ ]` |
| P1-10 | Submit `community-plugins.json` PR | Fork `obsidian-releases`, add entry, open PR — see `PUBLISHING.md` | `[ ]` |

---

## 🟡 P2 — Medium Term (Next 1-2 Releases)

| # | Item | Type | Detail | Done |
|---|---|---|---|:---:|
| P2-01 | Promote on Obsidian Discord `#share-showcase` | Marketing | Post with demo GIF after community approval | `[ ]` |
| P2-02 | Promote on Reddit `r/ObsidianMD` | Marketing | Full write-up with use cases and screenshots | `[ ]` |
| P2-03 | Promote on Reddit `r/Zettelkasten` | Marketing | Research workflow angle | `[ ]` |
| P2-04 | Promote on Twitter/X | Marketing | Short video demo, tag `@obsdmd` | `[ ]` |
| P2-05 | Test on Mac | QA | Ask a friend — verify no macOS-specific rendering issues | `[ ]` |
| P2-06 | Test with 100+ note vault | QA | Verify search and digest performance at scale | `[ ]` |
| P2-07 | Extract `src/utils/helpers.ts` module | Refactor | Prerequisite for broader unit test coverage — see `NextSteps.md` Phase 1 Step 1.1 | `[x]` |
| P2-08 | Add GitHub Issue templates | Infra | `bug_report.md` and `feature_request.md` under `.github/ISSUE_TEMPLATE/` | `[ ]` |
| P2-09 | Update model list for new Anthropic releases | Maintenance | Check `docs.anthropic.com` changelog; update model dropdown in settings tab | `[ ]` |

---

## 🟢 P3 — Future Roadmap

Tracked here for visibility. No fixed release target.

| # | Feature | Why | Notes |
|---|---|---|---|
| P3-01 | Vault-wide topic graph | Visualise connections between notes; also the key Zettelkasten gap — true value comes from traversing the link graph, not just full-text search | Requires a graph rendering lib (e.g. Sigma.js or D3) |
| P3-02 | Research streaks / usage stats | Gamify daily research habits | Store per-day action counts in plugin data |
| P3-03 | Collaborative vault templates | Share prompt templates across a team | Needs import/export format + hosted or vault-synced storage |
| P3-04 | Playwright headless integration (Tier 2) | Automate TC-03 → TC-09 | See `NextSteps.md` Phase 4 — implement post-publish |
| P3-05 | Product Hunt launch | Wider discovery | After Reddit/Discord traction and a few GitHub stars |
| P3-06 | Claude Files API integration | Attach PDFs and images as note context | Beta feature — monitor Anthropic API changelog |
| P3-07 | Plugin settings import/export | Backup and share configuration | JSON export of all settings + templates |
| P3-08 | Audit quick actions against short atomic notes | Zettelkasten workflows rely on one-idea-per-note files much shorter than typical research notes — verify summarize/concepts/gaps/connections actions degrade gracefully | Relates to `P2-03` (r/Zettelkasten promotion) |
| P3-09 | Audit AI actions for silent link/filename mutation | Zettelkasten users manually curate `[[links]]` and permanent note IDs — any feature that auto-inserts links or renames/restructures notes would violate the method's intent and must surface suggestions for user approval instead | Surfaced during Zettelkasten Method discussion, 2026-06-21 |

---

## 🔧 Tech Debt

**Priority order (set 2026-06-12):** TD-01 ✅ → TD-04 ✅ → TD-08 ✅ → TD-07 ✅. All prioritized TD items complete. TD-05 deferred — it's really a P1 community-submission item, bundle it with P1-01–04.

| # | Item | Risk if ignored | Done |
|---|---|---|:---:|
| TD-01 | All logic lives in single `src/main.ts` (2,205 lines and growing every release) | Difficult to unit-test; grows into unmaintainable monolith | `[x]` see sub-tasks below — done as v4.2.1 |
| TD-02 | No Obsidian mock — `test/` dir doesn't exist | `npm run test` fails with no helpful output | `[x]` |
| TD-03 | No `.github/workflows/` — CI not wired up | Broken builds can merge to `main` undetected | `[x]` |
| TD-04 | `deploy.bat` vault path is hardcoded | Script breaks if Obsidian vault moves; must be manually edited | `[x]` done as v4.2.2 |
| TD-05 | `docs/screenshots/` directory doesn't exist | README has placeholder text instead of real screenshots — deferred, bundle with P1-01–04 | `[ ]` |
| TD-06 | No `vitest.config.ts` | Obsidian mock alias must live in `package.json` — hard to scale | `[x]` |
| TD-07 | Web search beta header may expire | `anthropic-beta: web-search-2025-03-05` — Anthropic has promoted `web_search_20250305` to stable; header removed | `[x]` done as v4.2.4 |
| TD-08 | esbuild dev-server vulnerability (GHSA-67mh-4wv8-2f99) | Chain: `esbuild@0.17.3` → `vite` → `vite-node` → `vitest`. Attack vector is esbuild HTTP dev server — **not applicable** to this project (we use file watcher only). Fixed by bumping `esbuild` to `^0.25.0` and `vitest` to `^3.0.0` | `[x]` done as v4.2.3 |

### TD-01 sub-tasks — modularize `src/main.ts`

Each step is its own `refactor/*` branch, pure refactor (no behavior change), `npm run build && npm run test` must pass before merging `--no-ff` into `dev`. No per-step version bump — one PATCH bump at the end of the whole effort.

| # | Step | Extract to | Done |
|---|---|---|:---:|
| TD-01a | Claude API client (`callClaude` + request/response handling) | `src/api/claude.ts` | `[x]` |
| TD-01b | Modal classes (`SetupWizardModal`, `NoteSuggestModal`, `TemplateEditorModal`) + shared types/constants | `src/modals.ts`, `src/types.ts` | `[x]` |
| TD-01c | Settings tab + settings interface/defaults | `src/settings.ts` | `[x]` |
| TD-01d | `ItemView` panels/renderers (largest piece — do last) | `src/views/DeepVaultView.ts` | `[x]` |
| TD-01e | `src/main.ts` left as thin `Plugin` class (lifecycle + command registration) | — | `[x]` (achieved as part of TD-01d — main.ts is now 122 lines) |

---

## Completed

Move items here when done. Keep for audit trail.

| # | Item | Completed |
|---|---|---|
| ✅ | Sync `package.json` version to `3.1.2` (was `1.0.0`) | May 2026 |
| ✅ | Fix `esbuild.config.mjs` placeholder GitHub URL | May 2026 |
| ✅ | Fix `deploy.bat` hardcoded source paths → `%~dp0` | May 2026 |
| ✅ | Fix `TESTING.md` broken absolute Linux file path | May 2026 |
| ✅ | Add `vitest` to `devDependencies` + `npm run test` script | May 2026 |
| ✅ | Add `build.sh` to `README.md` Development section | May 2026 |
| ✅ | Add `build.sh`, `build.md`, `TESTING.md` to `memory.md` files table | May 2026 |
| ✅ | Annotate planned test modules in `build.md` as non-existent | May 2026 |
| ✅ | Create `MyDocs.md` living developer reference | May 2026 |
| ✅ | Create `NextSteps.md` testing implementation plan | May 2026 |
| ✅ | Create `vitest.config.ts` with env-aware reporters (local vs CI) | May 2026 |
| ✅ | Create `.github/workflows/test.yml` — CI with version validation + security checks | May 2026 |
| ✅ | Create `.github/workflows/release.yml` — automated release on tag push | May 2026 |
| ✅ | Create `.github/pull_request_template.md` — PR release gate checklist | May 2026 |
| ✅ | Bump version to 4.0.0 — major version for infrastructure overhaul | May 2026 |
| ✅ | v4.0.1 — fix "Please open a note first" (getCurrentNote leaves-API lookup) | 2026-06-12 |
| ✅ | v4.0.2 — fix "Failed to fetch" (requestUrl replaces fetch) | 2026-06-12 |
| ✅ | v4.0.3 — fix Daily Digest overlap (removed flex:1 from .dv-response-wrap) | 2026-06-12 |
| ✅ | v4.0.4 — fix "Could not find the active note" on Apply Tags (getCurrentFile helper) | 2026-06-12 |
| ✅ | v4.0.5 — fix Synthesis "Browse & Select Notes" multi-select (selectSuggestion override) | 2026-06-12 |
| ✅ | Codify versioning policy (PATCH/MINOR/MAJOR) in CLAUDE.md | 2026-06-12 |
| ✅ | v4.2.1 — TD-01 complete: split `src/main.ts` monolith into `src/api/claude.ts`, `src/types.ts`, `src/modals.ts`, `src/settings.ts`, `src/views/DeepVaultView.ts` | 2026-06-12 |
| ✅ | v4.2.2 — TD-04 complete: `deploy.bat` now takes vault path as a command-line argument instead of a hardcoded `VAULT_DIR` | 2026-06-12 |
| ✅ | v4.2.3 — TD-08 complete: bumped `esbuild` to `^0.25.0` and `vitest` to `^3.0.0`, fixing GHSA-67mh-4wv8-2f99 | 2026-06-12 |
| ✅ | v4.2.4 — TD-07 complete: removed stale `anthropic-beta: web-search-2025-03-05` header (`web_search_20250305` is now stable) | 2026-06-12 |
| ✅ | v4.2.5 — P1-08 complete: removed stray `console.log` debug statement from `onload()` | 2026-06-12 |

---

## How to Use This File

- **Starting a session:** scan P0 → P1 → Debt top to bottom, pick the highest incomplete item.
- **Completing an item:** check the box `[x]` and move it to the Completed table with today's date.
- **New requirement or bug:** add it at the correct priority level immediately — don't leave it in notes or memory.
- **Reprioritising:** change the P-label prefix and move the row to the correct section.
- **Before any release:** all P0 items must be `[x]` with no exceptions.

---

*Last updated: 2026-06-12 — v4.2.5*
*Related files: `NextSteps.md` (testing plan) · `TESTING.md` (QA protocol) · `PUBLISHING.md` (submission guide) · `MyDocs.md` (dev reference)*
