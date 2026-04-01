import { Suspense } from 'react'
import Header from '@/components/header'
import MessagesClientPage from './messages-client'

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <>
          <Header />
          <main className="min-h-screen py-8">
            <div className="container mx-auto px-4">
              <div className="h-[600px] animate-pulse rounded-[1.75rem] bg-muted" />
            </div>
          </main>
        </>
      }
    >
      <MessagesClientPage />
    </Suspense>
  )
}
