# Deep Vault — Developer Reference

A living document of critical project rules, cross-file constraints, and non-obvious decisions.
Update this file whenever a new invariant, gotcha, or architectural decision is discovered.

---

## Version Management (Critical Invariant)

**Both of these files must always have the same version number:**

| File | Field |
|---|---|
| `manifest.json` | `"version"` |
| `package.json` | `"version"` |

`manifest.json` is what Obsidian reads. `package.json` is what npm and tooling read.
A mismatch causes silent inconsistencies in release assets and CI output.

**Every release checklist step:**
1. Update `manifest.json` → `"version"`
2. Update `package.json` → `"version"` (same value)
3. Run `npm run build`
4. Commit, tag the GitHub release with the same version string
5. Attach `main.js`, `manifest.json`, `styles.css` to the GitHub release

---

## Build Pipeline

```
src/main.ts
    └── tsc -noEmit -skipLibCheck   (type-check only, no emit)
    └── esbuild.config.mjs          (bundles to main.js)
            └── format: CJS, target: ES2018
            └── sourcemap: inline (dev) / none (production)
            └── externals: obsidian, electron, @codemirror/*, @lezer/*
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Watch mode — rebuilds on every save, inline sourcemaps |
| `npm run build` | Type-check + production bundle → `main.js` |
| `npm run test` | Vitest one-shot run — use locally and in CI |
| `npm run test:watch` | Vitest interactive watch mode — use during local development |
| `npm run deploy -- /path/to/vault` | Copy `main.js`, `manifest.json`, `styles.css` to Obsidian vault |

### esbuild Banner URL

The bundle embeds a banner comment pointing to the GitHub source repo:
```
https://github.com/sunnys-santhosh/deep-vault
```
If the repo is ever renamed or transferred, update `esbuild.config.mjs` line 7.

---

## Deploy Scripts

### Cross-platform (all OS) — `npm run deploy`

The canonical deploy command. Works on Windows, Linux, and macOS without modification.
Powered by `scripts/deploy.js` (Node.js).

```bash
npm run deploy -- /path/to/Obsidian/Vault
npm run deploy -- "E:\Obsidian\MyVault"
```

Verifies all three source files exist before touching the destination.
Creates the plugin directory if it doesn't exist.

### Windows convenience wrapper — `deploy.bat`

Calls `scripts/deploy.js` with the hardcoded vault path.
Edit `VAULT_DIR` in `deploy.bat` if the Obsidian vault path changes.

```cmd
deploy.bat
```

### Linux/macOS convenience wrapper — `build.sh`

Handles nvm loading, npm check, dependency install, build, and optional deploy in one step.
Delegates the deploy step to `scripts/deploy.js`.

```bash
./build.sh                              # build only
./build.sh /path/to/Obsidian/Vault      # build + deploy
```

**Rule:** All deploy logic lives in `scripts/deploy.js`. The `.bat` and `.sh` wrappers must never re-implement it.

Deployed files (all three methods): `main.js`, `manifest.json`, `styles.css`.

---

## Known TypeScript / Build Gotchas

These were discovered during development and will silently break the build if ignored.

| Symptom | Cause | Fix |
|---|---|---|
| TS error on multiline strings | Multiline template literals in placeholder attributes cause parse errors | Keep all placeholder strings on a single line |
| TS error on comment lines | A comment like `// - a` on its own line is parsed as code | Keep comments on a single line, never `// - text` alone |
| `Cannot find module 'obsidian'` | Package not installed | `npm install --save-dev obsidian` |
| esbuild fails with `moduleResolution` error | `tsconfig.json` set to `"bundler"` | Must use `"moduleResolution": "node"` |

---

## Testing

Tooling: **Vitest** (`npm run test`).

The `test/` directory must be created before tests can run. The entry point is `test/helpers.test.ts`.
Unit tests mock the Obsidian API using `vi.mock()` — the Obsidian package is not a standard Node module and cannot be imported directly in tests.

### Three testing tiers

