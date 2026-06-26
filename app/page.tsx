'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Book, UserBook } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import BookCard from '@/components/BookCard'

const HEARTS = ['💕','🌸','💖','🎀','💗','✨','🌷','💝']

function SkeletonCard() {
  return (
    <div className="card-pink" style={{ overflow:'hidden', borderRadius:'16px' }}>
      <div className="shimmer" style={{ paddingTop:'140%' }} />
      <div style={{ padding:'12px' }}>
        <div className="shimmer" style={{ height:'14px', borderRadius:'7px', marginBottom:'8px' }} />
        <div className="shimmer" style={{ height:'12px', borderRadius:'6px', width:'70%' }} />
      </div>
    </div>
  )
}

function HomeContent() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<Book[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [groqUsed, setGroqUsed] = useState(false)
  const [continueReading, setContinueReading] = useState<UserBook[]>([])
  const { user } = useAuth()
  const router = useRouter()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const hearts = useRef(Array.from({ length: 10 }, (_, i) => ({ left:`${i*10+2}%`, top:`${20+(i%3)*25}%`, delay:`${i*0.4}s`, emoji: HEARTS[i%HEARTS.length] }))).current

  useEffect(() => {
    if (!user) return
    supabase.from('user_books').select('*, books(*)').eq('user_id', user.id).order('last_read_at', { ascending:false }).limit(4)
      .then(({ data }) => { if (data) setContinueReading(data as any) })
  }, [user])

  const searchBooks = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setGroqUsed(false); return }
    setLoading(true); setError(''); setGroqUsed(false)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResults(data.books || [])
      setGroqUsed(data.groq_enhanced || false)
    } catch { setError('Search failed. Please try again.') }
    finally { setLoading(false) }
  }, [])

  // On mount: run search if ?q= param exists (back button preserves search)
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) searchBooks(q)
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    router.replace(val ? `/?q=${encodeURIComponent(val)}` : '/', { scroll:false })
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchBooks(val), 450)
  }

  const getProgress = (ub: UserBook) => !ub.total_pages ? 0 : Math.round((ub.current_page/ub.total_pages)*100)

  return (
    <div style={{ minHeight:'100vh', background:'#FFF0F5', position:'relative' }}>
      {hearts.map((h,i) => (
        <div key={i} style={{ position:'fixed', left:h.left, top:h.top, fontSize:'1.3rem', pointerEvents:'none', zIndex:0, animationDelay:h.delay, opacity:0.25 }} className="heart-float">{h.emoji}</div>
      ))}

      <div style={{ position:'relative', zIndex:1, textAlign:'center', padding:'50px 24px 32px' }}>
        <div style={{ fontSize:'3.5rem', marginBottom:'10px' }}>🎀</div>
        <h1 className="font-pacifico" style={{ fontSize:'clamp(1.8rem,5vw,3rem)', color:'#FF1493', marginBottom:'8px' }}>Book Haven</h1>
        <p style={{ fontSize:'1rem', color:'#FF69B4', fontWeight:600, marginBottom:'28px' }}>✨ Your magical reading paradise ✨</p>

        <div style={{ maxWidth:'600px', margin:'0 auto', position:'relative' }}>
          <input className="input-pink"
            style={{ fontSize:'1rem', padding:'14px 50px 14px 22px', boxShadow:'0 4px 20px rgba(255,105,180,0.2)' }}
            placeholder="🔍 Search any book... try 'good girl bad blood'"
            value={query} onChange={handleInput} />
          {loading && <div style={{ position:'absolute', right:'18px', top:'50%', transform:'translateY(-50%)', fontSize:'1.2rem' }}>🌸</div>}
        </div>
        {groqUsed && <p style={{ color:'#FF91A4', fontSize:'0.8rem', marginTop:'8px' }}>✨ AI boosted your search and found more results!</p>}
      </div>

      <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'0 20px 60px', position:'relative', zIndex:1 }}>
        {user && continueReading.length > 0 && !query && (
          <div style={{ marginBottom:'36px' }}>
            <h2 className="font-pacifico" style={{ fontSize:'1.5rem', color:'#FF1493', marginBottom:'14px' }}>🎀 Continue Reading</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'12px' }}>
              {continueReading.map((ub) => (
                <div key={ub.id} className="card-pink book-card"
                  onClick={() => router.push(`/read/${(ub as any).books?.archive_id}?page=${ub.current_page}`)}
                  style={{ padding:'14px', display:'flex', gap:'12px', alignItems:'center' }}>
                  <img src={(ub as any).books?.cover_url||''} alt="" style={{ width:'56px', height:'76px', objectFit:'cover', borderRadius:'8px', flexShrink:0 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <h4 style={{ fontSize:'0.88rem', fontWeight:700, color:'#4A1942', marginBottom:'3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(ub as any).books?.title}</h4>
                    <p style={{ fontSize:'0.75rem', color:'#FF69B4', marginBottom:'6px' }}>Page {ub.current_page}{ub.total_pages?` of ${ub.total_pages}`:''}</p>
                    <div className="progress-bar"><div className="progress-fill" style={{ width:`${getProgress(ub)}%` }} /></div>
                    <p style={{ fontSize:'0.7rem', color:'#FF91A4', marginTop:'3px' }}>{getProgress(ub)}% complete</p>
                  </div>
                  <span style={{ fontSize:'1.3rem' }}>📖</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ textAlign:'center', padding:'40px', color:'#FF69B4' }}><div style={{ fontSize:'3rem', marginBottom:'12px' }}>😢</div><p style={{ fontWeight:700 }}>{error}</p></div>}

        {loading && (
          <div>
            <p style={{ textAlign:'center', color:'#FF69B4', fontWeight:700, marginBottom:'14px' }}>🌸 Searching... 🎀</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'14px' }}>
              {Array.from({length:8}).map((_,i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div>
            <h2 className="font-pacifico" style={{ fontSize:'1.3rem', color:'#FF1493', marginBottom:'14px' }}>📚 {results.length} results for &ldquo;{query}&rdquo;</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'14px' }}>
              {results.map((book) => <BookCard key={book.archive_id} book={book} />)}
            </div>
          </div>
        )}

        {!loading && results.length === 0 && !query && (
          <div style={{ textAlign:'center', padding:'40px 0' }}>
            <p style={{ fontSize:'1rem', color:'#FF91A4', fontWeight:600 }}>💕 Start searching for your favorite books above!</p>
            <p style={{ fontSize:'0.85rem', color:'#FFB6C1', marginTop:'8px' }}>Try: "pride and prejudice", "good girl bad blood", "rich dad poor dad"</p>
          </div>
        )}

        {!loading && results.length === 0 && query && (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ fontSize:'4rem', marginBottom:'14px' }}>📚</div>
            <p style={{ fontSize:'1.1rem', color:'#FF69B4', fontWeight:700 }}>No results for &ldquo;{query}&rdquo;</p>
            <p style={{ color:'#FFB6C1', marginTop:'8px' }}>Try different keywords or check spelling!</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:'#FFF0F5'}}><div style={{fontSize:'3rem'}} className="heart-float">🌸</div></div>}>
      <HomeContent />
    </Suspense>
  )
}
