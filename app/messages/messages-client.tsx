'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { formatDate, getFullName, ProfileSummary } from '@/lib/marketplace'

type Conversation = {
  id: string
  recipient: ProfileSummary
  last_message: string
  last_message_at: string
  unread_count: number
}

type Message = {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  created_at: string
  is_read: boolean
}

export default function MessagesClientPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(searchParams.get('seller') || null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requiresAuth, setRequiresAuth] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void hydratePage()
  }, [])

  useEffect(() => {
    if (user) {
      void fetchConversations()
    }
  }, [user, selectedConversation])

  useEffect(() => {
    if (user && selectedConversation) {
      void fetchMessages(selectedConversation)
    }
  }, [selectedConversation, user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const hydratePage = async () => {
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
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
        router.push('/auth/login?redirect=/messages')
        return
      }

      setUser(currentUser)
    } catch (hydrateError) {
      console.error('Failed to hydrate messages page:', hydrateError)
      setError(hydrateError instanceof Error ? hydrateError.message : 'Failed to load your inbox.')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchConversations = async () => {
    if (!user) {
      return
    }

    const supabase = createClient()
    setError(null)
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, created_at, is_read')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching conversations:', error)
      setError(error.message)
      return
    }

    const conversationMap = new Map<
      string,
      {
        last_message: string
        last_message_at: string
        unread_count: number
      }
    >()

    for (const message of (data ?? []) as Message[]) {
      const otherUserId = message.sender_id === user.id ? message.recipient_id : message.sender_id
      const existingConversation = conversationMap.get(otherUserId)

      if (!existingConversation) {
        conversationMap.set(otherUserId, {
          last_message: message.body,
          last_message_at: message.created_at,
          unread_count: message.recipient_id === user.id && !message.is_read ? 1 : 0,
        })
      } else if (message.recipient_id === user.id && !message.is_read) {
        existingConversation.unread_count += 1
      }
    }

    const recipientIds = Array.from(new Set([...conversationMap.keys(), ...(selectedConversation ? [selectedConversation] : [])]))
    const { data: profileData } = recipientIds.length
      ? await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone_number, location, bio, user_type')
          .in('id', recipientIds)
      : { data: [] }

    const profilesById = new Map(
      ((profileData ?? []) as ProfileSummary[]).map((profile) => [profile.id, profile]),
    )

    const mergedConversations = recipientIds
      .map((recipientId) => {
        const recipient = profilesById.get(recipientId)
        if (!recipient) {
          return null
        }

        const conversationData = conversationMap.get(recipientId)
        return {
          id: recipientId,
          recipient,
          last_message: conversationData?.last_message ?? 'Start the conversation',
          last_message_at: conversationData?.last_message_at ?? new Date().toISOString(),
          unread_count: conversationData?.unread_count ?? 0,
        }
      })
      .filter((conversation): conversation is Conversation => Boolean(conversation))
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())

    setConversations(mergedConversations)
  }

  const fetchMessages = async (recipientId: string) => {
    if (!user) {
      return
    }

    const supabase = createClient()
    setError(null)
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, created_at, is_read')
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`,
      )
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      setError(error.message)
      return
    }

    const conversationMessages = (data ?? []) as Message[]
    setMessages(conversationMessages)

    const unreadIds = conversationMessages
      .filter((message) => message.recipient_id === user.id && !message.is_read)
      .map((message) => message.id)

    if (unreadIds.length > 0) {
      await supabase.from('messages').update({ is_read: true }).in('id', unreadIds)
      void fetchConversations()
    }
  }

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newMessage.trim() || !selectedConversation || isSending) {
      return
    }

    setIsSending(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          sender_id: user.id,
          recipient_id: selectedConversation,
          body: newMessage.trim(),
          is_read: false,
        },
      ])
      .select('id, sender_id, recipient_id, body, created_at, is_read')
      .single()

    if (error) {
      console.error('Error sending message:', error)
      setError(error.message)
    } else if (data) {
      setMessages((current) => [...current, data as Message])
      setNewMessage('')
      setError(null)
      void fetchConversations()
    }

    setIsSending(false)
  }

  const activeConversation = conversations.find((conversation) => conversation.id === selectedConversation) ?? null

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="container mx-auto px-4">
            <div className="h-[600px] animate-pulse rounded-[1.75rem] bg-muted" />
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
            <div className="rounded-[1.75rem] border border-border/70 bg-card/90 p-8">
              <h1 className="text-3xl font-semibold">Login required</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in to view buyer and seller conversations.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/auth/login?redirect=/messages">Login</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/browse">Browse Cars</Link>
                </Button>
              </div>
            </div>
          </div>
        </main>
      </>
    )
  }

  if (error && !user) {
    return (
      <>
        <Header />
        <main className="min-h-screen py-8">
          <div className="container mx-auto max-w-3xl px-4">
            <div className="rounded-[1.75rem] border border-border/70 bg-card/90 p-8">
              <h1 className="text-3xl font-semibold">Inbox could not load</h1>
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => void hydratePage()}>Try again</Button>
                <Button variant="outline" asChild>
                  <Link href="/browse">Browse Cars</Link>
                </Button>
              </div>
            </div>
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
          <div className="mb-8">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Inbox</p>
            <h1 className="mt-2 text-4xl font-semibold">Messages and negotiations</h1>
          </div>

          {error ? <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          <div className="grid h-[680px] gap-6 md:grid-cols-[320px_1fr]">
            <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/90">
              <div className="border-b border-border/70 px-5 py-4">
                <h2 className="font-semibold">Conversations</h2>
              </div>
              <div className="h-full overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-muted-foreground">No conversations yet.</div>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversation(conversation.id)}
                      className={`w-full border-b border-border/70 px-5 py-4 text-left transition hover:bg-muted/40 ${
                        selectedConversation === conversation.id ? 'bg-muted/50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{getFullName(conversation.recipient)}</div>
                          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{conversation.last_message}</div>
                          <div className="mt-2 text-xs text-muted-foreground">{formatDate(conversation.last_message_at)}</div>
                        </div>
                        {conversation.unread_count > 0 ? <Badge>{conversation.unread_count}</Badge> : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/90">
              {selectedConversation && activeConversation ? (
                <>
                  <div className="border-b border-border/70 px-5 py-4">
                    <div className="font-semibold">{getFullName(activeConversation.recipient)}</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {activeConversation.recipient.user_type} account
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xl rounded-3xl px-4 py-3 text-sm ${
                            message.sender_id === user.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          <p>{message.body}</p>
                          <p className={`mt-2 text-xs ${message.sender_id === user.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={handleSendMessage} className="border-t border-border/70 px-5 py-4">
                    <div className="flex gap-3">
                      <Input
                        value={newMessage}
                        onChange={(event) => setNewMessage(event.target.value)}
                        placeholder="Type your message..."
                        disabled={isSending}
                      />
                      <Button type="submit" disabled={isSending || !newMessage.trim()}>
                        {isSending ? 'Sending...' : 'Send'}
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  Select a conversation to continue negotiating with a buyer or seller.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
