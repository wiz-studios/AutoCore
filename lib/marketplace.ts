export type UserType = 'buyer' | 'seller' | 'dealer' | 'admin'
export type ListingCondition = 'new' | 'used'
export type ListingSource = 'local' | 'import'
export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric'
export type Transmission = 'manual' | 'automatic'
export type InquiryStatus = 'pending' | 'accepted' | 'rejected' | 'sold'

export type ProfileSummary = {
  id: string
  first_name: string | null
  last_name: string | null
  phone_number: string | null
  location: string | null
  bio?: string | null
  user_type: UserType
}

export type ListingImage = {
  id: string
  listing_id: string
  image_url: string
  display_order: number | null
}

export type ListingRecord = {
  id: string
  seller_id: string
  title: string
  description: string
  make: string
  model: string
  year: number
  price_ksh: number
  mileage: number | null
  transmission: Transmission | null
  fuel_type: FuelType | null
  color: string | null
  body_type: string | null
  location: string | null
  condition_type: ListingCondition | null
  source_type: ListingSource | null
  clearing_agent_name: string | null
  status: 'active' | 'sold' | 'delisted'
  featured: boolean | null
  created_at: string
}

export type InquiryRecord = {
  id: string
  buyer_id: string
  seller_id: string
  listing_id: string
  offered_price_ksh: number | null
  message: string | null
  status: InquiryStatus
  created_at: string
}

export const accountTypes: Array<{ value: Exclude<UserType, 'admin'>; label: string; description: string }> = [
  {
    value: 'buyer',
    label: 'Buyer',
    description: 'Track saved cars, message sellers, and negotiate safely.',
  },
  {
    value: 'seller',
    label: 'Private Seller',
    description: 'List your own vehicle and manage direct buyer conversations.',
  },
  {
    value: 'dealer',
    label: 'Dealer',
    description: 'Manage multiple stock units and build a trusted showroom profile.',
  },
]

export const conditionOptions: Array<{ value: ListingCondition; label: string }> = [
  { value: 'used', label: 'Used' },
  { value: 'new', label: 'New' },
]

export const sourceOptions: Array<{ value: ListingSource; label: string }> = [
  { value: 'local', label: 'Local Stock' },
  { value: 'import', label: 'Import / On Order' },
]

export const fuelOptions: Array<{ value: FuelType; label: string }> = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'electric', label: 'Electric' },
]

export const transmissionOptions: Array<{ value: Transmission; label: string }> = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'manual', label: 'Manual' },
]

export const kenyaMarketHighlights = [
  'M-Pesa-first checkout for deposits and escrow milestones',
  'Dealer and private-seller onboarding with trust signals',
  'Import and clearing-agent friendly listing fields',
  'Support flows aligned to Kenya vehicle transfer expectations',
]

const kesFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
})

export function formatKES(value: number | string | null | undefined) {
  const numericValue = typeof value === 'string' ? Number(value) : value
  if (numericValue == null || Number.isNaN(numericValue)) {
    return 'KES 0'
  }

  return kesFormatter.format(numericValue)
}

export function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '0'
  }

  return new Intl.NumberFormat('en-KE').format(value)
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Recently'
  }

  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function getFullName(profile: Pick<ProfileSummary, 'first_name' | 'last_name'> | null | undefined) {
  if (!profile) {
    return 'Marketplace user'
  }

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  return name || 'Marketplace user'
}

export function getInitials(profile: Pick<ProfileSummary, 'first_name' | 'last_name'> | null | undefined) {
  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase()

  return initials || 'AC'
}

export function coerceImageUrls(urls: string[]) {
  return urls
    .map((value) => value.trim())
    .filter(Boolean)
}

export function getInquiryStatusLabel(status: InquiryStatus | string | null | undefined) {
  switch (status) {
    case 'accepted':
      return 'Accepted'
    case 'rejected':
      return 'Rejected'
    case 'sold':
      return 'Sold'
    case 'pending':
    default:
      return 'Pending'
  }
}

export function getInquiryStatusVariant(status: InquiryStatus | string | null | undefined) {
  switch (status) {
    case 'accepted':
      return 'default'
    case 'rejected':
      return 'destructive'
    case 'sold':
      return 'outline'
    case 'pending':
    default:
      return 'secondary'
  }
}
