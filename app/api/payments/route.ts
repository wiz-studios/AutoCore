import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
    const { seller_id, listing_id, amount_ksh, payment_method } = await request.json()

    if (!seller_id || !listing_id || !amount_ksh || !payment_method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['mpesa', 'bank_transfer', 'cash'].includes(payment_method)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    if (seller_id === user.id) {
      return NextResponse.json({ error: 'You cannot create a payment for your own listing' }, { status: 400 })
    }

    const { data: listing, error: listingError } = await supabase
      .from('car_listings')
      .select('id, seller_id, status')
      .eq('id', listing_id)
      .single()

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.seller_id !== seller_id) {
      return NextResponse.json({ error: 'Seller does not match listing owner' }, { status: 400 })
    }

    if (listing.status !== 'active') {
      return NextResponse.json({ error: 'Payments can only be created for active listings' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('payments')
      .insert([
        {
          buyer_id: user.id,
          seller_id,
          listing_id,
          amount_ksh,
          payment_method,
          status: 'pending',
        },
      ])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const listingId = searchParams.get('listing_id')

    let query = supabase.from('payments').select('*').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    if (listingId) {
      query = query.eq('listing_id', listingId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { payment_id, status, mpesa_receipt_number } = await request.json()

    if (!payment_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['pending', 'completed', 'failed', 'refunded'].includes(status)) {
      return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, buyer_id, seller_id, listing_id, status')
      .eq('id', payment_id)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (payment.seller_id !== user.id) {
      return NextResponse.json({ error: 'Only the seller can update payment status' }, { status: 403 })
    }

    const updateData: Record<string, string> = { status }
    if (mpesa_receipt_number) {
      updateData.mpesa_receipt_number = mpesa_receipt_number
    }

    const { data, error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', payment_id)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (status === 'completed') {
      await supabase.from('car_listings').update({ status: 'sold' }).eq('id', payment.listing_id)

      const { data: winningInquiries } = await supabase
        .from('inquiries')
        .select('id')
        .eq('listing_id', payment.listing_id)
        .eq('buyer_id', payment.buyer_id)
        .in('status', ['pending', 'accepted'])

      if ((winningInquiries ?? []).length > 0) {
        await supabase
          .from('inquiries')
          .update({ status: 'sold' })
          .in('id', (winningInquiries ?? []).map((inquiry) => inquiry.id))
      }

      const { data: competingInquiries } = await supabase
        .from('inquiries')
        .select('id')
        .eq('listing_id', payment.listing_id)
        .neq('buyer_id', payment.buyer_id)
        .in('status', ['pending', 'accepted'])

      if ((competingInquiries ?? []).length > 0) {
        await supabase
          .from('inquiries')
          .update({ status: 'rejected' })
          .in('id', (competingInquiries ?? []).map((inquiry) => inquiry.id))
      }
    }

    return NextResponse.json(data[0])
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}
