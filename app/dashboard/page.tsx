'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CarFront, ChartColumnBig, MessageSquare, ShieldCheck, Star } from 'lucide-react'
import Header from '@/components/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatKES, getFullName, ListingRecord, ProfileSummary } from '@/lib/marketplace'
import { ensureOwnProfile } from '@/lib/supabase/profile'

type DashboardStats = {
  totalListings: number
  activeListings: number
  unreadMessages: number
  totalViews: number
  openOffers: number
  reviewCount: number
}

type InquirySummary = {
  id: string
  listing_id: string
  status: string
  offered_price_ksh: number | null
  message: string | null
  created_at: string
}

const defaultStats: DashboardStats = {
  totalListings: 0,
  activeListings: 0,
  unreadMessages: 0,
  totalViews: 0,
  openOffers: 0,
  reviewCount: 0,
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [editData, setEditData] = useState<ProfileSummary | null>(null)
  const [listings, setListings] = useState<ListingRecord[]>([])
  const [recentOffers, setRecentOffers] = useState<InquirySummary[]>([])
  const [stats, setStats] = useState<DashboardStats>(defaultStats)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [requiresAuth, setRequiresAuth] = useState(false)

  useEffect(() => {
    void hydrateDashboard()
  }, [])

  const hydrateDashboard = async () => {
    const supabase = createClient()
    setIsLoading(true)
    setLoadError(null)
    setRequiresAuth(false)

    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) {
        throw authError
      }

      if (!currentUser) {
        setRequiresAuth(true)
        router.push('/auth/login?redirect=/dashboard')
        return
      }

      setUser(currentUser)

      const { profile: hydratedProfile, error: profileError } = await ensureOwnProfile(supabase, currentUser)

      if (profileError || !hydratedProfile) {
        setLoadError(profileError ?? 'We could not load your marketplace profile.')
        return
      }

      setProfile(hydratedProfile)
      setEditData(hydratedProfile)

      const isSellerLike = ['seller', 'dealer', 'admin'].includes(hydratedProfile.user_type)

      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('recipient_id', currentUser.id)
        .eq('is_read', false)

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('id')
        .eq('reviewed_user_id', currentUser.id)

      if (!isSellerLike) {
        const { data: buyerInquiries } = await supabase
          .from('inquiries')
          .select('id, listing_id, status, offered_price_ksh, message, created_at')
          .eq('buyer_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(5)

        setRecentOffers((buyerInquiries ?? []) as InquirySummary[])
        setStats({
          totalListings: 0,
          activeListings: 0,
          unreadMessages: unreadMessages?.length ?? 0,
          totalViews: 0,
          openOffers: (buyerInquiries ?? []).filter((inquiry) => inquiry.status === 'pending').length,
          reviewCount: reviewsData?.length ?? 0,
        })
        return
      }

      const { data: listingData } = await supabase
        .from('car_listings')
        .select('*')
        .eq('seller_id', currentUser.id)
        .order('created_at', { ascending: false })

      const sellerListings = (listingData ?? []) as ListingRecord[]
      setListings(sellerListings)

      const listingIds = sellerListings.map((listing) => listing.id)
      const [{ data: analyticsData }, { data: inquiriesData }] = await Promise.all([
        listingIds.length
          ? supabase.from('analytics').select('event_type, listing_id').in('listing_id', listingIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('inquiries')
          .select('id, listing_id, status, offered_price_ksh, message, created_at')
          .eq('seller_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      setRecentOffers((inquiriesData ?? []) as InquirySummary[])
      setStats({
        totalListings: sellerListings.length,
        activeListings: sellerListings.filter((listing) => listing.status === 'active').length,
        unreadMessages: unreadMessages?.length ?? 0,
        totalViews: (analyticsData ?? []).filter((event) => event.event_type === 'view').length,
        openOffers: (inquiriesData ?? []).filter((inquiry) => inquiry.status === 'pending').length,
        reviewCount: reviewsData?.length ?? 0,
      })
    } catch (hydrateError) {
      console.error('Failed to hydrate dashboard:', hydrateError)
      setLoadError(hydrateError instanceof Error ? hydrateError.message : 'Failed to load the dashboard.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleProfileUpdate = async () => {
    if (!user || !editData) {
      return
    }

    setIsSavingProfile(true)
    setError(null)
    setFeedback(null)

    const supabase = createClient()
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({
        first_name: editData.first_name,
        last_name: editData.last_name,
        phone_number: editData.phone_number,
        location: editData.location,
        bio: editData.bio,
      })
      .eq('id', user.id)
      .select('id, first_name, last_name, phone_number, location, bio, user_type')
      .single()

    if (updateError) {
      setError(updateError.message)
    } else {
      const updatedProfile = data as ProfileSummary
      setProfile(updatedProfile)
      setEditData(updatedProfile)
      setEditMode(false)
      setFeedback('Profile updated successfully.')
    }

    setIsSavingProfile(false)
  }

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="container mx-auto px-4">
            <div className="h-[560px] animate-pulse rounded-[1.75rem] bg-muted" />
          </div>
        </main>
      </>
    )
  }

  if (requiresAuth) {
    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="container mx-auto max-w-3xl px-4">
            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>Login required</CardTitle>
                <CardDescription>You need to sign in before AutoCore can load your dashboard.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/auth/login?redirect=/dashboard">Login</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/browse">Browse Cars</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    )
  }

  if (loadError && !profile) {
    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="container mx-auto max-w-3xl px-4">
            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>Dashboard could not load</CardTitle>
                <CardDescription>
                  The page hit an auth or profile-loading problem, so it now shows a recovery panel instead of a blank shell.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void hydrateDashboard()}>Try again</Button>
                  <Button variant="outline" asChild>
                    <Link href="/browse">Browse Cars</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    )
  }

  const isSellerLike = !!profile && ['seller', 'dealer', 'admin'].includes(profile.user_type)
  const statCards = isSellerLike
    ? [
        { label: 'Total Listings', value: stats.totalListings, icon: CarFront },
        { label: 'Active Listings', value: stats.activeListings, icon: ShieldCheck },
        { label: 'Unread Messages', value: stats.unreadMessages, icon: MessageSquare },
        { label: 'Listing Views', value: stats.totalViews, icon: ChartColumnBig },
      ]
    : [
        { label: 'Unread Messages', value: stats.unreadMessages, icon: MessageSquare },
        { label: 'Open Offers', value: stats.openOffers, icon: ShieldCheck },
        { label: 'Reviews', value: stats.reviewCount, icon: Star },
        { label: 'Buyer Profile', value: 1, icon: CarFront },
      ]

  return (
    <>
      <Header />
      <main className="min-h-screen py-8">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Dashboard</p>
              <h1 className="mt-2 text-4xl font-semibold">{getFullName(profile)}</h1>
              <p className="mt-2 text-sm text-muted-foreground capitalize">
                {profile?.user_type} workspace
              </p>
            </div>
            {profile ? (
              <Badge variant="secondary" className="rounded-full px-4 py-1 text-sm capitalize">
                {profile.user_type}
              </Badge>
            ) : null}
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((stat) => (
              <Card key={stat.label} className="rounded-[1.5rem] border-border/70 bg-card/90">
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <stat.icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mb-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Keep your marketplace identity current so buyers and sellers trust what they see.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!editMode && profile ? (
                  <>
                    <div>
                      <div className="text-sm text-muted-foreground">Name</div>
                      <div className="font-medium">{getFullName(profile)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Phone</div>
                      <div className="font-medium">{profile.phone_number ?? 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Location</div>
                      <div className="font-medium">{profile.location ?? 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Bio</div>
                      <div className="text-sm text-muted-foreground">{profile.bio ?? 'No bio yet'}</div>
                    </div>
                    <Button onClick={() => setEditMode(true)}>Edit Profile</Button>
                  </>
                ) : editData ? (
                  <>
                    <Field label="First Name">
                      <Input
                        value={editData.first_name ?? ''}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          setEditData((current) => (current ? { ...current, first_name: event.target.value } : current))
                        }
                      />
                    </Field>
                    <Field label="Last Name">
                      <Input
                        value={editData.last_name ?? ''}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          setEditData((current) => (current ? { ...current, last_name: event.target.value } : current))
                        }
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        value={editData.phone_number ?? ''}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          setEditData((current) => (current ? { ...current, phone_number: event.target.value } : current))
                        }
                      />
                    </Field>
                    <Field label="Location">
                      <Input
                        value={editData.location ?? ''}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          setEditData((current) => (current ? { ...current, location: event.target.value } : current))
                        }
                      />
                    </Field>
                    <Field label="Bio">
                      <textarea
                        rows={4}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={editData.bio ?? ''}
                        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setEditData((current) => (current ? { ...current, bio: event.target.value } : current))
                        }
                      />
                    </Field>
                    <div className="flex gap-3">
                      <Button onClick={handleProfileUpdate} disabled={isSavingProfile}>
                        {isSavingProfile ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditMode(false)
                          setEditData(profile)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Move directly into the next important workflow.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <ActionCard href="/browse" title="Browse inventory" description="Search current stock and compare listings." />
                <ActionCard href="/messages" title="Open inbox" description="Respond to buyers, sellers, and negotiations." />
                <ActionCard href="/sell" title="Publish listing" description="Add a new local or import unit." />
                <ActionCard href={`/profile/${user?.id}`} title="View public profile" description="See what other users see about you." />
              </CardContent>
            </Card>
          </div>

          {error ? <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {feedback ? (
            <p className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</p>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>{isSellerLike ? 'Recent buyer activity' : 'Recent offers'}</CardTitle>
                <CardDescription>
                  {isSellerLike
                    ? 'Offers and inbound negotiation context from your latest listing activity.'
                    : 'Offers you have sent and their current status.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentOffers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {isSellerLike
                      ? 'No offers yet. Once buyers start negotiating, the latest activity will show here.'
                      : 'You have not sent any offers yet. Browse listings and start the conversation.'}
                  </p>
                ) : (
                  recentOffers.map((offer) => (
                    <div key={offer.id} className="rounded-2xl border border-border/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-medium">Listing ID: {offer.listing_id}</div>
                        <Badge variant="secondary" className="capitalize">
                          {offer.status}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">{offer.message ?? 'No note added.'}</div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                        <div className="font-medium">
                          {offer.offered_price_ksh ? formatKES(offer.offered_price_ksh) : 'No amount specified'}
                        </div>
                        <div className="text-muted-foreground">{formatDate(offer.created_at)}</div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>{isSellerLike ? 'Your Listings' : 'Buyer Guidance'}</CardTitle>
                <CardDescription>
                  {isSellerLike
                    ? 'Track pricing, freshness, and live availability at a glance.'
                    : 'Your buyer account is ready for messaging, reviews, and negotiation.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isSellerLike ? (
                  listings.length === 0 ? (
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p>No listings yet. Publish your first unit to start collecting views and offers.</p>
                      <Button asChild>
                        <Link href="/sell">Create Listing</Link>
                      </Button>
                    </div>
                  ) : (
                    listings.map((listing) => (
                      <Link key={listing.id} href={`/listings/${listing.id}`} className="block rounded-2xl border border-border/70 p-4 transition hover:bg-muted/40">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{listing.title}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {listing.year} {listing.make} {listing.model}
                            </div>
                          </div>
                          <Badge variant="secondary" className="capitalize">
                            {listing.status}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                          <div className="font-medium text-primary">{formatKES(listing.price_ksh)}</div>
                          <div className="text-muted-foreground">Listed {formatDate(listing.created_at)}</div>
                        </div>
                      </Link>
                    ))
                  )
                ) : (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Use the browse page to discover listings, then message sellers directly or submit offers from a listing detail page.</p>
                    <p>Trust signals improve as reviews accumulate, so leave honest feedback after each transaction.</p>
                    <Button asChild>
                      <Link href="/browse">Browse Cars</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{label}</div>
      {children}
    </div>
  )
}

function ActionCard({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link href={href} className="rounded-2xl border border-border/70 p-4 transition hover:bg-muted/40">
      <div className="font-medium">{title}</div>
      <div className="mt-2 text-sm text-muted-foreground">{description}</div>
    </Link>
  )
}
