#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Terminal Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Deep Vault Build Script ===${NC}\n"

# 1. Load nvm if it exists to ensure node/npm are in path
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    echo -e "${BLUE}ℹ️ Sourcing nvm...${NC}"
    export NVM_DIR="$HOME/.nvm"
    \. "$NVM_DIR/nvm.sh"
fi

# Verify npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ Error: npm is not installed or not in PATH.${NC}"
    echo -e "Please install Node.js/npm first."
    exit 1
fi

# 2. Check and install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 node_modules not found. Installing dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}✅ node_modules found.${NC}"
fi

# 3. Compile the project
echo -e "${BLUE}🚀 Running production build...${NC}"
npm run build

echo -e "${GREEN}✅ Build completed successfully! Generated main.js.${NC}\n"

# 4. Optional deployment step if vault path is provided
# Usage: ./build.sh /path/to/your/obsidian/vault
VAULT_DIR="$1"

if [ -n "$VAULT_DIR" ]; then
    echo -e "${BLUE}📂 Deploying to vault: ${VAULT_DIR}${NC}"
    node scripts/deploy.js "$VAULT_DIR"
    echo -e "\n${GREEN}🎉 Successfully deployed to Obsidian vault!${NC}"
else
    echo -e "${YELLOW}💡 Tip: Deploy using either of these commands:${NC}"
    echo -e "   ./build.sh /path/to/your/Obsidian/Vault"
    echo -e "   npm run deploy -- /path/to/your/Obsidian/Vault"
fi
