#!/bin/bash
# ===========================================
# Authentication System - Initial Setup Script
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }
echo_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

echo ""
echo "==========================================="
echo "  Authentication System - Setup"
echo "==========================================="
echo ""

# Step 1: Check prerequisites
echo_step "Checking prerequisites..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo_error "Node.js is not installed."
    echo_info "Please install Node.js 18 or higher from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo_error "Node.js version 18 or higher is required. Current: $(node -v)"
    exit 1
fi
echo_info "Node.js $(node -v) detected"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo_error "npm is not installed."
    exit 1
fi
echo_info "npm $(npm -v) detected"

# Check for PostgreSQL client (optional but recommended)
if command -v psql &> /dev/null; then
    echo_info "PostgreSQL client detected"
else
    echo_warn "PostgreSQL client (psql) not found. Manual database setup may be needed."
fi

# Step 2: Create .env file
echo ""
echo_step "Setting up environment configuration..."

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo_info "Created .env from .env.example"
        
        # Generate a random session secret
        if command -v openssl &> /dev/null; then
            SESSION_SECRET=$(openssl rand -hex 32)
            sed -i.bak "s/your-super-secret-key-change-in-production-min-32-chars/$SESSION_SECRET/" .env
            rm -f .env.bak
            echo_info "Generated random SESSION_SECRET"
        else
            echo_warn "Could not generate SESSION_SECRET. Please set it manually in .env"
        fi
    else
        echo_error ".env.example not found. Cannot create configuration."
        exit 1
    fi
else
    echo_info ".env already exists, skipping..."
fi

# Step 3: Install dependencies
echo ""
echo_step "Installing dependencies..."
npm install

# Step 4: Create scripts directory if needed
if [ ! -d "scripts" ]; then
    mkdir -p scripts
fi

# Step 5: Create migration script if it doesn't exist
if [ ! -f "scripts/migrate.js" ]; then
    echo_step "Creating migration script..."
    cat > scripts/migrate.js << 'MIGRATE_EOF'
/**
 * Database Migration Script
 * Run migrations against the PostgreSQL database
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS_TABLE = 'schema_migrations';

async function ensureMigrationsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `);
}

async function getAppliedMigrations() {
    const result = await pool.query(
        `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`
    );
    return result.rows.map(r => r.name);
}

async function getMigrationFiles(direction = 'up') {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    const suffix = direction === 'up' ? '.up.sql' : '.down.sql';
    const altSuffix = direction === 'up' ? '.sql' : '_down.sql';
    
    return files
        .filter(f => f.endsWith(suffix) || (direction === 'up' && f.endsWith('.sql') && !f.includes('down')))
        .sort();
}

async function runMigration(filename, direction = 'up') {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filepath, 'utf8');
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        
        const baseName = filename.replace(/\.(up|down)\.sql$/, '').replace(/_down\.sql$/, '');
        
        if (direction === 'up') {
            await client.query(
                `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
                [baseName]
            );
        } else {
            await client.query(
                `DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`,
                [baseName]
            );
        }
        
        await client.query('COMMIT');
        console.log(`✓ ${direction === 'up' ? 'Applied' : 'Reverted'}: ${filename}`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function migrate() {
    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();
    const files = await getMigrationFiles('up');
    
    let count = 0;
    for (const file of files) {
        const baseName = file.replace(/\.(up)?\.sql$/, '');
        if (!applied.includes(baseName)) {
            await runMigration(file, 'up');
            count++;
        }
    }
    
    if (count === 0) {
        console.log('No new migrations to apply.');
    } else {
        console.log(`Applied ${count} migration(s).`);
    }
}

async function rollback() {
    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();
    
    if (applied.length === 0) {
        console.log('No migrations to rollback.');
        return;
    }
    
    const lastMigration = applied[applied.length - 1];
    const downFile = `${lastMigration}.down.sql`;
    const altDownFile = `${lastMigration}_down.sql`;
    
    const files = fs.readdirSync(MIGRATIONS_DIR);
    const targetFile = files.find(f => f === downFile || f === altDownFile);
    
    if (targetFile) {
        await runMigration(targetFile, 'down');
    } else {
        console.error(`Down migration not found for: ${lastMigration}`);
        process.exit(1);
    }
}

async function status() {
    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();
    const files = await getMigrationFiles('up');
    
    console.log('\nMigration Status:');
    console.log('=================');
    
    for (const file of files) {
        const baseName = file.replace(/\.(up)?\.sql$/, '');
        const status = applied.includes(baseName) ? '✓' : '○';
        console.log(`${status} ${file}`);
    }
    console.log('');
}

async function main() {
    const command = process.argv[2] || 'up';
    
    try {
        switch (command) {
            case 'up':
                await migrate();
                break;
            case 'down':
                await rollback();
                break;
            case 'status':
                await status();
                break;
            default:
                console.log('Usage: node migrate.js [up|down|status]');
                process.exit(1);
        }
    } catch (err) {
        console.error('Migration error:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
MIGRATE_EOF
    echo_info "Created scripts/migrate.js"
fi

# Step 6: Create src directory structure
echo ""
echo_step "Creating application structure..."

mkdir -p src

if [ ! -f "src/index.js" ]; then
    cat > src/index.js << 'INDEX_EOF'
/**
 * Authentication System - Main Entry Point
 */

const config = require('../config');

// Validate configuration on startup
config.validate();

console.log(`Starting ${config.appName} in ${config.env} mode...`);
console.log(`Server would listen on port ${config.port}`);
console.log('');
console.log('Note: This is a placeholder. Implement your Express app here.');

// TODO: Implement Express server with authentication routes
// - POST /auth/register
// - POST /auth/login
// - POST /auth/logout
// - POST /auth/forgot-password
// - POST /auth/reset-password
// - POST /auth/verify-email
// - GET  /auth/me
INDEX_EOF
    echo_info "Created src/index.js placeholder"
fi

# Step 7: Summary
echo ""
echo "==========================================="
echo "  Setup Complete!"
echo "==========================================="
echo ""
echo_info "Next steps:"
echo "  1. Edit .env with your database and SMTP settings"
echo "  2. Create a PostgreSQL database"
echo "  3. Run migrations: npm run migrate"
echo "  4. Start the server: ./start.sh (or npm run dev)"
echo ""
echo_warn "Remember to:"
echo "  - Never commit your .env file to version control"
echo "  - Use a strong SESSION_SECRET in production"
echo "  - Configure SMTP for email functionality"
echo ""
