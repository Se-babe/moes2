import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Public project URL and publishable key (safe to ship in the client; data
// is protected by row-level security). Override per environment with
// EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY, e.g. for staging.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://sjsavaijgoazitnrjtab.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_4Is7tiWWz3HT1bnSOnPBGg_iLPEJMYv';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

// Email links (staff invitations, password resets) come back to the site with
// the session — or an error such as an expired link — in the URL fragment.
// Capture any error before the client clears the fragment.
const linkParams = isWeb ? new URLSearchParams(window.location.hash.replace(/^#/, '')) : null;
export const authLinkError = linkParams?.get('error_description') || null;
export const authLinkType = linkParams?.get('type') || null; // 'invite' | 'recovery' | ...

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
  },
});

/** Where email links should send people to choose a password. */
export const passwordSetupUrl = () => (isWeb ? `${window.location.origin}/set-password` : undefined);