import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { listing_id, reason, description } = (await request.json()) as {
      listing_id?: string
      reason?: string
      description?: string | null
    }

    if (!listing_id || !reason?.trim()) {
      return NextResponse.json({ error: 'listing_id and reason are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('flagged_listings')
      .insert([
        {
          listing_id,
          reported_by_id: user.id,
          reason: reason.trim(),
          description: description?.trim() || null,
          status: 'pending',
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating flagged listing:', error)
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
  }
}
