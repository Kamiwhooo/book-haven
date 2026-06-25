'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Book, UserBook } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import BookCard from '@/components/BookCard'

const HEARTS = ['💕', '🌸', '💖', '🎀', '💗', '✨', '🌷', '💝']

function FloatingHeart({ style }: { style: React.CSSProperties }) {
  return <div style={{ position: 'fixed', fontSize: '1.5rem', pointerEvents: 'none', zIndex: 0, ...style }} className="heart-float">{HEARTS[Math.floor(Math.random() * HEARTS.length)]}</div>
}

function SkeletonCard() {
  return (
    <div className="card-pink" style={{ overflow: 'hidden', borderRadius: '16px' }}>
      <div className="shimmer" style={{ paddingTop: '140%' }} />
      <div style={{ padding: '12px' }}>
        <div className="shimmer" style={{ height: '14px', borderRadius: '7px', marginBottom: '8px' }} />
        <div className="shimmer" style={{ height: '12px', borderRadius: '6px', width: '70%' }} />
      </div>
    </div>
  )
}

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Book[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [continueReading, setContinueReading] = useState<UserBook[]>([])
  const { user } = useAuth()
  const router = useRouter()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const [hearts] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      left: `${(i * 8) + 2}%`,
      top: `${Math.random() * 80 + 10}%`,
      animationDelay: `${i * 0.3}s`,
    }))
  )

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_books')
      .select('*, books(*)')
      .eq('user_id', user.id)
      .order('last_read_at', { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data) setContinueReading(data as any)
      })
  }, [user])

  const searchBooks = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResults(data.books || [])
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchBooks(val), 400)
  }

  const getProgress = (ub: UserBook) => {
    if (!ub.total_pages || ub.total_pages === 0) return 0
    return Math.round((ub.current_page / ub.total_pages) * 100)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF0F5', position: 'relative', overflow: 'hidden' }}>
      {hearts.map((h, i) => (
        <div key={i} style={{ position: 'fixed', left: h.left, top: h.top, fontSize: '1.5rem', pointerEvents: 'none', zIndex: 0, animationDelay: h.animationDelay, opacity: 0.4 }} className="heart-float">
          {HEARTS[i % HEARTS.length]}
        </div>
      ))}

      {/* Hero */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '60px 24px 40px' }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎀</div>
        <h1 className="font-pacifico" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#FF1493', marginBottom: '12px', lineHeight: 1.2 }}>
          Book Haven
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#FF69B4', fontWeight: 600, marginBottom: '40px' }}>
          ✨ Your magical reading paradise ✨
        </p>

        {/* Search bar */}
        <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
          <input
            className="input-pink"
            style={{ fontSize: '1.1rem', padding: '16px 60px 16px 24px', boxShadow: '0 4px 20px rgba(255,105,180,0.2)' }}
            placeholder="🔍 Search for any book... try 'rich dad poor dad'"
            value={query}
            onChange={handleInput}
          />
          {loading && (
            <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.5rem' }}>
              🌸
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 60px', position: 'relative', zIndex: 1 }}>
        {/* Continue Reading */}
        {user && continueReading.length > 0 && !query && (
          <div style={{ marginBottom: '48px' }}>
            <h2 className="font-pacifico" style={{ fontSize: '1.6rem', color: '#FF1493', marginBottom: '20px' }}>
              🎀 Continue Reading
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {continueReading.map((ub) => (
                <div
                  key={ub.id}
                  className="card-pink book-card"
                  onClick={() => router.push(`/read/${(ub as any).books?.archive_id}?page=${ub.current_page}`)}
                  style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}
                >
                  <img
                    src={(ub as any).books?.cover_url || ''}
                    alt={(ub as any).books?.title}
                    style={{ width: '60px', height: '80px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
                    onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRkZENkU3Ii8+PHRleHQgeD0iMzAiIHk9IjQ1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjI0Ij7wn4ScPC90ZXh0Pjwvc3ZnPg==' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4A1942', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(ub as any).books?.title}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: '#FF69B4', marginBottom: '8px' }}>
                      Page {ub.current_page} {ub.total_pages ? `of ${ub.total_pages}` : ''}
                    </p>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${getProgress(ub)}%` }} />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#FF91A4', marginTop: '4px' }}>{getProgress(ub)}% complete</p>
                  </div>
                  <span style={{ fontSize: '1.4rem' }}>📖</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search results */}
        {error && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#FF69B4' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>😢</div>
            <p style={{ fontWeight: 700 }}>{error}</p>
          </div>
        )}

        {loading && (
          <div>
            <p style={{ textAlign: 'center', color: '#FF69B4', fontWeight: 700, marginBottom: '20px', fontSize: '1.1rem' }}>
              🌸 Finding books for you... 🎀
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div>
            <h2 className="font-pacifico" style={{ fontSize: '1.4rem', color: '#FF1493', marginBottom: '20px' }}>
              📚 Found {results.length} books for &ldquo;{query}&rdquo;
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
              {results.map((book) => (
                <BookCard key={book.archive_id} book={book} />
              ))}
            </div>
          </div>
        )}

        {!loading && results.length === 0 && !query && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: '1rem', color: '#FF91A4', fontWeight: 600 }}>
              💕 Start searching for your favorite books above!
            </p>
            <p style={{ fontSize: '0.9rem', color: '#FFB6C1', marginTop: '8px' }}>
              Try: "rich dad poor dad", "Harry Potter", "The Alchemist"
            </p>
          </div>
        )}

        {!loading && results.length === 0 && query && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📚</div>
            <p style={{ fontSize: '1.1rem', color: '#FF69B4', fontWeight: 700 }}>No books found for &ldquo;{query}&rdquo;</p>
            <p style={{ color: '#FFB6C1', marginTop: '8px' }}>Try different keywords!</p>
          </div>
        )}
      </div>
    </div>
  )
}
