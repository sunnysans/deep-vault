# Deep Vault — Testing Implementation Plan
*Derived from `TESTING.md` — translates the three-tier QA strategy into ordered, actionable steps.*

---

## Current State at a Glance

| Item | Status |
|---|:---:|
| `vitest` in `devDependencies` | ✅ Done |
| `npm run test` script in `package.json` | ✅ Done |
| `src/utils/helpers.ts` extracted from `src/main.ts` | ✅ Done |
| `test/__mocks__/obsidian.ts` stub created | ✅ Done |
| `test/helpers.test.ts` written (16 test cases) | ✅ Done |
| Vitest alias config added to `package.json` | ✅ Done |
| `npm run test` verified locally | ⏳ Run locally to confirm |
| `.github/workflows/test.yml` exists | ✅ Done |
| Tier 2 Playwright setup | ❌ Not started |
| Tier 3 manual regression executed for v3.1.2 | ❌ Not done |

---

## Phase 1 — Vitest Unit Test Foundation (Tier 1)

**Goal:** Get `npm run test` passing with meaningful coverage of pure logic helpers.

### Step 1.1 — Extract testable helpers from `src/main.ts`

The functions `slugify`, `formatDate`, and `formatTime` currently live inside `src/main.ts` alongside Obsidian API calls. They need to be pure functions (no Obsidian imports) to be unit-testable.

- Create `src/utils/helpers.ts`
- Move `slugify`, `formatDate`, `formatTime` into it
- Export each function
- Update `src/main.ts` to import from `src/utils/helpers.ts`
- Verify `npm run build` still passes after the move

### Step 1.2 — Scaffold the test directory

```
test/
  helpers.test.ts        ← Tier 1 unit tests
  __mocks__/
    obsidian.ts          ← Vitest mock of the Obsidian module
```

### Step 1.3 — Write the Obsidian mock

Create `test/__mocks__/obsidian.ts`. Vitest's `vi.mock('obsidian')` will auto-resolve to this file.
The mock only needs to export the symbols actually imported in `src/main.ts` — at minimum:
`App`, `Plugin`, `PluginSettingTab`, `Setting`, `ItemView`, `Notice`, `Modal`, `SuggestModal`, `TFile`, `WorkspaceLeaf`, `MarkdownView`, `Editor`.

Each can be a minimal stub class or empty object — enough to prevent import errors, not a full simulation.

### Step 1.4 — Write `test/helpers.test.ts`

Cover the three functions per the TESTING.md specification:

| Function | Test Cases |
|---|---|
| `slugify` | Special chars → hyphens; leading/trailing hyphens stripped; truncates at 60 chars; empty string |
| `formatDate` | Returns `YYYY-MM-DD` for a known date; handles month/day zero-padding |
| `formatTime` | Returns `HH:MM` with 2-digit hour and minute; handles midnight (00:00) |

### Step 1.5 — Add Vitest config to `package.json`

Add a `vitest` config block so it knows where to find the mock:

```json
"vitest": {
  "alias": {
    "obsidian": "./test/__mocks__/obsidian.ts"
  }
}
```

Or create a `vitest.config.ts` file at root if configuration grows beyond a few lines.

### Step 1.6 — Verify locally

```bash
npm install          # picks up vitest from devDependencies
npm run test         # should exit 0 with all tests green
```

---

## Phase 2 — GitHub Actions CI (Tier 1 Automation)

**Goal:** Tests run automatically on every push and pull request to `main` or `dev`.

### Step 2.1 — Create the workflow file

Path: `.github/workflows/test.yml`

The full YAML is already specified in `TESTING.md` Section 3. Copy it verbatim:

```yaml
name: Continuous Integration

on:
  push:
    branches: [ main, dev ]
  pull_request:
    branches: [ main, dev ]

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js Environment
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Project Dependencies
        run: npm ci --legacy-peer-deps

      - name: Validate TypeScript Compilation
        run: npm run build

      - name: Execute Automated Unit Tests
        run: npm run test
```

### Step 2.2 — Push and verify

- Push the workflow file to `dev`
- Open a PR from `dev` → `main`
- Confirm the Actions tab shows the CI job passing
- The green check must appear before merging any future PR

### Step 2.3 — Add CI badge to README

Once CI is green, add the badge to `README.md` below the version badge:
```markdown
[![CI](https://github.com/sunnys-santhosh/deep-vault/actions/workflows/test.yml/badge.svg)](https://github.com/sunnys-santhosh/deep-vault/actions/workflows/test.yml)
```

---

## Phase 3 — Pre-Release Manual Regression (Tier 3)

**Goal:** Execute and sign off the full regression matrix in `TESTING.md` before every merge to `main`.

### When to run

Every time a branch is being merged from `dev` → `main` for a release tag.

### How to run

1. Build and deploy to local Obsidian: `npm run build` then `deploy.bat` (Windows) or `build.sh /vault/path` (Linux)
2. Reload Obsidian: `Ctrl+P` → "Reload app without saving"
3. Work through each test case in `TESTING.md` Section 5 (TC-01 → TC-09)
4. Mark each `[ ]` → `[x]` as you verify
5. Only merge after all 9 cases are checked

### Test cases summary

| ID | Feature | Key verification |
|---|---|---|
| TC-01 | Setup Wizard | Fresh install — wizard auto-launches |
| TC-02 | API Errors | Invalid key → descriptive warning, no crash |
| TC-03 | Research Card | Summarize → 5-bullet structured output |
| TC-04 | Chat Web Toggle | Web search on → citations in response |
| TC-05 | Auto-Tagging | Suggests tags → writes to frontmatter on apply |
| TC-06 | Daily Digest | Last 7 days → structured digest output |
| TC-07 | Synthesis | 2 notes + Compare → formatted analysis |
| TC-08 | Mobile Touch | Swipe between tabs, icon-only compact bar |
| TC-09 | Shortcuts | Cmd/Ctrl+P commands open correct panels |

---

## Phase 4 — Playwright Headless Integration (Tier 2 — Future)

**Goal:** Automate UI regression so TC-03 through TC-09 run without manual interaction.
Schedule: implement after the plugin is accepted into the Obsidian community directory.

### Setup steps (when ready)

1. Install Playwright and `electron` test driver:
   ```bash
   npm install --save-dev @playwright/test playwright-electron
   ```

2. Create fixture directory:
   ```
   test/
     fixtures/
       vault/          ← minimal mock vault (1-2 .md notes)
       obsidian-config/  ← clean .obsidian/ folder with deep-vault enabled
   ```

3. Write smoke tests that:
   - Launch Obsidian Electron binary
   - Inject the built `main.js` into the fixtures vault
   - Open the Deep Vault panel via the ribbon icon
   - Assert the tab bar renders without JS exceptions

4. Add a `test:integration` script to `package.json` and a separate GitHub Actions job on a nightly schedule.

---

## Implementation Order

```
Phase 1 (Unit tests)  →  Phase 2 (CI)  →  Phase 3 (Manual regression every release)
                                                    ↓
                                         Phase 4 (Playwright — post-publish)
```

Phases 1 and 2 are prerequisites for community submission.
Phase 3 must run before v3.1.2 is officially released on GitHub.
Phase 4 can wait until post-publish when the project has more stability.

---

*Last updated: May 2026 — v3.1.2*
*Source specification: `TESTING.md`*
