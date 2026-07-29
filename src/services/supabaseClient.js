import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with your actual Supabase URL and anon key
const supabaseUrl = 'https://sjsavaijgoazitnrjtab.supabase.co';
const supabaseAnonKey = 'sb_publishable_4Is7tiWWz3HT1bnSOnPBGg_iLPEJMYv'; // ← use the key from your project

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});