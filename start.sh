#!/bin/bash
# ===========================================
# Authentication System - Development Start Script
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo_error "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo_error "Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
    echo_warn ".env file not found."
    if [ -f .env.example ]; then
        echo_info "Copying .env.example to .env..."
        cp .env.example .env
        echo_warn "Please edit .env with your configuration before running again."
        exit 1
    else
        echo_error ".env.example not found. Cannot create configuration."
        exit 1
    fi
fi

# Check for node_modules
if [ ! -d "node_modules" ]; then
    echo_info "Installing dependencies..."
    npm install
fi

# Source .env for validation
set -a
source .env
set +a

# Validate required environment variables
MISSING_VARS=""
for var in DATABASE_URL SESSION_SECRET; do
    if [ -z "${!var}" ]; then
        MISSING_VARS="$MISSING_VARS $var"
    fi
done

if [ -n "$MISSING_VARS" ]; then
    echo_error "Missing required environment variables:$MISSING_VARS"
    echo_info "Please configure these in your .env file."
    exit 1
fi

echo_info "Starting authentication system in development mode..."
echo_info "Server will be available at: ${APP_URL:-http://localhost:3000}"
echo ""

# Start with nodemon for auto-reload
if command -v npx &> /dev/null && [ -d "node_modules/nodemon" ]; then
    npm run dev
else
    npm start
fi
