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
      <div style={{ padding:'10px' }}>
        <div className="shimmer" style={{ height:'12px', borderRadius:'6px', marginBottom:'6px' }} />
        <div className="shimmer" style={{ height:'10px', borderRadius:'5px', width:'70%' }} />
      </div>
    </div>
  )
}

interface SearchSources { archive_free: number; web_readable: number; borrow_only: number }

function HomeContent() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<Book[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [groqUsed, setGroqUsed] = useState(false)
  const [sources, setSources] = useState<SearchSources | null>(null)
  const [continueReading, setContinueReading] = useState<UserBook[]>([])
  const { user } = useAuth()
  const router = useRouter()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const hearts = useRef(Array.from({ length: 10 }, (_, i) => ({ left:`${i*10+2}%`, top:`${20+(i%3)*25}%`, delay:`${i*0.4}s`, emoji:HEARTS[i%HEARTS.length] }))).current

  useEffect(() => {
    if (!user) return
    supabase.from('user_books').select('*, books(*)').eq('user_id', user.id).order('last_read_at', { ascending:false }).limit(4)
      .then(({ data }) => { if (data) setContinueReading(data as any) })
  }, [user])

  const searchBooks = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setGroqUsed(false); setSources(null); return }
    setLoading(true); setError(''); setGroqUsed(false); setSources(null)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResults(data.books || [])
      setGroqUsed(data.groq_enhanced || false)
      setSources(data.sources || null)
    } catch { setError('Search failed. Please try again.') }
    finally { setLoading(false) }
  }, [])

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

      <div style={{ position:'relative', zIndex:1, textAlign:'center', padding:'40px 20px 28px' }}>
        <div style={{ fontSize:'3rem', marginBottom:'8px' }}>🎀</div>
        <h1 className="font-pacifico" style={{ fontSize:'clamp(1.8rem,5vw,3rem)', color:'#FF1493', marginBottom:'6px' }}>Book Haven</h1>
        <p style={{ fontSize:'0.95rem', color:'#FF69B4', fontWeight:600, marginBottom:'24px' }}>✨ Search, read, and discover books for free ✨</p>

        <div style={{ maxWidth:'600px', margin:'0 auto', position:'relative' }}>
          <input className="input-pink"
            style={{ fontSize:'1rem', padding:'14px 50px 14px 22px', boxShadow:'0 4px 20px rgba(255,105,180,0.2)' }}
            placeholder="🔍 Search any book... e.g. 'fourth wing' or 'the last letter'"
            value={query} onChange={handleInput} />
          {loading && <div style={{ position:'absolute', right:'18px', top:'50%', transform:'translateY(-50%)', fontSize:'1.2rem' }}>🌸</div>}
        </div>

        {/* Source breakdown */}
        {sources && !loading && (
          <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginTop:'10px', flexWrap:'wrap' }}>
            {sources.archive_free > 0 && <span style={{ background:'rgba(34,197,94,0.15)', color:'#16a34a', fontSize:'0.72rem', fontWeight:700, padding:'3px 10px', borderRadius:'20px', border:'1px solid rgba(34,197,94,0.3)' }}>✅ {sources.archive_free} free PDFs</span>}
            {sources.web_readable > 0 && <span style={{ background:'rgba(255,105,180,0.12)', color:'#FF1493', fontSize:'0.72rem', fontWeight:700, padding:'3px 10px', borderRadius:'20px', border:'1px solid #FFD6E7' }}>📖 {sources.web_readable} read online</span>}
            {sources.borrow_only > 0 && <span style={{ background:'rgba(100,100,100,0.1)', color:'#666', fontSize:'0.72rem', fontWeight:700, padding:'3px 10px', borderRadius:'20px', border:'1px solid #ddd' }}>🔒 {sources.borrow_only} borrow only</span>}
            {groqUsed && <span style={{ background:'rgba(139,92,246,0.1)', color:'#7c3aed', fontSize:'0.72rem', fontWeight:700, padding:'3px 10px', borderRadius:'20px', border:'1px solid rgba(139,92,246,0.2)' }}>✨ AI enhanced</span>}
          </div>
        )}
      </div>

      <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'0 16px 80px', position:'relative', zIndex:1 }}>
        {/* Continue reading */}
        {user && continueReading.length > 0 && !query && (
          <div style={{ marginBottom:'36px' }}>
            <h2 className="font-pacifico" style={{ fontSize:'1.4rem', color:'#FF1493', marginBottom:'14px' }}>🎀 Continue Reading</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'12px' }}>
              {continueReading.map((ub) => (
                <div key={ub.id} className="card-pink book-card"
                  onClick={() => router.push(`/read/${(ub as any).books?.archive_id}?page=${ub.current_page}`)}
                  style={{ padding:'12px', display:'flex', gap:'12px', alignItems:'center' }}>
                  <img src={(ub as any).books?.cover_url||''} alt="" style={{ width:'52px', height:'70px', objectFit:'cover', borderRadius:'8px', flexShrink:0 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <h4 style={{ fontSize:'0.85rem', fontWeight:700, color:'#4A1942', marginBottom:'3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(ub as any).books?.title}</h4>
                    <p style={{ fontSize:'0.72rem', color:'#FF69B4', marginBottom:'6px' }}>Page {ub.current_page}{ub.total_pages?` of ${ub.total_pages}`:''}</p>
                    <div className="progress-bar"><div className="progress-fill" style={{ width:`${getProgress(ub)}%` }} /></div>
                    <p style={{ fontSize:'0.68rem', color:'#FF91A4', marginTop:'2px' }}>{getProgress(ub)}% complete</p>
                  </div>
                  <span style={{ fontSize:'1.2rem' }}>📖</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ textAlign:'center', padding:'40px', color:'#FF69B4' }}><div style={{ fontSize:'3rem', marginBottom:'12px' }}>😢</div><p style={{ fontWeight:700 }}>{error}</p></div>}

        {loading && (
          <div>
            <p style={{ textAlign:'center', color:'#FF69B4', fontWeight:700, marginBottom:'14px' }}>🌸 Searching across multiple sources... 🎀</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'12px' }}>
              {Array.from({length:8}).map((_,i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div>
            <h2 className="font-pacifico" style={{ fontSize:'1.2rem', color:'#FF1493', marginBottom:'14px' }}>
              📚 {results.length} results for &ldquo;{query}&rdquo;
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'12px' }}>
              {results.map((book) => <BookCard key={(book as any).web_url || book.archive_id} book={book} />)}
            </div>
          </div>
        )}

        {!loading && results.length === 0 && !query && (
          <div style={{ textAlign:'center', padding:'40px 0' }}>
            <p style={{ fontSize:'1rem', color:'#FF91A4', fontWeight:600 }}>💕 Start searching for your favorite books!</p>
            <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginTop:'12px', flexWrap:'wrap' }}>
              {['fourth wing','the last letter','good girl bad blood','pride and prejudice','rich dad poor dad'].map(s => (
                <button key={s} onClick={() => { setQuery(s); router.replace(`/?q=${encodeURIComponent(s)}`, { scroll:false }); searchBooks(s) }}
                  style={{ background:'white', border:'2px solid #FFD6E7', borderRadius:'50px', padding:'6px 14px', color:'#FF69B4', fontWeight:700, cursor:'pointer', fontSize:'0.78rem', fontFamily:'Nunito,sans-serif' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && results.length === 0 && query && (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ fontSize:'4rem', marginBottom:'14px' }}>📚</div>
            <p style={{ fontSize:'1.1rem', color:'#FF69B4', fontWeight:700 }}>No results for &ldquo;{query}&rdquo;</p>
            <p style={{ color:'#FFB6C1', marginTop:'8px', marginBottom:'16px' }}>Try different keywords!</p>
            <div style={{ display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap' }}>
              <button className="btn-pink" onClick={() => router.push(`/read-web`)}>📖 Read from a URL</button>
              <button className="btn-pink" onClick={() => router.push(`/link`)}>🔗 Paste PDF Link</button>
            </div>
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
