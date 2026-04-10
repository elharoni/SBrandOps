/**
 * Database Check Script
 * Checks if the database is set up correctly and provides instructions if not
 */

import { createClient } from '@supabase/supabase-js';

// Read from environment variables (set these before running)
const supabaseUrl = 'https://xosboyhviihchnoxtimj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvc2JveWh2aWloY2hub3h0aW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODQ5NzMsImV4cCI6MjA3OTE2MDk3M30.Nxrv6iJbunWaGveG9Bt3vJYE3Y-67fTzlBGFJP6TaNE';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('\n❌ Missing Supabase credentials in .env file\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDatabase() {
  console.log('\n🔍 Checking database setup...\n');

  try {
    // Try to fetch brands
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist
        console.log('❌ Database is not set up yet.\n');
        console.log('📋 Please follow these steps:\n');
        console.log('1. Open Supabase SQL Editor:');
        console.log(`   https://supabase.com/dashboard/project/${supabaseUrl.split('.')[0].split('//')[1]}/sql/new\n`);
        console.log('2. Copy the content of setup_full.sql');
        console.log('3. Paste it in the SQL Editor');
        console.log('4. Click "Run"\n');
        console.log('5. Run this script again to verify\n');
        return false;
      } else {
        console.error('❌ Database error:', error.message);
        return false;
      }
    }

    if (!data || data.length === 0) {
      console.log('⚠️  Database tables exist but no brands found.\n');
      console.log('Creating a sample brand...\n');

      // Try to create a brand
      const { data: newBrand, error: insertError } = await supabase
        .from('brands')
        .insert([
          {
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            name: 'Confort-Tex',
            logo_url: 'https://picsum.photos/seed/brandlogo/100',
            industry: 'Textiles'
          }
        ])
        .select()
        .single();

      if (insertError && insertError.code !== '23505') {
        console.error('❌ Failed to create sample brand:', insertError.message);
        return false;
      }

      console.log('✅ Sample brand created successfully!');
      return true;
    }

    console.log(`✅ Database is set up correctly!`);
    console.log(`📊 Found ${data.length > 0 ? data[0].name : 'brand data'}\n`);
    return true;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return false;
  }
}

// Run the check
checkDatabase().then(success => {
  if (success) {
    console.log('🎉 Your database is ready to use!\n');
    console.log('🌐 Start the app with: npm run dev\n');
  }
  process.exit(success ? 0 : 1);
});
