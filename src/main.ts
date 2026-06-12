import {
  App,
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  ItemView,
  WorkspaceLeaf,
  TFile,
  Platform,
} from "obsidian";
import { formatTime, formatDate, slugify } from "./utils/helpers";
import { callClaude } from "./api/claude";
import {
  DEEP_VAULT_VIEW,
  ChatMessage,
  PromptTemplate,
  DeepVaultSettings,
  DEFAULT_TEMPLATES,
  DEFAULT_SETTINGS,
} from "./types";
import { NoteSuggestModal, TemplateEditorModal, SetupWizardModal } from "./modals";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderMarkdown(container: HTMLElement, text: string) {
  container.empty();
  const lines = text.split("\n");
  let inList = false;
  let listEl: HTMLElement | null = null;

  for (const line of lines) {
    if (line.startsWith("### ")) {
      if (inList) { inList = false; listEl = null; }
      container.createEl("h4", { text: line.slice(4), cls: "dv-md-h3" });
    } else if (line.startsWith("## ")) {
      if (inList) { inList = false; listEl = null; }
      container.createEl("h3", { text: line.slice(3), cls: "dv-md-h2" });
    } else if (line.startsWith("# ")) {
      if (inList) { inList = false; listEl = null; }
      container.createEl("h2", { text: line.slice(2), cls: "dv-md-h1" });
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      if (!inList) { listEl = container.createEl("ul", { cls: "dv-md-list" }); inList = true; }
      listEl!.createEl("li", { text: line.slice(2), cls: "dv-md-li" });
    } else if (line.match(/^\d+\. /)) {
      if (!inList) { listEl = container.createEl("ol", { cls: "dv-md-list" }); inList = true; }
      listEl!.createEl("li", { text: line.replace(/^\d+\. /, ""), cls: "dv-md-li" });
    } else if (line.startsWith("> ")) {
      if (inList) { inList = false; listEl = null; }
      container.createEl("blockquote", { text: line.slice(2), cls: "dv-md-quote" });
    } else if (line.trim() === "") {
      if (inList) { inList = false; listEl = null; }
    } else {
      if (inList) { inList = false; listEl = null; }
      const p = container.createEl("p", { cls: "dv-md-p" });
      const parts = line.split(/\*\*(.*?)\*\*/g);
      parts.forEach((part, i) => {
        if (i % 2 === 1) p.createEl("strong", { text: part });
        else if (part) p.appendText(part);
      });
    }
  }
}

// ─── Main Sidebar View ────────────────────────────────────────────────────────

class DeepVaultView extends ItemView {
  private plugin: DeepVaultPlugin;
  private chatHistory: ChatMessage[] = [];
  private activeTab: "research" | "chat" | "synthesis" | "templates" | "search" | "history" = "research";
  private lastResponse: string = "";

