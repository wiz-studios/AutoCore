import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_DB_SCHEMA } from '@/lib/supabase/schema'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: {
        schema: SUPABASE_DB_SCHEMA,
      },
    },
  )
}
