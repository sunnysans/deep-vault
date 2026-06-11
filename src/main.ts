import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  ItemView,
  WorkspaceLeaf,
  TFile,
  SuggestModal,
  requestUrl,
} from "obsidian";
import { formatTime, formatDate, slugify } from "./utils/helpers";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEEP_VAULT_VIEW = "deep-vault-view";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  noteTitle?: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  icon: string;
  prompt: string;
  useNoteContext: boolean;
  createdAt: string;
}

interface DeepVaultSettings {
  apiKey: string;
  model: string;
  maxTokens: number;
  enableWebSearch: boolean;
  exportFolder: string;
  templates: PromptTemplate[];
  hasSeenWizard: boolean;
}

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: "tpl-1",
    name: "Executive Summary",
    icon: "📋",
    prompt: "Write a crisp executive summary of this note in 3 sentences, suitable for sharing with a non-expert audience:",
    useNoteContext: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-2",
    name: "Critical Analysis",
    icon: "🔬",
    prompt: "Critically analyse this note. What are the strongest arguments? What assumptions are made? What are the weakest points?",
    useNoteContext: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-3",
    name: "Explain Simply",
    icon: "🧒",
    prompt: "Explain the main ideas of this note as if explaining to a curious 12-year-old with no background knowledge:",
    useNoteContext: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-4",
    name: "Action Items",
    icon: "✅",
    prompt: "Based on this note, generate a prioritised list of concrete action items and next steps I should take:",
    useNoteContext: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-5",
    name: "Counter Arguments",
    icon: "⚔️",
    prompt: "Generate the strongest possible counter-arguments and opposing viewpoints to the ideas presented in this note:",
    useNoteContext: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-6",
    name: "Tweet Thread",
    icon: "🐦",
    prompt: "Turn the key ideas from this note into an engaging Twitter/X thread of 5 tweets. Make it accessible and interesting:",
    useNoteContext: true,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_SETTINGS: DeepVaultSettings = {
  apiKey: "",
  model: DEFAULT_MODEL,
  maxTokens: 2000,
  enableWebSearch: true,
  exportFolder: "Deep Vault Exports",
  templates: DEFAULT_TEMPLATES,
  hasSeenWizard: false,
};

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

// ─── Note Picker Modal ────────────────────────────────────────────────────────

class NoteSuggestModal extends SuggestModal<TFile> {
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

