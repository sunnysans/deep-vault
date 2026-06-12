import { requestUrl } from "obsidian";

export interface ClaudeApiSettings {
  apiKey: string;
  model: string;
  maxTokens: number;
  enableWebSearch: boolean;
}

export interface ClaudeMessage {
  role: string;
  content: string;
}

const SYSTEM_PROMPT = "You are Deep Vault, an expert research assistant embedded in Obsidian. Help researchers analyze notes, extract insights, identify knowledge gaps, find connections, and synthesize ideas. Be concise, structured, and use markdown formatting. Use bullet points and headers to organize responses clearly.";

export async function callClaude(
  settings: ClaudeApiSettings,
  messages: ClaudeMessage[],
  useWeb: boolean
): Promise<string> {
  const body: any = {
    model: settings.model,
    max_tokens: settings.maxTokens,
    system: SYSTEM_PROMPT,
    messages,
  };

  if (useWeb && settings.enableWebSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  // requestUrl is Obsidian's built-in HTTP client — works on desktop and mobile.
  // Native fetch() fails in Obsidian's Electron/Capacitor environment.
  const response = await requestUrl({
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
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
