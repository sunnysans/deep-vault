import { App, Modal, Notice, SuggestModal, TFile } from "obsidian";
import { DEEP_VAULT_VIEW, PromptTemplate } from "./types";
import type DeepVaultPlugin from "./main";

// ─── Note Picker Modal ────────────────────────────────────────────────────────

export class NoteSuggestModal extends SuggestModal<TFile> {
  private files: TFile[];
  private onSelect: (files: TFile[]) => void;
  private selected: TFile[] = [];

  constructor(app: App, files: TFile[], onSelect: (files: TFile[]) => void) {
    super(app);
    this.files = files;
    this.onSelect = onSelect;
    this.setPlaceholder("Search and select notes to synthesize (Enter to add, Esc when done)...");
  }

  getSuggestions(query: string): TFile[] {
    return this.files.filter(f =>
      f.basename.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 20);
  }

  renderSuggestion(file: TFile, el: HTMLElement) {
    const isSelected = this.selected.includes(file);
    el.createEl("div", {
      text: `${isSelected ? "✅ " : ""}${file.basename}`,
      cls: isSelected ? "dv-modal-selected" : ""
    });
    el.createEl("small", { text: file.path, cls: "dv-modal-path" });
  }

  onChooseSuggestion(file: TFile, _evt?: MouseEvent | KeyboardEvent) {
    if (!this.selected.includes(file)) {
      this.selected.push(file);
      new Notice(`Added: ${file.basename} (${this.selected.length} selected)`);
    } else {
      this.selected = this.selected.filter(f => f !== file);
      new Notice(`Removed: ${file.basename}`);
    }
    this.onSelect(this.selected);
  }

  selectSuggestion(value: TFile, evt: MouseEvent | KeyboardEvent) {
    // Default SuggestModal behaviour closes the modal after one pick.
    // Re-trigger the suggester instead so users can keep selecting notes,
    // and only close on Escape.
    this.onChooseSuggestion(value, evt);
    this.inputEl.dispatchEvent(new Event("input"));
  }
}

// ─── Template Editor Modal ────────────────────────────────────────────────────

export class TemplateEditorModal extends Modal {
  private existing?: PromptTemplate;
  private onSave: (tpl: PromptTemplate) => void;

  constructor(app: App, existing: PromptTemplate | undefined, onSave: (tpl: PromptTemplate) => void) {
    super(app);
    this.existing = existing;
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dv-modal");

    contentEl.createEl("h2", { text: this.existing ? "✏️ Edit Template" : "📝 New Template", cls: "dv-modal-title" });

    // Name
    contentEl.createEl("label", { text: "Template Name", cls: "dv-modal-label" });
    const nameInput = contentEl.createEl("input", {
      cls: "dv-modal-input",
      attr: { type: "text", placeholder: "e.g. Meeting Summary", value: this.existing?.name ?? "" }
    });

    // Icon
    contentEl.createEl("label", { text: "Icon (emoji)", cls: "dv-modal-label" });
    const iconInput = contentEl.createEl("input", {
      cls: "dv-modal-input dv-modal-input-sm",
      attr: { type: "text", placeholder: "📝", value: this.existing?.icon ?? "📝" }
    });

    // Prompt
    contentEl.createEl("label", { text: "Prompt", cls: "dv-modal-label" });
    contentEl.createEl("p", { text: "Write your prompt. Claude will receive this, optionally followed by your note content.", cls: "dv-modal-hint" });
    const promptInput = contentEl.createEl("textarea", {
      cls: "dv-modal-textarea",
      attr: { placeholder: "e.g. Summarise this note as a bullet list suitable for a team standup..." }
    });
    promptInput.value = this.existing?.prompt ?? "";

    // Use note context toggle
    const toggleRow = contentEl.createDiv("dv-modal-toggle-row");
    toggleRow.createEl("label", { text: "Include current note as context", cls: "dv-modal-toggle-label" });
    const toggleInput = toggleRow.createEl("input", {
      attr: { type: "checkbox" }
    }) as HTMLInputElement;
    toggleInput.checked = this.existing?.useNoteContext ?? true;

    // Quick insert variables
    contentEl.createEl("p", { text: "Quick insert:", cls: "dv-modal-label" });
    const varRow = contentEl.createDiv("dv-modal-var-row");
    const vars = [
      { label: "{{note_title}}", desc: "Note title" },
      { label: "{{date}}", desc: "Today's date" },
    ];
    for (const v of vars) {
      const chip = varRow.createEl("button", { text: v.label, cls: "dv-var-chip", attr: { title: v.desc } });
      chip.onclick = () => {
        const pos = promptInput.selectionStart ?? promptInput.value.length;
        promptInput.value = promptInput.value.slice(0, pos) + v.label + promptInput.value.slice(pos);
        promptInput.focus();
      };
    }

    // Buttons
    const btnRow = contentEl.createDiv("dv-modal-btn-row");

    const cancelBtn = btnRow.createEl("button", { text: "Cancel", cls: "dv-btn-ghost" });
    cancelBtn.onclick = () => this.close();

    const saveBtn = btnRow.createEl("button", { text: this.existing ? "Save Changes" : "Create Template", cls: "dv-btn-primary" });
    saveBtn.onclick = () => {
      const name = nameInput.value.trim();
      const prompt = promptInput.value.trim();
      if (!name) { new Notice("Please enter a template name."); return; }
      if (!prompt) { new Notice("Please enter a prompt."); return; }

      const tpl: PromptTemplate = {
        id: this.existing?.id ?? `tpl-${Date.now()}`,
        name,
        icon: iconInput.value.trim() || "📝",
        prompt,
        useNoteContext: toggleInput.checked,
        createdAt: this.existing?.createdAt ?? new Date().toISOString(),
      };

      this.onSave(tpl);
      this.close();
    };
  }

