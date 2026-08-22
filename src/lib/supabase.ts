import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://nmmrptkyxiolofyxgpem.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tbXJwdGt5eGlvbG9meXhncGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4OTIwOTcsImV4cCI6MjA5ODQ2ODA5N30.5IsgsdbwwE6V49vd3V19ug3LdY28QlE2motbQDI1UVg';

export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
