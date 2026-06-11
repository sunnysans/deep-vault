@echo off
rem Deep Vault — Windows deploy wrapper.
rem Delegates to scripts/deploy.js (cross-platform Node.js script).
rem Edit VAULT_DIR below to match your local Obsidian vault path.

set VAULT_DIR=E:\Obsidian\MyVault
node "%~dp0scripts\deploy.js" "%VAULT_DIR%"
