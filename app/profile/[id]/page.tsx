'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { MapPin, MessageSquare, Phone, Star } from 'lucide-react'
import Header from '@/components/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import {
  formatDate,
  formatKES,
  getFullName,
  getInitials,
  ListingRecord,
  ProfileSummary,
} from '@/lib/marketplace'

type Review = {
  id: string
  rating: number
  title: string | null
  comment: string | null
  reviewer_id: string
  created_at: string
  transaction_type: string | null
}

type ReviewWithAuthor = Review & {
  reviewer: ProfileSummary | null
}

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [reviews, setReviews] = useState<ReviewWithAuthor[]>([])
  const [activeListings, setActiveListings] = useState<ListingRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [transactionType, setTransactionType] = useState('buyer')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    void hydrateProfile()
  }, [userId])

  const hydrateProfile = async () => {
    const supabase = createClient()
    setIsLoading(true)
    setLoadError(null)

    try {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setCurrentUser(user)
      } catch (authError) {
        console.error('Failed to resolve viewer session on profile page:', authError)
        setCurrentUser(null)
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone_number, location, bio, user_type')
        .eq('id', userId)
        .single()

      if (profileError || !profileData) {
        console.error('Error fetching profile:', profileError)
        setProfile(null)
        return
      }

      setProfile(profileData as ProfileSummary)

      const [{ data: reviewData }, { data: listingData }] = await Promise.all([
        supabase
          .from('reviews')
          .select('id, rating, title, comment, reviewer_id, created_at, transaction_type')
          .eq('reviewed_user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('car_listings')
          .select('*')
          .eq('seller_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(6),
      ])

      const reviewerIds = Array.from(new Set(((reviewData ?? []) as Review[]).map((review) => review.reviewer_id)))
      const { data: reviewerProfiles } = reviewerIds.length
        ? await supabase
            .from('profiles')
            .select('id, first_name, last_name, phone_number, location, bio, user_type')
            .in('id', reviewerIds)
        : { data: [] }

      const reviewersById = new Map(
        ((reviewerProfiles ?? []) as ProfileSummary[]).map((reviewer) => [reviewer.id, reviewer]),
      )

      setReviews(
        ((reviewData ?? []) as Review[]).map((review) => ({
          ...review,
          reviewer: reviewersById.get(review.reviewer_id) ?? null,
        })),
      )
      setActiveListings((listingData ?? []) as ListingRecord[])
    } catch (hydrateError) {
      console.error('Failed to load profile page:', hydrateError)
      setLoadError(hydrateError instanceof Error ? hydrateError.message : 'Failed to load this profile.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReviewSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!currentUser) {
      router.push('/auth/login')
      return
    }

    setIsSubmittingReview(true)
    setFeedback(null)
    setError(null)

    const response = await fetch('/api/reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reviewed_user_id: userId,
        rating,
        title: title.trim() || null,
        comment: comment.trim() || null,
        transaction_type: transactionType,
      }),
    })

    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(payload.error ?? 'Failed to submit review.')
    } else {
      setTitle('')
      setComment('')
      setTransactionType('buyer')
      setFeedback('Review submitted successfully.')
      await hydrateProfile()
    }

    setIsSubmittingReview(false)
  }

  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="container mx-auto px-4">
            <div className="h-[520px] animate-pulse rounded-[1.75rem] bg-muted" />
          </div>
        </main>
      </>
    )
  }

  if (!profile) {
    if (loadError) {
      return (
        <>
          <Header />
          <main className="min-h-screen py-8">
            <div className="container mx-auto px-4">
              <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
                <CardContent className="space-y-4 p-8">
                  <h1 className="text-3xl font-semibold">Profile could not load</h1>
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => void hydrateProfile()}>Try again</Button>
                    <Button variant="outline" asChild>
                      <Link href="/browse">Back to Browse</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </>
      )
    }

    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="container mx-auto px-4">
            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardContent className="space-y-4 p-8">
                <h1 className="text-3xl font-semibold">Profile not found</h1>
                <p className="text-sm text-muted-foreground">The requested seller or buyer profile does not exist.</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="min-h-screen py-8">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-6">
              <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
                <CardHeader>
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-2xl font-semibold text-primary-foreground">
                    {getInitials(profile)}
                  </div>
                  <CardTitle className="mt-4 text-3xl">{getFullName(profile)}</CardTitle>
                  <CardDescription className="capitalize">{profile.user_type} profile</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="h-4 w-4 text-primary" />
                    <span className="font-medium">{averageRating ? averageRating.toFixed(1) : 'No rating yet'}</span>
                    <span className="text-muted-foreground">({reviews.length} reviews)</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      {profile.phone_number ?? 'Phone not shared'}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {profile.location ?? 'Location not shared'}
                    </div>
                  </div>
                  {profile.bio ? <p className="text-sm leading-7 text-muted-foreground">{profile.bio}</p> : null}
                  {currentUser?.id !== profile.id ? (
                    <Button asChild className="w-full">
                      <Link href={`/messages?seller=${profile.id}`}>
                        <MessageSquare className="h-4 w-4" />
                        Message {profile.user_type}
                      </Link>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              {activeListings.length > 0 ? (
                <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle>Active Listings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {activeListings.map((listing) => (
                      <Link key={listing.id} href={`/listings/${listing.id}`} className="block rounded-2xl border border-border/70 p-4 transition hover:bg-muted/40">
                        <div className="font-medium">{listing.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {listing.year} {listing.make} {listing.model}
                        </div>
                        <div className="mt-2 text-sm font-medium text-primary">{formatKES(listing.price_ksh)}</div>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <div className="space-y-6">
              {currentUser?.id !== profile.id ? (
                <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle>Leave a review</CardTitle>
                    <CardDescription>Share transaction feedback to strengthen marketplace trust.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleReviewSubmit} className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium">Rating</label>
                        <div className="flex gap-2">
                          {Array.from({ length: 5 }).map((_, index) => {
                            const currentRating = index + 1
                            return (
                              <button
                                key={currentRating}
                                type="button"
                                onClick={() => setRating(currentRating)}
                                className="rounded-full p-2 transition hover:bg-muted"
                              >
                                <Star
                                  className={`h-5 w-5 ${
                                    currentRating <= rating ? 'fill-primary text-primary' : 'text-muted-foreground'
                                  }`}
                                />
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium">Review Title</label>
                          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Trusted seller, smooth handover..." />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium">Transaction Perspective</label>
                          <select
                            value={transactionType}
                            onChange={(event) => setTransactionType(event.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="buyer">Buyer</option>
                            <option value="seller">Seller</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium">Comment</label>
                        <textarea
                          rows={4}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                          placeholder="What should future buyers or sellers know?"
                        />
                      </div>

                      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
                      {feedback ? (
                        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                          {feedback}
                        </p>
                      ) : null}

                      <Button type="submit" disabled={isSubmittingReview}>
                        {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
                <CardHeader>
                  <CardTitle>Reviews & Ratings</CardTitle>
                  <CardDescription>
                    {reviews.length === 0 ? 'No reviews yet' : `${reviews.length} review${reviews.length === 1 ? '' : 's'}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {reviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No reviews have been published for this profile yet.</p>
                  ) : (
                    reviews.map((review) => (
                      <div key={review.id} className="rounded-2xl border border-border/70 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{getFullName(review.reviewer)}</div>
                            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                              {review.transaction_type ?? 'transaction'}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">{formatDate(review.created_at)}</div>
                        </div>
                        <div className="mt-3 flex gap-1">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                              key={index}
                              className={`h-4 w-4 ${index < review.rating ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                            />
                          ))}
                        </div>
                        {review.title ? <div className="mt-3 font-medium">{review.title}</div> : null}
                        {review.comment ? <p className="mt-2 text-sm leading-7 text-muted-foreground">{review.comment}</p> : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
