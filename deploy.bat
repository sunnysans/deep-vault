@echo off
rem Deep Vault — Windows deploy wrapper.
rem Delegates to scripts/deploy.js (cross-platform Node.js script).
rem Usage: deploy.bat "E:\Obsidian\MyVault"

if "%~1"=="" (
  echo Error: Obsidian vault path is required.
  echo.
  echo Usage:
  echo   deploy.bat "E:\Obsidian\MyVault"
  echo   npm run deploy -- "E:\Obsidian\MyVault"
  exit /b 1
)

node "%~dp0scripts\deploy.js" "%~1"
