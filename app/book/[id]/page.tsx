'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

interface BookData {
  archive_id: string; title: string; author: string | null
  description: string | null; cover_url: string
  published_date: string | null; pages: number | null
}

export default function BookDetailsPage({ params }: { params: { id: string } }) {
  const [book, setBook] = useState<BookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [descExpanded, setDescExpanded] = useState(false)
  const [progress, setProgress] = useState<{ current_page: number; total_pages: number } | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle')
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/books/${params.id}`).then(r => r.json()).then(data => { setBook(data.book); setLoading(false) }).catch(() => setLoading(false))
  }, [params.id])

  useEffect(() => {
    if (!user || !book) return
    supabase.from('books').select('id').eq('archive_id', book.archive_id).single()
      .then(({ data: bd }) => {
        if (!bd) return
        supabase.from('user_books').select('current_page, total_pages').eq('user_id', user.id).eq('book_id', bd.id).single()
          .then(({ data: ub }) => { if (ub) { setProgress(ub); setSaveStatus('saved') } })
      })
  }, [user, book])

  const handleSave = async () => {
    if (!user) { router.push('/login'); return }
    if (!book) return
    setSaveStatus('saving')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book, current_page: progress?.current_page || 1,
          total_pages: progress?.total_pages || book.pages || 0,
          user_id: user.id, access_token: session?.access_token,
        }),
      })
      if (res.ok) { setSaveStatus('saved') }
      else { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 3000) }
    } catch { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 3000) }
  }

  if (loading) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'60vh', background:'#FFF0F5' }}><div style={{ textAlign:'center' }}><div style={{ fontSize:'3rem' }} className="heart-float">🌸</div><p className="font-pacifico" style={{ color:'#FF1493', marginTop:'12px' }}>Loading...</p></div></div>
  if (!book) return <div style={{ textAlign:'center', padding:'60px 24px', background:'#FFF0F5', minHeight:'60vh' }}><div style={{ fontSize:'3rem', marginBottom:'12px' }}>😢</div><h2 className="font-pacifico" style={{ color:'#FF1493' }}>Book not found</h2><button className="btn-pink" onClick={() => router.push('/')} style={{ marginTop:'20px' }}>Go Home 🎀</button></div>

  const desc = book.description || 'No description available.'
  const shortDesc = desc.length > 250 ? desc.slice(0, 250) + '...' : desc
  const pct = progress ? Math.round((progress.current_page / (progress.total_pages || 1)) * 100) : 0

  const saveBtnLabel = saveStatus === 'saving' ? '⏳ Saving...' : saveStatus === 'saved' ? '✅ Saved to Library' : saveStatus === 'error' ? '❌ Try Again' : '🔖 Save to Library'
  const saveBtnBg = saveStatus === 'saved' ? 'linear-gradient(135deg,#FF69B4,#FF1493)' : saveStatus === 'error' ? '#FFD6E7' : 'white'
  const saveBtnColor = saveStatus === 'saved' ? 'white' : saveStatus === 'error' ? '#C7006E' : '#FF1493'

  return (
    <div style={{ minHeight:'100vh', background:'#FFF0F5' }}>
      <div style={{ padding:'12px 16px' }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#FF69B4', fontWeight:700, fontSize:'0.95rem', cursor:'pointer', padding:0 }}>← Back</button>
      </div>

      <div style={{ maxWidth:'860px', margin:'0 auto', padding:'0 16px 60px' }}>
        <div style={{ display:'flex', gap:'24px', alignItems:'flex-start', flexWrap:'wrap' }}>
          {/* Cover */}
          <div style={{ width:'180px', flexShrink:0, margin:'0 auto' }}>
            <img src={book.cover_url} alt={book.title}
              style={{ width:'100%', borderRadius:'12px', boxShadow:'0 8px 30px rgba(255,20,147,0.2)' }}
              onError={(e) => { (e.target as HTMLImageElement).src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjI1MiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTgwIiBoZWlnaHQ9IjI1MiIgZmlsbD0iI0ZGRDBFNyIvPjx0ZXh0IHg9IjkwIiB5PSIxMzYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iNTAiPvCfjJw8L3RleHQ+PC9zdmc+' }}
            />

            {/* Action buttons */}
            <div style={{ marginTop:'14px', display:'flex', flexDirection:'column', gap:'10px' }}>
              {progress ? (
                <>
                  <button className="btn-pink" style={{ width:'100%' }}
                    onClick={() => router.push(`/read/${book.archive_id}?page=${progress.current_page}`)}>
                    📖 Continue (p.{progress.current_page})
                  </button>
                  <div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width:`${pct}%` }} /></div>
                    <p style={{ fontSize:'0.75rem', color:'#FF91A4', marginTop:'3px', textAlign:'center' }}>{pct}% read</p>
                  </div>
                </>
              ) : (
                <button className="btn-pink" style={{ width:'100%' }}
                  onClick={() => { if (!user) { router.push('/login'); return }; router.push(`/read/${book.archive_id}`) }}>
                  ✨ Read Now
                </button>
              )}

              {/* Save to library button */}
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                style={{
                  width:'100%', background:saveBtnBg, color:saveBtnColor,
                  border:`2px solid ${saveStatus === 'saved' ? '#FF1493' : '#FFD6E7'}`,
                  borderRadius:'50px', padding:'11px', fontWeight:700,
                  cursor: saveStatus === 'saved' ? 'default' : 'pointer',
                  fontSize:'0.88rem', fontFamily:'Nunito,sans-serif',
                  transition:'all 0.3s',
                }}>
                {saveBtnLabel}
              </button>
            </div>
          </div>

          {/* Info */}
          <div style={{ flex:1, minWidth:'200px' }}>
            <h1 style={{ fontSize:'clamp(1.2rem,3vw,1.9rem)', fontWeight:700, color:'#4A1942', lineHeight:1.3, marginBottom:'10px' }}>{book.title}</h1>
            {book.author && <p style={{ fontSize:'1rem', color:'#FF69B4', fontWeight:700, marginBottom:'14px' }}>✍️ {book.author}</p>}
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' }}>
              {book.published_date && <div className="card-pink" style={{ padding:'5px 12px', fontSize:'0.8rem', fontWeight:700 }}>📅 {book.published_date}</div>}
              {book.pages && <div className="card-pink" style={{ padding:'5px 12px', fontSize:'0.8rem', fontWeight:700 }}>📄 {book.pages} pages</div>}
            </div>
            <div className="card-pink" style={{ padding:'14px', marginBottom:'14px' }}>
              <h3 style={{ fontWeight:700, color:'#4A1942', marginBottom:'8px', fontSize:'0.9rem' }}>📖 About this book</h3>
              <p style={{ color:'#4A1942', lineHeight:1.7, fontSize:'0.88rem' }}>{descExpanded ? desc : shortDesc}</p>
              {desc.length > 250 && <button onClick={() => setDescExpanded(!descExpanded)} style={{ background:'none', border:'none', color:'#FF1493', fontWeight:700, cursor:'pointer', marginTop:'6px', fontSize:'0.85rem' }}>{descExpanded ? 'Show less ▲' : 'Read more ▼'}</button>}
            </div>
            <div style={{ background:'#FFD6E7', borderRadius:'10px', padding:'10px', fontSize:'0.8rem', color:'#8F004F' }}>
              <p>🌐 <strong>Internet Archive</strong> — Free public domain books</p>
              <p style={{ marginTop:'2px', wordBreak:'break-all' }}>📚 ID: <code style={{ fontSize:'0.72rem' }}>{book.archive_id}</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