  onChooseSuggestion(file: TFile) {
    if (!this.selected.includes(file)) {
      this.selected.push(file);
      new Notice(`Added: ${file.basename} (${this.selected.length} selected)`);
    } else {
      this.selected = this.selected.filter(f => f !== file);
      new Notice(`Removed: ${file.basename}`);
    }
    if (this.selected.length > 0) {
      this.onSelect(this.selected);
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
      const result = await this.callClaude([{ role: "user", content: prompts[action] }], false);
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
      const result = await this.callClaude([{ role: "user", content: prompt }], false);
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
      const result = await this.callClaude([{ role: "user", content: prompt }], false);

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
  }

  private renderHotkeys() {
    const panel = this.panelHistory;
    panel.empty();

    panel.createEl("p", { text: "KEYBOARD SHORTCUTS", cls: "dv-section-label" });
    panel.createEl("p", { text: "Assign hotkeys in Settings → Hotkeys → search Deep Vault", cls: "dv-hotkey-hint" });

    const shortcuts = [
      { cmd: "Open Deep Vault panel", cat: "Navigation" },
      { cmd: "Deep Vault: Go to Research tab", cat: "Navigation" },
      { cmd: "Deep Vault: Go to Chat tab", cat: "Navigation" },
      { cmd: "Deep Vault: Go to Synthesis tab", cat: "Navigation" },
      { cmd: "Deep Vault: Go to Templates tab", cat: "Navigation" },
      { cmd: "Deep Vault: Go to Search tab", cat: "Navigation" },
      { cmd: "Deep Vault: Go to History tab", cat: "Navigation" },
      { cmd: "Deep Vault: Summarise current note", cat: "Actions" },
      { cmd: "Deep Vault: Generate research questions", cat: "Actions" },
      { cmd: "Deep Vault: Extract key concepts", cat: "Actions" },
      { cmd: "Deep Vault: Find research gaps", cat: "Actions" },
      { cmd: "Deep Vault: Auto-tag current note", cat: "Actions" },
      { cmd: "Deep Vault: Generate daily research digest", cat: "Digest" },
      { cmd: "Deep Vault: Search vault", cat: "Search" },
      { cmd: "Deep Vault: Open setup wizard", cat: "Setup" },
    ];

    const cats = [...new Set(shortcuts.map(s => s.cat))];
    for (const cat of cats) {
      panel.createEl("p", { text: cat.toUpperCase(), cls: "dv-section-label dv-section-label-top" });
      const table = panel.createEl("table", { cls: "dv-hotkey-table" });
      shortcuts.filter(s => s.cat === cat).forEach(s => {
        const row = table.createEl("tr");
        row.createEl("td", { text: s.cmd, cls: "dv-hotkey-cmd" });
      });
    }

    const wizardBtn = panel.createEl("button", { text: "🧙 Re-run Setup Wizard", cls: "dv-btn-ghost dv-hotkey-wizard-btn" });
    wizardBtn.onclick = () => new SetupWizardModal(this.app, this.plugin).open();
  }

  private renderHistory() {
    this.panelHistory.empty();
    this.panelHistory.createEl("p", { text: "SESSION HISTORY", cls: "dv-section-label" });

    if (this.chatHistory.length === 0) {
      const empty = this.panelHistory.createDiv("dv-empty-state");
      empty.createEl("p", { text: "📭", cls: "dv-empty-icon" });
      empty.createEl("p", { text: "No history yet", cls: "dv-empty-title" });
      empty.createEl("p", { text: "Start a conversation in Chat or run a Quick Action", cls: "dv-empty-desc" });
      return;
    }

    // Export all history button
    const exportAllBtn = this.panelHistory.createEl("button", { text: "💾 Export Full History as Note", cls: "dv-btn-export" });
    exportAllBtn.onclick = () => this.exportHistoryToNote();

    const list = this.panelHistory.createDiv("dv-history-list");
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

    const clearBtn = this.panelHistory.createEl("button", { text: "🗑 Clear All History", cls: "dv-btn-danger" });
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
      const result = await this.callClaude([{ role: "user", content: prompts[action] }], false);
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
      const result = await this.callClaude([{ role: "user", content: prompt }], false);

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

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.file) { new Notice("Could not find the active note."); return; }

    const file = view.file;
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
      const result = await this.callClaude([{ role: "user", content: prompt }], false);

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
      const result = await this.callClaude(messages, useWeb);
      thinkingWrap.remove();
      this.addChatBubble("assistant", result);
      this.chatHistory.push({ role: "assistant", content: result, timestamp: new Date() });
    } catch (err) {
      thinkingWrap.remove();
      this.addChatBubble("assistant", `❌ Error: ${err.message}`);
    }
  }

  private async callClaude(
    messages: { role: string; content: string }[],
    useWeb: boolean
  ): Promise<string> {
    const body: any = {
      model: this.plugin.settings.model,
      max_tokens: this.plugin.settings.maxTokens,
      system: "You are Deep Vault, an expert research assistant embedded in Obsidian. Help researchers analyze notes, extract insights, identify knowledge gaps, find connections, and synthesize ideas. Be concise, structured, and use markdown formatting. Use bullet points and headers to organize responses clearly.",
      messages,
    };

    if (useWeb && this.plugin.settings.enableWebSearch) {
      body.tools = [{ type: "web_search_20250305", name: "web_search" }];
    }

    // requestUrl is Obsidian's built-in HTTP client — works on desktop and mobile.
    // Native fetch() fails in Obsidian's Electron/Capacitor environment.
    const response = await requestUrl({
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.plugin.settings.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify(body),
      throw: false,
    });

    if (response.status !== 200) {
      const err = response.json;
      throw new Error(err?.error?.message ?? `API error ${response.status}`);
    }

    const data = response.json;
    return data.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n") || "No response received.";
  }

  async onClose() { }
}


// ─── Template Editor Modal ────────────────────────────────────────────────────

class TemplateEditorModal extends Modal {
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


// ─── Setup Wizard Modal ───────────────────────────────────────────────────────

class SetupWizardModal extends Modal {
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