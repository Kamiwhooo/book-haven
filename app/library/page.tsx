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
    pdf_url: string | null
  }
}

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'recent'|'title'|'progress'>('recent')
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    fetchLibrary()
  }, [user, authLoading])

  const fetchLibrary = async () => {
    const { data, error } = await supabase
      .from('user_books')
      .select('*, books(*)')
      .eq('user_id', user!.id)
      .order('last_read_at', { ascending: false })
    if (!error) setBooks((data as any) || [])
    setLoading(false)
  }

  const removeBook = async (id: string) => {
    setRemoving(id)
    await supabase.from('user_books').delete().eq('id', id)
    setBooks(prev => prev.filter(b => b.id !== id))
    setRemoving(null)
  }

  const openBook = (ub: LibraryBook) => {
    const archiveId = ub.books?.archive_id || ''
    // Web books saved with web_ prefix
    if (archiveId.startsWith('web_') && ub.books?.pdf_url) {
      router.push(`/read-web?url=${encodeURIComponent(ub.books.pdf_url)}&page=${ub.current_page}`)
    } else if (archiveId.startsWith('link_') && ub.books?.pdf_url) {
      router.push(`/link?url=${encodeURIComponent(ub.books.pdf_url)}&page=${ub.current_page}`)
    } else {
      router.push(`/read/${archiveId}?page=${ub.current_page}`)
    }
  }

  const sorted = [...books].sort((a, b) => {
    if (sortBy === 'title') return (a.books?.title||'').localeCompare(b.books?.title||'')
    if (sortBy === 'progress') {
      const pa = a.total_pages ? a.current_page/a.total_pages : 0
      const pb = b.total_pages ? b.current_page/b.total_pages : 0
      return pb - pa
    }
    return new Date(b.last_read_at).getTime() - new Date(a.last_read_at).getTime()
  })

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff/60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m/60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h/24)}d ago`
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'60vh', background:'#FFF0F5' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'3rem' }} className="heart-float">🎀</div>
        <p className="font-pacifico" style={{ color:'#FF1493', marginTop:'12px' }}>Loading your library...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#FFF0F5', padding:'24px 16px 80px' }}>
      <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'14px', marginBottom:'28px' }}>
          <div>
            <h1 className="font-pacifico" style={{ fontSize:'1.8rem', color:'#FF1493' }}>📚 My Library</h1>
            <p style={{ color:'#FF91A4', marginTop:'4px', fontSize:'0.85rem' }}>{books.length} book{books.length !== 1 ? 's' : ''} saved</p>
          </div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {(['recent','title','progress'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                style={{ background:sortBy===s?'linear-gradient(135deg,#FF69B4,#FF1493)':'white', color:sortBy===s?'white':'#FF69B4', border:`2px solid ${sortBy===s?'#FF1493':'#FFD6E7'}`, borderRadius:'50px', padding:'7px 14px', fontWeight:700, cursor:'pointer', fontSize:'0.8rem', fontFamily:'Nunito,sans-serif', transition:'all 0.2s' }}>
                {s === 'recent' ? '🕐 Recent' : s === 'title' ? '📖 Title' : '📊 Progress'}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {books.length === 0 && (
          <div style={{ textAlign:'center', padding:'80px 24px' }}>
            <div style={{ fontSize:'5rem', marginBottom:'20px' }}>💕</div>
            <h2 className="font-pacifico" style={{ color:'#FF1493', fontSize:'1.8rem', marginBottom:'12px' }}>Your library is empty!</h2>
            <p style={{ color:'#FF91A4', marginBottom:'24px' }}>Start reading a book and it&apos;ll appear here 🎀</p>
            <button className="btn-pink" onClick={() => router.push('/')}>Find a Book 📚</button>
          </div>
        )}

        {/* Books grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'16px' }}>
          {sorted.map(ub => {
            const pct = ub.total_pages ? Math.round((ub.current_page/ub.total_pages)*100) : 0
            const isWeb = ub.books?.archive_id?.startsWith('web_')
            const isLink = ub.books?.archive_id?.startsWith('link_')
            return (
              <div key={ub.id} className="card-pink" style={{ padding:'16px', display:'flex', gap:'14px', position:'relative' }}>
                {/* Cover */}
                <div style={{ position:'relative', flexShrink:0 }}>
                  <img src={ub.books?.cover_url||''} alt={ub.books?.title}
                    style={{ width:'64px', height:'86px', objectFit:'cover', borderRadius:'8px', cursor:'pointer', display:'block' }}
                    onClick={() => openBook(ub)}
                    onError={(e) => {
                      const t = e.target as HTMLImageElement
                      t.style.background='#FFD6E7'
                      t.style.display='flex'
                      t.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iODYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9Ijg2IiBmaWxsPSIjRkZENkU3Ii8+PHRleHQgeD0iMzIiIHk9IjQ4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjI0Ij7wn4ScPC90ZXh0Pjwvc3ZnPg=='
                    }}
                  />
                  {isWeb && <span style={{ position:'absolute', bottom:'2px', left:'2px', background:'#FF1493', color:'white', fontSize:'0.55rem', fontWeight:700, padding:'1px 4px', borderRadius:'4px' }}>WEB</span>}
                  {isLink && <span style={{ position:'absolute', bottom:'2px', left:'2px', background:'#7c3aed', color:'white', fontSize:'0.55rem', fontWeight:700, padding:'1px 4px', borderRadius:'4px' }}>PDF</span>}
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <h3 onClick={() => openBook(ub)}
                    style={{ fontSize:'0.88rem', fontWeight:700, color:'#4A1942', marginBottom:'3px', cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {ub.books?.title}
                  </h3>
                  {ub.books?.author && (
                    <p style={{ fontSize:'0.75rem', color:'#FF69B4', marginBottom:'8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {ub.books.author}
                    </p>
                  )}
                  <div className="progress-bar" style={{ marginBottom:'4px' }}>
                    <div className="progress-fill" style={{ width:`${pct}%` }} />
                  </div>
                  <p style={{ fontSize:'0.7rem', color:'#FF91A4', marginBottom:'10px' }}>
                    {pct}% · p.{ub.current_page}{ub.total_pages?` of ${ub.total_pages}`:''} · {timeAgo(ub.last_read_at)}
                  </p>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button className="btn-pink" onClick={() => openBook(ub)}
                      style={{ flex:1, padding:'7px 10px', fontSize:'0.8rem' }}>
                      Continue 📖
                    </button>
                    <button
                      onClick={() => removeBook(ub.id)}
                      disabled={removing === ub.id}
                      style={{ background:'none', border:'2px solid #FFD6E7', borderRadius:'8px', padding:'7px 10px', cursor:'pointer', color:'#FF91A4', fontSize:'0.8rem', transition:'all 0.2s' }}
                      title="Remove from library">
                      {removing === ub.id ? '⏳' : '🗑️'}
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
