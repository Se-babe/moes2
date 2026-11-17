import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Public project URL and publishable key (safe to ship in the client; data
// is protected by row-level security). Override per environment with
// EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY, e.g. for staging.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://sjsavaijgoazitnrjtab.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_4Is7tiWWz3HT1bnSOnPBGg_iLPEJMYv';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});