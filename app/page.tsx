import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CarFront,
  CreditCard,
  MapPinned,
  MessageSquare,
  Search,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Header from '@/components/header'
import { kenyaMarketHighlights } from '@/lib/marketplace'

export default function Home() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        <section className="overflow-hidden py-20">
          <div className="container mx-auto grid gap-10 px-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-2 text-sm text-primary">
                <ShieldCheck className="h-4 w-4" />
                Buyer trust, dealer growth, and import-ready workflows
              </div>
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance md:text-6xl">
                Kenya&apos;s sharper marketplace for buying, selling, and stocking cars.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                AutoCore brings together private sellers, dealers, buyers, and import-focused partners with listing tools,
                verified profiles, in-app negotiation, and M-Pesa-ready payments built around the Kenyan market.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button size="lg" asChild>
                  <Link href="/browse">Browse Cars</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/auth/sign-up">Create Seller Account</Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/sell">
                    List a Car
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {kenyaMarketHighlights.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-border/70 bg-card/80 px-4 py-4 text-sm text-card-foreground shadow-sm"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-xl shadow-primary/5">
              <div className="rounded-[1.5rem] bg-primary px-5 py-6 text-primary-foreground">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-primary-foreground/80">Live Marketplace</p>
                    <h2 className="mt-3 text-3xl font-semibold">Move stock faster, buy with more signal.</h2>
                  </div>
                  <CarFront className="mt-1 h-7 w-7" />
                </div>
              </div>
              {heroStats.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-5 py-4"
                >
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                  </div>
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="mb-10 max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Core Capabilities</p>
              <h2 className="mt-3 text-3xl font-semibold text-balance">Built for the way vehicles move in Kenya.</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="rounded-[1.75rem] border border-border/70 bg-card/90 p-6 shadow-sm">
                  <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3 text-primary">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto grid gap-6 px-4 md:grid-cols-3">
            {journeys.map((journey) => (
              <div key={journey.title} className="rounded-[1.75rem] border border-border/70 bg-background/90 p-6">
                <h3 className="text-xl font-semibold">{journey.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{journey.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4">
            <div
              className="rounded-[2rem] px-6 py-10 text-primary-foreground shadow-2xl shadow-primary/15 md:px-10"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 94%, black) 0%, color-mix(in srgb, var(--color-primary) 74%, #0f172a) 100%)',
              }}
            >
              <div className="max-w-3xl">
                <p className="text-sm uppercase tracking-[0.24em] text-primary-foreground/80">Launch Ready</p>
                <h2 className="mt-4 text-4xl font-semibold text-balance">Start with listings and trust. Layer financing, insurance, and inspections next.</h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-primary-foreground/85">
                  The platform foundation is built for marketplace growth: buyers can discover stock, sellers can list and negotiate,
                  dealers can onboard, and the roadmap naturally extends into financing, insurance, and inspection partnerships.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Button size="lg" variant="secondary" asChild>
                    <Link href="/dashboard">Open Dashboard</Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                    asChild
                  >
                    <Link href="/browse">Explore Inventory</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

const heroStats = [
  { label: 'Payments', value: 'M-Pesa Ready', icon: Smartphone },
  { label: 'Vehicle Types', value: 'New + Used', icon: CarFront },
  { label: 'Seller Mix', value: 'Private + Dealer', icon: Building2 },
  { label: 'Trust Layer', value: 'Verification', icon: BadgeCheck },
]

const features = [
  {
    icon: Search,
    title: 'Advanced Discovery',
    description: 'Filter by make, model, price, condition, source, year, and location to find the right stock faster.',
  },
  {
    icon: MessageSquare,
    title: 'Negotiation Flow',
    description: 'Buyers can message sellers directly, make offers, and keep a negotiation trail inside the platform.',
  },
  {
    icon: CreditCard,
    title: 'Kenya Payment Rails',
    description: 'Escrow-friendly payment records support M-Pesa, bank transfers, and staged deal completion.',
  },
  {
    icon: MapPinned,
    title: 'Local Context',
    description: 'Location-aware listings and import-specific fields help buyers compare local stock against incoming units.',
  },
  {
    icon: ShieldCheck,
    title: 'Fraud Prevention',
    description: 'Verification, reporting flows, and review history create a cleaner signal for serious buyers and sellers.',
  },
  {
    icon: Building2,
    title: 'Dealer Growth',
    description: 'Dealer-ready onboarding makes it easier to manage inventory, build reputation, and scale paid packages later.',
  },
]

const journeys = [
  {
    title: 'Buyer journey',
    description: 'Discover listings, shortlist vehicles, check seller trust signals, negotiate, then move into payment and transfer steps.',
  },
  {
    title: 'Private seller journey',
    description: 'Create a profile, verify identity, publish a car with rich details, answer buyer questions, and manage offers in one place.',
  },
  {
    title: 'Dealer journey',
    description: 'Onboard as a dealership, publish multiple units, highlight import stock, and turn profile credibility into more inbound leads.',
  },
]
