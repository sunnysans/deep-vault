import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";

const isCI = process.env.CI === "true";

export default defineConfig({
  test: {
    alias: {
      obsidian: fileURLToPath(
        new URL("./test/__mocks__/obsidian.ts", import.meta.url)
      ),
    },
    // local: human-readable terminal output
    // CI (GitHub Actions): adds inline PR annotations via workflow commands
    reporters: isCI ? ["verbose", "github-actions"] : ["verbose"],
  },
});
