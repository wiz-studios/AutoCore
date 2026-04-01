'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, CarFront, CreditCard, Gauge, MapPin, MessageSquare, ShieldCheck } from 'lucide-react'
import Header from '@/components/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatKES, getFullName, ListingImage, ListingRecord, ProfileSummary } from '@/lib/marketplace'

export default function ListingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const listingId = params.id as string
  const viewTrackedRef = useRef(false)
  const [listing, setListing] = useState<ListingRecord | null>(null)
  const [seller, setSeller] = useState<ProfileSummary | null>(null)
  const [images, setImages] = useState<ListingImage[]>([])
  const [activeImage, setActiveImage] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [quickMessage, setQuickMessage] = useState('')
  const [offerAmount, setOfferAmount] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [reportReason, setReportReason] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isMessaging, setIsMessaging] = useState(false)
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false)
  const [isReporting, setIsReporting] = useState(false)

  useEffect(() => {
    void hydratePage()
  }, [listingId])

  useEffect(() => {
    if (!listing || viewTrackedRef.current) {
      return
    }

    viewTrackedRef.current = true
    void trackListingView()
  }, [listing, user?.id])

  const hydratePage = async () => {
    const supabase = createClient()
    setIsLoading(true)
    setFeedback(null)
    setError(null)

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()
    setUser(currentUser)

    const { data: listingData, error: listingError } = await supabase
      .from('car_listings')
      .select('*')
      .eq('id', listingId)
      .single()

    if (listingError || !listingData) {
      console.error('Error fetching listing:', listingError)
      setListing(null)
      setIsLoading(false)
      return
    }

    const [sellerResponse, imageResponse] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, first_name, last_name, phone_number, location, bio, user_type')
        .eq('id', listingData.seller_id)
        .single(),
      supabase
        .from('car_images')
        .select('id, listing_id, image_url, display_order')
        .eq('listing_id', listingData.id)
        .order('display_order', { ascending: true }),
    ])

    const fetchedImages = (imageResponse.data ?? []) as ListingImage[]
    setListing(listingData as ListingRecord)
    setSeller((sellerResponse.data as ProfileSummary | null) ?? null)
    setImages(fetchedImages)
    setActiveImage(fetchedImages[0]?.image_url ?? null)
    setIsLoading(false)
  }

  const trackListingView = async () => {
    if (!listing) {
      return
    }

    const supabase = createClient()
    await supabase.from('analytics').insert([
      {
        listing_id: listing.id,
        user_id: user?.id ?? null,
        event_type: 'view',
      },
    ])
  }

  const redirectToLogin = () => {
    router.push(`/auth/login?redirect=/listings/${listingId}`)
  }

  const handleQuickMessage = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!listing || !seller) {
      return
    }
    if (!user) {
      redirectToLogin()
      return
    }
    if (!quickMessage.trim()) {
      setError('Write a message before sending.')
      return
    }

    setIsMessaging(true)
    setError(null)
    setFeedback(null)
    const supabase = createClient()

    const { error: messageError } = await supabase.from('messages').insert([
      {
        sender_id: user.id,
        recipient_id: seller.id,
        listing_id: listing.id,
        subject: `Inquiry about ${listing.title}`,
        body: quickMessage.trim(),
        is_read: false,
      },
    ])

    if (messageError) {
      setError(messageError.message)
    } else {
      setQuickMessage('')
      setFeedback('Message sent. You can continue the conversation in your inbox.')
      router.push(`/messages?seller=${seller.id}`)
    }

    setIsMessaging(false)
  }

  const handleOfferSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!listing || !seller) {
      return
    }
    if (!user) {
      redirectToLogin()
      return
    }
    if (!offerAmount && !offerMessage.trim()) {
      setError('Add an offer amount or a negotiation note before submitting.')
      return
    }

    setIsSubmittingOffer(true)
    setError(null)
    setFeedback(null)

    const response = await fetch('/api/inquiries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listing_id: listing.id,
        seller_id: seller.id,
        offered_price_ksh: offerAmount ? Number(offerAmount) : null,
        message: offerMessage.trim() || null,
      }),
    })

    const payload = (await response.json()) as { error?: string }

    if (!response.ok) {
      setError(payload.error ?? 'Failed to submit offer.')
    } else {
      setOfferAmount('')
      setOfferMessage('')
      setFeedback('Offer submitted. The seller can now respond from their dashboard and messages.')
    }

    setIsSubmittingOffer(false)
  }

  const handleReportSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!listing) {
      return
    }
    if (!user) {
      redirectToLogin()
      return
    }
    if (!reportReason.trim()) {
      setError('Add a reason for the report.')
      return
    }

    setIsReporting(true)
    setError(null)
    setFeedback(null)

    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listing_id: listing.id,
        reason: reportReason.trim(),
        description: reportDescription.trim() || null,
      }),
    })

    const payload = (await response.json()) as { error?: string }

    if (!response.ok) {
      setError(payload.error ?? 'Failed to submit report.')
    } else {
      setReportReason('')
      setReportDescription('')
      setFeedback('Listing reported. The trust and safety queue has been updated.')
    }

    setIsReporting(false)
  }

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="container mx-auto px-4">
            <div className="h-[480px] animate-pulse rounded-[1.75rem] bg-muted" />
          </div>
        </main>
      </>
    )
  }

  if (!listing) {
    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="container mx-auto px-4">
            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardContent className="space-y-4 p-8">
                <h1 className="text-3xl font-semibold">Listing not found</h1>
                <p className="text-sm text-muted-foreground">
                  The listing may have been removed, sold, or never existed in this environment.
                </p>
                <Button asChild>
                  <Link href="/browse">Back to Browse</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    )
  }

  const mainImage = activeImage ?? images[0]?.image_url ?? null
  const isOwnListing = user?.id && user.id === listing.seller_id

  return (
    <>
      <Header />
      <main className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <Button variant="outline" asChild className="mb-6">
            <Link href="/browse">Back to Browse</Link>
          </Button>

          <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-8">
              <Card className="overflow-hidden rounded-[2rem] border-border/70 bg-card/90">
                <div className="relative h-[420px] overflow-hidden bg-muted">
                  {mainImage ? (
                    <img src={mainImage} alt={listing.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <CarFront className="h-16 w-16" />
                    </div>
                  )}
                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    {listing.featured ? <Badge>Featured</Badge> : null}
                    {listing.condition_type ? <Badge variant="secondary">{listing.condition_type}</Badge> : null}
                    {listing.source_type ? <Badge variant="secondary">{listing.source_type}</Badge> : null}
                  </div>
                </div>
                {images.length > 1 ? (
                  <div className="grid grid-cols-4 gap-3 p-4">
                    {images.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setActiveImage(image.image_url)}
                        className={`overflow-hidden rounded-2xl border ${
                          activeImage === image.image_url ? 'border-primary' : 'border-border/70'
                        }`}
                      >
                        <img src={image.image_url} alt={listing.title} className="h-24 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </Card>

              <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
                <CardContent className="space-y-6 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-3xl font-semibold text-primary">{formatKES(listing.price_ksh)}</div>
                      <h1 className="mt-2 text-4xl font-semibold text-balance">{listing.title}</h1>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {listing.year} {listing.make} {listing.model}
                      </p>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {listing.location ?? seller?.location ?? 'Location pending'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-primary" />
                        {listing.mileage ? `${listing.mileage.toLocaleString()} km` : 'Mileage on request'}
                      </div>
                      <div>Listed {formatDate(listing.created_at)}</div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Spec label="Transmission" value={listing.transmission ?? 'Not set'} />
                    <Spec label="Fuel Type" value={listing.fuel_type ?? 'Not set'} />
                    <Spec label="Body Type" value={listing.body_type ?? 'Not set'} />
                    <Spec label="Color" value={listing.color ?? 'Not set'} />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">Vehicle Description</h2>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{listing.description}</p>
                  </div>

                  {listing.source_type === 'import' ? (
                    <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
                      <p className="font-medium">Import support details</p>
                      <p className="mt-1 text-muted-foreground">
                        Clearing agent: {listing.clearing_agent_name ?? 'Not specified'}.
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
                <CardHeader>
                  <CardTitle>Seller</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-xl font-semibold">{getFullName(seller)}</div>
                    <div className="mt-1 text-sm capitalize text-muted-foreground">
                      {seller?.user_type ?? 'seller'} account
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Trust Layer
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      Messaging, reviews, reporting, and profile verification are designed to reduce marketplace noise.
                    </p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>Phone: {seller?.phone_number ?? 'Not provided'}</div>
                    <div>Location: {seller?.location ?? 'Not provided'}</div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => (user ? router.push(`/messages?seller=${seller?.id}`) : redirectToLogin())}>
                      <MessageSquare className="h-4 w-4" />
                      Open Inbox
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/profile/${seller?.id}`}>View Profile</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {!isOwnListing ? (
                <>
                  <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
                    <CardHeader>
                      <CardTitle>Send a quick message</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleQuickMessage} className="space-y-3">
                        <textarea
                          rows={4}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          placeholder="Is the car still available? Can I schedule a viewing?"
                          value={quickMessage}
                          onChange={(event) => setQuickMessage(event.target.value)}
                        />
                        <Button type="submit" disabled={isMessaging}>
                          {isMessaging ? 'Sending...' : 'Send Message'}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
                    <CardHeader>
                      <CardTitle>Make an offer</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleOfferSubmit} className="space-y-3">
                        <Input
                          type="number"
                          value={offerAmount}
                          onChange={(event) => setOfferAmount(event.target.value)}
                          placeholder="Offer amount in KES"
                        />
                        <textarea
                          rows={3}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          placeholder="Share your terms, timing, or viewing request."
                          value={offerMessage}
                          onChange={(event) => setOfferMessage(event.target.value)}
                        />
                        <Button type="submit" variant="secondary" disabled={isSubmittingOffer}>
                          {isSubmittingOffer ? 'Submitting...' : 'Submit Offer'}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
                    <CardHeader>
                      <CardTitle>Fraud prevention</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleReportSubmit} className="space-y-3">
                        <Input
                          value={reportReason}
                          onChange={(event) => setReportReason(event.target.value)}
                          placeholder="Reason for reporting"
                        />
                        <textarea
                          rows={3}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          placeholder="Add extra detail for the moderation team."
                          value={reportDescription}
                          onChange={(event) => setReportDescription(event.target.value)}
                        />
                        <Button type="submit" variant="outline" disabled={isReporting}>
                          <AlertTriangle className="h-4 w-4" />
                          {isReporting ? 'Submitting...' : 'Report Listing'}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle>Seller actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>This is your listing. Use the dashboard to track messages, offers, and performance.</p>
                    <Button asChild>
                      <Link href="/dashboard">Open Dashboard</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
                <CardHeader>
                  <CardTitle>Secure payment path</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <CreditCard className="h-4 w-4 text-primary" />
                    M-Pesa and escrow-ready payment records
                  </div>
                  <p>Use negotiation first, then move into platform-tracked payments to preserve a clean transaction trail.</p>
                </CardContent>
              </Card>

              {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
              {feedback ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</p>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-medium capitalize">{value}</div>
    </div>
  )
}
