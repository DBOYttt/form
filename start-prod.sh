#!/bin/bash
# ===========================================
# Authentication System - Production Start Script
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
    echo_error ".env file not found. Production requires a configured .env file."
    exit 1
fi

# Source .env for validation
set -a
source .env
set +a

# Validate required environment variables
REQUIRED_VARS="DATABASE_URL SESSION_SECRET"
MISSING_VARS=""
for var in $REQUIRED_VARS; do
    if [ -z "${!var}" ]; then
        MISSING_VARS="$MISSING_VARS $var"
    fi
done

if [ -n "$MISSING_VARS" ]; then
    echo_error "Missing required environment variables:$MISSING_VARS"
    exit 1
fi

# Production-specific checks
if [ "${#SESSION_SECRET}" -lt 32 ]; then
    echo_error "SESSION_SECRET must be at least 32 characters long for production."
    exit 1
fi

# Warn about email configuration
if [ -z "$SMTP_HOST" ] || [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ]; then
    echo_warn "Email (SMTP) is not fully configured. Password reset and email verification will not work."
fi

# Set production environment
export NODE_ENV=production

# Check for node_modules
if [ ! -d "node_modules" ]; then
    echo_info "Installing production dependencies..."
    npm ci --omit=dev
fi

echo_info "Starting authentication system in PRODUCTION mode..."
echo_info "Server will listen on port: ${PORT:-3000}"
echo ""

# Start the application
exec node src/index.js
