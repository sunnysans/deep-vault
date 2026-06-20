import { Plugin } from "obsidian";
import {
  DEEP_VAULT_VIEW,
  DeepVaultSettings,
  DEFAULT_SETTINGS,
} from "./types";
import { SetupWizardModal } from "./modals";
import { DeepVaultSettingTab } from "./settings";
import { DeepVaultView } from "./views/DeepVaultView";

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
