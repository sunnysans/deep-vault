# 🧪 Deep Vault — Verification & Testing Protocol
**Chief Architect's Specification for Continuous Integration & Quality Assurance**

This document establishes the official verification and testing process for **Deep Vault**. It details the automated CI/CD-ready unit test suite, guidelines for integration testing, and the manual regression checklist required before any production release.

---

## 📈 1. Testing Philosophy & Multi-Tiered Strategy

Due to the hybrid runtime environment of Obsidian plugins—which execute inside Electron on desktop systems and Cordova/Capacitor on mobile platforms—testing is structured across three distinct tiers to maximize coverage and speed:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tier 3: Manual Regression                       │
│              (Layouts, Swipes, Setup Wizard, Safe-Areas)               │
├────────────────────────────────────────────────────────────────────────┤
│                       Tier 2: Headless Integration                      │
│             (Playwright + Electron Obsidian DOM Interactions)          │
├────────────────────────────────────────────────────────────────────────┤
│                     Tier 1: Automated Unit Testing                     │
│                (Vitest, Sourcing, Pure Logical Helpers)                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ 2. Tier 1: Automated Unit Testing (CI/CD Ready)

The project uses **Vitest** for lightweight, super-fast TypeScript unit testing with zero build-step overhead.

### How it Works
Since the Obsidian framework is not a standard Node runtime package (it relies on types and Electron globals), the unit test suite automatically injects a mock interface of the Obsidian module using Vitest's hoisted `vi.mock()` capabilities. This allows us to test pure logic, string operations, error parsers, and variable interpolations instantly on a local machine or inside an unprivileged CI container.

### Running Tests Locally
To execute the suite in one-off run mode:
```bash
npm run test
```

To run tests in interactive watch mode during development:
```bash
npx vitest
```

### Existing Coverage
The initial test suite is configured in [`test/helpers.test.ts`](test/helpers.test.ts) and verifies:
- `slugify`: Converts special characters, handles leading/trailing hyphens, and truncates to the 60-character maximum.
- `formatDate`: Checks standard date representations used in exported session notes.
- `formatTime`: Verifies the 2-digit hour-minute time formatting.

---

## 🤖 3. Continuous Integration (CI/CD) Workflow

To automate quality gates, integrate the test runner into your CI system. Below is the production-ready **GitHub Actions** workflow configuration.

### Git Configuration: `.github/workflows/test.yml`

Create this file under your repository to run tests on every push and pull request:

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

---

## 🎭 4. Tier 2: Headless Integration Testing (Future Roadmap)

To test UI workflows automatically, we recommend using **Playwright** to interact with a headless Obsidian desktop client:

1. **Setup**: Store a clean, minimal Obsidian configuration folder and a mock vault in `test/fixtures/`.
2. **Execution**: Playwright launches the Electron executable of Obsidian, registers the deep-vault plugin under test, and simulates clicks or triggers Command Palette keys.
3. **Verification**: Queries the Chromium DOM inside Electron to verify components render without throwing runtime exceptions.

---

## 📋 5. Tier 3: Pre-Release Manual Regression Matrix

The following test checklist **must be executed and signed off** by an engineer before any branch is merged from `dev` into `main` for a release tag:

| ID | Module / Feature | Step Description | Expected Output | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-01** | **Setup Wizard** | Clean install with no existing configuration. | Wizard opens automatically, accepts and validates the Claude API Key. | `[ ]` |
| **TC-02** | **API Errors** | Input an invalid API key, then run "Summarize". | UI displays a clear, descriptive warning notice without crashing. | `[ ]` |
| **TC-03** | **Research Card** | Open a markdown note and click "Summarize". | Renders a clean, structured 5-bullet summary inside the response area. | `[ ]` |
| **TC-04** | **Chat Web Toggle**| Open Chat, toggle "Web Search" on, send query. | Claude responds with integrated live search citations. | `[ ]` |
| **TC-05** | **Auto-Tagging** | Click "Auto-Tag" quick action on active note. | UI displays suggested tags with checkmarks; applying writes directly to frontmatter. | `[ ]` |
| **TC-06** | **Daily Digest** | Select "Last 7 days" and click "Generate". | Creates a compiled overview, highlights, and action items of edited files. | `[ ]` |
| **TC-07** | **Synthesis** | Select 2 notes, click "Compare". | Displays clear, formatted comparative analysis. | `[ ]` |
| **TC-08** | **Mobile Touch** | Launch in touch responsive emulator. | Tab swiping left/right is fluid, tabs compress to icons on narrow widths. | `[ ]` |
| **TC-09** | **Shortcuts** | Press `Cmd/Ctrl + P` and trigger "Deep Vault" actions. | Commands respond immediately and open the relevant panel tabs. | `[ ]` |
