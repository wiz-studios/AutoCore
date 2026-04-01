'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Page() {
  const router = useRouter()
  const [secondsRemaining, setSecondsRemaining] = useState(5)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval)
          router.push('/auth/login?redirect=/dashboard')
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [router])

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Account created</CardTitle>
              <CardDescription>Your AutoCore account is ready to use.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If you were not redirected automatically, continue into the marketplace and sign in with your new credentials.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to login in {secondsRemaining} second{secondsRemaining === 1 ? '' : 's'}.
              </p>
              <div className="flex gap-3">
                <Button asChild>
                  <Link href="/auth/login?redirect=/dashboard">Login</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/browse">Browse Cars</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
