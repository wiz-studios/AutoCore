import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type SignUpPayload = {
  email?: string
  password?: string
  first_name?: string
  last_name?: string
  phone_number?: string
  user_type?: 'buyer' | 'seller' | 'dealer'
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SignUpPayload
    const email = payload.email?.trim().toLowerCase()
    const password = payload.password ?? ''
    const firstName = payload.first_name?.trim() ?? ''
    const lastName = payload.last_name?.trim() ?? ''
    const phoneNumber = payload.phone_number?.trim() ?? ''
    const userType = payload.user_type

    if (!email || !password || !firstName || !lastName || !phoneNumber || !userType) {
      return NextResponse.json({ error: 'All signup fields are required.' }, { status: 400 })
    }

    if (!['buyer', 'seller', 'dealer'].includes(userType)) {
      return NextResponse.json({ error: 'Unsupported account type.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        user_type: userType,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      user: {
        id: data.user?.id ?? null,
        email: data.user?.email ?? email,
      },
    })
  } catch (error) {
    console.error('Signup route failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Signup failed.' },
      { status: 500 },
    )
  }
}
