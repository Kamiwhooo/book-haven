'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

interface BookData {
  title: string; author: string; cover: string | null
  text: string; current_page: number; total_pages: number
  site: string; page_url: string
}

function WebReaderContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()

  const [inputUrl, setInputUrl] = useState(searchParams.get('url') || '')
  const [book, setBook] = useState<BookData | null>(null)
  const [phase, setPhase] = useState<'input'|'loading'|'reading'|'error'>('input')
  const [errorMsg, setErrorMsg] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [fontSize, setFontSize] = useState(17)
  const [showBars, setShowBars] = useState(true)
  const [showPanel, setShowPanel] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle'|'saved'|'error'>('idle')
  const [fullscreen, setFullscreen] = useState(false)
  const [loadingPage, setLoadingPage] = useState(false)

  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lastTap = useRef(0)
  const touchStartY = useRef(0)
  const currentPageRef = useRef(1)
  if (book) currentPageRef.current = book.current_page

  // Auto-load if URL in params
  useEffect(() => {
    const url = searchParams.get('url')
    const page = searchParams.get('page')
    if (url) fetchBook(url, page ? parseInt(page) : undefined)
  }, [])

  const fetchBook = async (url: string, page?: number) => {
    setPhase('loading'); setErrorMsg('')
    try {
      const res = await fetch('/api/fetch-book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, page }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to load')
      setBook(data)
      setPhase('reading')
      // Scroll to top on new page
      setTimeout(() => contentRef.current?.scrollTo({ top: 0 }), 100)
      // Update URL
      const params = new URLSearchParams({ url, page: String(data.current_page) })
      window.history.replaceState({}, '', `/read-web?${params.toString()}`)
    } catch (err: any) {
      setErrorMsg(err.message)
      setPhase('error')
    }
  }

  const goToPage = async (page: number) => {
    if (!book || loadingPage) return
    setLoadingPage(true)
    try {
      const res = await fetch('/api/fetch-book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: searchParams.get('url') || inputUrl, page }),
      })
      const data = await res.json()
      if (res.ok && !data.error) {
        setBook(data)
        setTimeout(() => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50)
        const params = new URLSearchParams({ url: searchParams.get('url') || inputUrl, page: String(page) })
        window.history.replaceState({}, '', `/read-web?${params.toString()}`)
      }
    } catch {}
    setLoadingPage(false)
  }

  // Save progress
  const saveProgress = useCallback(async (silent = true) => {
    if (!user || !book) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const bookData = {
        archive_id: `web_${btoa(inputUrl || book.page_url).slice(0, 24).replace(/[/+=]/g, '_')}`,
        title: book.title, author: book.author || null, description: null,
        cover_url: book.cover || null, pdf_url: book.page_url,
        published_date: null, pages: book.total_pages,
      }
      const res = await fetch('/api/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book: bookData, current_page: book.current_page, total_pages: book.total_pages, user_id: user.id, access_token: session?.access_token }),
      })
      if (res.ok) { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), silent ? 1000 : 2500) }
      else { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 3000) }
    } catch {}
  }, [user, book, inputUrl])

  useEffect(() => {
    if (saveTimerRef.current) clearInterval(saveTimerRef.current)
    saveTimerRef.current = setInterval(() => { if (book && user) saveProgress(true) }, 5000)
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current) }
  }, [saveProgress, book, user])

  const resetHide = useCallback(() => {
    setShowBars(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (fullscreen) hideTimerRef.current = setTimeout(() => setShowBars(false), 4000)
  }, [fullscreen])
  useEffect(() => { resetHide() }, [fullscreen])

  const toggleFullscreen = useCallback(() => {
    if (!fullscreen) { document.documentElement.requestFullscreen?.().catch(() => {}); setFullscreen(true) }
    else { document.exitFullscreen?.().catch(() => {}); setFullscreen(false) }
  }, [fullscreen])
  useEffect(() => {
    const h = () => { if (!document.fullscreenElement) setFullscreen(false) }
    document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  const onTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY }
  const onTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now()
    if (now - lastTap.current < 280) { setShowBars(v => !v); setShowPanel(false); lastTap.current = 0; return }
    lastTap.current = now; resetHide()
  }

  const bg = darkMode ? '#1a1a2e' : '#FFF9F5'
  const textColor = darkMode ? '#e8d5b7' : '#2d1810'
  const barBg = darkMode ? 'rgba(10,10,20,0.97)' : 'rgba(255,255,255,0.97)'
  const border = darkMode ? '#2a1040' : '#FFD6E7'
  const contentBg = darkMode ? '#16213e' : '#fffdf9'
  const saveLbl = saveStatus === 'saved' ? '✅ Saved' : saveStatus === 'error' ? '❌' : '💾'
  const saveBg = saveStatus === 'saved' ? 'linear-gradient(135deg,#FF69B4,#FF1493)' : darkMode ? '#333' : '#FFD6E7'
  const saveClr = saveStatus === 'saved' ? 'white' : saveStatus === 'error' ? '#ff6b6b' : darkMode ? 'white' : '#4A1942'

  // ── INPUT ──
  if (phase === 'input') return (
    <div style={{ minHeight:'100vh', background:'#FFF0F5', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div className="card-pink" style={{ width:'100%', maxWidth:'560px', padding:'40px' }}>
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <div style={{ fontSize:'3rem', marginBottom:'10px' }}>📖</div>
          <h1 className="font-pacifico" style={{ fontSize:'1.8rem', color:'#FF1493', marginBottom:'8px' }}>Read Any Book Site</h1>
          <p style={{ color:'#FF91A4', fontSize:'0.9rem', lineHeight:1.6 }}>Paste a link from supported reading sites and read it beautifully here!</p>
        </div>
        {errorMsg && <div style={{ background:'#FFD6E7', border:'1px solid #FF69B4', borderRadius:'10px', padding:'10px', marginBottom:'16px', color:'#C7006E', fontSize:'0.85rem' }}>⚠️ {errorMsg}</div>}
        <textarea
          value={inputUrl}
          onChange={e => { setInputUrl(e.target.value); setErrorMsg('') }}
          placeholder="Paste book page URL here...&#10;&#10;Works with:&#10;• archive.bookfrom.net&#10;• readfrom.net&#10;• and more!"
          style={{ width:'100%', minHeight:'120px', background:'white', border:'2px solid #FFD6E7', borderRadius:'12px', padding:'14px', fontFamily:'Nunito,sans-serif', fontSize:'0.88rem', color:'#4A1942', resize:'vertical', outline:'none', boxSizing:'border-box', lineHeight:1.6, transition:'border 0.2s' }}
          onFocus={e => (e.target.style.borderColor='#FF69B4')} onBlur={e => (e.target.style.borderColor='#FFD6E7')}
        />
        <button className="btn-pink" onClick={() => fetchBook(inputUrl)} disabled={!inputUrl.trim()} style={{ width:'100%', marginTop:'14px', fontSize:'1rem', padding:'14px', opacity:!inputUrl.trim()?0.5:1 }}>
          ✨ Open & Read
        </button>
        <div style={{ marginTop:'20px', background:'#FFF0F5', borderRadius:'10px', padding:'14px', fontSize:'0.82rem', color:'#FF91A4', lineHeight:1.7 }}>
          <p style={{ fontWeight:700, color:'#FF69B4', marginBottom:'6px' }}>✅ Supported sites:</p>
          <p>📚 <strong>archive.bookfrom.net</strong> — huge library, thousands of books</p>
          <p>📚 <strong>readfrom.net</strong> — same network</p>
          <p style={{ marginTop:'8px', fontSize:'0.78rem' }}>🔗 For PDF links → use <button onClick={()=>router.push('/link')} style={{background:'none',border:'none',color:'#FF1493',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:'inherit'}}>Open Link</button> instead</p>
        </div>
        <div style={{ display:'flex', gap:'10px', marginTop:'14px' }}>
          <button onClick={()=>router.push('/')} style={{ background:'none', border:'none', color:'#FF91A4', cursor:'pointer', flex:1, fontSize:'0.85rem', fontFamily:'Nunito,sans-serif' }}>← Search Books</button>
          <button onClick={()=>router.push('/link')} style={{ background:'none', border:'none', color:'#FF91A4', cursor:'pointer', flex:1, fontSize:'0.85rem', fontFamily:'Nunito,sans-serif' }}>🔗 PDF Link</button>
        </div>
      </div>
    </div>
  )

  // ── LOADING ──
  if (phase === 'loading') return (
    <div style={{ height:'100vh', background:'#FFF0F5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:'3.5rem', marginBottom:'16px' }} className="heart-float">🌸</div>
      <p className="font-pacifico" style={{ color:'#FF1493', fontSize:'1.2rem' }}>Loading book...</p>
      <p style={{ color:'#FF91A4', marginTop:'8px', fontSize:'0.85rem' }}>Fetching and formatting text 💕</p>
    </div>
  )

  // ── ERROR ──
  if (phase === 'error') return (
    <div style={{ height:'100vh', background:'#FFF0F5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', textAlign:'center' }}>
      <div style={{ fontSize:'3.5rem', marginBottom:'12px' }}>😢</div>
      <h3 className="font-pacifico" style={{ color:'#FF1493', marginBottom:'10px' }}>Couldn't load this page</h3>
      <p style={{ color:'#FF91A4', maxWidth:'320px', marginBottom:'20px', fontSize:'0.9rem' }}>{errorMsg}</p>
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center' }}>
        <button className="btn-pink" onClick={() => setPhase('input')}>Try Another Link</button>
        <button className="btn-pink" onClick={() => fetchBook(inputUrl)}>🔄 Retry</button>
      </div>
    </div>
  )

  // ── READER ──
  const pct = book ? Math.round((book.current_page / book.total_pages) * 100) : 0
  const paragraphs = book?.text.split(/\n\n+/).filter(p => p.trim().length > 0) || []

  return (
    <div style={{ height:'100vh', background:bg, display:'flex', flexDirection:'column', overflow:'hidden' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onMouseMove={resetHide}>

      {/* TOP BAR */}
      <div style={{ background:barBg, borderBottom:`1px solid ${border}`, backdropFilter:'blur(8px)', padding:'8px 12px', display:'flex', alignItems:'center', gap:'8px', flexShrink:0, zIndex:60, transition:'transform 0.3s,opacity 0.3s', transform:showBars?'translateY(0)':'translateY(-100%)', opacity:showBars?1:0, pointerEvents:showBars?'auto':'none' }}>
        <button onClick={()=>setPhase('input')} style={{ background:'none', border:'none', color:'#FF69B4', fontWeight:700, cursor:'pointer', fontSize:'0.9rem', padding:'4px 6px', flexShrink:0 }}>← Back</button>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:'0.78rem', fontWeight:700, color:'#FF1493', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{book?.title}</p>
          {book?.author && <p style={{ fontSize:'0.65rem', color:'#FF91A4', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{book.author}</p>}
        </div>
        <div style={{ display:'flex', gap:'5px', flexShrink:0 }}>
          <button onClick={()=>setFontSize(f=>Math.max(13,f-1))} style={{ background:darkMode?'#333':'#FFD6E7', border:'none', borderRadius:'8px', padding:'5px 8px', cursor:'pointer', color:darkMode?'white':'#4A1942', fontWeight:700, fontSize:'0.8rem' }}>A-</button>
          <button onClick={()=>setFontSize(f=>Math.min(26,f+1))} style={{ background:darkMode?'#333':'#FFD6E7', border:'none', borderRadius:'8px', padding:'5px 8px', cursor:'pointer', color:darkMode?'white':'#4A1942', fontWeight:700, fontSize:'0.9rem' }}>A+</button>
          <button onClick={()=>setDarkMode(!darkMode)} style={{ background:darkMode?'#FF69B4':'#FFD6E7', border:'none', borderRadius:'8px', padding:'5px 8px', cursor:'pointer', fontSize:'0.85rem' }}>{darkMode?'☀️':'🌙'}</button>
          <button onClick={toggleFullscreen} style={{ background:fullscreen?'linear-gradient(135deg,#FF69B4,#FF1493)':'rgba(255,105,180,0.15)', color:fullscreen?'white':'#FF69B4', border:'none', borderRadius:'8px', padding:'5px 8px', cursor:'pointer', fontSize:'0.85rem' }}>{fullscreen?'⊠':'⛶'}</button>
          <button onClick={()=>saveProgress(false)} style={{ background:saveBg, color:saveClr, border:'none', borderRadius:'8px', padding:'5px 8px', cursor:'pointer', fontSize:'0.75rem', fontWeight:700, whiteSpace:'nowrap', transition:'all 0.3s' }}>{saveLbl}</button>
        </div>
      </div>

      {/* Progress */}
      <div style={{ height:'3px', background:darkMode?'#222':'#FFD6E7', flexShrink:0 }}>
        <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#FF69B4,#FF1493)', transition:'width 0.5s' }} />
      </div>

      {/* TEXT CONTENT */}
      <div ref={contentRef} style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'0 0 80px' }}>
        <div style={{ maxWidth:'680px', margin:'0 auto', padding:'24px 20px' }}>
          {/* Chapter header */}
          <div style={{ textAlign:'center', marginBottom:'28px', paddingBottom:'16px', borderBottom:`1px solid ${darkMode?'#333':'#FFD6E7'}` }}>
            <p style={{ fontSize:'0.78rem', color:darkMode?'#888':'#FF91A4', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'4px' }}>
              Page {book?.current_page} of {book?.total_pages}
            </p>
            <p style={{ fontSize:'0.72rem', color:darkMode?'#555':'#FFB6C1' }}>{book?.site}</p>
          </div>

          {/* Paragraphs */}
          {paragraphs.map((para, i) => {
            const isChapter = para.startsWith('###') || para.startsWith('Chapter') || (para.length < 60 && para.toUpperCase() === para)
            return isChapter ? (
              <h3 key={i} style={{ fontSize: `${fontSize + 2}px`, fontWeight:700, color:darkMode?'#FFB6C1':'#FF1493', margin:'28px 0 16px', fontFamily:'Nunito,sans-serif', textAlign:'center' }}>
                {para.replace(/^###\s*/, '')}
              </h3>
            ) : (
              <p key={i} style={{ fontSize:`${fontSize}px`, lineHeight:1.85, color:textColor, marginBottom:'1.4em', fontFamily:'Georgia, serif', textIndent: i === 0 ? 0 : '1.5em' }}>
                {para.replace(/^###\s*/, '')}
              </p>
            )
          })}

          {loadingPage && (
            <div style={{ textAlign:'center', padding:'30px', color:'#FF69B4' }}>
              <div style={{ fontSize:'2rem' }} className="heart-float">🌸</div>
              <p style={{ marginTop:'10px', fontWeight:700 }}>Loading page...</p>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM BAR - always visible */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:70, background:barBg, borderTop:`1px solid ${border}`, backdropFilter:'blur(10px)', padding:'10px 14px', display:'flex', alignItems:'center', gap:'10px', transition:'transform 0.3s', transform:showBars?'translateY(0)':'translateY(100%)' }}>
        <button
          onClick={() => book && goToPage(book.current_page - 1)}
          disabled={!book || book.current_page <= 1 || loadingPage}
          style={{ background:'linear-gradient(135deg,#FF69B4,#FF1493)', color:'white', border:'none', borderRadius:'50px', padding:'8px 16px', cursor:'pointer', fontWeight:700, fontSize:'0.85rem', fontFamily:'Nunito,sans-serif', opacity:(!book||book.current_page<=1||loadingPage)?0.4:1 }}>
          ← Prev
        </button>

        <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px' }}>
          <div style={{ flex:1, height:'5px', background:darkMode?'#333':'#FFD6E7', borderRadius:'3px', overflow:'hidden', cursor:'pointer' }}
            onClick={(e) => {
              if (!book) return
              const rect = e.currentTarget.getBoundingClientRect()
              const pct = (e.clientX - rect.left) / rect.width
              goToPage(Math.max(1, Math.min(book.total_pages, Math.round(pct * book.total_pages))))
            }}>
            <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#FF69B4,#FF1493)', transition:'width 0.5s' }} />
          </div>
          <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#FF1493', whiteSpace:'nowrap', flexShrink:0 }}>{book?.current_page}/{book?.total_pages}</span>
        </div>

        <button
          onClick={() => book && goToPage(book.current_page + 1)}
          disabled={!book || book.current_page >= (book?.total_pages||1) || loadingPage}
          style={{ background:'linear-gradient(135deg,#FF69B4,#FF1493)', color:'white', border:'none', borderRadius:'50px', padding:'8px 16px', cursor:'pointer', fontWeight:700, fontSize:'0.85rem', fontFamily:'Nunito,sans-serif', opacity:(!book||book.current_page>=(book?.total_pages||1)||loadingPage)?0.4:1 }}>
          Next →
        </button>

        <button onClick={()=>setShowPanel(v=>!v)} style={{ background:darkMode?'#333':'#FFD6E7', border:'none', borderRadius:'8px', padding:'8px 10px', cursor:'pointer', color:darkMode?'white':'#4A1942', fontSize:'0.85rem' }}>☰</button>
      </div>

      {/* PANEL */}
      {showPanel && (
        <div style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(0,0,0,0.5)' }} onClick={()=>setShowPanel(false)}>
          <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'220px', background:barBg, borderLeft:`2px solid ${border}`, padding:'18px 14px', display:'flex', flexDirection:'column', gap:'10px' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
              <span className="font-pacifico" style={{ color:'#FF1493', fontSize:'1rem' }}>Menu 🎀</span>
              <button onClick={()=>setShowPanel(false)} style={{ background:'none', border:'none', fontSize:'1.1rem', cursor:'pointer', color:'#FF69B4' }}>✕</button>
            </div>
            {/* Jump to page */}
            <div>
              <p style={{ fontSize:'0.75rem', color:'#FF91A4', marginBottom:'4px', fontWeight:700 }}>Jump to page:</p>
              <div style={{ display:'flex', gap:'6px' }}>
                <input type="number" min={1} max={book?.total_pages||1} defaultValue={book?.current_page}
                  onKeyDown={e => { if (e.key==='Enter') { goToPage(parseInt((e.target as HTMLInputElement).value)||1); setShowPanel(false) } }}
                  style={{ flex:1, border:`2px solid ${border}`, borderRadius:'8px', padding:'6px', fontSize:'0.85rem', color:darkMode?'#FFB6C1':'#4A1942', background:barBg, fontWeight:700 }} />
                <button onClick={(e)=>{const input=(e.currentTarget.previousSibling as HTMLInputElement);goToPage(parseInt(input.value)||1);setShowPanel(false)}}
                  style={{ background:'linear-gradient(135deg,#FF69B4,#FF1493)', color:'white', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontWeight:700, fontSize:'0.82rem', fontFamily:'Nunito,sans-serif' }}>Go</button>
              </div>
            </div>
            {[
              { label:darkMode?'☀️ Light Mode':'🌙 Dark Mode', action:()=>{setDarkMode(!darkMode);setShowPanel(false)} },
              { label:fullscreen?'⊠ Exit Fullscreen':'⛶ Fullscreen', action:()=>{toggleFullscreen();setShowPanel(false)} },
              { label:`${saveLbl} Progress`, action:()=>{saveProgress(false);setShowPanel(false)} },
              { label:'🔗 New Link', action:()=>{setPhase('input');setShowPanel(false)} },
            ].map((btn,i)=>(
              <button key={i} onClick={btn.action} style={{ background:darkMode?'#333':'#FFD6E7', color:darkMode?'white':'#4A1942', border:'none', borderRadius:'10px', padding:'10px', cursor:'pointer', fontWeight:700, fontSize:'0.85rem', fontFamily:'Nunito,sans-serif', textAlign:'left' }}>{btn.label}</button>
            ))}
            <div style={{ marginTop:'auto', fontSize:'0.7rem', color:darkMode?'#555':'#FFB6C1', textAlign:'center' }}>Double-tap to hide/show bars</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WebReaderPage() {
  return (
    <Suspense fallback={<div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#FFF0F5'}}><div style={{textAlign:'center'}}><div style={{fontSize:'3rem'}} className="heart-float">🌸</div><p className="font-pacifico" style={{color:'#FF1493',marginTop:'12px'}}>Loading...</p></div></div>}>
      <WebReaderContent />
    </Suspense>
  )
}
