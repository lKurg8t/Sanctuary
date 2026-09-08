import { getSupabase } from './src/lib/supabase.js';

async function testSupabaseCRUD() {
  console.log('=== TESTING SUPABASE CRUD OPERATIONS ===\n');

  const supabase = getSupabase();
  if (!supabase) {
    console.error('❌ Supabase client not initialized');
    return;
  }

  console.log('✅ Supabase client initialized\n');

  // Test 1: Read profiles
  console.log('Test 1: Reading profiles...');
  try {
    const { data, error } = await supabase.from('profiles').select('*').limit(5);
    if (error) {
      console.error('❌ Failed to read profiles:', error.message);
    } else {
      console.log(`✅ Successfully read ${data?.length || 0} profiles`);
    }
  } catch (err: any) {
    console.error('❌ Error reading profiles:', err.message);
  }

  // Test 2: Read couples
  console.log('\nTest 2: Reading couples...');
  try {
    const { data, error } = await supabase.from('couples').select('*').limit(5);
    if (error) {
      console.error('❌ Failed to read couples:', error.message);
    } else {
      console.log(`✅ Successfully read ${data?.length || 0} couples`);
    }
  } catch (err: any) {
    console.error('❌ Error reading couples:', err.message);
  }

  // Test 3: Read chat messages
  console.log('\nTest 3: Reading chat messages...');
  try {
    const { data, error } = await supabase.from('chat_messages').select('*').limit(5);
    if (error) {
      console.error('❌ Failed to read chat messages:', error.message);
    } else {
      console.log(`✅ Successfully read ${data?.length || 0} chat messages`);
    }
  } catch (err: any) {
    console.error('❌ Error reading chat messages:', err.message);
  }

  // Test 4: Read books
  console.log('\nTest 4: Reading books...');
  try {
    const { data, error } = await supabase.from('books').select('*').limit(5);
    if (error) {
      console.error('❌ Failed to read books:', error.message);
    } else {
      console.log(`✅ Successfully read ${data?.length || 0} books`);
    }
  } catch (err: any) {
    console.error('❌ Error reading books:', err.message);
  }

  // Test 5: Read photos
  console.log('\nTest 5: Reading photos...');
  try {
    const { data, error } = await supabase.from('photos').select('*').limit(5);
    if (error) {
      console.error('❌ Failed to read photos:', error.message);
    } else {
      console.log(`✅ Successfully read ${data?.length || 0} photos`);
    }
  } catch (err: any) {
    console.error('❌ Error reading photos:', err.message);
  }

  // Test 6: Read cycle settings
  console.log('\nTest 6: Reading cycle settings...');
  try {
    const { data, error } = await supabase.from('cycle_settings').select('*').limit(5);
    if (error) {
      console.error('❌ Failed to read cycle settings:', error.message);
    } else {
      console.log(`✅ Successfully read ${data?.length || 0} cycle settings`);
    }
  } catch (err: any) {
    console.error('❌ Error reading cycle settings:', err.message);
  }

  // Test 7: Read game prompts
  console.log('\nTest 7: Reading game prompts...');
  try {
    const { data, error } = await supabase.from('game_prompts').select('*').limit(5);
    if (error) {
      console.error('❌ Failed to read game prompts:', error.message);
    } else {
      console.log(`✅ Successfully read ${data?.length || 0} game prompts`);
    }
  } catch (err: any) {
    console.error('❌ Error reading game prompts:', err.message);
  }

  // Test 8: Read notifications
  console.log('\nTest 8: Reading notifications...');
  try {
    const { data, error } = await supabase.from('app_notifications').select('*').limit(5);
    if (error) {
      console.error('❌ Failed to read notifications:', error.message);
    } else {
      console.log(`✅ Successfully read ${data?.length || 0} notifications`);
    }
  } catch (err: any) {
    console.error('❌ Error reading notifications:', err.message);
  }

  // Test 9: Read achievements
  console.log('\nTest 9: Reading achievements...');
  try {
    const { data, error } = await supabase.from('achievements').select('*').limit(5);
    if (error) {
      console.error('❌ Failed to read achievements:', error.message);
    } else {
      console.log(`✅ Successfully read ${data?.length || 0} achievements`);
    }
  } catch (err: any) {
    console.error('❌ Error reading achievements:', err.message);
  }

  console.log('\n=== TEST COMPLETE ===');
}

testSupabaseCRUD().catch(console.error);
