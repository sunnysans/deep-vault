import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_TEMPLATES } from "./types";
import type DeepVaultPlugin from "./main";

export class DeepVaultSettingTab extends PluginSettingTab {
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
