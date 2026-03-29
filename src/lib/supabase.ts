import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabaseConfigError =
  'Missing Supabase config. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your local .env file.'

export const supabase = createClient(supabaseUrl || 'https://invalid.local', supabaseAnonKey || 'invalid-key', {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
})

export function requireSupabaseConfig() {
  if (!isSupabaseConfigured) {
    throw new Error(supabaseConfigError)
  }
}

export function getSupabaseFunctionUrl(functionName: string) {
  requireSupabaseConfig()
  return `${supabaseUrl}/functions/v1/${functionName}`
}
