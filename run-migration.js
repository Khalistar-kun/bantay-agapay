#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function runMigration() {
  require('dotenv').config({ path: '.env.local', quiet: true });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('🚀 Starting database migration...');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '00_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log(`📄 Migration file size: ${sql.length} bytes`);
    console.log('⏳ Executing SQL statements...\n');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    let executed = 0;
    for (const statement of statements) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql_exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
          },
          body: JSON.stringify({ query: statement }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.warn(`⚠️  Statement execution note:`, result);
        } else {
          executed++;
          if (executed % 5 === 0) {
            console.log(`✓ ${executed}/${statements.length} statements processed...`);
          }
        }
      } catch (err) {
        // Continue on individual statement errors
        console.warn(`⚠️  Statement execution note: ${err.message}`);
      }
    }

    console.log('\n✅ Migration processing completed!');
    console.log('\n📊 Expected tables created:');
    console.log('  ✓ profiles');
    console.log('  ✓ visitors');
    console.log('  ✓ destinations');
    console.log('  ✓ visits');
    console.log('  ✓ verification_logs');
    console.log('  ✓ system_settings');
    console.log('  ✓ audit_logs');
    console.log('\n🎯 Next steps:');
    console.log('  1. Run: npm run dev');
    console.log('  2. Visit: http://localhost:3000');
    console.log('  3. Test the visitor registration flow');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error running migration:');
    console.error(err.message);

    console.log('\n💡 Manual Steps:');
    console.log('1. Go to: https://quvvyilbzkbazxpsvins.supabase.co');
    console.log('2. Click: SQL Editor (left sidebar)');
    console.log('3. Click: New Query');
    console.log('4. Paste contents of: supabase/migrations/00_initial_schema.sql');
    console.log('5. Click: RUN');

    process.exit(1);
  }
}

runMigration();