  // UI elements
  private tabResearch: HTMLElement;
  private tabChat: HTMLElement;
  private tabSynthesis: HTMLElement;
  private tabTemplates: HTMLElement;
  private tabSearch: HTMLElement;
  private tabHistory: HTMLElement;
  private panelResearch: HTMLElement;
  private panelChat: HTMLElement;
  private panelSynthesis: HTMLElement;
  private panelTemplates: HTMLElement;
  private panelSearch: HTMLElement;
  private panelHistory: HTMLElement;
  private panelHistoryTop: HTMLElement;
  private panelHistoryBottom: HTMLElement;
  private chatMessagesEl: HTMLElement;
  private chatInputEl: HTMLTextAreaElement;
  private statusEl: HTMLElement;
  private _responseEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: DeepVaultPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return DEEP_VAULT_VIEW; }
  getDisplayText() { return "Deep Vault"; }
  getIcon() { return "search"; }

  async onOpen() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("dv-root");

    // Detect mobile and add class for CSS targeting
    const isMobile = (this.app as any).isMobile ?? window.innerWidth < 768;
    if (isMobile) root.addClass("dv-mobile");

    this.buildHeader(root);
    this.buildTabs(root);
    this.buildPanelResearch(root);
    this.buildPanelChat(root);
    this.buildPanelSynthesis(root);
    this.buildPanelTemplates(root);
    this.buildPanelSearch(root);
    this.buildPanelHistory(root);
    this.statusEl = root.createDiv("dv-status");
    this.switchTab("research");

    // Touch swipe support between tabs
    this.addTouchSwipe(root);
  }

  private addTouchSwipe(root: HTMLElement) {
    let touchStartX = 0;
    let touchStartY = 0;
    const tabOrder: Array<"research" | "chat" | "synthesis" | "templates" | "search" | "history"> =
      ["research", "chat", "synthesis", "templates", "search", "history"];

    root.addEventListener("touchstart", (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    root.addEventListener("touchend", (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      // Only horizontal swipes (dx > dy) with enough distance
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;

      const currentIdx = tabOrder.indexOf(this.activeTab);
      if (dx < 0 && currentIdx < tabOrder.length - 1) {
        // Swipe left → next tab
        this.switchTab(tabOrder[currentIdx + 1]);
      } else if (dx > 0 && currentIdx > 0) {
        // Swipe right → previous tab
        this.switchTab(tabOrder[currentIdx - 1]);
      }
    }, { passive: true });
  }

  // ─── Header ───────────────────────────────────────────────────────────────

  private buildHeader(root: HTMLElement) {
    const header = root.createDiv("dv-header");
    const left = header.createDiv("dv-header-left");
    left.createEl("span", { text: "🔍", cls: "dv-logo" });
    const titles = left.createDiv("dv-header-titles");
    titles.createEl("h2", { text: "Deep Vault", cls: "dv-title" });
    titles.createEl("p", { text: "AI Research Assistant", cls: "dv-subtitle" });
    const badge = header.createDiv("dv-badge");
    badge.createEl("span", { text: "Claude", cls: "dv-badge-text" });
  }

  // ─── Tabs ─────────────────────────────────────────────────────────────────

  private buildTabs(root: HTMLElement) {
    const tabBar = root.createDiv("dv-tab-bar");

    const tabs = [
      { ref: "tabResearch", icon: "🔬", label: "Research", tab: "research" },
      { ref: "tabChat", icon: "💬", label: "Chat", tab: "chat" },
      { ref: "tabSynthesis", icon: "🔗", label: "Synthesis", tab: "synthesis" },
      { ref: "tabTemplates", icon: "📝", label: "Templates", tab: "templates" },
      { ref: "tabSearch", icon: "🔍", label: "Search", tab: "search" },
      { ref: "tabHistory", icon: "📋", label: "More", tab: "history" },
    ];

    for (const t of tabs) {
      const el = tabBar.createDiv("dv-tab");
      el.createEl("span", { text: t.icon, cls: "dv-tab-icon" });
      el.createEl("span", { text: t.label, cls: "dv-tab-label" });
      el.onclick = () => this.switchTab(t.tab as any);
      (this as any)[t.ref] = el;
    }
  }

  switchTabPublic(tab: string) { this.switchTab(tab as any); }

  private switchTab(tab: "research" | "chat" | "synthesis" | "templates" | "search" | "history") {
    this.activeTab = tab;
    const tabs = [this.tabResearch, this.tabChat, this.tabSynthesis, this.tabTemplates, this.tabSearch, this.tabHistory];
    const panels = [this.panelResearch, this.panelChat, this.panelSynthesis, this.panelTemplates, this.panelSearch, this.panelHistory];
    tabs.forEach(t => t.removeClass("dv-tab-active"));
    panels.forEach(p => p.addClass("dv-hidden"));

    const map: Record<string, number> = { research: 0, chat: 1, synthesis: 2, templates: 3, search: 4, history: 5 };
    tabs[map[tab]].addClass("dv-tab-active");
    panels[map[tab]].removeClass("dv-hidden");

    if (tab === "chat") this.chatInputEl?.focus();
    if (tab === "templates") this.renderTemplates();
    if (tab === "history") { this.renderHotkeys(); this.renderHistory(); }
  }

  // ─── Research Panel ───────────────────────────────────────────────────────

  private buildPanelResearch(root: HTMLElement) {
    this.panelResearch = root.createDiv("dv-panel");

    const noteInfo = this.panelResearch.createDiv("dv-note-info");
    noteInfo.createEl("span", { text: "📄 Uses your currently open note as context", cls: "dv-note-label" });

    this.panelResearch.createEl("p", { text: "QUICK ACTIONS", cls: "dv-section-label" });
    const grid = this.panelResearch.createDiv("dv-action-grid");

    const actions = [
      { icon: "📄", label: "Summarize", action: "summarize", desc: "Key points from this note" },
      { icon: "❓", label: "Questions", action: "questions", desc: "Research questions to explore" },
      { icon: "💡", label: "Concepts", action: "concepts", desc: "Extract core ideas & terms" },
      { icon: "🔭", label: "Gaps", action: "gaps", desc: "Missing info & research gaps" },
      { icon: "🔗", label: "Connections", action: "connections", desc: "Links to other ideas" },
      { icon: "📚", label: "Literature", action: "literature", desc: "Related research areas" },
      { icon: "🏷", label: "Auto-Tag", action: "autotag", desc: "Suggest & apply tags" },
    ];

    for (const a of actions) {
      const card = grid.createDiv("dv-action-card");
      card.createEl("span", { text: a.icon, cls: "dv-action-icon" });
      card.createEl("span", { text: a.label, cls: "dv-action-label" });
      card.createEl("span", { text: a.desc, cls: "dv-action-desc" });
      card.onclick = () => this.runQuickAction(a.action);
    }

    this.panelResearch.createEl("p", { text: "RESPONSE", cls: "dv-section-label dv-section-label-top" });
    const responseWrap = this.panelResearch.createDiv("dv-response-wrap");
    this._responseEl = responseWrap.createDiv("dv-response");
    this._responseEl.createEl("p", { text: "Select a Quick Action above.", cls: "dv-placeholder" });

    // Export button (hidden until there's a response)
    const exportRow = this.panelResearch.createDiv("dv-export-row dv-hidden");
    const exportBtn = exportRow.createEl("button", { text: "💾 Save as Note", cls: "dv-btn-export" });
    exportBtn.onclick = () => this.exportToNote(this.lastResponse, "Research Result");
    (this as any)._exportRow = exportRow;

    // ── Daily Digest section ──────────────────────────────────────────────
    this.panelResearch.createEl("p", { text: "DAILY DIGEST", cls: "dv-section-label dv-section-label-top" });

    const digestDesc = this.panelResearch.createDiv("dv-digest-desc");
    digestDesc.createEl("span", { text: "Summarise notes you have worked on recently.", cls: "dv-note-label" });

    const digestControls = this.panelResearch.createDiv("dv-digest-controls");

    // Time range selector
    const rangeSelect = digestControls.createEl("select", { cls: "dv-digest-select" });
    [
      { value: "1", label: "Last 24 hours" },
      { value: "7", label: "Last 7 days" },
      { value: "30", label: "Last 30 days" },
    ].forEach(opt => {
      const o = rangeSelect.createEl("option", { text: opt.label });
      o.value = opt.value;
    });

    const digestBtn = digestControls.createEl("button", { text: "📰 Generate Digest", cls: "dv-btn-digest" });
    digestBtn.onclick = () => {
      const days = parseInt(rangeSelect.value);
      this.runDailyDigest(days);
    };

    // Digest response area
    const digestResponseWrap = this.panelResearch.createDiv("dv-response-wrap");
    const digestResponseEl = digestResponseWrap.createDiv("dv-response");
    digestResponseEl.createEl("p", { text: "Click Generate Digest to summarise your recent notes.", cls: "dv-placeholder" });
    (this as any)._digestResponseEl = digestResponseEl;

    // Digest export row
    const digestExportRow = this.panelResearch.createDiv("dv-export-row dv-hidden");
    digestExportRow.createEl("button", { text: "💾 Save Digest as Note", cls: "dv-btn-export" })
      .onclick = () => this.exportDigestAsNote();
    (this as any)._digestExportRow = digestExportRow;
  }

  private get responseEl(): HTMLElement { return this._responseEl; }

  // ─── Chat Panel ───────────────────────────────────────────────────────────

  private buildPanelChat(root: HTMLElement) {
    this.panelChat = root.createDiv("dv-panel dv-panel-chat");
    this.chatMessagesEl = this.panelChat.createDiv("dv-chat-messages");
    this.renderWelcomeMessage();

    const inputArea = this.panelChat.createDiv("dv-chat-input-area");
    this.chatInputEl = inputArea.createEl("textarea", {
      cls: "dv-chat-input",
      attr: { placeholder: "Ask anything... (Enter to send, Shift+Enter for new line)" },
    });

    this.chatInputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.sendChatMessage(); }
    });

    const inputFooter = inputArea.createDiv("dv-chat-input-footer");

    const clearBtn = inputFooter.createEl("button", { text: "🗑 Clear", cls: "dv-btn-ghost" });
    clearBtn.onclick = () => this.clearChat();

    const useNoteBtn = inputFooter.createEl("button", { text: "📄 Note", cls: "dv-btn-ghost" });
    useNoteBtn.onclick = () => {
      const note = this.getCurrentNote();
      if (note) { this.chatInputEl.value = `Based on my note "${note.title}": `; this.chatInputEl.focus(); }
      else new Notice("Open a note first.");
    };

    const webBtn = inputFooter.createEl("button", { text: "🌐 Web", cls: "dv-btn-ghost dv-web-toggle" });
    webBtn.title = "Toggle web search for this query";
    (this as any)._webEnabled = false;
    webBtn.onclick = () => {
      (this as any)._webEnabled = !(this as any)._webEnabled;
      webBtn.toggleClass("dv-web-active", (this as any)._webEnabled);
      webBtn.setText((this as any)._webEnabled ? "🌐 Web ON" : "🌐 Web");
    };

    const sendBtn = inputFooter.createEl("button", { text: "Send →", cls: "dv-btn-primary" });
    sendBtn.onclick = () => this.sendChatMessage();
  }

  private renderWelcomeMessage() {
    this.chatMessagesEl.empty();
    const welcome = this.chatMessagesEl.createDiv("dv-chat-welcome");
    welcome.createEl("p", { text: "👋 Hi! I'm Deep Vault.", cls: "dv-welcome-title" });
    welcome.createEl("p", { text: "Ask me anything about your research. Enable 🌐 Web to search the internet for current information.", cls: "dv-welcome-text" });

    const tips = welcome.createDiv("dv-welcome-tips");
    const examples = [
      "What are the key themes in my note?",
      "Fact-check the claims in my current note",
      "What recent research exists on this topic?",
    ];
    for (const ex of examples) {
      const tip = tips.createEl("button", { text: `"${ex}"`, cls: "dv-example-btn" });
      tip.onclick = () => { this.chatInputEl.value = ex; this.chatInputEl.focus(); };
    }
  }

  private async sendChatMessage() {
    const input = this.chatInputEl.value.trim();
    if (!input) return;

    const note = this.getCurrentNote();
    const useWeb = (this as any)._webEnabled && this.plugin.settings.enableWebSearch;
    this.chatInputEl.value = "";

    this.addChatBubble("user", input, note?.title);

    const messages = this.chatHistory
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role, content: m.content }));

    const userContent = note
      ? `Context from note "${note.title}":\n\n${note.content.slice(0, 3000)}\n\n---\n\n${input}`
      : input;

    messages.push({ role: "user", content: userContent });
    this.chatHistory.push({ role: "user", content: input, timestamp: new Date(), noteTitle: note?.title });

    await this.callClaudeChat(messages, useWeb);
  }

  private addChatBubble(role: "user" | "assistant", content: string, noteTitle?: string): HTMLElement {
    const welcome = this.chatMessagesEl.querySelector(".dv-chat-welcome");
    if (welcome) welcome.remove();

    const wrap = this.chatMessagesEl.createDiv(`dv-bubble-wrap dv-bubble-${role}`);

    if (role === "user") {
      if (noteTitle) wrap.createEl("span", { text: `📄 ${noteTitle}`, cls: "dv-bubble-note" });
      wrap.createEl("div", { text: content, cls: "dv-bubble dv-bubble-user" });
    } else {
      const bubble = wrap.createDiv("dv-bubble dv-bubble-assistant");
      if (content === "...") {
        bubble.createEl("span", { text: "⏳ Thinking...", cls: "dv-thinking" });
      } else {
        renderMarkdown(bubble, content);

        // Export button on each assistant message
        const exportBtn = wrap.createEl("button", { text: "💾 Save as Note", cls: "dv-btn-export-inline" });
        exportBtn.onclick = () => this.exportToNote(content, "Chat Response");
      }
    }

    wrap.createEl("span", { text: formatTime(new Date()), cls: "dv-bubble-time" });
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
    return wrap;
  }

  private clearChat() {
    this.chatHistory = [];
    this.renderWelcomeMessage();
    new Notice("Chat cleared.");
  }

  // ─── Synthesis Panel (v2.1) ───────────────────────────────────────────────

  private buildPanelSynthesis(root: HTMLElement) {
    this.panelSynthesis = root.createDiv("dv-panel");

    this.panelSynthesis.createEl("p", { text: "MULTI-NOTE SYNTHESIS", cls: "dv-section-label" });
    this.panelSynthesis.createEl("p", {
      text: "Select multiple notes from your vault to synthesize, compare, or review together.",
      cls: "dv-synthesis-desc"
    });

    // Selected notes display
    const selectedArea = this.panelSynthesis.createDiv("dv-selected-notes");
    selectedArea.createEl("p", { text: "No notes selected yet.", cls: "dv-placeholder", attr: { id: "dv-selected-label" } });
    (this as any)._selectedNotes = [] as TFile[];
    (this as any)._selectedArea = selectedArea;

    // Browse button
    const browseBtn = this.panelSynthesis.createEl("button", { text: "📂 Browse & Select Notes", cls: "dv-btn-browse" });
    browseBtn.onclick = () => this.openNotePicker();

    // Synthesis type
    this.panelSynthesis.createEl("p", { text: "SYNTHESIS TYPE", cls: "dv-section-label dv-section-label-top" });
    const synthGrid = this.panelSynthesis.createDiv("dv-synth-grid");

    const synthActions = [
      { icon: "📝", label: "Summarize All", action: "synth-summarize", desc: "Combined summary" },
      { icon: "🔍", label: "Compare", action: "synth-compare", desc: "Similarities & differences" },
      { icon: "🧩", label: "Connect", action: "synth-connect", desc: "Find common themes" },
      { icon: "📖", label: "Lit Review", action: "synth-litreview", desc: "Academic overview" },
    ];

    for (const a of synthActions) {
      const card = synthGrid.createDiv("dv-action-card");
      card.createEl("span", { text: a.icon, cls: "dv-action-icon" });
      card.createEl("span", { text: a.label, cls: "dv-action-label" });
      card.createEl("span", { text: a.desc, cls: "dv-action-desc" });
      card.onclick = () => this.runSynthesis(a.action);
    }

    // Response
    this.panelSynthesis.createEl("p", { text: "SYNTHESIS RESULT", cls: "dv-section-label dv-section-label-top" });
    const synthResponseWrap = this.panelSynthesis.createDiv("dv-response-wrap");
    const synthResponse = synthResponseWrap.createDiv("dv-response");
    synthResponse.createEl("p", { text: "Select notes and choose a synthesis type.", cls: "dv-placeholder" });
    (this as any)._synthResponseEl = synthResponse;

    const synthExportRow = this.panelSynthesis.createDiv("dv-export-row dv-hidden");
    const synthExportBtn = synthExportRow.createEl("button", { text: "💾 Save Synthesis as Note", cls: "dv-btn-export" });
    synthExportBtn.onclick = () => this.exportToNote((this as any)._lastSynthResponse ?? "", "Synthesis");
    (this as any)._synthExportRow = synthExportRow;
  }

  private openNotePicker() {
    const files = this.app.vault.getMarkdownFiles();
    new NoteSuggestModal(this.app, files, (selected: TFile[]) => {
      (this as any)._selectedNotes = selected;
      this.updateSelectedNotesUI();
    }).open();
  }

  private updateSelectedNotesUI() {
    const area = (this as any)._selectedArea as HTMLElement;
    area.empty();
    const notes = (this as any)._selectedNotes as TFile[];
    if (notes.length === 0) {
      area.createEl("p", { text: "No notes selected yet.", cls: "dv-placeholder" });
      return;
    }
    area.createEl("p", { text: `${notes.length} note${notes.length > 1 ? "s" : ""} selected:`, cls: "dv-selected-count" });
    for (const f of notes) {
      const tag = area.createDiv("dv-note-tag");
      tag.createEl("span", { text: f.basename });
      const removeBtn = tag.createEl("span", { text: " ✕", cls: "dv-note-tag-remove" });
      removeBtn.onclick = () => {
        (this as any)._selectedNotes = notes.filter((n: TFile) => n !== f);
        this.updateSelectedNotesUI();
      };
    }
  }

  private async runSynthesis(action: string) {
    const notes = (this as any)._selectedNotes as TFile[];
    if (notes.length < 2) {
      new Notice("Please select at least 2 notes to synthesize.");
      return;
    }

    const synthResponseEl = (this as any)._synthResponseEl as HTMLElement;
    synthResponseEl.empty();
    synthResponseEl.createEl("p", { text: "⏳ Synthesizing notes...", cls: "dv-thinking" });
    this.setStatus("⏳ Synthesizing...");

    // Read all note contents
    const noteContents: string[] = [];
    for (const file of notes) {
      const content = await this.app.vault.read(file);
      noteContents.push(`## ${file.basename}\n\n${content.slice(0, 2000)}`);
    }

    const combinedNotes = noteContents.join("\n\n---\n\n");

    const prompts: Record<string, string> = {
      "synth-summarize": `Provide a unified summary across all these research notes, highlighting the most important ideas from each:\n\n${combinedNotes}`,
      "synth-compare": `Compare and contrast these research notes. What are the key similarities and differences?\n\n${combinedNotes}`,
      "synth-connect": `Identify the common themes, connections, and patterns across these research notes:\n\n${combinedNotes}`,
      "synth-litreview": `Write a structured literature review based on these notes, as if preparing an academic overview of the topic:\n\n${combinedNotes}`,
    };

    if (!this.plugin.settings.apiKey) {
      synthResponseEl.empty();
      synthResponseEl.createEl("p", { text: "⚠️ Add your API key in Settings → Deep Vault", cls: "dv-error" });
      this.setStatus("");
      return;
    }

    try {
      const result = await callClaude(this.plugin.settings, [{ role: "user", content: prompts[action] }], false);
      synthResponseEl.empty();
      renderMarkdown(synthResponseEl, result);
      (this as any)._lastSynthResponse = result;
      (this as any)._synthExportRow.removeClass("dv-hidden");
      this.chatHistory.push({ role: "assistant", content: result, timestamp: new Date() });
    } catch (err) {
      synthResponseEl.empty();
      synthResponseEl.createEl("p", { text: `❌ ${err.message}`, cls: "dv-error" });
    }

    this.setStatus("");
  }


  // ─── Templates Panel (v3.0.1) ─────────────────────────────────────────────

  private buildPanelTemplates(root: HTMLElement) {
    this.panelTemplates = root.createDiv("dv-panel");
  }

  private renderTemplates() {
    this.panelTemplates.empty();

    // Header row
    const headerRow = this.panelTemplates.createDiv("dv-templates-header");
    headerRow.createEl("p", { text: "MY TEMPLATES", cls: "dv-section-label" });
    const newBtn = headerRow.createEl("button", { text: "+ New", cls: "dv-btn-new-template" });
    newBtn.onclick = () => this.openTemplateEditor();

    const templates = this.plugin.settings.templates;

    if (templates.length === 0) {
      const empty = this.panelTemplates.createDiv("dv-empty-state");
      empty.createEl("p", { text: "📝", cls: "dv-empty-icon" });
      empty.createEl("p", { text: "No templates yet", cls: "dv-empty-title" });
      empty.createEl("p", { text: "Create your first reusable prompt template", cls: "dv-empty-desc" });
      return;
    }

    // Template cards
    const list = this.panelTemplates.createDiv("dv-template-list");
    for (const tpl of templates) {
      this.renderTemplateCard(list, tpl);
    }

    // Tip
    this.panelTemplates.createEl("p", {
      text: "💡 Tip: Templates with Note Context use your open note as input.",
      cls: "dv-template-tip"
    });
  }

  private renderTemplateCard(container: HTMLElement, tpl: PromptTemplate) {
    const card = container.createDiv("dv-template-card");

    const cardTop = card.createDiv("dv-template-card-top");
    cardTop.createEl("span", { text: tpl.icon, cls: "dv-template-icon" });
    const cardInfo = cardTop.createDiv("dv-template-info");
    cardInfo.createEl("p", { text: tpl.name, cls: "dv-template-name" });
    cardInfo.createEl("p", { text: tpl.prompt.slice(0, 60) + (tpl.prompt.length > 60 ? "..." : ""), cls: "dv-template-preview" });

    const cardBadge = cardTop.createDiv("dv-template-badges");
    if (tpl.useNoteContext) {
      cardBadge.createEl("span", { text: "📄 Note", cls: "dv-template-badge" });
    }

    const cardActions = card.createDiv("dv-template-card-actions");

    const runBtn = cardActions.createEl("button", { text: "▶ Run", cls: "dv-btn-run-template" });
    runBtn.onclick = () => this.runTemplate(tpl);

    const editBtn = cardActions.createEl("button", { text: "✏️ Edit", cls: "dv-btn-ghost-sm" });
    editBtn.onclick = () => this.openTemplateEditor(tpl);

    const deleteBtn = cardActions.createEl("button", { text: "🗑", cls: "dv-btn-ghost-sm dv-btn-delete" });
    deleteBtn.onclick = async () => {
      this.plugin.settings.templates = this.plugin.settings.templates.filter(t => t.id !== tpl.id);
      await this.plugin.saveSettings();
      this.renderTemplates();
      new Notice(`Template "${tpl.name}" deleted.`);
    };
  }

  private openTemplateEditor(existing?: PromptTemplate) {
    new TemplateEditorModal(this.app, existing, async (tpl: PromptTemplate) => {
      if (existing) {
        const idx = this.plugin.settings.templates.findIndex(t => t.id === existing.id);
        if (idx !== -1) this.plugin.settings.templates[idx] = tpl;
      } else {
        this.plugin.settings.templates.push(tpl);
      }
      await this.plugin.saveSettings();
      this.renderTemplates();
      new Notice(`Template "${tpl.name}" ${existing ? "updated" : "created"}!`);
    }).open();
  }

  private async runTemplate(tpl: PromptTemplate) {
    const note = this.getCurrentNote();

    if (tpl.useNoteContext && !note) {
      new Notice("This template needs an open note. Please open a note first.");
      return;
    }

    // Switch to research tab to show result
    this.switchTab("research");

    const prompt = tpl.useNoteContext && note
      ? `${tpl.prompt}\n\n# ${note.title}\n\n${note.content.slice(0, 3000)}`
      : tpl.prompt;

    this.setStatus(`⏳ Running "${tpl.name}"...`);
    this.responseEl.empty();
    this.responseEl.createEl("p", { text: `⏳ Running template: ${tpl.icon} ${tpl.name}...`, cls: "dv-thinking" });
    (this as any)._exportRow?.addClass("dv-hidden");

    if (!this.plugin.settings.apiKey) {
      this.responseEl.empty();
      this.responseEl.createEl("p", { text: "⚠️ Add your API key in Settings → Deep Vault", cls: "dv-error" });
      this.setStatus("");
      return;
    }

    try {
      const result = await callClaude(this.plugin.settings, [{ role: "user", content: prompt }], false);
      this.responseEl.empty();
      renderMarkdown(this.responseEl, result);
      this.lastResponse = result;
      (this as any)._exportRow?.removeClass("dv-hidden");
      this.chatHistory.push({
        role: "user",
        content: `[Template: ${tpl.name}]${note ? ` on note "${note.title}"` : ""}`,
        timestamp: new Date(),
        noteTitle: note?.title
      });
      this.chatHistory.push({ role: "assistant", content: result, timestamp: new Date() });
    } catch (err) {
      this.responseEl.empty();
      this.responseEl.createEl("p", { text: `❌ ${err.message}`, cls: "dv-error" });
    }
    this.setStatus("");
  }


  // ─── Vault-Wide Search Panel (v3.0.3) ────────────────────────────────────

  private buildPanelSearch(root: HTMLElement) {
    this.panelSearch = root.createDiv("dv-panel");

    // Header
    this.panelSearch.createEl("p", { text: "VAULT-WIDE SEARCH", cls: "dv-section-label" });
    this.panelSearch.createEl("p", {
      text: "Ask Claude anything — it will search across all your notes to find the answer.",
      cls: "dv-search-desc"
    });

    // Search input
    const searchBox = this.panelSearch.createDiv("dv-search-box");
    const searchInput = searchBox.createEl("textarea", {
      cls: "dv-search-input",
      attr: { placeholder: "e.g. What do my notes say about machine learning? Which notes mention climate change? Summarise everything I know about quantum computing..." }
    });

    searchInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        runSearch();
      }
    });

    // Options row
    const optionsRow = this.panelSearch.createDiv("dv-search-options");

    // Folder filter
    const folderLabel = optionsRow.createEl("label", { text: "Folder filter (optional):", cls: "dv-search-option-label" });
    const folderInput = optionsRow.createEl("input", {
      cls: "dv-search-folder-input",
      attr: { type: "text", placeholder: "e.g. Research/" }
    });

    // Max notes slider
    const maxLabel = optionsRow.createEl("label", { cls: "dv-search-option-label" });
    const maxSlider = optionsRow.createEl("input", {
      cls: "dv-search-slider",
      attr: { type: "range", min: "5", max: "50", value: "20" }
    }) as HTMLInputElement;
    const updateMaxLabel = () => maxLabel.setText(`Max notes to search: ${maxSlider.value}`);
    updateMaxLabel();
    maxSlider.addEventListener("input", updateMaxLabel);

    // Search button
    const searchBtn = this.panelSearch.createEl("button", { text: "🔍 Search Vault", cls: "dv-btn-search" });

    // Stats bar
    const statsEl = this.panelSearch.createDiv("dv-search-stats dv-hidden");
    (this as any)._searchStatsEl = statsEl;

    // Results area
    this.panelSearch.createEl("p", { text: "RESULTS", cls: "dv-section-label dv-section-label-top" });
    const resultsWrap = this.panelSearch.createDiv("dv-response-wrap");
    const resultsEl = resultsWrap.createDiv("dv-response");
    resultsEl.createEl("p", { text: "Enter a question above to search across your vault.", cls: "dv-placeholder" });
    (this as any)._searchResultsEl = resultsEl;

    // Sources area
    const sourcesEl = this.panelSearch.createDiv("dv-search-sources dv-hidden");
    (this as any)._sourcesEl = sourcesEl;

    // Export row
    const searchExportRow = this.panelSearch.createDiv("dv-export-row dv-hidden");
    searchExportRow.createEl("button", { text: "💾 Save Results as Note", cls: "dv-btn-export" })
      .onclick = () => this.exportToNote((this as any)._lastSearchResult ?? "", "Vault Search Results");
    (this as any)._searchExportRow = searchExportRow;

    const runSearch = () => {
      const query = searchInput.value.trim();
      if (!query) { new Notice("Please enter a search query."); return; }
      const folder = folderInput.value.trim();
      const maxNotes = parseInt(maxSlider.value);
      this.runVaultSearch(query, folder, maxNotes);
    };

    searchBtn.onclick = runSearch;
  }

  private async runVaultSearch(query: string, folderFilter: string, maxNotes: number) {
    const resultsEl = (this as any)._searchResultsEl as HTMLElement;
    const statsEl = (this as any)._searchStatsEl as HTMLElement;
    const sourcesEl = (this as any)._sourcesEl as HTMLElement;
    const exportRow = (this as any)._searchExportRow as HTMLElement;

    if (!this.plugin.settings.apiKey) {
      resultsEl.empty();
      resultsEl.createEl("p", { text: "⚠️ Add your API key in Settings → Deep Vault", cls: "dv-error" });
      return;
    }

    // Reset UI
    resultsEl.empty();
    resultsEl.createEl("p", { text: "⏳ Scanning vault...", cls: "dv-thinking" });
    statsEl.addClass("dv-hidden");
    sourcesEl.addClass("dv-hidden");
    exportRow.addClass("dv-hidden");
    this.setStatus("⏳ Searching vault...");

    // Get all markdown files, optionally filtered by folder
    let files = this.app.vault.getMarkdownFiles();
    if (folderFilter) {
      files = files.filter(f => f.path.startsWith(folderFilter));
    }

    if (files.length === 0) {
      resultsEl.empty();
      resultsEl.createEl("p", { text: `❌ No notes found${folderFilter ? ` in folder "${folderFilter}"` : ""}.`, cls: "dv-error" });
      this.setStatus("");
      return;
    }

    // Score and rank notes by keyword relevance first
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const scored = files.map(file => {
      const cache = this.app.metadataCache.getFileCache(file);
      const headings = cache?.headings?.map(h => h.heading.toLowerCase()).join(" ") ?? "";
      const tags = cache?.tags?.map(t => t.tag).join(" ") ?? "";
      const score = keywords.reduce((acc, kw) => {
        if (file.basename.toLowerCase().includes(kw)) acc += 3;
        if (headings.includes(kw)) acc += 2;
        if (tags.includes(kw)) acc += 2;
        return acc;
      }, 0);
      return { file, score };
    });

    // Sort by relevance, take top N
    const topFiles = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxNotes)
      .map(s => s.file);

    // Update status
    resultsEl.empty();
    resultsEl.createEl("p", { text: `⏳ Reading ${topFiles.length} notes...`, cls: "dv-thinking" });

    // Read note contents
    const noteChunks: string[] = [];
    const sourceNames: string[] = [];

    for (const file of topFiles) {
      try {
        const content = await this.app.vault.read(file);
        const excerpt = content.slice(0, 800).trim();
        if (excerpt.length > 50) {
          noteChunks.push(`## ${file.basename}\n\n${excerpt}`);
          sourceNames.push(file.basename);
        }
      } catch { /* skip unreadable files */ }
    }

    if (noteChunks.length === 0) {
      resultsEl.empty();
      resultsEl.createEl("p", { text: "❌ Could not read any matching notes.", cls: "dv-error" });
      this.setStatus("");
      return;
    }

    // Update status
    resultsEl.empty();
    resultsEl.createEl("p", { text: `⏳ Asking Claude to synthesize ${noteChunks.length} notes...`, cls: "dv-thinking" });

    const prompt = `You are searching across a user's Obsidian vault to answer their query.

Query: "${query}"

Below are excerpts from ${noteChunks.length} relevant notes. Synthesize a clear, well-structured answer based on what these notes contain. Always cite which notes you're drawing from.

If the notes don't contain enough information to answer the query, say so clearly.

---

${noteChunks.join("\n\n---\n\n")}`;

    try {
      const result = await callClaude(this.plugin.settings, [{ role: "user", content: prompt }], false);

      // Show results
      resultsEl.empty();
      renderMarkdown(resultsEl, result);
      (this as any)._lastSearchResult = result;

      // Show stats
      statsEl.removeClass("dv-hidden");
      statsEl.empty();
      statsEl.createEl("span", { text: `📊 Searched ${noteChunks.length} of ${files.length} notes`, cls: "dv-search-stat" });

      // Show sources
      sourcesEl.removeClass("dv-hidden");
      sourcesEl.empty();
      sourcesEl.createEl("p", { text: "SOURCES", cls: "dv-section-label" });
      const sourceGrid = sourcesEl.createDiv("dv-source-grid");
      sourceNames.slice(0, 12).forEach(name => {
        const chip = sourceGrid.createEl("span", { text: name, cls: "dv-source-chip" });
        chip.onclick = async () => {
          const file = this.app.vault.getMarkdownFiles().find(f => f.basename === name);
          if (file) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
          }
        };
      });
      if (sourceNames.length > 12) {
        sourceGrid.createEl("span", { text: `+${sourceNames.length - 12} more`, cls: "dv-source-chip dv-source-more" });
      }

      // Show export
      exportRow.removeClass("dv-hidden");

      // Add to history
      this.chatHistory.push({ role: "user", content: `[Vault Search] "${query}"`, timestamp: new Date() });
      this.chatHistory.push({ role: "assistant", content: result, timestamp: new Date() });

    } catch (err) {
      resultsEl.empty();
      resultsEl.createEl("p", { text: `❌ ${err.message}`, cls: "dv-error" });
    }

    this.setStatus("");
  }

  // ─── History Panel ────────────────────────────────────────────────────────

  private buildPanelHistory(root: HTMLElement) {
    this.panelHistory = root.createDiv("dv-panel");
    this.panelHistoryTop = this.panelHistory.createDiv("dv-panel-history-top");
    this.panelHistoryBottom = this.panelHistory.createDiv("dv-panel-history-bottom");
  }

  private getAssignedHotkey(commandId: string): string | null {
    // hotkeyManager is an internal, undocumented API — not present in PluginManifest types.
    const hotkeyManager = (this.app as any).hotkeyManager;
    if (!hotkeyManager) return null;

    const hotkeys = hotkeyManager.getHotkeys(commandId) ?? hotkeyManager.getDefaultHotkeys(commandId);
    if (!hotkeys || hotkeys.length === 0) return null;

    const modifierLabels: Record<string, string> = {
      Mod: Platform.isMacOS ? "Cmd" : "Ctrl",
      Ctrl: "Ctrl",
      Meta: Platform.isMacOS ? "Cmd" : "Win",
      Shift: "Shift",
      Alt: Platform.isMacOS ? "Option" : "Alt",
    };

    return hotkeys
      .map((hk: { modifiers: string[]; key: string }) =>
        [...hk.modifiers.map(m => modifierLabels[m] ?? m), hk.key.toUpperCase()].join(" + ")
      )
      .join(", ");
  }

  private renderHotkeys() {
    const panel = this.panelHistoryTop;
    panel.empty();

    panel.createEl("p", { text: "KEYBOARD SHORTCUTS", cls: "dv-section-label" });
    panel.createEl("p", { text: "Assign hotkeys in Settings → Hotkeys → search Deep Vault", cls: "dv-hotkey-hint" });

    const shortcuts = [
      { cmd: "Open Deep Vault panel", id: "open-deep-vault", cat: "Navigation" },
      { cmd: "Deep Vault: Go to Research tab", id: "deep-vault-tab-research", cat: "Navigation" },
      { cmd: "Deep Vault: Go to Chat tab", id: "deep-vault-tab-chat", cat: "Navigation" },
      { cmd: "Deep Vault: Go to Synthesis tab", id: "deep-vault-tab-synthesis", cat: "Navigation" },
      { cmd: "Deep Vault: Go to Templates tab", id: "deep-vault-tab-templates", cat: "Navigation" },
      { cmd: "Deep Vault: Go to Search tab", id: "deep-vault-tab-search", cat: "Navigation" },
      { cmd: "Deep Vault: Go to History tab", id: "deep-vault-tab-history", cat: "Navigation" },
      { cmd: "Deep Vault: Summarise current note", id: "deep-vault-summarize", cat: "Actions" },
      { cmd: "Deep Vault: Generate research questions", id: "deep-vault-questions", cat: "Actions" },
      { cmd: "Deep Vault: Extract key concepts", id: "deep-vault-concepts", cat: "Actions" },
      { cmd: "Deep Vault: Find research gaps", id: "deep-vault-gaps", cat: "Actions" },
      { cmd: "Deep Vault: Auto-tag current note", id: "deep-vault-autotag", cat: "Actions" },
      { cmd: "Deep Vault: Generate daily research digest", id: "deep-vault-daily-digest", cat: "Digest" },
      { cmd: "Deep Vault: Search vault", id: "deep-vault-search", cat: "Search" },
      { cmd: "Deep Vault: Open setup wizard", id: "deep-vault-setup-wizard", cat: "Setup" },
    ];

    const cats = [...new Set(shortcuts.map(s => s.cat))];
    for (const cat of cats) {
      panel.createEl("p", { text: cat.toUpperCase(), cls: "dv-section-label dv-section-label-top" });
      const table = panel.createEl("table", { cls: "dv-hotkey-table" });
      shortcuts.filter(s => s.cat === cat).forEach(s => {
        const row = table.createEl("tr");
        row.createEl("td", { text: s.cmd, cls: "dv-hotkey-cmd" });
        const keyText = this.getAssignedHotkey(`${this.plugin.manifest.id}:${s.id}`);
        row.createEl("td", { text: keyText ?? "Not set", cls: keyText ? "dv-hotkey-key" : "dv-hotkey-key dv-hotkey-key-unset" });
      });
    }

    const wizardBtn = panel.createEl("button", { text: "🧙 Re-run Setup Wizard", cls: "dv-btn-ghost dv-hotkey-wizard-btn" });
    wizardBtn.onclick = () => new SetupWizardModal(this.app, this.plugin).open();

    panel.createEl("p", { text: "ABOUT", cls: "dv-section-label dv-section-label-top" });
    const about = panel.createDiv("dv-about");
    about.createEl("p", { text: `Deep Vault v${this.plugin.manifest.version}`, cls: "dv-about-version" });
    about.createEl("p", { text: "© 2026 Sunny Santhosh. Licensed under the MIT License.", cls: "dv-about-copyright" });
    const links = about.createDiv("dv-about-links");
    const githubLink = links.createEl("a", { text: "GitHub", href: this.plugin.manifest.authorUrl, cls: "dv-about-link" });
    githubLink.setAttr("target", "_blank");
    githubLink.setAttr("rel", "noopener");
    const fundingLink = links.createEl("a", { text: "☕ Support", href: (this.plugin.manifest as any).fundingUrl, cls: "dv-about-link" });
    fundingLink.setAttr("target", "_blank");
    fundingLink.setAttr("rel", "noopener");
  }

  private renderHistory() {
    this.panelHistoryBottom.empty();
    this.panelHistoryBottom.createEl("p", { text: "SESSION HISTORY", cls: "dv-section-label" });

    if (this.chatHistory.length === 0) {
      const empty = this.panelHistoryBottom.createDiv("dv-empty-state");
      empty.createEl("p", { text: "📭", cls: "dv-empty-icon" });
      empty.createEl("p", { text: "No history yet", cls: "dv-empty-title" });
      empty.createEl("p", { text: "Start a conversation in Chat or run a Quick Action", cls: "dv-empty-desc" });
      return;
    }

    // Export all history button
    const exportAllBtn = this.panelHistoryBottom.createEl("button", { text: "💾 Export Full History as Note", cls: "dv-btn-export" });
    exportAllBtn.onclick = () => this.exportHistoryToNote();

    const list = this.panelHistoryBottom.createDiv("dv-history-list");
    for (const msg of [...this.chatHistory].reverse()) {
      const item = list.createDiv(`dv-history-item dv-history-${msg.role}`);
      const itemHeader = item.createDiv("dv-history-item-header");
      itemHeader.createEl("span", { text: msg.role === "user" ? "You" : "Claude", cls: "dv-history-role" });
      itemHeader.createEl("span", { text: formatTime(msg.timestamp), cls: "dv-history-time" });
      if (msg.noteTitle) item.createEl("span", { text: `📄 ${msg.noteTitle}`, cls: "dv-history-note" });
      item.createEl("p", { text: msg.content.slice(0, 140) + (msg.content.length > 140 ? "..." : ""), cls: "dv-history-preview" });

      // Individual export
      const saveBtn = item.createEl("button", { text: "💾 Save", cls: "dv-btn-save-small" });
      saveBtn.onclick = () => this.exportToNote(msg.content, msg.role === "user" ? "My Question" : "Claude Response");
    }

    const clearBtn = this.panelHistoryBottom.createEl("button", { text: "🗑 Clear All History", cls: "dv-btn-danger" });
    clearBtn.onclick = () => { this.chatHistory = []; this.renderHistory(); new Notice("History cleared."); };
  }

  // ─── Export to Note (v2.2) ────────────────────────────────────────────────

  private async exportToNote(content: string, label: string) {
    if (!content.trim()) { new Notice("Nothing to export."); return; }

    const folder = this.plugin.settings.exportFolder;
    const date = formatDate(new Date());
    const time = formatTime(new Date()).replace(":", "-");
    const filename = `${folder}/${label} - ${date} ${time}.md`;

    const noteContent = `---
created: ${new Date().toISOString()}
source: Deep Vault
type: ${label}
---

# ${label}
*Exported from Deep Vault on ${date}*

---

${content}
`;

    try {
      // Ensure folder exists
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
      await this.app.vault.create(filename, noteContent);
      new Notice(`✅ Saved to "${filename}"`);

      // Open the new note
      const file = this.app.vault.getAbstractFileByPath(filename) as TFile;
      if (file) {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.openFile(file);
      }
    } catch (err) {
      new Notice(`❌ Export failed: ${err.message}`);
    }
  }

  private async exportHistoryToNote() {
    if (this.chatHistory.length === 0) { new Notice("No history to export."); return; }

    const lines: string[] = [
      `---`,
      `created: ${new Date().toISOString()}`,
      `source: Deep Vault`,
      `type: Session History`,
      `---`,
      ``,
      `# Deep Vault Session — ${formatDate(new Date())}`,
      ``,
    ];

    for (const msg of this.chatHistory) {
      lines.push(`## ${msg.role === "user" ? "🧑 You" : "🤖 Claude"} — ${formatTime(msg.timestamp)}`);
      if (msg.noteTitle) lines.push(`*Context: ${msg.noteTitle}*`);
      lines.push("");
      lines.push(msg.content);
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    await this.exportToNote(lines.join("\n"), "Session History");
  }

  // ─── API Calls ────────────────────────────────────────────────────────────

  private getCurrentNote(): { content: string; title: string } | null {
    // Try the active MarkdownView first (works when a note is directly focused)
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active?.file) return { content: active.editor.getValue(), title: active.file.basename };

    // Deep Vault panel is focused so getActiveViewOfType returns null.
    // getLeavesOfType uses the view-type string — reliable across bundled environments
    // unlike instanceof which can fail when class references differ between bundles.
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const view = leaf.view as MarkdownView;
      if (view.file) return { content: view.editor.getValue(), title: view.file.basename };
    }
    return null;
  }

  private getCurrentFile(): TFile | null {
    // Same fallback as getCurrentNote — getActiveViewOfType returns null
    // whenever the Deep Vault panel itself is focused.
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active?.file) return active.file;

    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const view = leaf.view as MarkdownView;
      if (view.file) return view.file;
    }
    return null;
  }

  private setStatus(msg: string) {
    this.statusEl.empty();
    if (msg) this.statusEl.createEl("span", { text: msg, cls: "dv-status-text" });
  }

  private async runQuickAction(action: string) {
    const note = this.getCurrentNote();
    if (!note) { new Notice("Please open a note first."); return; }

    // Auto-tag has its own dedicated flow
    if (action === "autotag") {
      await this.runAutoTag(note);
      return;
    }

    const prompts: Record<string, string> = {
      summarize: `Summarize this research note in 5 clear bullet points:\n\n# ${note.title}\n\n${note.content}`,
      questions: `Generate 6 insightful research questions to explore next:\n\n# ${note.title}\n\n${note.content}`,
      concepts: `Extract and briefly explain the 6 most important concepts or terms:\n\n# ${note.title}\n\n${note.content}`,
      gaps: `Identify research gaps, missing evidence, and areas needing investigation:\n\n# ${note.title}\n\n${note.content}`,
      connections: `Suggest 5 ways this note connects to other research areas. Be specific:\n\n# ${note.title}\n\n${note.content}`,
      literature: `Suggest 5 related academic topics, authors, or research areas:\n\n# ${note.title}\n\n${note.content}`,
    };

    const labels: Record<string, string> = {
      summarize: "⏳ Summarizing...", questions: "⏳ Generating questions...",
      concepts: "⏳ Extracting concepts...", gaps: "⏳ Finding gaps...",
      connections: "⏳ Finding connections...", literature: "⏳ Researching literature...",
    };

    this.setStatus(labels[action]);
    this.responseEl.empty();
    this.responseEl.createEl("p", { text: labels[action], cls: "dv-thinking" });
    (this as any)._exportRow?.addClass("dv-hidden");

    if (!this.plugin.settings.apiKey) {
      this.responseEl.empty();
      this.responseEl.createEl("p", { text: "⚠️ Add your API key in Settings → Deep Vault", cls: "dv-error" });
      this.setStatus("");
      return;
    }

    try {
      const result = await callClaude(this.plugin.settings, [{ role: "user", content: prompts[action] }], false);
      this.responseEl.empty();
      renderMarkdown(this.responseEl, result);
      this.lastResponse = result;
      (this as any)._exportRow?.removeClass("dv-hidden");
      this.chatHistory.push({ role: "user", content: `[Quick Action: ${action}] on note "${note.title}"`, timestamp: new Date(), noteTitle: note.title });
      this.chatHistory.push({ role: "assistant", content: result, timestamp: new Date() });
    } catch (err) {
      this.responseEl.empty();
      this.responseEl.createEl("p", { text: `❌ ${err.message}`, cls: "dv-error" });
    }
    this.setStatus("");
  }


  // ─── Auto-Tag Notes (v3.0.2) ──────────────────────────────────────────────

  private async runAutoTag(note: { content: string; title: string }) {
    this.setStatus("⏳ Analysing note for tags...");
    this.responseEl.empty();
    this.responseEl.createEl("p", { text: "⏳ Asking Claude to suggest tags...", cls: "dv-thinking" });

    if (!this.plugin.settings.apiKey) {
      this.responseEl.empty();
      this.responseEl.createEl("p", { text: "⚠️ Add your API key in Settings → Deep Vault", cls: "dv-error" });
      this.setStatus("");
      return;
    }

    // Get existing vault tags to help Claude suggest consistent ones
    const existingTags = this.getVaultTags();
    const existingTagsStr = existingTags.length > 0
      ? `\n\nExisting tags in this vault (prefer these where relevant): ${existingTags.slice(0, 40).join(", ")}`
      : "";

    const prompt = `Analyse this note and suggest 5-8 relevant tags for it.${existingTagsStr}

Rules:
- Return ONLY a JSON array of tag strings, nothing else
- Tags should be lowercase, use hyphens for spaces (e.g. "machine-learning")
- No # symbol prefix
- Mix specific and broad tags
- Example output: ["research", "machine-learning", "neural-networks", "deep-learning", "ai", "paper-notes"]

Note to analyse:
# ${note.title}

${note.content.slice(0, 2000)}`;

    try {
      const result = await callClaude(this.plugin.settings, [{ role: "user", content: prompt }], false);

      // Parse the JSON tag array from Claude's response
      const jsonMatch = result.match(/\[.*?\]/s);
      if (!jsonMatch) throw new Error("Could not parse tags from response.");

      const suggestedTags: string[] = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(suggestedTags) || suggestedTags.length === 0) {
        throw new Error("No tags returned.");
      }

      this.setStatus("");
      this.responseEl.empty();

      // Show tag picker UI
      this.renderTagPicker(suggestedTags, note);

    } catch (err) {
      this.responseEl.empty();
      this.responseEl.createEl("p", { text: `❌ ${err.message}`, cls: "dv-error" });
      this.setStatus("");
    }
  }

  private getVaultTags(): string[] {
    const tags = new Set<string>();
    this.app.vault.getMarkdownFiles().forEach(file => {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.tags) cache.tags.forEach(t => tags.add(t.tag.replace("#", "")));
      if (cache?.frontmatter?.tags) {
        const ft = cache.frontmatter.tags;
        if (Array.isArray(ft)) ft.forEach((t: string) => tags.add(t));
        else if (typeof ft === "string") tags.add(ft);
      }
    });
    return Array.from(tags).sort();
  }

  private renderTagPicker(suggestedTags: string[], note: { content: string; title: string }) {
    this.responseEl.empty();

    this.responseEl.createEl("p", { text: "🏷 Suggested Tags", cls: "dv-autotag-title" });
    this.responseEl.createEl("p", { text: "Click tags to select, then apply to your note.", cls: "dv-autotag-hint" });

    const selected = new Set<string>(suggestedTags); // all selected by default
    const tagGrid = this.responseEl.createDiv("dv-tag-grid");

    const renderTags = () => {
      tagGrid.empty();
      for (const tag of suggestedTags) {
        const chip = tagGrid.createEl("button", {
          text: `#${tag}`,
          cls: selected.has(tag) ? "dv-tag-chip dv-tag-chip-selected" : "dv-tag-chip",
        });
        chip.onclick = () => {
          if (selected.has(tag)) selected.delete(tag);
          else selected.add(tag);
          renderTags();
          updateButtons();
        };
      }
    };

    renderTags();

    const btnRow = this.responseEl.createDiv("dv-autotag-btn-row");

    const selectAllBtn = btnRow.createEl("button", { text: "Select All", cls: "dv-btn-ghost-sm" });
    selectAllBtn.onclick = () => {
      suggestedTags.forEach(t => selected.add(t));
      renderTags();
      updateButtons();
    };

    const clearBtn = btnRow.createEl("button", { text: "Clear All", cls: "dv-btn-ghost-sm" });
    clearBtn.onclick = () => {
      selected.clear();
      renderTags();
      updateButtons();
    };

    const applyBtn = btnRow.createEl("button", { text: "✅ Apply to Note", cls: "dv-btn-primary" });
    applyBtn.onclick = () => this.applyTagsToNote(Array.from(selected), note);

    const updateButtons = () => {
      applyBtn.setText(`✅ Apply ${selected.size} Tag${selected.size !== 1 ? "s" : ""} to Note`);
      applyBtn.disabled = selected.size === 0;
    };

    updateButtons();
  }

  private async applyTagsToNote(tags: string[], note: { content: string; title: string }) {
    if (tags.length === 0) { new Notice("No tags selected."); return; }

    const file = this.getCurrentFile();
    if (!file) { new Notice("Could not find the active note."); return; }

    let content = await this.app.vault.read(file);

    // Check if frontmatter exists
    const hasFrontmatter = content.startsWith("---");

    if (hasFrontmatter) {
      // Find closing ---
      const endIdx = content.indexOf("---", 3);
      if (endIdx !== -1) {
        const frontmatter = content.slice(0, endIdx + 3);
        const rest = content.slice(endIdx + 3);

        if (frontmatter.includes("tags:")) {
          // Tags key exists — append to it
          const newFrontmatter = frontmatter.replace(
            /tags:(.*)/,
            (match: string) => {
              const existing = match.replace("tags:", "").trim();
              if (existing.startsWith("[")) {
                // Inline array style: tags: [a, b]
                const arr = existing.slice(1, -1).split(",").map((t: string) => t.trim()).filter(Boolean);
                tags.forEach(t => { if (!arr.includes(t)) arr.push(t); });
                return `tags: [${arr.join(", ")}]`;
              } else {
                // List style: tags: (with - item lines)
                const newTagLines = tags.map(t => `\n  - ${t}`).join("");
                return match + newTagLines;
              }
            }
          );
          content = newFrontmatter + rest;
        } else {
          // No tags key — add it
          const tagLines = tags.map(t => `  - ${t}`).join("\n");
          content = frontmatter.replace("---", `tags:\n${tagLines}\n---`).slice(0, -3) + rest;
        }
      }
    } else {
      // No frontmatter — create it
      const tagLines = tags.map(t => `  - ${t}`).join("\n");
      content = `---\ntags:\n${tagLines}\n---\n\n` + content;
    }

    await this.app.vault.modify(file, content);
    new Notice(`✅ Applied ${tags.length} tag${tags.length !== 1 ? "s" : ""} to "${note.title}"`);

    // Update response to confirm
    this.responseEl.empty();
    this.responseEl.createEl("p", { text: "✅ Tags Applied!", cls: "dv-autotag-title" });
    const appliedGrid = this.responseEl.createDiv("dv-tag-grid");
    tags.forEach(t => appliedGrid.createEl("span", { text: `#${t}`, cls: "dv-tag-chip dv-tag-chip-applied" }));
    this.responseEl.createEl("p", { text: `Added to frontmatter of "${note.title}"`, cls: "dv-autotag-hint" });
  }


  // ─── Daily Research Digest (v3.0.4) ──────────────────────────────────────

  private async runDailyDigest(days: number) {
    const digestResponseEl = (this as any)._digestResponseEl as HTMLElement;
    const digestExportRow = (this as any)._digestExportRow as HTMLElement;

    if (!this.plugin.settings.apiKey) {
      digestResponseEl.empty();
      digestResponseEl.createEl("p", { text: "⚠️ Add your API key in Settings → Deep Vault", cls: "dv-error" });
      return;
    }

    digestResponseEl.empty();
    digestResponseEl.createEl("p", { text: `⏳ Scanning notes from the last ${days} day${days > 1 ? "s" : ""}...`, cls: "dv-thinking" });
    digestExportRow.addClass("dv-hidden");
    this.setStatus("⏳ Generating digest...");

    // Find recently modified files
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentFiles = this.app.vault.getMarkdownFiles()
      .filter(f => f.stat.mtime > cutoff)
      .sort((a, b) => b.stat.mtime - a.stat.mtime);

    if (recentFiles.length === 0) {
      digestResponseEl.empty();
      digestResponseEl.createEl("p", {
        text: `📭 No notes modified in the last ${days} day${days > 1 ? "s" : ""}.`,
        cls: "dv-placeholder"
      });
      this.setStatus("");
      return;
    }

    // Take top 15 most recently modified
    const filesToDigest = recentFiles.slice(0, 15);

    digestResponseEl.empty();
    digestResponseEl.createEl("p", {
      text: `⏳ Reading ${filesToDigest.length} recently modified notes...`,
      cls: "dv-thinking"
    });

    // Read contents
    const noteChunks: string[] = [];
    for (const file of filesToDigest) {
      try {
        const content = await this.app.vault.read(file);
        const modDate = new Date(file.stat.mtime).toLocaleDateString();
        noteChunks.push(`## ${file.basename} (modified ${modDate})\n\n${content.slice(0, 600).trim()}`);
      } catch { /* skip */ }
    }

    digestResponseEl.empty();
    digestResponseEl.createEl("p", { text: "⏳ Asking Claude to generate digest...", cls: "dv-thinking" });

    const rangeLabel = days === 1 ? "the last 24 hours" : `the last ${days} days`;
    const prompt = `You are generating a daily research digest for an Obsidian user.

They have modified ${noteChunks.length} notes in ${rangeLabel}. Analyse these notes and create a structured digest with these sections:

## 📊 Overview
Brief summary of what they worked on (2-3 sentences).

## 💡 Key Ideas
The most important concepts or insights across all notes (bullet points).

## 🔗 Connections
Any interesting links or themes across different notes.

## ❓ Open Questions
Unresolved questions or areas that need more research.

## ✅ Suggested Next Steps
2-3 concrete things to do next based on this work.

Here are the notes:

${noteChunks.join("\n\n---\n\n")}`;

    try {
      const result = await callClaude(this.plugin.settings, [{ role: "user", content: prompt }], false);

      digestResponseEl.empty();
      renderMarkdown(digestResponseEl, result);
      (this as any)._lastDigestResult = result;
      (this as any)._lastDigestDays = days;
      (this as any)._lastDigestCount = filesToDigest.length;
      digestExportRow.removeClass("dv-hidden");

      // Add to history
      this.chatHistory.push({
        role: "user",
        content: `[Daily Digest] Last ${days} day${days > 1 ? "s" : ""} — ${filesToDigest.length} notes`,
        timestamp: new Date()
      });
      this.chatHistory.push({ role: "assistant", content: result, timestamp: new Date() });

    } catch (err) {
      digestResponseEl.empty();
      digestResponseEl.createEl("p", { text: `❌ ${err.message}`, cls: "dv-error" });
    }

    this.setStatus("");
  }

  private async exportDigestAsNote() {
    const result = (this as any)._lastDigestResult as string;
    const days = (this as any)._lastDigestDays as number;
    const count = (this as any)._lastDigestCount as number;
    if (!result) { new Notice("No digest to export."); return; }

    const dateStr = formatDate(new Date());
    const label = days === 1 ? "Daily" : days === 7 ? "Weekly" : "Monthly";
    const content = `---
created: ${new Date().toISOString()}
source: Deep Vault
type: Research Digest
period: Last ${days} day${days > 1 ? "s" : ""}
notes_reviewed: ${count}
---

# ${label} Research Digest — ${dateStr}

${result}
`;
    await this.exportToNote(content, `${label} Digest`);
  }

  private async callClaudeChat(messages: { role: string; content: string }[], useWeb: boolean) {
    if (!this.plugin.settings.apiKey) {
      this.addChatBubble("assistant", "⚠️ Please add your Anthropic API key in **Settings → Deep Vault**.");
      return;
    }
    const thinkingWrap = this.addChatBubble("assistant", "...");
    if (useWeb) {
      const statusMsg = thinkingWrap.querySelector(".dv-thinking");
      if (statusMsg) statusMsg.textContent = "🌐 Searching the web...";
    }

    try {
      const result = await callClaude(this.plugin.settings, messages, useWeb);
      thinkingWrap.remove();
      this.addChatBubble("assistant", result);
      this.chatHistory.push({ role: "assistant", content: result, timestamp: new Date() });
    } catch (err) {
      thinkingWrap.remove();
      this.addChatBubble("assistant", `❌ Error: ${err.message}`);
    }
  }

  async onClose() { }
}


