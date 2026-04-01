import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { ProfileSummary, UserType } from '@/lib/marketplace'

export const PROFILE_SELECT_FIELDS = 'id, first_name, last_name, phone_number, location, bio, user_type'

function coerceUserType(value: unknown): UserType {
  if (value === 'seller' || value === 'dealer' || value === 'admin') {
    return value
  }

  return 'buyer'
}

function buildProfileSeed(user: User) {
  const metadata = user.user_metadata ?? {}

  return {
    id: user.id,
    user_type: coerceUserType(metadata.user_type),
    first_name: typeof metadata.first_name === 'string' ? metadata.first_name : null,
    last_name: typeof metadata.last_name === 'string' ? metadata.last_name : null,
    phone_number: typeof metadata.phone_number === 'string' ? metadata.phone_number : null,
  }
}

export async function ensureOwnProfile(supabase: SupabaseClient, user: User) {
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_FIELDS)
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return {
      error: profileError.message,
      profile: null as ProfileSummary | null,
    }
  }

  if (profileData) {
    return {
      error: null,
      profile: profileData as ProfileSummary,
    }
  }

  const { data: insertedProfile, error: insertError } = await supabase
    .from('profiles')
    .upsert(buildProfileSeed(user), { onConflict: 'id' })
    .select(PROFILE_SELECT_FIELDS)
    .single()

  return {
    error: insertError?.message ?? null,
    profile: (insertedProfile as ProfileSummary | null) ?? null,
  }
}