  onClose() { this.contentEl.empty(); }
}

// ─── Setup Wizard Modal ───────────────────────────────────────────────────────

export class SetupWizardModal extends Modal {
  private plugin: DeepVaultPlugin;
  private step: number = 0;

  private readonly steps = [
    {
      title: "👋 Welcome to Deep Vault",
      icon: "🔍",
      content: (el: HTMLElement, plugin: DeepVaultPlugin, next: () => void, _close: () => void) => {
        el.createEl("p", { text: "Deep Vault is your AI-powered research assistant inside Obsidian, powered by Anthropic's Claude.", cls: "dv-wizard-text" });
        el.createEl("p", { text: "This quick setup takes less than 2 minutes.", cls: "dv-wizard-text" });

        const features = [
          "🔬 Research tab — 6 smart quick actions on any note",
          "💬 Chat — multi-turn conversation with your vault",
          "🔗 Synthesis — combine and compare multiple notes",
          "📝 Templates — save and reuse custom prompts",
          "🔍 Search — natural language search across all notes",
          "📰 Daily Digest — summarise recent work automatically",
        ];

        const list = el.createEl("ul", { cls: "dv-wizard-list" });
        features.forEach(f => list.createEl("li", { text: f }));

        el.createEl("button", { text: "Get Started →", cls: "dv-btn-primary dv-wizard-btn" }).onclick = next;
      }
    },
    {
      title: "🔑 Connect to Claude",
      icon: "🔑",
      content: (el: HTMLElement, plugin: DeepVaultPlugin, next: () => void, _close: () => void) => {
        el.createEl("p", { text: "Deep Vault needs an Anthropic API key to power Claude.", cls: "dv-wizard-text" });

        const steps = el.createEl("ol", { cls: "dv-wizard-steps" });
        steps.createEl("li", { text: "Go to console.anthropic.com and sign up" });
        steps.createEl("li", { text: "Navigate to API Keys → Create Key" });
        steps.createEl("li", { text: "Copy the key (starts with sk-ant-...)" });
        steps.createEl("li", { text: "Paste it below" });

        el.createEl("label", { text: "Your API Key", cls: "dv-modal-label" });
        const keyInput = el.createEl("input", {
          cls: "dv-modal-input",
          attr: { type: "password", placeholder: "sk-ant-..." }
        });
        keyInput.value = plugin.settings.apiKey;

        el.createEl("p", { text: "🔒 Your key is stored locally in Obsidian and never sent anywhere except Anthropic.", cls: "dv-wizard-hint" });

        const btn = el.createEl("button", { text: "Save & Continue →", cls: "dv-btn-primary dv-wizard-btn" });
        btn.onclick = async () => {
          const key = keyInput.value.trim();
          if (!key.startsWith("sk-ant-") && key.length > 0) {
            new Notice("That doesn't look like a valid Anthropic API key.");
            return;
          }
          plugin.settings.apiKey = key;
          await plugin.saveSettings();
          next();
        };

        const skipBtn = el.createEl("button", { text: "Skip for now", cls: "dv-btn-ghost dv-wizard-skip" });
        skipBtn.onclick = next;
      }
    },
    {
      title: "🤖 Choose Your Model",
      icon: "🤖",
      content: (el: HTMLElement, plugin: DeepVaultPlugin, next: () => void, _close: () => void) => {
        el.createEl("p", { text: "Which Claude model would you like to use?", cls: "dv-wizard-text" });

        const models = [
          {
            id: "claude-sonnet-4-20250514",
            name: "Claude Sonnet 4",
            badge: "⭐ Recommended",
            desc: "Best balance of intelligence and speed. Ideal for deep research, synthesis and complex analysis.",
            badgeCls: "dv-wizard-badge-recommended"
          },
          {
            id: "claude-haiku-4-5-20251001",
            name: "Claude Haiku 4.5",
            badge: "⚡ Fastest",
            desc: "Quicker responses, lower cost. Great for quick summaries and simple tasks.",
            badgeCls: "dv-wizard-badge-fast"
          },
        ];

        const modelGrid = el.createDiv("dv-wizard-model-grid");

        for (const m of models) {
          const card = modelGrid.createDiv("dv-wizard-model-card");
          if (plugin.settings.model === m.id) card.addClass("dv-wizard-model-selected");

          const cardTop = card.createDiv("dv-wizard-model-top");
          cardTop.createEl("span", { text: m.name, cls: "dv-wizard-model-name" });
          cardTop.createEl("span", { text: m.badge, cls: `dv-wizard-badge ${m.badgeCls}` });

          card.createEl("p", { text: m.desc, cls: "dv-wizard-model-desc" });

          card.onclick = async () => {
            modelGrid.querySelectorAll(".dv-wizard-model-card").forEach(c => c.removeClass("dv-wizard-model-selected"));
            card.addClass("dv-wizard-model-selected");
            plugin.settings.model = m.id;
            await plugin.saveSettings();
          };
        }

        el.createEl("button", { text: "Continue →", cls: "dv-btn-primary dv-wizard-btn" }).onclick = next;
      }
    },
    {
      title: "⌨️ Keyboard Shortcuts",
      icon: "⌨️",
      content: (el: HTMLElement, _plugin: DeepVaultPlugin, next: () => void, _close: () => void) => {
        el.createEl("p", { text: "Deep Vault registers these commands in Obsidian. You can assign hotkeys to any of them in Settings → Hotkeys.", cls: "dv-wizard-text" });

        const shortcuts = [
          { cmd: "Open Deep Vault panel", hint: "Main panel" },
          { cmd: "Deep Vault: Go to Research tab", hint: "Research" },
          { cmd: "Deep Vault: Go to Chat tab", hint: "Chat" },
          { cmd: "Deep Vault: Go to Search tab", hint: "Search" },
          { cmd: "Deep Vault: Summarise current note", hint: "Quick action" },
          { cmd: "Deep Vault: Auto-tag current note", hint: "Quick action" },
          { cmd: "Deep Vault: Generate daily research digest", hint: "Digest" },
          { cmd: "Deep Vault: Search vault", hint: "Vault search" },
        ];

        const table = el.createEl("table", { cls: "dv-wizard-table" });
        const thead = table.createEl("thead");
        const hrow = thead.createEl("tr");
        hrow.createEl("th", { text: "Command" });
        hrow.createEl("th", { text: "What it does" });

        const tbody = table.createEl("tbody");
        shortcuts.forEach(s => {
          const row = tbody.createEl("tr");
          row.createEl("td", { text: s.cmd, cls: "dv-wizard-cmd" });
          row.createEl("td", { text: s.hint, cls: "dv-wizard-hint-cell" });
        });

        el.createEl("p", { text: "💡 Tip: Go to Settings → Hotkeys and search Deep Vault to assign your preferred shortcuts.", cls: "dv-wizard-hint" });

        el.createEl("button", { text: "Continue →", cls: "dv-btn-primary dv-wizard-btn" }).onclick = next;
      }
    },
    {
      title: "🎉 You are ready!",
      icon: "🎉",
      content: (el: HTMLElement, _plugin: DeepVaultPlugin, _next: () => void, close: () => void) => {
        el.createEl("p", { text: "Deep Vault is all set up. Here is how to get started:", cls: "dv-wizard-text" });

        const tips = [
          { icon: "1️⃣", text: "Open any note in your vault" },
          { icon: "2️⃣", text: "Click the 🔍 icon in the left ribbon" },
          { icon: "3️⃣", text: "Try Summarize in the Research tab" },
          { icon: "4️⃣", text: "Ask Claude anything in the Chat tab" },
        ];

        const tipList = el.createDiv("dv-wizard-tips");
        tips.forEach(t => {
          const row = tipList.createDiv("dv-wizard-tip-row");
          row.createEl("span", { text: t.icon, cls: "dv-wizard-tip-icon" });
          row.createEl("span", { text: t.text, cls: "dv-wizard-tip-text" });
        });

        el.createEl("button", { text: "Open Deep Vault 🚀", cls: "dv-btn-primary dv-wizard-btn" }).onclick = close;
      }
    },
  ];

