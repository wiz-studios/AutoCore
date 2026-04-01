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
    const { reviewed_user_id, rating, title, comment, transaction_type } =
      await request.json()

    if (!reviewed_user_id || !rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Invalid review data' },
        { status: 400 }
      )
    }

    if (reviewed_user_id === user.id) {
      return NextResponse.json(
        { error: 'You cannot review your own profile' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert([
        {
          reviewer_id: user.id,
          reviewed_user_id,
          rating,
          title: title?.trim() || null,
          comment: comment?.trim() || null,
          transaction_type: transaction_type || null,
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')

  if (!userId) {
    return NextResponse.json(
      { error: 'user_id parameter required' },
      { status: 400 }
    )
  }

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('reviewed_user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    )
  }
}
