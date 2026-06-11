import { describe, it, expect, vi } from "vitest";

vi.mock("obsidian");

import { slugify, formatDate, formatTime } from "../src/utils/helpers";

// ─── slugify ──────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("replaces spaces with hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  it("replaces special characters with hyphens", () => {
    expect(slugify("note: ideas & thoughts!")).toBe("note-ideas-thoughts");
  });

  it("collapses consecutive non-alphanumeric chars into a single hyphen", () => {
    expect(slugify("a   ---   b")).toBe("a-b");
  });

  it("strips leading hyphens", () => {
    expect(slugify("---hello")).toBe("hello");
  });

  it("strips trailing hyphens", () => {
    expect(slugify("hello---")).toBe("hello");
  });

  it("truncates to 60 characters", () => {
    const long = "a".repeat(80);
    expect(slugify(long)).toHaveLength(60);
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("handles input that is only special characters", () => {
    expect(slugify("!!!---???")).toBe("");
  });
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("returns a non-empty string for a known date", () => {
    const result = formatDate(new Date("2026-01-15"));
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes the year", () => {
    const result = formatDate(new Date("2026-06-01"));
    expect(result).toContain("2026");
  });

  it("produces a different string for two different dates", () => {
    const jan = formatDate(new Date("2026-01-01"));
    const dec = formatDate(new Date("2026-12-31"));
    expect(jan).not.toBe(dec);
  });
});

// ─── formatTime ───────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("returns a non-empty string", () => {
    const result = formatTime(new Date());
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("contains a colon separator", () => {
    const result = formatTime(new Date("2026-01-01T14:05:00"));
    expect(result).toContain(":");
  });

  it("produces different output for different times", () => {
    const morning = formatTime(new Date("2026-01-01T08:00:00"));
    const evening = formatTime(new Date("2026-01-01T20:00:00"));
    expect(morning).not.toBe(evening);
  });
});
