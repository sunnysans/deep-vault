// Minimal Obsidian API stubs for Vitest.
// Only exports that src/main.ts actually imports need to be present here.

export class App {}
export class Plugin {
  app = new App();
  addCommand() {}
  addRibbonIcon() {}
  addSettingTab() {}
  loadData() { return Promise.resolve({}); }
  saveData() { return Promise.resolve(); }
  registerView() {}
}
export class PluginSettingTab {
  app = new App();
  containerEl = { empty: () => {}, createEl: () => ({}) } as any;
  display() {}
}
export class Setting {
  constructor(_containerEl: any) {}
  setName() { return this; }
  setDesc() { return this; }
  addText() { return this; }
  addDropdown() { return this; }
  addToggle() { return this; }
  addSlider() { return this; }
  addButton() { return this; }
}
export class ItemView {
  app = new App();
  containerEl = { empty: () => {}, createEl: () => ({}) } as any;
  leaf: any = {};
  getViewType() { return ""; }
  getDisplayText() { return ""; }
  onOpen() { return Promise.resolve(); }
  onClose() { return Promise.resolve(); }
}
export class Modal {
  app = new App();
  contentEl = { empty: () => {}, createEl: () => ({}) } as any;
  open() {}
  close() {}
  onOpen() {}
  onClose() {}
}
export class Notice {
  constructor(_message: string) {}
}
export class WorkspaceLeaf {}
export class TFile {
  path = "";
  name = "";
  basename = "";
  extension = "";
  stat = { mtime: 0, ctime: 0, size: 0 };
}
export class SuggestModal<T> {
  app = new App();
  inputEl = { value: "" } as any;
  getSuggestions(_query: string): T[] { return []; }
  renderSuggestion(_item: T, _el: HTMLElement) {}
  onChooseSuggestion(_item: T, _evt: MouseEvent | KeyboardEvent) {}
  open() {}
  close() {}
}
export class MarkdownView {}
export class Editor {}
