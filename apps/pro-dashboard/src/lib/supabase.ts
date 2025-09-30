import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (client) {
    return client;
  }
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return null;
  }
  client = createClient(url, anon, {
    auth: { persistSession: false },
    global: {
      fetch: (...args) => fetch(...args).catch((error) => {
        console.error('Supabase fetch error', error);
        throw error;
      }),
    },
  });
  return client;
};
