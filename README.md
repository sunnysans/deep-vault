# 🔍 Deep Vault

**AI-powered research assistant for Obsidian, powered by Claude**

[![Version](https://img.shields.io/badge/version-4.2.1-blue)](https://github.com/sunnys-santhosh/deep-vault/releases)
[![CI](https://github.com/sunnysans/deep-vault/actions/workflows/test.yml/badge.svg)](https://github.com/sunnysans/deep-vault/actions/workflows/test.yml)
[![Obsidian](https://img.shields.io/badge/Obsidian-0.15%2B-purple)](https://obsidian.md)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Deep Vault brings the intelligence of Anthropic's Claude directly into your Obsidian vault. Research smarter, write better, and discover connections you never knew existed — all without leaving your notes.

---

## 📸 Screenshots

> **How to take screenshots for your GitHub listing:**
>
> 1. Open Obsidian with Deep Vault loaded and a research note open
> 2. Take screenshots with `Win + Shift + S` (Windows) or `Cmd + Shift + 4` (Mac)
> 3. Save them to `docs/screenshots/` in your repo
> 4. Replace the image paths below with your actual files
>
> **Recommended shots:**
> - Research tab showing 6 action cards
> - Chat tab mid-conversation
> - Auto-tag picker with suggested tags selected
> - Vault-wide search results with source chips
> - Daily digest output
> - Setup wizard welcome screen
> - Mobile view (Obsidian mobile app or browser DevTools responsive mode)

**How to create a demo GIF:**
1. Download [ScreenToGif](https://www.screentogif.com/) — free, Windows
2. Record 20-30 seconds: open panel → summarise a note → chat → auto-tag
3. Export at 800×600, 15fps
4. Save as `docs/screenshots/demo.gif` and link it here

---

## ✨ Features

### 🔬 Research Tab
Six AI-powered quick actions on your currently open note:

| Action | What it does |
|---|---|
| 📄 Summarise | 5 bullet-point summary of key ideas |
| ❓ Questions | 6 insightful follow-up research questions |
| 💡 Concepts | Extract and explain core terms |
| 🔭 Gaps | Identify missing evidence and research gaps |
| 🔗 Connections | Find links to other research areas |
| 📚 Literature | Suggest related academic topics |

**🏷 Auto-Tag Notes** — Claude suggests 5–8 relevant tags, lets you pick which ones to apply, then writes them directly into your note's frontmatter. Uses your existing vault tags for consistency.

**📰 Daily Research Digest** — One-click summary of everything you worked on recently. Choose last 24 hours, 7 days, or 30 days. Returns a structured digest: overview, key ideas, connections, open questions, and next steps.

### 💬 Chat Tab
Full multi-turn conversation with Claude — it remembers the whole session.
- **📄 Note** — inject your open note as context instantly
- **🌐 Web** — toggle on to search the internet for current information
- `Enter` to send · `Shift+Enter` for new line
- Every response has a **💾 Save as Note** button

### 🔗 Synthesis Tab
Select 2+ notes from your vault and synthesise them together:
- **Summarise All** — unified summary across selected notes
- **Compare** — similarities and differences
- **Connect** — common themes and patterns
- **Literature Review** — academic-style overview

### 📝 Templates Tab
Save and reuse your own Claude prompts with one click.

**6 built-in starter templates:**
- 📋 Executive Summary · 🔬 Critical Analysis · 🧒 Explain Simply
- ✅ Action Items · ⚔️ Counter Arguments · 🐦 Tweet Thread

Full template editor with name, icon, prompt, note context toggle, and `{{note_title}}` / `{{date}}` variable support.

### 🔍 Search Tab
Natural language search across your **entire vault**:
- Smart relevance scoring using note titles, headings and tags
- Folder filter and configurable note count limit
- Claude synthesises a unified answer with source citations
- **Clickable source chips** — tap any note to open it instantly
- Export results as a new note

### 📋 More Tab
- Session history log with individual save buttons
- Full session export as a structured note
- Keyboard shortcuts reference card
- Re-run setup wizard button

---

## 🚀 Installation

### From Obsidian Community Plugins *(Recommended)*
1. Open Obsidian → **Settings → Community Plugins**
2. Click **Browse** and search for **Deep Vault**
3. Click **Install** → **Enable**
4. The setup wizard appears automatically

### Manual Installation
1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/sunnys-santhosh/deep-vault/releases/latest)
2. Create folder: `<your-vault>/.obsidian/plugins/deep-vault/`
3. Copy all 3 files into that folder
4. Reload Obsidian → Settings → Community Plugins → Enable **Deep Vault**

---

## ⚙️ Setup

1. Get your **Anthropic API key** at [console.anthropic.com](https://console.anthropic.com)
   - Sign up → API Keys → Create Key → Copy the key (`sk-ant-...`)
2. Open Obsidian — the **Setup Wizard** appears automatically on first install
3. Paste your API key in Step 2 of the wizard
4. Choose your model — Sonnet recommended
5. Click the **🔍 icon** in the left ribbon to open Deep Vault

---

## 💰 Pricing

Deep Vault is **completely free**. You pay Anthropic only for what you actually use:

| Action | Approx. cost |
|---|---|
| Summarise a note | ~$0.001 |
| Chat message | ~$0.001 |
| Auto-tag a note | ~$0.002 |
| Vault-wide search (20 notes) | ~$0.005 |
| Daily digest (15 notes) | ~$0.005 |
| Heavy daily use — per month | ~$1–3 |

A **$5 credit** will last most users several months. Claude Haiku option available for even lower costs.

---

## ⌨️ Commands & Hotkeys

All commands accessible via `Ctrl+P` / `Cmd+P`. Assign custom hotkeys in **Settings → Hotkeys → search "Deep Vault"**.

| Command | Description |
|---|---|
| `Open Deep Vault panel` | Open the sidebar panel |
| `Deep Vault: Go to Research tab` | Jump to Research |
| `Deep Vault: Go to Chat tab` | Jump to Chat |
| `Deep Vault: Go to Synthesis tab` | Jump to Synthesis |
| `Deep Vault: Go to Templates tab` | Jump to Templates |
| `Deep Vault: Go to Search tab` | Jump to Search |
| `Deep Vault: Summarise current note` | Quick summarise |
| `Deep Vault: Generate research questions` | Quick questions |
| `Deep Vault: Extract key concepts` | Quick concepts |
| `Deep Vault: Find research gaps` | Quick gaps |
| `Deep Vault: Auto-tag current note` | Auto-tag |
| `Deep Vault: Generate daily research digest` | Daily digest |
| `Deep Vault: Search vault` | Open search tab |
| `Deep Vault: Open setup wizard` | Re-run wizard |

---

## ⚙️ Settings

| Setting | Default | Description |
|---|---|---|
| API Key | — | Your Anthropic API key — stored locally, never shared |
| Claude Model | Sonnet 4 | Model used for all requests |
| Max Response Length | 2000 tokens | Higher = longer, more detailed responses |
| Enable Web Search | On | Allow web search in Chat tab |
| Export Folder | `Deep Vault Exports` | Vault folder for exported notes |

---

## 📱 Mobile Support

Deep Vault fully supports **Obsidian iOS and Android**:
- **Swipe left/right** to navigate between tabs
- Touch-optimised tap targets throughout
- Icon-only compact tab bar on narrow screens
- Active state feedback instead of hover
- iPhone notch and home indicator safe area support

---

## 🛠 Development

```bash
git clone https://github.com/sunnys-santhosh/deep-vault
cd deep-vault
npm install
npm run dev      # watch mode with auto-rebuild
npm run build    # production build
```

### Branch Strategy
```
main              ← stable releases only
  └── dev         ← integration branch
        └── feature/*   ← one branch per feature
```

### Deploy Script (Windows)
```cmd
deploy.bat   ← copies main.js, manifest.json, styles.css to Obsidian plugin folder
```

### Build & Deploy Script (Linux)
```bash
./build.sh                        # build only
./build.sh /path/to/Obsidian/Vault  # build + auto-deploy to vault
```

---

## 📋 Changelog

### v4.2.1
- 🔧 Tech debt: split the 2,200+ line `src/main.ts` monolith into focused modules — `src/api/claude.ts`, `src/types.ts`, `src/modals.ts`, `src/settings.ts`, and `src/views/DeepVaultView.ts`. `src/main.ts` is now a thin plugin class (~120 lines) handling lifecycle and command registration only. No behavior change.

### v4.2.0
- ⌨️ The Keyboard Shortcuts list in the More tab now shows the hotkey actually assigned to each command (via Obsidian's hotkey manager), or "Not set" if none is configured

### v4.1.1
- 🐛 Fixed the new "About" section (and the Keyboard Shortcuts list) not appearing in the More tab — `renderHistory()` was clearing the shared panel right after `renderHotkeys()` rendered into it; the More tab now uses separate top/bottom containers so both sections coexist

### v4.1.0
- ℹ️ Added an "About" section to the More tab — plugin version, copyright, and links to GitHub and Buy Me a Coffee
- 📄 Added missing `LICENSE` file (MIT) — was referenced by README but didn't exist in the repo

### v4.0.6
- 🐛 Fixed inconsistent tab bar layout — "Research" and "Templates" wrapped their labels onto a second line while other tabs stayed inline; `.dv-tab` is now a column flexbox so every tab consistently shows icon above label

### v4.0.5
- 🐛 Fixed Multi-Note Synthesis "Browse & Select Notes" only allowing one note to be picked — Obsidian's `SuggestModal` closes after the first selection by default; overrode `selectSuggestion` to keep the modal open and let users pick multiple notes (Esc to finish)

### v4.0.4
- 🐛 Fixed "Could not find the active note" error when applying Auto-Tag suggestions while the Deep Vault panel is focused — `applyTagsToNote` now uses the same `getLeavesOfType("markdown")` fallback as note detection elsewhere

### v4.0.3
- 🐛 Fixed response area overlapping Daily Digest section — removed greedy `flex:1` from response wrapper

### v4.0.2
- 🐛 Fixed "Failed to fetch" on all API calls — replaced native `fetch()` with Obsidian's `requestUrl()` which works correctly in Electron and on mobile

### v4.0.1
- 🐛 Fixed "Please open a note first" error when note is open but Deep Vault panel is focused — switched from `instanceof` class check to `getLeavesOfType("markdown")` string-based lookup

### v4.0.0
- 🏗 Complete build infrastructure overhaul — cross-platform from day one
- ✅ Vitest unit test suite — 14 tests covering all pure helpers
- 🤖 GitHub Actions CI — auto-runs build validation, version check, security scan, and unit tests on every push and PR
- 🚀 Automated GitHub Releases — tag `v4.x.x` and release assets are published automatically
- 🛡 Security checks in CI — blocks `console.log` and `eval()` from reaching `main`
- 📦 Cross-platform deploy script (`scripts/deploy.js`) — works on Windows, Linux, macOS
- 📋 PR template enforcing the release gate checklist
- 📁 Source module split — pure helpers extracted to `src/utils/helpers.ts`

### v3.1.2
- 📸 Screenshots and demo GIF guide
- 🔧 Manifest author URLs corrected
- 📝 Comprehensive README overhaul

### v3.1.1
- 📱 Full mobile support — touch swipe, responsive layout, safe area insets
- Icon-only tabs on narrow screens
- Touch active states replacing hover effects

### v3.1.0
- 🧙 5-step setup wizard — auto-shown on first install
- ⌨️ 14 keyboard commands, all assignable as hotkeys
- 📋 Shortcuts reference card in More tab

### v3.0.4
- 📰 Daily research digest with 24hr / 7 day / 30 day range
- Available as Obsidian command for instant access anywhere

### v3.0.3
- 🔍 Vault-wide search with natural language queries
- Smart relevance scoring, source citations, clickable note chips

### v3.0.2
- 🏷 Auto-tag notes — Claude suggests, you pick, applied to frontmatter
- Vault-aware tag suggestions using existing tags

### v3.0.1
- 📝 Custom prompt templates with full editor modal
- 6 built-in starter templates with variable support

### v2.3.0
- 🔗 Multi-note synthesis with 4 modes
- 💾 Export responses as new Obsidian notes
- 🌐 Web search integration in Chat tab
- 📋 Session history with full export

### v2.0.0
- Complete UI redesign with tabbed interface
- Full chat with conversation history and markdown rendering

### v1.0.0
- Initial release — sidebar panel, 4 quick actions, Claude API

---

## 🤝 Contributing

Pull requests welcome! Please:
1. Fork the repo and create a feature branch from `dev`
2. Make your changes with clear commit messages
3. Open a PR against the `dev` branch

For major changes, open an issue first to discuss.

---

## 📄 License

[MIT](LICENSE) — free to use, modify and distribute.

---

## ❤️ Support

If Deep Vault helps your research, consider [buying me a coffee](https://buymeacoffee.com/sunnyssanthosh)!

**Found a bug?** [Open an issue](https://github.com/sunnys-santhosh/deep-vault/issues)
**Have a feature idea?** [Start a discussion](https://github.com/sunnys-santhosh/deep-vault/discussions)