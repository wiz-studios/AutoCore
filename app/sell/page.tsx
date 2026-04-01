'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ShieldCheck, Upload } from 'lucide-react'
import Header from '@/components/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import {
  coerceImageUrls,
  conditionOptions,
  formatKES,
  fuelOptions,
  ProfileSummary,
  sourceOptions,
  transmissionOptions,
} from '@/lib/marketplace'
import { ensureOwnProfile } from '@/lib/supabase/profile'

type ListingFormState = {
  title: string
  description: string
  make: string
  model: string
  year: string
  price_ksh: string
  mileage: string
  transmission: string
  fuel_type: string
  color: string
  body_type: string
  location: string
  condition_type: string
  source_type: string
  clearing_agent_name: string
}

const initialFormState: ListingFormState = {
  title: '',
  description: '',
  make: '',
  model: '',
  year: String(new Date().getFullYear()),
  price_ksh: '',
  mileage: '',
  transmission: 'automatic',
  fuel_type: 'petrol',
  color: '',
  body_type: '',
  location: '',
  condition_type: 'used',
  source_type: 'local',
  clearing_agent_name: '',
}

export default function SellPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [requiresAuth, setRequiresAuth] = useState(false)
  const [formData, setFormData] = useState<ListingFormState>(initialFormState)
  const [imageUrls, setImageUrls] = useState(['', '', ''])

  useEffect(() => {
    void hydratePage()
  }, [])

  const hydratePage = async () => {
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
        router.push('/auth/login?redirect=/sell')
        return
      }

      const { profile: profileData, error: profileError } = await ensureOwnProfile(supabase, currentUser)

      setUser(currentUser)

      if (profileError || !profileData) {
        setLoadError(profileError ?? 'We could not load your seller profile right now.')
        return
      }

      setProfile(profileData)
      setFormData((current) => ({
        ...current,
        location: profileData.location ?? current.location,
      }))
    } catch (hydrateError) {
      console.error('Failed to hydrate sell page:', hydrateError)
      setLoadError(hydrateError instanceof Error ? hydrateError.message : 'Failed to load the sell page.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof ListingFormState, value: string) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleImageChange = (index: number, value: string) => {
    setImageUrls((current) => current.map((url, currentIndex) => (currentIndex === index ? value : url)))
  }

  const upgradeBuyerAccount = async () => {
    if (!user) {
      return
    }

    setIsUpgrading(true)
    setError(null)

    const supabase = createClient()
    const { data, error: upgradeError } = await supabase
      .from('profiles')
      .update({ user_type: 'seller' })
      .eq('id', user.id)
      .select('id, first_name, last_name, phone_number, location, bio, user_type')
      .single()

    if (upgradeError) {
      setError(upgradeError.message)
    } else {
      setProfile((data as ProfileSummary | null) ?? null)
      setSuccess('Your account is now seller-enabled. Finish publishing your first listing below.')
    }

    setIsUpgrading(false)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!user) {
      setError('You must be signed in to list a vehicle.')
      return
    }

    if (profile?.user_type === 'buyer') {
      setError('Upgrade your buyer account to seller before publishing a listing.')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()

    const { data: listingData, error: insertError } = await supabase
      .from('car_listings')
      .insert([
        {
          seller_id: user.id,
          title: formData.title,
          description: formData.description,
          make: formData.make,
          model: formData.model,
          year: Number(formData.year),
          price_ksh: Number(formData.price_ksh),
          mileage: formData.mileage ? Number(formData.mileage) : null,
          transmission: formData.transmission,
          fuel_type: formData.fuel_type,
          color: formData.color || null,
          body_type: formData.body_type || null,
          location: formData.location || null,
          condition_type: formData.condition_type,
          source_type: formData.source_type,
          clearing_agent_name:
            formData.source_type === 'import' && formData.clearing_agent_name
              ? formData.clearing_agent_name
              : null,
          status: 'active',
        },
      ])
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setIsSubmitting(false)
      return
    }

    const cleanedImageUrls = coerceImageUrls(imageUrls)
    if (cleanedImageUrls.length > 0) {
      const { error: imageInsertError } = await supabase.from('car_images').insert(
        cleanedImageUrls.map((imageUrl, index) => ({
          listing_id: listingData.id,
          image_url: imageUrl,
          display_order: index,
        })),
      )

      if (imageInsertError) {
        setError(`Listing created, but image upload links failed: ${imageInsertError.message}`)
        setIsSubmitting(false)
        return
      }
    }

    setSuccess('Vehicle published successfully. Redirecting to the live listing.')
    setFormData(initialFormState)
    setImageUrls(['', '', ''])
    setIsSubmitting(false)
    window.setTimeout(() => {
      router.push(`/listings/${listingData.id}`)
    }, 900)
  }

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="container mx-auto px-4">
            <div className="h-48 animate-pulse rounded-[1.75rem] bg-muted" />
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
                <CardDescription>You need an account before you can publish a vehicle listing.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/auth/login?redirect=/sell">Login</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/auth/sign-up">Create account</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    )
  }

  if (loadError) {
    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="container mx-auto max-w-3xl px-4">
            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>Sell page could not load</CardTitle>
                <CardDescription>
                  We could not finish loading your marketplace workspace, so the page was left intentionally visible instead of blank.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void hydratePage()}>Try again</Button>
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

  return (
    <>
      <Header />
      <main className="min-h-screen py-8">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Seller Studio</p>
              <h1 className="mt-2 text-4xl font-semibold">Publish a car listing</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Create local or import inventory with the pricing, location, and trust signals buyers need to act.
              </p>
            </div>
            {profile ? (
              <Badge variant="secondary" className="rounded-full px-4 py-1 text-sm capitalize">
                {profile.user_type} account
              </Badge>
            ) : null}
          </div>

          <div className="mb-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardContent className="flex h-full items-center gap-4 p-6">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium">Buyer confidence starts with completeness.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Listings with clear pricing, images, source details, and location convert better than bare-minimum posts.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Preview price format</p>
                <p className="mt-2 text-3xl font-semibold text-primary">
                  {formData.price_ksh ? formatKES(Number(formData.price_ksh)) : 'KES 0'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Keep your headline price realistic, then use messaging and offers to negotiate.
                </p>
              </CardContent>
            </Card>
          </div>

          {profile?.user_type === 'buyer' ? (
            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>Upgrade buyer account to seller</CardTitle>
                <CardDescription>
                  Buyer accounts can browse and message. Seller access unlocks listing creation.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-4">
                <Button onClick={upgradeBuyerAccount} disabled={isUpgrading}>
                  {isUpgrading ? 'Upgrading...' : 'Enable Seller Access'}
                </Button>
                <Button variant="outline" asChild>
                  <a href="/browse">
                    Keep Browsing
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-[1.75rem] border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>Vehicle Details</CardTitle>
                <CardDescription>Provide clean, accurate data so buyers can trust the listing immediately.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Listing Basics</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Listing Title">
                        <Input
                          value={formData.title}
                          placeholder="2019 Mazda CX-5 AWD, low mileage"
                          onChange={(event) => handleInputChange('title', event.target.value)}
                          required
                        />
                      </Field>
                      <Field label="Location">
                        <Input
                          value={formData.location}
                          placeholder="Nairobi, Mombasa, Kisumu..."
                          onChange={(event) => handleInputChange('location', event.target.value)}
                          required
                        />
                      </Field>
                    </div>

                    <Field label="Description">
                      <textarea
                        rows={5}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Condition, ownership history, maintenance notes, standout features..."
                        value={formData.description}
                        onChange={(event) => handleInputChange('description', event.target.value)}
                        required
                      />
                    </Field>
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Vehicle Specifications</h2>
                    <div className="grid gap-4 md:grid-cols-4">
                      <Field label="Make">
                        <Input value={formData.make} onChange={(event) => handleInputChange('make', event.target.value)} required />
                      </Field>
                      <Field label="Model">
                        <Input value={formData.model} onChange={(event) => handleInputChange('model', event.target.value)} required />
                      </Field>
                      <Field label="Year">
                        <Input
                          type="number"
                          value={formData.year}
                          onChange={(event) => handleInputChange('year', event.target.value)}
                          required
                        />
                      </Field>
                      <Field label="Mileage (km)">
                        <Input
                          type="number"
                          value={formData.mileage}
                          onChange={(event) => handleInputChange('mileage', event.target.value)}
                        />
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Body Type">
                        <Input
                          value={formData.body_type}
                          placeholder="SUV, Sedan, Hatchback..."
                          onChange={(event) => handleInputChange('body_type', event.target.value)}
                        />
                      </Field>
                      <Field label="Color">
                        <Input value={formData.color} onChange={(event) => handleInputChange('color', event.target.value)} />
                      </Field>
                      <Field label="Price (KES)">
                        <Input
                          type="number"
                          value={formData.price_ksh}
                          onChange={(event) => handleInputChange('price_ksh', event.target.value)}
                          required
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Marketplace Positioning</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <SelectField
                        label="Condition"
                        value={formData.condition_type}
                        onChange={(value) => handleInputChange('condition_type', value)}
                        options={conditionOptions.map((option) => option.value)}
                      />
                      <SelectField
                        label="Source"
                        value={formData.source_type}
                        onChange={(value) => handleInputChange('source_type', value)}
                        options={sourceOptions.map((option) => option.value)}
                      />
                      <SelectField
                        label="Transmission"
                        value={formData.transmission}
                        onChange={(value) => handleInputChange('transmission', value)}
                        options={transmissionOptions.map((option) => option.value)}
                      />
                      <SelectField
                        label="Fuel Type"
                        value={formData.fuel_type}
                        onChange={(value) => handleInputChange('fuel_type', value)}
                        options={fuelOptions.map((option) => option.value)}
                      />
                    </div>

                    {formData.source_type === 'import' ? (
                      <Field label="Clearing Agent / Import Partner">
                        <Input
                          value={formData.clearing_agent_name}
                          placeholder="Agent or company handling the import"
                          onChange={(event) => handleInputChange('clearing_agent_name', event.target.value)}
                        />
                      </Field>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      <h2 className="text-lg font-semibold">Image URLs</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Add up to three direct image URLs for now. This keeps the gallery live without waiting on storage wiring.
                    </p>
                    <div className="grid gap-4">
                      {imageUrls.map((imageUrl, index) => (
                        <Field key={index} label={`Image URL ${index + 1}`}>
                          <Input
                            value={imageUrl}
                            placeholder="https://..."
                            onChange={(event) => handleImageChange(index, event.target.value)}
                          />
                        </Field>
                      ))}
                    </div>
                  </div>

                  {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
                  {success ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {success}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" size="lg" disabled={isSubmitting}>
                      {isSubmitting ? 'Publishing...' : 'Publish Listing'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setFormData(initialFormState)}>
                      Reset Form
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
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
      <label className="mb-2 block text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
      >
        {options.map((option) => (
          <option key={option} value={option} className="capitalize">
            {option}
          </option>
        ))}
      </select>
    </Field>
  )
}
