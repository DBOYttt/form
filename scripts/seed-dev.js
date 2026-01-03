#!/usr/bin/env node
/**
 * Seed Database with Test Users for Development
 * 
 * Creates test users for local development:
 * - test@example.com / password123 (verified)
 * - unverified@example.com / password123 (unverified)
 * 
 * Usage: node scripts/seed-dev.js
 */

import bcrypt from 'bcrypt';
import pg from 'pg';
import { config } from '../src/config.js';

const { Pool } = pg;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

// Test users to seed
const testUsers = [
  {
    email: 'test@example.com',
    password: 'password123',
    emailVerified: true,
    description: 'Verified test user',
  },
  {
    email: 'unverified@example.com',
    password: 'password123',
    emailVerified: false,
    description: 'Unverified test user',
  },
];

async function seedDatabase() {
  const pool = new Pool({
    ...config.database,
    max: 5,
  });

  console.log(`${colors.cyan}🌱 Seeding database with test users...${colors.reset}\n`);

  try {
    for (const user of testUsers) {
      // Check if user already exists
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [user.email]
      );

      if (existing.rows.length > 0) {
        console.log(`${colors.yellow}⚠️  User ${user.email} already exists, skipping${colors.reset}`);
        continue;
      }

      // Hash password with low rounds for dev
      const passwordHash = await bcrypt.hash(user.password, 4);

      // Insert user
      await pool.query(
        `INSERT INTO users (email, password_hash, email_verified, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [user.email, passwordHash, user.emailVerified]
      );

      const status = user.emailVerified 
        ? `${colors.green}verified${colors.reset}` 
        : `${colors.yellow}unverified${colors.reset}`;

      console.log(`${colors.green}✓${colors.reset} Created: ${user.email} / ${user.password} (${status})`);
      console.log(`  ${colors.dim}${user.description}${colors.reset}`);
    }

    console.log(`\n${colors.green}✓ Seeding complete!${colors.reset}`);
    console.log(`\n${colors.cyan}Test credentials:${colors.reset}`);
    testUsers.forEach(user => {
      const status = user.emailVerified ? '✓ verified' : '✗ unverified';
      console.log(`  ${user.email} / ${user.password} (${status})`);
    });

  } catch (error) {
    console.error(`${colors.red}Error seeding database:${colors.reset}`, error.message);
    
    if (error.message.includes('does not exist')) {
      console.log(`\n${colors.yellow}Hint: Run migrations first with: npm run migrate${colors.reset}`);
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
seedDatabase();
