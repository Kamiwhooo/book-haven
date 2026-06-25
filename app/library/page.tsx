'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

interface LibraryBook {
  id: string
  current_page: number
  total_pages: number
  last_read_at: string
  saved_at: string
  books: {
    archive_id: string
    title: string
    author: string | null
    cover_url: string | null
  }
}

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'progress'>('recent')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    fetchLibrary()
  }, [user, authLoading])

  const fetchLibrary = async () => {
    const { data } = await supabase
      .from('user_books')
      .select('*, books(*)')
      .eq('user_id', user!.id)
      .order('last_read_at', { ascending: false })
    setBooks((data as any) || [])
    setLoading(false)
  }

  const removeBook = async (id: string) => {
    await supabase.from('user_books').delete().eq('id', id)
    setBooks(prev => prev.filter(b => b.id !== id))
  }

  const sorted = [...books].sort((a, b) => {
    if (sortBy === 'title') return (a.books?.title || '').localeCompare(b.books?.title || '')
    if (sortBy === 'progress') {
      const pa = a.total_pages ? a.current_page / a.total_pages : 0
      const pb = b.total_pages ? b.current_page / b.total_pages : 0
      return pb - pa
    }
    return new Date(b.last_read_at).getTime() - new Date(a.last_read_at).getTime()
  })

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const hrs = Math.floor(diff / 3600000)
    if (hrs < 1) return 'just now'
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }} className="heart-float">🎀</div>
        <p className="font-pacifico" style={{ color: '#FF1493', fontSize: '1.2rem' }}>Loading your library...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#FFF0F5', padding: '40px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
          <div>
            <h1 className="font-pacifico" style={{ fontSize: '2rem', color: '#FF1493' }}>📚 My Library</h1>
            <p style={{ color: '#FF91A4', marginTop: '4px' }}>{books.length} book{books.length !== 1 ? 's' : ''} saved</p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {(['recent', 'title', 'progress'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                style={{
                  background: sortBy === s ? 'linear-gradient(135deg, #FF69B4, #FF1493)' : 'white',
                  color: sortBy === s ? 'white' : '#FF69B4',
                  border: `2px solid ${sortBy === s ? '#FF1493' : '#FFD6E7'}`,
                  borderRadius: '50px',
                  padding: '8px 16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  textTransform: 'capitalize',
                }}
              >
                {s === 'recent' ? '🕐 Recent' : s === 'title' ? '📖 Title' : '📊 Progress'}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {books.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: '5rem', marginBottom: '20px' }}>💕</div>
            <h2 className="font-pacifico" style={{ color: '#FF1493', fontSize: '1.8rem', marginBottom: '12px' }}>
              Your library is empty!
            </h2>
            <p style={{ color: '#FF91A4', marginBottom: '24px' }}>Start reading a book to save it here 🎀</p>
            <button className="btn-pink" onClick={() => router.push('/')}>
              Find a Book 📚
            </button>
          </div>
        )}

        {/* Books grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {sorted.map(ub => {
            const pct = ub.total_pages ? Math.round((ub.current_page / ub.total_pages) * 100) : 0
            return (
              <div key={ub.id} className="card-pink" style={{ padding: '16px', display: 'flex', gap: '16px' }}>
                <img
                  src={ub.books?.cover_url || ''}
                  alt={ub.books?.title}
                  style={{ width: '70px', height: '95px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, cursor: 'pointer' }}
                  onClick={() => router.push(`/book/${ub.books?.archive_id}`)}
                  onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzAiIGhlaWdodD0iOTUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjcwIiBoZWlnaHQ9Ijk1IiBmaWxsPSIjRkZENkU3Ii8+PHRleHQgeD0iMzUiIHk9IjUzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjI4Ij7wn4ScPC90ZXh0Pjwvc3ZnPg==' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4A1942', marginBottom: '4px', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    onClick={() => router.push(`/book/${ub.books?.archive_id}`)}
                  >
                    {ub.books?.title}
                  </h3>
                  {ub.books?.author && (
                    <p style={{ fontSize: '0.78rem', color: '#FF69B4', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ub.books.author}
                    </p>
                  )}

                  <div className="progress-bar" style={{ marginBottom: '4px' }}>
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#FF91A4', marginBottom: '10px' }}>
                    {pct}% · p.{ub.current_page}{ub.total_pages ? ` of ${ub.total_pages}` : ''} · {timeAgo(ub.last_read_at)}
                  </p>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-pink"
                      style={{ flex: 1, padding: '7px 10px', fontSize: '0.8rem' }}
                      onClick={() => router.push(`/read/${ub.books?.archive_id}?page=${ub.current_page}`)}
                    >
                      Continue 📖
                    </button>
                    <button
                      onClick={() => removeBook(ub.id)}
                      style={{ background: 'none', border: '2px solid #FFD6E7', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#FF91A4', fontSize: '0.8rem' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
