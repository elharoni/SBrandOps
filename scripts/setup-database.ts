/**
 * Database Setup Script
 * This script sets up the Supabase database with all necessary tables and seed data
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setupDatabase() {
  console.log('🚀 Starting database setup...\n');

  try {
    // Read the setup SQL file
    const sqlFilePath = path.join(__dirname, '..', 'setup_full.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf-8');

    console.log('📄 Read setup_full.sql');
    console.log('⚠️  Note: You need to run this SQL in Supabase SQL Editor manually.\n');
    console.log('Steps:');
    console.log('1. Go to: https://supabase.com/dashboard/project/' + supabaseUrl.split('.')[0].split('//')[1] + '/sql/new');
    console.log('2. Copy the content of setup_full.sql');
    console.log('3. Paste it in the SQL Editor');
    console.log('4. Click "Run"\n');

    // Alternatively, try to create a brand directly
    console.log('🔧 Attempting to create a test brand...');

    const { data, error } = await supabase
      .from('brands')
      .insert([
        {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          name: 'Confort-Tex',
          logo_url: 'https://picsum.photos/seed/brandlogo/100',
          industry: 'Textiles'
        }
      ])
      .select();

    if (error) {
      if (error.code === '42P01') {
        console.error('\n❌ Table "brands" does not exist.');
        console.error('You need to run the SQL setup first. Please follow the steps above.\n');
        return false;
      } else if (error.code === '23505') {
        console.log('✅ Brand already exists in database');
        return true;
      } else {
        console.error('❌ Error creating brand:', error.message);
        return false;
      }
    }

    console.log('✅ Successfully created test brand:', data);
    return true;

  } catch (error: any) {
    console.error('❌ Setup failed:', error.message);
    return false;
  }
}

// Run the setup
setupDatabase().then(success => {
  if (success) {
    console.log('\n✨ Database setup completed successfully!');
    console.log('🌐 You can now use the application with real data.\n');
  } else {
    console.log('\n⚠️  Database setup incomplete. Please run the SQL manually as described above.\n');
  }
  process.exit(success ? 0 : 1);
});
