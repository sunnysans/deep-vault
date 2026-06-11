#!/usr/bin/env node
// Cross-platform deploy script. Works on Windows, Linux, and macOS.
// Usage:
//   node scripts/deploy.js <path-to-obsidian-vault>
//   npm run deploy -- <path-to-obsidian-vault>

const fs = require("fs");
const path = require("path");

const FILES = ["main.js", "manifest.json", "styles.css"];
const PLUGIN_ID = "deep-vault";

const vaultPath = process.argv[2];

if (!vaultPath) {
  console.error("Error: Obsidian vault path is required.");
  console.error("");
  console.error("Usage:");
  console.error("  node scripts/deploy.js <path-to-obsidian-vault>");
  console.error("  npm run deploy -- <path-to-obsidian-vault>");
  console.error("");
  console.error("Examples:");
  console.error("  npm run deploy -- /home/user/ObsidianVault");
  console.error("  npm run deploy -- \"E:\\Obsidian\\MyVault\"");
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, "..");
const pluginDir = path.join(vaultPath, ".obsidian", "plugins", PLUGIN_ID);

// Verify all source files exist before touching the destination
for (const file of FILES) {
  const src = path.join(projectRoot, file);
  if (!fs.existsSync(src)) {
    console.error(`Error: ${file} not found at ${src}`);
    console.error("Run 'npm run build' first.");
    process.exit(1);
  }
}

fs.mkdirSync(pluginDir, { recursive: true });

for (const file of FILES) {
  const src = path.join(projectRoot, file);
  const dest = path.join(pluginDir, file);
  fs.copyFileSync(src, dest);
  console.log(`  copied  ${file}  →  ${dest}`);
}

console.log(`\nDeployed to: ${pluginDir}`);
console.log("Reload Obsidian: Ctrl+P → \"Reload app without saving\"");
