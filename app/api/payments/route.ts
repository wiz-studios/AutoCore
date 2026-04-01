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
    const {
      seller_id,
      listing_id,
      amount_ksh,
      payment_method,
    } = await request.json()

    if (!seller_id || !listing_id || !amount_ksh || !payment_method) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['mpesa', 'bank_transfer', 'cash'].includes(payment_method)) {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      )
    }

    // Create payment record
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
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // For M-Pesa, integrate with M-Pesa API
    if (payment_method === 'mpesa') {
      // TODO: Integrate with M-Pesa STK Push API
      // This would call the M-Pesa API to initiate payment
    }

    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    )
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

    let query = supabase.from('payments').select('*')

    if (listingId) {
      query = query.eq('listing_id', listingId)
    } else {
      // Get user's payments (as buyer or seller)
      query = query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
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
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const updateData: any = { status }
    if (mpesa_receipt_number) {
      updateData.mpesa_receipt_number = mpesa_receipt_number
    }

    const { data, error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', payment_id)
      .select()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // If payment completed, update listing status
    if (status === 'completed' && data && data[0]) {
      await supabase
        .from('car_listings')
        .update({ status: 'sold' })
        .eq('id', data[0].listing_id)
    }

    return NextResponse.json(data[0])
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json(
      { error: 'Failed to update payment' },
      { status: 500 }
    )
  }
}