  constructor(app: App, plugin: DeepVaultPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    this.renderStep();
  }

  private renderStep() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dv-wizard-modal");

    const step = this.steps[this.step];

    // Progress bar
    const progress = contentEl.createDiv("dv-wizard-progress");
    this.steps.forEach((_, i) => {
      progress.createDiv(i <= this.step ? "dv-wizard-dot dv-wizard-dot-active" : "dv-wizard-dot");
    });

    // Icon + title
    contentEl.createEl("div", { text: step.icon, cls: "dv-wizard-icon" });
    contentEl.createEl("h2", { text: step.title, cls: "dv-wizard-title" });

    // Content area
    const contentArea = contentEl.createDiv("dv-wizard-content");
    step.content(
      contentArea,
      this.plugin,
      () => { this.step++; if (this.step < this.steps.length) this.renderStep(); else this.close(); },
      () => this.close()
    );
  }

  async onClose() {
    this.plugin.settings.hasSeenWizard = true;
    await this.plugin.saveSettings();
    // Open Deep Vault panel after wizard
    const leaves = this.app.workspace.getLeavesOfType(DEEP_VAULT_VIEW);
    if (leaves.length === 0) {
      const leaf = this.app.workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: DEEP_VAULT_VIEW, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
    this.contentEl.empty();
  }
}
