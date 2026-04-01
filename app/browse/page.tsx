'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CarFront, Fuel, Gauge, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import Header from '@/components/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import {
  conditionOptions,
  formatDate,
  formatKES,
  ListingImage,
  ListingRecord,
  ProfileSummary,
  sourceOptions,
} from '@/lib/marketplace'

type BrowseListing = ListingRecord & {
  seller: ProfileSummary | null
  primaryImage: string | null
}

const defaultFilters = {
  search: '',
  make: '',
  location: '',
  condition: '',
  source: '',
  fuel: '',
  minPrice: '',
  maxPrice: '',
  minYear: '',
}

export default function BrowsePage() {
  const [listings, setListings] = useState<BrowseListing[]>([])
  const [filteredListings, setFilteredListings] = useState<BrowseListing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState(defaultFilters)

  useEffect(() => {
    void fetchListings()
  }, [])

  useEffect(() => {
    setFilteredListings(
      listings.filter((listing) => {
        const normalizedQuery = filters.search.trim().toLowerCase()
        const haystack = [listing.title, listing.make, listing.model, listing.location]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        const minPrice = filters.minPrice ? Number(filters.minPrice) : null
        const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null
        const minYear = filters.minYear ? Number(filters.minYear) : null

        return (
          (!normalizedQuery || haystack.includes(normalizedQuery)) &&
          (!filters.make || listing.make === filters.make) &&
          (!filters.location || listing.location === filters.location) &&
          (!filters.condition || listing.condition_type === filters.condition) &&
          (!filters.source || listing.source_type === filters.source) &&
          (!filters.fuel || listing.fuel_type === filters.fuel) &&
          (minPrice == null || listing.price_ksh >= minPrice) &&
          (maxPrice == null || listing.price_ksh <= maxPrice) &&
          (minYear == null || listing.year >= minYear)
        )
      }),
    )
  }, [filters, listings])

  const fetchListings = async () => {
    const supabase = createClient()
    setIsLoading(true)

    const { data, error } = await supabase
      .from('car_listings')
      .select('*')
      .eq('status', 'active')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching listings:', error)
      setListings([])
      setIsLoading(false)
      return
    }

    const listingRows = ((data ?? []) as ListingRecord[])
    const sellerIds = Array.from(new Set(listingRows.map((listing) => listing.seller_id)))
    const listingIds = listingRows.map((listing) => listing.id)

    const [{ data: profileData }, { data: imageData }] = await Promise.all([
      sellerIds.length
        ? supabase
            .from('profiles')
            .select('id, first_name, last_name, phone_number, location, user_type, bio')
            .in('id', sellerIds)
        : Promise.resolve({ data: [] as ProfileSummary[] }),
      listingIds.length
        ? supabase
            .from('car_images')
            .select('id, listing_id, image_url, display_order')
            .in('listing_id', listingIds)
            .order('display_order', { ascending: true })
        : Promise.resolve({ data: [] as ListingImage[] }),
    ])

    const profilesById = new Map(
      ((profileData ?? []) as ProfileSummary[]).map((profile) => [profile.id, profile]),
    )
    const imagesByListing = new Map<string, ListingImage[]>()

    for (const image of (imageData ?? []) as ListingImage[]) {
      const existingImages = imagesByListing.get(image.listing_id) ?? []
      existingImages.push(image)
      imagesByListing.set(image.listing_id, existingImages)
    }

    const mergedListings = listingRows.map((listing) => {
      const images = imagesByListing.get(listing.id) ?? []

      return {
        ...listing,
        seller: profilesById.get(listing.seller_id) ?? null,
        primaryImage: images[0]?.image_url ?? null,
      }
    })

    setListings(mergedListings)
    setIsLoading(false)
  }

  const makes = Array.from(new Set(listings.map((listing) => listing.make))).sort()
  const locations = Array.from(
    new Set(
      listings
        .map((listing) => listing.location)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort()
  const fuelTypes = Array.from(
    new Set(
      listings
        .map((listing) => listing.fuel_type)
        .filter((value): value is NonNullable<ListingRecord['fuel_type']> => Boolean(value)),
    ),
  ).sort()

  return (
    <>
      <Header />
      <main className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Inventory</p>
              <h1 className="mt-2 text-4xl font-semibold">Browse cars across Kenya</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Search by make, location, condition, or import status and move directly into seller conversations.
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full px-4 py-1 text-sm">
              {filteredListings.length} listings
            </Badge>
          </div>

          <Card className="mb-8 rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </div>
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Search</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Title, make, model, location..."
                      value={filters.search}
                      onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    />
                  </div>
                </div>

                <FilterSelect
                  label="Make"
                  value={filters.make}
                  onChange={(value) => setFilters((current) => ({ ...current, make: value }))}
                  options={makes}
                  allLabel="All makes"
                />
                <FilterSelect
                  label="Location"
                  value={filters.location}
                  onChange={(value) => setFilters((current) => ({ ...current, location: value }))}
                  options={locations}
                  allLabel="All locations"
                />
                <FilterSelect
                  label="Condition"
                  value={filters.condition}
                  onChange={(value) => setFilters((current) => ({ ...current, condition: value }))}
                  options={conditionOptions.map((option) => option.value)}
                  allLabel="Any condition"
                />
                <FilterSelect
                  label="Source"
                  value={filters.source}
                  onChange={(value) => setFilters((current) => ({ ...current, source: value }))}
                  options={sourceOptions.map((option) => option.value)}
                  allLabel="Local or import"
                />
                <FilterSelect
                  label="Fuel Type"
                  value={filters.fuel}
                  onChange={(value) => setFilters((current) => ({ ...current, fuel: value }))}
                  options={fuelTypes}
                  allLabel="Any fuel"
                />
                <NumberFilter
                  label="Min Price"
                  placeholder="0"
                  value={filters.minPrice}
                  onChange={(value) => setFilters((current) => ({ ...current, minPrice: value }))}
                />
                <NumberFilter
                  label="Max Price"
                  placeholder="10,000,000"
                  value={filters.maxPrice}
                  onChange={(value) => setFilters((current) => ({ ...current, maxPrice: value }))}
                />
                <NumberFilter
                  label="From Year"
                  placeholder="2018"
                  value={filters.minYear}
                  onChange={(value) => setFilters((current) => ({ ...current, minYear: value }))}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" onClick={() => setFilters(defaultFilters)}>
                  Reset Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[360px] animate-pulse rounded-[1.75rem] bg-muted" />
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-border bg-card/70 px-6 py-14 text-center">
              <h2 className="text-2xl font-semibold">No listings match those filters</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Reset your filters or adjust the search terms to expand the inventory results.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredListings.map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`}>
                  <Card className="h-full overflow-hidden rounded-[1.75rem] border-border/70 bg-card/90 transition hover:-translate-y-1 hover:shadow-lg">
                    <div className="relative h-56 w-full overflow-hidden bg-muted">
                      {listing.primaryImage ? (
                        <img
                          src={listing.primaryImage}
                          alt={listing.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <CarFront className="h-12 w-12" />
                        </div>
                      )}
                      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                        {listing.featured ? <Badge>Featured</Badge> : null}
                        {listing.condition_type ? <Badge variant="secondary">{listing.condition_type}</Badge> : null}
                        {listing.source_type ? <Badge variant="secondary">{listing.source_type}</Badge> : null}
                      </div>
                    </div>

                    <CardContent className="space-y-4 p-5">
                      <div>
                        <div className="text-2xl font-semibold text-primary">{formatKES(listing.price_ksh)}</div>
                        <h2 className="mt-2 line-clamp-2 text-xl font-semibold">{listing.title}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {listing.year} {listing.make} {listing.model}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-primary" />
                          {listing.mileage ? `${listing.mileage.toLocaleString()} km` : 'Mileage on request'}
                        </div>
                        <div className="flex items-center gap-2">
                          <Fuel className="h-4 w-4 text-primary" />
                          {listing.fuel_type ?? 'Fuel not set'}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          {listing.location ?? listing.seller?.location ?? 'Location pending'}
                        </div>
                        <div className="truncate">{listing.body_type ?? 'Body type pending'}</div>
                      </div>

                      <div className="flex items-center justify-between border-t border-border/70 pt-4 text-sm">
                        <div>
                          <div className="font-medium">
                            {listing.seller?.first_name || 'Marketplace'} {listing.seller?.last_name || 'Seller'}
                          </div>
                          <div className="text-muted-foreground">Listed {formatDate(listing.created_at)}</div>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                          View Details
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  allLabel: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

function NumberFilter({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <Input type="number" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
