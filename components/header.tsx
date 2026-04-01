'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CarFront, LayoutDashboard, LogOut, MessageSquare, PlusCircle, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function Header() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const checkAuth = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()
      setUser(currentUser)
      setIsLoading(false)
    }

    checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <CarFront className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">AutoCore</div>
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Kenya Car Marketplace
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-5 text-sm">
          <Link href="/browse" className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-primary">
            <Search className="h-4 w-4" />
            Browse Cars
          </Link>
          <Link href="/sell" className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-primary">
            <PlusCircle className="h-4 w-4" />
            Sell
          </Link>
          {user && (
            <>
              <Link href="/messages" className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-primary">
                <MessageSquare className="h-4 w-4" />
                Messages
              </Link>
              <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-primary">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-4">
          {isLoading ? (
            <div className="h-10 w-20 animate-pulse rounded bg-muted" />
          ) : user ? (
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/auth/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/sign-up">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
