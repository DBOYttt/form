#!/usr/bin/env bash
# ===========================================
# Development Mode Startup Script
# ===========================================
# ⚠️  WARNING: This script enables development mode settings
# that should NEVER be used in production!
# ===========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Parse arguments
RESET_DB=false
SEED_DB=false
PORT="${PORT:-3000}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --reset-db)
      RESET_DB=true
      shift
      ;;
    --seed)
      SEED_DB=true
      shift
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./dev.sh [options]"
      echo ""
      echo "Options:"
      echo "  --reset-db    Wipe and recreate the database"
      echo "  --seed        Seed database with test users"
      echo "  --port PORT   Set the server port (default: 3000)"
      echo "  -h, --help    Show this help message"
      echo ""
      echo "Environment Variables:"
      echo "  PORT          Server port (default: 3000)"
      echo "  DEV_MODE      Enable dev mode (default: true)"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║        🔧 Development Mode Startup                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+${NC}"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}❌ Node.js 18+ is required. Current version: $(node -v)${NC}"
  exit 1
fi

# Check for npm and install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 Installing dependencies...${NC}"
  npm install
fi

# Load development environment
if [ -f ".env.development" ]; then
  echo -e "${GREEN}✓ Loading .env.development${NC}"
  set -a
  source .env.development
  set +a
fi

# Override with command line port if specified
export PORT="$PORT"

# Reset database if requested
if [ "$RESET_DB" = true ]; then
  echo -e "${YELLOW}🗑️  Resetting database...${NC}"
  npm run migrate:down 2>/dev/null || true
  npm run migrate
  echo -e "${GREEN}✓ Database reset complete${NC}"
fi

# Run migrations
echo -e "${CYAN}📋 Running database migrations...${NC}"
npm run migrate 2>/dev/null || echo -e "${YELLOW}⚠️  Migrations may have already been applied${NC}"

# Seed database if requested
if [ "$SEED_DB" = true ]; then
  echo -e "${CYAN}🌱 Seeding database with test users...${NC}"
  node scripts/seed-dev.js
fi

# Print dev mode warning
echo ""
echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  ⚠️  DEVELOPMENT MODE - NOT FOR PRODUCTION                  ║${NC}"
echo -e "${YELLOW}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${YELLOW}║  • Email verification is BYPASSED                          ║${NC}"
echo -e "${YELLOW}║  • Emails are logged to console (not sent)                 ║${NC}"
echo -e "${YELLOW}║  • Relaxed password requirements                           ║${NC}"
echo -e "${YELLOW}║  • Rate limiting may be disabled                           ║${NC}"
echo -e "${YELLOW}║  • CORS allows all origins                                 ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Start the development server with hot reload
echo -e "${GREEN}🚀 Starting development server...${NC}"
echo ""

# Use node --watch for hot reload (Node.js 18.11+)
exec node --watch src/index.js