| Tier | Tool | Cadence |
|---|---|---|
| 1 — Unit | Vitest | Every push / PR via GitHub Actions |
| 2 — Integration | Playwright + headless Electron | Nightly / pre-release |
| 3 — Manual regression | Matrix in `TESTING.md` | Before every merge to `main` |

The manual regression matrix in `TESTING.md` is the gate before any release. Do not skip it.

### Planned module split (currently everything is in `src/main.ts`)

As the codebase grows, extract these before writing Tier 1 tests:
- `src/utils/tag-parser.ts` — tag extraction and normalisation
- `src/utils/template-engine.ts` — `{{date}}`, `{{note_title}}` interpolation
- `src/services/claude-client.ts` — Anthropic API calls, error handling

---

## API & Model Details

| Setting | Value |
|---|---|
| Endpoint | `https://api.anthropic.com/v1/messages` |
| Default model | `claude-sonnet-4-20250514` |
| Fast/cheap model | `claude-haiku-4-5-20251001` |
| Web search beta header | `anthropic-beta: web-search-2025-03-05` |

The API key is stored in Obsidian plugin settings only. It must never appear in source code, `.env` files, or git history.
When Anthropic deprecates a model, update `DEFAULT_MODEL` in `src/main.ts` and the model list in the settings tab.

---

## Branch & Release Workflow

```
main          ← stable releases only — every commit here gets a GitHub release tag
  └── dev     ← integration branch — merges from feature branches
        └── feature/*   ← one branch per feature or fix
```

**Rule:** never commit directly to `main`. Always go `feature/* → dev → main`.

Release sequence:
```bash
git checkout dev && git merge feature/my-fix
git checkout main && git merge dev
git push
# Then create GitHub release with tag matching manifest.json version
```

---

## File Responsibilities (Quick Reference)

| File | Role |
|---|---|
| `src/main.ts` | All plugin logic — single source of truth |
| `styles.css` | All UI styles |
| `manifest.json` | Obsidian plugin metadata + **version source of truth** |
| `package.json` | npm deps, build/test scripts — version must match `manifest.json` |
| `esbuild.config.mjs` | Bundler config — external modules list, output format |
| `tsconfig.json` | TypeScript options — `moduleResolution` must stay `"node"` |
| `main.js` | Compiled output — committed intentionally for Obsidian releases |
| `deploy.bat` | Windows one-click deploy to local Obsidian vault |
| `build.sh` | Linux build + optional deploy — also usable in CI |
| `build.md` | Internal build architecture notes and testing tier specs |
| `TESTING.md` | Full QA protocol — CI config, Vitest setup, manual regression matrix |
| `PUBLISHING.md` | Step-by-step guide for submitting to Obsidian community plugins |
| `memory.md` | Session context — developer profile, roadmap, known issues log |
| `README.md` | Public-facing docs — features, install, setup, changelog |

---

## Ongoing Best Practices

- After any change to build tooling, run `npm run build` and verify `main.js` updates correctly.
- After any change to `manifest.json`, verify `package.json` version matches before committing.
- After adding a new feature, add a row to the manual regression matrix in `TESTING.md`.
- After fixing a non-obvious bug, add a row to the **Known TypeScript / Build Gotchas** table above.
- After a release, update `memory.md` → Features Built table and bump the current version line.
- `main.js` is intentionally tracked in git — it is the release artifact that Obsidian loads. Do not add it to `.gitignore`.

---

---

## Related Documents

| File | Purpose |
|---|---|
| `CLAUDE.md` | **Session-start rules** — auto-loaded by Claude Code; cross-platform mandate, invariants, standards |
| `NextSteps.md` | Phased implementation plan for the full testing infrastructure (Vitest → CI → Playwright) |
| `MyNextSteps.md` | Master prioritised backlog — P0 release blockers, P1-P3 features, tech debt, completed log |
| `TESTING.md` | QA specification — tier definitions, Vitest setup, CI YAML, manual regression matrix |
| `PUBLISHING.md` | Step-by-step Obsidian community submission guide |

---

*Document created: May 2026 — Deep Vault v3.1.2*
*Update this file as the project evolves, not just at release time.*
