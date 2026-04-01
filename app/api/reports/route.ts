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

    const { data: listing, error: listingError } = await supabase
      .from('car_listings')
      .select('id, seller_id')
      .eq('id', listing_id)
      .single()

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.seller_id === user.id) {
      return NextResponse.json({ error: 'You cannot report your own listing' }, { status: 400 })
    }

    const { data: existingReport } = await supabase
      .from('flagged_listings')
      .select('id')
      .eq('listing_id', listing_id)
      .eq('reported_by_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingReport) {
      return NextResponse.json({ error: 'You already have a pending report for this listing' }, { status: 409 })
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
