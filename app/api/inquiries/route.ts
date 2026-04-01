import { NextRequest, NextResponse } from 'next/server'
import { formatKES, InquiryRecord, InquiryStatus } from '@/lib/marketplace'
import { createClient } from '@/lib/supabase/server'

type OfferAction = 'accept' | 'reject' | 'mark_sold'

function composeOfferMessage(offeredPrice: number | null | undefined, note: string | null | undefined) {
  const sections: string[] = []

  if (offeredPrice != null) {
    sections.push(`Offer amount: ${formatKES(offeredPrice)}.`)
  }

  if (note?.trim()) {
    sections.push(note.trim())
  }

  return sections.join('\n\n') || 'A buyer submitted an offer on this listing.'
}

function composeOfferStatusMessage(
  action: OfferAction,
  listingTitle: string,
  offeredPrice: number | null | undefined,
) {
  const amountText = offeredPrice != null ? ` at ${formatKES(offeredPrice)}` : ''

  switch (action) {
    case 'accept':
      return {
        subject: `Offer accepted on ${listingTitle}`,
        body: `Your offer${amountText} on ${listingTitle} has been accepted. Continue the conversation in your inbox and coordinate the next steps with the seller.`,
      }
    case 'reject':
      return {
        subject: `Offer declined on ${listingTitle}`,
        body: `Your offer${amountText} on ${listingTitle} was declined by the seller. You can continue browsing or reopen the conversation with a new proposal.`,
      }
    case 'mark_sold':
      return {
        subject: `Listing sold: ${listingTitle}`,
        body: `The seller marked ${listingTitle} as sold${amountText ? ` for your accepted offer${amountText}` : ''}. Use the platform inbox to finalize handover details and payment tracking.`,
      }
    default:
      return {
        subject: `Offer update on ${listingTitle}`,
        body: `There is an update on your offer for ${listingTitle}.`,
      }
  }
}

function getNextStatus(action: OfferAction): InquiryStatus {
  switch (action) {
    case 'accept':
      return 'accepted'
    case 'reject':
      return 'rejected'
    case 'mark_sold':
      return 'sold'
  }
}

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

    if (!offered_price_ksh && !message?.trim()) {
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
          message: message?.trim() || null,
          status: 'pending',
        },
      ])
      .select('id, buyer_id, seller_id, listing_id, offered_price_ksh, message, status, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await supabase.from('messages').insert([
      {
        sender_id: user.id,
        recipient_id: seller_id,
        listing_id,
        subject: `Offer on ${listing.title}`,
        body: composeOfferMessage(offered_price_ksh ?? null, message ?? null),
        is_read: false,
      },
    ])

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating inquiry:', error)
    return NextResponse.json({ error: 'Failed to create inquiry' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { inquiry_id, action } = (await request.json()) as {
      inquiry_id?: string
      action?: OfferAction
    }

    if (!inquiry_id || !action) {
      return NextResponse.json({ error: 'inquiry_id and action are required' }, { status: 400 })
    }

    if (!['accept', 'reject', 'mark_sold'].includes(action)) {
      return NextResponse.json({ error: 'Unsupported inquiry action' }, { status: 400 })
    }

    const { data: inquiry, error: inquiryError } = await supabase
      .from('inquiries')
      .select('id, buyer_id, seller_id, listing_id, offered_price_ksh, message, status, created_at')
      .eq('id', inquiry_id)
      .single()

    if (inquiryError || !inquiry) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    const currentInquiry = inquiry as InquiryRecord

    if (currentInquiry.seller_id !== user.id) {
      return NextResponse.json({ error: 'Only the listing owner can update this offer' }, { status: 403 })
    }

    const { data: listing, error: listingError } = await supabase
      .from('car_listings')
      .select('id, title, status')
      .eq('id', currentInquiry.listing_id)
      .single()

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (action === 'accept' && currentInquiry.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending offers can be accepted' }, { status: 409 })
    }

    if (action === 'reject' && !['pending', 'accepted'].includes(currentInquiry.status)) {
      return NextResponse.json({ error: 'Only pending or accepted offers can be rejected' }, { status: 409 })
    }

    if (action === 'mark_sold' && !['pending', 'accepted'].includes(currentInquiry.status)) {
      return NextResponse.json({ error: 'Only pending or accepted offers can be marked as sold' }, { status: 409 })
    }

    if (action === 'mark_sold' && listing.status === 'sold') {
      return NextResponse.json({ error: 'This listing is already marked as sold' }, { status: 409 })
    }

    const nextStatus = getNextStatus(action)
    const { data: updatedInquiry, error: updateError } = await supabase
      .from('inquiries')
      .update({ status: nextStatus })
      .eq('id', currentInquiry.id)
      .select('id, buyer_id, seller_id, listing_id, offered_price_ksh, message, status, created_at')
      .single()

    if (updateError || !updatedInquiry) {
      return NextResponse.json({ error: updateError?.message ?? 'Failed to update offer' }, { status: 400 })
    }

    if (action === 'mark_sold') {
      const { error: listingUpdateError } = await supabase
        .from('car_listings')
        .update({ status: 'sold' })
        .eq('id', currentInquiry.listing_id)

      if (listingUpdateError) {
        return NextResponse.json({ error: listingUpdateError.message }, { status: 400 })
      }
    }

    const shouldRejectCompetingOffers = action === 'accept' || action === 'mark_sold'
    const { data: competingOffers, error: competingOffersError } = shouldRejectCompetingOffers
      ? await supabase
          .from('inquiries')
          .select('id, buyer_id, seller_id, listing_id, offered_price_ksh, message, status, created_at')
          .eq('listing_id', currentInquiry.listing_id)
          .neq('id', currentInquiry.id)
          .in('status', ['pending', 'accepted'])
      : { data: [], error: null }

    if (competingOffersError) {
      return NextResponse.json({ error: competingOffersError.message }, { status: 400 })
    }

    const rejectedCompetingOffers = (competingOffers ?? []) as InquiryRecord[]

    if (rejectedCompetingOffers.length > 0) {
      const { error: rejectError } = await supabase
        .from('inquiries')
        .update({ status: 'rejected' })
        .in(
          'id',
          rejectedCompetingOffers.map((offer) => offer.id),
        )

      if (rejectError) {
        return NextResponse.json({ error: rejectError.message }, { status: 400 })
      }
    }

    const notificationRows = []
    const primaryNotification = composeOfferStatusMessage(action, listing.title, currentInquiry.offered_price_ksh)

    notificationRows.push({
      sender_id: user.id,
      recipient_id: currentInquiry.buyer_id,
      listing_id: currentInquiry.listing_id,
      subject: primaryNotification.subject,
      body: primaryNotification.body,
      is_read: false,
    })

    for (const competingOffer of rejectedCompetingOffers) {
      notificationRows.push({
        sender_id: user.id,
        recipient_id: competingOffer.buyer_id,
        listing_id: competingOffer.listing_id,
        subject: `Offer update on ${listing.title}`,
        body:
          action === 'accept'
            ? `Another buyer's offer on ${listing.title} has been accepted, so your pending offer is now closed.`
            : `${listing.title} has been marked as sold, so your pending offer is now closed.`,
        is_read: false,
      })
    }

    if (notificationRows.length > 0) {
      await supabase.from('messages').insert(notificationRows)
    }

    return NextResponse.json(
      {
        inquiry: updatedInquiry,
        listing_status: action === 'mark_sold' ? 'sold' : listing.status,
        rejected_competitors: rejectedCompetingOffers.length,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error updating inquiry:', error)
    return NextResponse.json({ error: 'Failed to update inquiry' }, { status: 500 })
  }
}