// ─── Main Plugin ──────────────────────────────────────────────────────────────

export default class DeepVaultPlugin extends Plugin {
  settings: DeepVaultSettings;

  async onload() {
    await this.loadSettings();
    this.registerView(DEEP_VAULT_VIEW, (leaf) => new DeepVaultView(leaf, this));
    this.addRibbonIcon("search", "Deep Vault", () => this.activateView());

    // ── Core commands ────────────────────────────────────────────────────────
    this.addCommand({ id: "open-deep-vault", name: "Open Deep Vault panel", callback: () => this.activateView() });

    // ── Tab navigation commands ───────────────────────────────────────────────
    const tabCommands: { id: string; name: string; tab: string }[] = [
      { id: "deep-vault-tab-research", name: "Deep Vault: Go to Research tab", tab: "research" },
      { id: "deep-vault-tab-chat", name: "Deep Vault: Go to Chat tab", tab: "chat" },
      { id: "deep-vault-tab-synthesis", name: "Deep Vault: Go to Synthesis tab", tab: "synthesis" },
      { id: "deep-vault-tab-templates", name: "Deep Vault: Go to Templates tab", tab: "templates" },
      { id: "deep-vault-tab-search", name: "Deep Vault: Go to Search tab", tab: "search" },
      { id: "deep-vault-tab-history", name: "Deep Vault: Go to History tab", tab: "history" },
    ];

    for (const cmd of tabCommands) {
      this.addCommand({
        id: cmd.id,
        name: cmd.name,
        callback: async () => {
          await this.activateView();
          const view = this.app.workspace.getLeavesOfType(DEEP_VAULT_VIEW)[0]?.view as DeepVaultView;
          if (view) view.switchTabPublic(cmd.tab);
        }
      });
    }

    // ── Quick action commands ─────────────────────────────────────────────────
    const actionCommands: { id: string; name: string; action: string }[] = [
      { id: "deep-vault-summarize", name: "Deep Vault: Summarise current note", action: "summarize" },
      { id: "deep-vault-questions", name: "Deep Vault: Generate research questions", action: "questions" },
      { id: "deep-vault-concepts", name: "Deep Vault: Extract key concepts", action: "concepts" },
      { id: "deep-vault-gaps", name: "Deep Vault: Find research gaps", action: "gaps" },
      { id: "deep-vault-connections", name: "Deep Vault: Find connections", action: "connections" },
      { id: "deep-vault-autotag", name: "Deep Vault: Auto-tag current note", action: "autotag" },
    ];

    for (const cmd of actionCommands) {
      this.addCommand({
        id: cmd.id,
        name: cmd.name,
        editorCallback: async () => {
          await this.activateView();
          const view = this.app.workspace.getLeavesOfType(DEEP_VAULT_VIEW)[0]?.view as DeepVaultView;
          if (view) { view.switchTabPublic("research"); (view as any).runQuickAction(cmd.action); }
        }
      });
    }

    // ── Digest command ────────────────────────────────────────────────────────
    this.addCommand({
      id: "deep-vault-daily-digest",
      name: "Deep Vault: Generate daily research digest",
      callback: async () => {
        await this.activateView();
        const view = this.app.workspace.getLeavesOfType(DEEP_VAULT_VIEW)[0]?.view as DeepVaultView;
        if (view) { view.switchTabPublic("research"); (view as any).runDailyDigest(1); }
      }
    });

    // ── Vault search command ──────────────────────────────────────────────────
    this.addCommand({
      id: "deep-vault-search",
      name: "Deep Vault: Search vault",
      callback: async () => {
        await this.activateView();
        const view = this.app.workspace.getLeavesOfType(DEEP_VAULT_VIEW)[0]?.view as DeepVaultView;
        if (view) view.switchTabPublic("search");
      }
    });

    // ── Setup wizard ──────────────────────────────────────────────────────────
    this.addCommand({
      id: "deep-vault-setup-wizard",
      name: "Deep Vault: Open setup wizard",
      callback: () => new SetupWizardModal(this.app, this).open()
    });

    this.addSettingTab(new DeepVaultSettingTab(this.app, this));

    // Show wizard on first install
    this.app.workspace.onLayoutReady(() => {
      if (!this.settings.hasSeenWizard) {
        setTimeout(() => new SetupWizardModal(this.app, this).open(), 800);
      }
    });

    console.log("Deep Vault v3.1.2 loaded ✅");
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(DEEP_VAULT_VIEW)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: DEEP_VAULT_VIEW, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  onunload() { this.app.workspace.detachLeavesOfType(DEEP_VAULT_VIEW); }
  async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
  async saveSettings() { await this.saveData(this.settings); }
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

class DeepVaultSettingTab extends PluginSettingTab {
  plugin: DeepVaultPlugin;

  constructor(app: App, plugin: DeepVaultPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "🔍 Deep Vault Settings" });

    new Setting(containerEl)
      .setName("Anthropic API Key")
      .setDesc("Get your key from console.anthropic.com — stored locally, never shared.")
      .addText(text => text
        .setPlaceholder("sk-ant-...")
        .setValue(this.plugin.settings.apiKey)
        .onChange(async value => { this.plugin.settings.apiKey = value.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("Claude Model")
      .setDesc("Sonnet recommended for research. Haiku is faster and cheaper.")
      .addDropdown(drop => drop
        .addOption("claude-sonnet-4-20250514", "Claude Sonnet 4 (Recommended)")
        .addOption("claude-haiku-4-5-20251001", "Claude Haiku 4.5 (Faster)")
        .setValue(this.plugin.settings.model)
        .onChange(async value => { this.plugin.settings.model = value; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("Max Response Length")
      .setDesc("Higher = longer, more detailed responses.")
      .addSlider(slider => slider
        .setLimits(500, 4000, 250)
        .setValue(this.plugin.settings.maxTokens)
        .setDynamicTooltip()
        .onChange(async value => { this.plugin.settings.maxTokens = value; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("Enable Web Search")
      .setDesc("Allow Claude to search the web when the 🌐 Web button is active in Chat.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableWebSearch)
        .onChange(async value => { this.plugin.settings.enableWebSearch = value; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("Export Folder")
      .setDesc("Folder in your vault where exported notes will be saved.")
      .addText(text => text
        .setPlaceholder("Deep Vault Exports")
        .setValue(this.plugin.settings.exportFolder)
        .onChange(async value => { this.plugin.settings.exportFolder = value || "Deep Vault Exports"; await this.plugin.saveSettings(); }));

    containerEl.createEl("h3", { text: "What's New in v3.0" });
    const ul = containerEl.createEl("ul");
    ul.createEl("li", { text: "📝 Custom Templates — save and reuse your own prompts" });
    ul.createEl("li", { text: "🔗 Synthesis tab — combine & compare multiple notes" });
    ul.createEl("li", { text: "💾 Export any response directly as a new Obsidian note" });
    ul.createEl("li", { text: "🌐 Web search — Claude can search the internet from Chat" });
    ul.createEl("li", { text: "📋 History export — save your entire session as a note" });

    containerEl.createEl("h3", { text: "Prompt Templates" });
    const tplCount = this.plugin.settings.templates.length;
    containerEl.createEl("p", {
      text: `You have ${tplCount} template${tplCount !== 1 ? "s" : ""}. Manage them from the 📝 Templates tab in the Deep Vault panel.`,
      cls: "setting-item-description"
    });

    const resetBtn = containerEl.createEl("button", { text: "Reset to Default Templates", cls: "mod-warning" });
    resetBtn.style.marginTop = "8px";
    resetBtn.onclick = async () => {
      this.plugin.settings.templates = DEFAULT_TEMPLATES;
      await this.plugin.saveSettings();
      new Notice("Templates reset to defaults.");
      this.display();
    };
  }
}