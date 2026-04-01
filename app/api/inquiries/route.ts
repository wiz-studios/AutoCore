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
    const { listing_id, seller_id, offered_price_ksh, message } = (await request.json()) as {
      listing_id?: string
      seller_id?: string
      offered_price_ksh?: number | null
      message?: string | null
    }

    if (!listing_id || !seller_id) {
      return NextResponse.json({ error: 'listing_id and seller_id are required' }, { status: 400 })
    }

    if (!offered_price_ksh && !message) {
      return NextResponse.json({ error: 'Provide an offer amount or a message' }, { status: 400 })
    }

    if (seller_id === user.id) {
      return NextResponse.json({ error: 'You cannot negotiate on your own listing' }, { status: 400 })
    }

    const { data: listing, error: listingError } = await supabase
      .from('car_listings')
      .select('id, seller_id, title, status')
      .eq('id', listing_id)
      .single()

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.seller_id !== seller_id) {
      return NextResponse.json({ error: 'Seller does not match listing owner' }, { status: 400 })
    }

    if (listing.status !== 'active') {
      return NextResponse.json({ error: 'Only active listings can receive offers' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('inquiries')
      .insert([
        {
          buyer_id: user.id,
          seller_id,
          listing_id,
          offered_price_ksh: offered_price_ksh ?? null,
          message: message ?? null,
          status: 'pending',
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (message) {
      await supabase.from('messages').insert([
        {
          sender_id: user.id,
          recipient_id: seller_id,
          listing_id,
          subject: `Offer on ${listing.title}`,
          body: message,
          is_read: false,
        },
      ])
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating inquiry:', error)
    return NextResponse.json({ error: 'Failed to create inquiry' }, { status: 500 })
  }
}
