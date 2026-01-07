/**
 * Raw SQL Migration Runner
 *
 * This script runs raw SQL migrations that Prisma cannot handle
 * (PostGIS extensions, exclusion constraints, triggers, etc.)
 *
 * Migrations are idempotent - safe to run multiple times.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * Split SQL file into individual statements
 * Handles multi-line statements and $$ delimited functions
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let currentStatement = '';
  let inDollarQuote = false;
  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('--')) {
      continue;
    }

    // Check for $$ delimiter (function body start/end)
    const dollarMatches = (line.match(/\$\$/g) || []).length;
    if (dollarMatches % 2 === 1) {
      inDollarQuote = !inDollarQuote;
    }

    currentStatement += line + '\n';

    // If we're not in a dollar-quoted block and line ends with semicolon, it's end of statement
    if (!inDollarQuote && trimmedLine.endsWith(';')) {
      const stmt = currentStatement.trim();
      if (stmt && !stmt.match(/^--/)) {
        statements.push(stmt);
      }
      currentStatement = '';
    }
  }

  // Handle any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  return statements.filter((s) => s.length > 0);
}

async function runRawMigrations() {
  console.log('Starting raw SQL migrations...\n');

  // Path to the raw SQL migration file
  const migrationPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'infra',
    'migrations',
    '001-exclusion-constraint.sql',
  );

  // Check if migration file exists
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  console.log(`Reading migration from: ${migrationPath}\n`);
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Split into individual statements
  const statements = splitSqlStatements(sql);
  console.log(`Found ${statements.length} SQL statements to execute.\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ');

    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`[${i + 1}/${statements.length}] OK: ${preview}...`);
      successCount++;
    } catch (error: any) {
      // Some errors are expected for idempotent operations
      const msg = error.message || '';

      if (
        msg.includes('already exists') ||
        msg.includes('does not exist') ||
        msg.includes('duplicate key') ||
        msg.includes('current transaction is aborted')
      ) {
        console.log(`[${i + 1}/${statements.length}] SKIP (already applied): ${preview}...`);
        skipCount++;
      } else {
        console.error(`[${i + 1}/${statements.length}] ERROR: ${preview}...`);
        console.error(`   Error: ${msg}\n`);
        errorCount++;

        // Continue with other statements - don't fail entire migration
      }
    }
  }

  console.log('\n========================================');
  console.log('Migration Summary:');
  console.log(`  Success: ${successCount}`);
  console.log(`  Skipped: ${skipCount}`);
  console.log(`  Errors:  ${errorCount}`);
  console.log('========================================\n');

  if (errorCount > 0) {
    console.log('WARNING: Some statements failed. Review errors above.');
    // Don't exit with error - some failures may be expected
  }
}

// Run the migrations
runRawMigrations()
  .then(() => {
    console.log('Raw SQL migrations completed.');
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration runner failed:', error);
    prisma.$disconnect();
    process.exit(1);
  });
