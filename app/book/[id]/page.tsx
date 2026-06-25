'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

interface BookData {
  archive_id: string
  title: string
  author: string | null
  description: string | null
  cover_url: string
  pdf_url: string
  published_date: string | null
  pages: number | null
  files?: string[]
}

interface UserProgress {
  current_page: number
  total_pages: number
}

export default function BookDetailsPage({ params }: { params: { id: string } }) {
  const [book, setBook] = useState<BookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [descExpanded, setDescExpanded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/books/${params.id}`)
      .then(r => r.json())
      .then(data => {
        setBook(data.book)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.id])

  useEffect(() => {
    if (!user || !book) return
    supabase
      .from('books')
      .select('id')
      .eq('archive_id', book.archive_id)
      .single()
      .then(({ data: bookRow }) => {
        if (!bookRow) return
        return supabase
          .from('user_books')
          .select('*')
          .eq('user_id', user.id)
          .eq('book_id', bookRow.id)
          .single()
      })
      .then((res: any) => {
        if (res?.data) {
          setSaved(true)
          setProgress({ current_page: res.data.current_page, total_pages: res.data.total_pages })
        }
      })
  }, [user, book])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }} className="heart-float">🌸</div>
        <p className="font-pacifico" style={{ color: '#FF1493', fontSize: '1.3rem' }}>Loading book details...</p>
      </div>
    </div>
  )

  if (!book) return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: '4rem', marginBottom: '16px' }}>😢</div>
      <h2 className="font-pacifico" style={{ color: '#FF1493', fontSize: '1.8rem' }}>Book not found</h2>
      <button className="btn-pink" onClick={() => router.push('/')} style={{ marginTop: '24px' }}>
        Go Home 🎀
      </button>
    </div>
  )

  const desc = book.description || 'No description available for this book.'
  const shortDesc = desc.length > 300 ? desc.slice(0, 300) + '...' : desc
  const progressPct = progress ? Math.round((progress.current_page / (progress.total_pages || 1)) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#FFF0F5', padding: '40px 24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#FF69B4', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginBottom: '24px', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          ← Back
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 280px) 1fr', gap: '40px', alignItems: 'start' }}>
          {/* Cover */}
          <div>
            <img
              src={book.cover_url}
              alt={book.title}
              style={{ width: '100%', maxWidth: '280px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(255,20,147,0.25)' }}
              onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjM5MiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjgwIiBoZWlnaHQ9IjM5MiIgZmlsbD0iI0ZGRDBFNyIvPjx0ZXh0IHg9IjE0MCIgeT0iMTg2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjYwIj7wn4ScPC90ZXh0Pjwvc3ZnPg==' }}
            />

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
              {progress ? (
                <button
                  className="btn-pink"
                  style={{ width: '100%', fontSize: '1rem' }}
                  onClick={() => router.push(`/read/${book.archive_id}?page=${progress.current_page}`)}
                >
                  📖 Continue Reading (p.{progress.current_page})
                </button>
              ) : (
                <button
                  className="btn-pink"
                  style={{ width: '100%', fontSize: '1rem' }}
                  onClick={() => {
                    if (!user) { router.push('/login'); return }
                    router.push(`/read/${book.archive_id}`)
                  }}
                >
                  ✨ Read Now
                </button>
              )}

              {progress && (
                <div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#FF91A4', marginTop: '4px', textAlign: 'center' }}>
                    {progressPct}% read
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)', fontWeight: 700, color: '#4A1942', lineHeight: 1.3, marginBottom: '12px' }}>
              {book.title}
            </h1>

            {book.author && (
              <p style={{ fontSize: '1.1rem', color: '#FF69B4', fontWeight: 700, marginBottom: '20px' }}>
                ✍️ {book.author}
              </p>
            )}

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
              {book.published_date && (
                <div className="card-pink" style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700 }}>
                  📅 {book.published_date}
                </div>
              )}
              {book.pages && (
                <div className="card-pink" style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700 }}>
                  📄 {book.pages} pages
                </div>
              )}
            </div>

            <div className="card-pink" style={{ padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontWeight: 700, color: '#4A1942', marginBottom: '12px' }}>📖 About this book</h3>
              <p style={{ color: '#4A1942', lineHeight: 1.7, fontSize: '0.95rem' }}>
                {descExpanded ? desc : shortDesc}
              </p>
              {desc.length > 300 && (
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  style={{ background: 'none', border: 'none', color: '#FF1493', fontWeight: 700, cursor: 'pointer', marginTop: '8px', fontSize: '0.9rem' }}
                >
                  {descExpanded ? 'Show less ▲' : 'Read more ▼'}
                </button>
              )}
            </div>

            <div style={{ background: '#FFD6E7', borderRadius: '12px', padding: '16px', fontSize: '0.9rem', color: '#8F004F' }}>
              <p>🌐 Source: <strong>Internet Archive</strong> — Free public domain books</p>
              <p style={{ marginTop: '4px' }}>📚 Archive ID: <code style={{ fontSize: '0.8rem' }}>{book.archive_id}</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
