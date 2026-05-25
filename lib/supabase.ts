import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Bucket name for uploaded roof documents
export const STORAGE_BUCKET = 'roof-documents'

// Lazy-initialize to avoid crashing during build when env vars are not set
let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Add them to your .env.local file.'
    )
  }
  _client = createClient(url, key)
  return _client
}

// Convenience export — use this in API routes
export const supabase = {
  get from() { return getSupabase().from.bind(getSupabase()) },
  get storage() { return getSupabase().storage },
  get rpc() { return getSupabase().rpc.bind(getSupabase()) },
}
