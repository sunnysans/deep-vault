export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function slugify(text: string): string {
  return text.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60);
}
