export const DEEP_VAULT_VIEW = "deep-vault-view";
export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  noteTitle?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  icon: string;
  prompt: string;
  useNoteContext: boolean;
  createdAt: string;
}

export interface DeepVaultSettings {
  apiKey: string;
  model: string;
  maxTokens: number;
  enableWebSearch: boolean;
  exportFolder: string;
  templates: PromptTemplate[];
  hasSeenWizard: boolean;
}

export const DEFAULT_TEMPLATES: PromptTemplate[] = [
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

export const DEFAULT_SETTINGS: DeepVaultSettings = {
  apiKey: "",
  model: DEFAULT_MODEL,
  maxTokens: 2000,
  enableWebSearch: true,
  exportFolder: "Deep Vault Exports",
  templates: DEFAULT_TEMPLATES,
  hasSeenWizard: false,
};
