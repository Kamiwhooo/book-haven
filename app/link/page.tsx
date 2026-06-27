'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

declare global { interface Window { pdfjsLib: any } }

function LinkReaderContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()

  const [inputUrl, setInputUrl] = useState('')
  const [pdfProxyUrl, setPdfProxyUrl] = useState(searchParams.get('url') || '')
  const [bookTitle, setBookTitle] = useState(searchParams.get('title') || 'Your Book')
  const [bookId, setBookId] = useState(searchParams.get('id') || '')
  const [phase, setPhase] = useState<'input'|'loading'|'reading'|'error'>(
    searchParams.get('url') ? 'loading' : 'input'
  )
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'))
  const [totalPages, setTotalPages] = useState(0)
  const [loadMsg, setLoadMsg] = useState('🌸 Loading...')
  const [loadProgress, setLoadProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [scrollMode, setScrollMode] = useState(true)
  const [showBars, setShowBars] = useState(true)
  const [showPanel, setShowPanel] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle'|'saved'|'error'>('idle')
  const [pagesRendered, setPagesRendered] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<any>(null)
  const scrollRenderRef = useRef(false)
  const currentPageRef = useRef(currentPage)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const lastTap = useRef(0)
  currentPageRef.current = currentPage

  // Load PDF.js
  useEffect(() => {
    if (window.pdfjsLib) return
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js' }
    document.head.appendChild(s)
  }, [])

  const handleUrlSubmit = async () => {
    const url = inputUrl.trim()
    if (!url) return
    if (!url.includes('archive.org') && !url.match(/dn\d+\./)) {
      setErrorMsg('Please paste an archive.org PDF link')
      return
    }

    // Parse the URL to extract title/id
    setPhase('loading'); setLoadMsg('🎀 Parsing your link...'); setLoadProgress(10)
    try {
      const res = await fetch('/api/parse-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.success) {
        setBookTitle(data.title || 'Your Book')
        setBookId(data.identifier || '')
        setPdfProxyUrl(data.proxy_url)
        // Update URL so refresh/share works
        const params = new URLSearchParams({ url: data.proxy_url, title: data.title || '', id: data.identifier || '' })
        window.history.replaceState({}, '', `/link?${params.toString()}`)
      } else {
        setPdfProxyUrl(`/api/pdf-url?url=${encodeURIComponent(url)}`)
      }
    } catch {
      setPdfProxyUrl(`/api/pdf-url?url=${encodeURIComponent(url)}`)
    }
    loadPDF(`/api/pdf-url?url=${encodeURIComponent(url)}`)
  }

  const loadPDF = useCallback(async (proxyUrl?: string) => {
    const url = proxyUrl || pdfProxyUrl
    if (!url) return
    setPhase('loading'); setErrorMsg(''); setLoadProgress(20); setPagesRendered(0)
    scrollRenderRef.current = false
    try {
      let tries = 0
      while (!window.pdfjsLib && tries < 60) { await new Promise(r => setTimeout(r, 200)); tries++ }
      if (!window.pdfjsLib) throw new Error('PDF.js failed to load')
      setLoadMsg('🌸 Fetching PDF...'); setLoadProgress(40)
      const task = window.pdfjsLib.getDocument({
        url,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
      })
      task.onProgress = (p: any) => { if (p.total) { setLoadProgress(50 + Math.round((p.loaded / p.total) * 40)); setLoadMsg('💕 Loading pages...') } }
      setLoadProgress(50)
      const pdf = await task.promise
      pdfDocRef.current = pdf; setPdfDoc(pdf); setTotalPages(pdf.numPages)
      setLoadProgress(100); setPhase('reading')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load PDF')
      setPhase('error')
    }
  }, [pdfProxyUrl])

  useEffect(() => {
    if (pdfProxyUrl && phase === 'loading') loadPDF()
  }, [pdfProxyUrl])

  // Page mode render
  const renderPage = useCallback(async (pageNum: number) => {
    const doc = pdfDocRef.current || pdfDoc; const canvas = canvasRef.current
    if (!doc || !canvas || scrollMode) return
    try {
      const page = await doc.getPage(pageNum)
      const w = (canvas.parentElement?.clientWidth || window.innerWidth) - 24
      const h = (canvas.parentElement?.clientHeight || window.innerHeight) - 24
      const vp1 = page.getViewport({ scale: 1 })
      const vp = page.getViewport({ scale: Math.min(w / vp1.width, h / vp1.height, 2.5) })
      canvas.width = vp.width; canvas.height = vp.height
      const ctx = canvas.getContext('2d')!; ctx.filter = 'none'
      await page.render({ canvasContext: ctx, viewport: vp }).promise
    } catch {}
  }, [pdfDoc, scrollMode])

  useEffect(() => { if (pdfDoc && !scrollMode) renderPage(currentPage) }, [pdfDoc, currentPage, scrollMode])

  // Scroll mode render
  useEffect(() => {
    if (!pdfDoc || !scrollMode || scrollRenderRef.current) return
    const container = scrollContainerRef.current; if (!container) return
    container.innerHTML = ''; setPagesRendered(0); scrollRenderRef.current = true
    const startPage = currentPageRef.current
    const renderAll = async () => {
      const doc = pdfDocRef.current || pdfDoc
      for (let i = 1; i <= doc.numPages; i++) {
        const wrapper = document.createElement('div')
        wrapper.style.cssText = 'margin-bottom:10px;display:flex;justify-content:center;'
        wrapper.dataset.page = String(i)
        const canvas = document.createElement('canvas')
        canvas.style.cssText = 'max-width:100%;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,0.1);display:block;'
        wrapper.appendChild(canvas); container.appendChild(wrapper)
        try {
          const page = await doc.getPage(i)
          const w = container.clientWidth - 12; const vp1 = page.getViewport({ scale: 1 })
          const vp = page.getViewport({ scale: Math.min(w / vp1.width, 3) })
          canvas.width = vp.width; canvas.height = vp.height
          const ctx = canvas.getContext('2d')!; ctx.filter = 'none'
          await page.render({ canvasContext: ctx, viewport: vp }).promise
          setPagesRendered(i)
          if (i === startPage && startPage > 1) {
            setTimeout(() => { container.querySelector(`[data-page="${startPage}"]`)?.scrollIntoView({ block: 'start' }) }, 200)
            setTimeout(() => { container.querySelector(`[data-page="${startPage}"]`)?.scrollIntoView({ block: 'start' }) }, 800)
          }
        } catch {}
      }
      scrollRenderRef.current = false
    }
    renderAll()
  }, [pdfDoc, scrollMode])

  // Scroll tracking
  useEffect(() => {
    if (!scrollMode) return
    const container = scrollContainerRef.current; if (!container) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return; ticking = true
      requestAnimationFrame(() => {
        const wrappers = Array.from(container.querySelectorAll('[data-page]'))
        const cTop = container.getBoundingClientRect().top
        let best = 1, bestDist = Infinity
        wrappers.forEach(w => { const d = Math.abs(w.getBoundingClientRect().top - cTop); if (d < bestDist) { bestDist = d; best = parseInt((w as HTMLElement).dataset.page || '1') } })
        setCurrentPage(best); ticking = false
      })
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [pagesRendered, scrollMode])

  // Save progress
  const saveProgress = useCallback(async (silent = true) => {
    if (!user) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const book = {
        archive_id: bookId || `link_${btoa(pdfProxyUrl).slice(0, 20)}`,
        title: bookTitle, author: null, description: null,
        cover_url: bookId ? `https://archive.org/services/img/${bookId}` : null,
        pdf_url: pdfProxyUrl, published_date: null, pages: totalPages,
      }
      const res = await fetch('/api/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book, current_page: currentPageRef.current, total_pages: totalPages, user_id: user.id, access_token: session?.access_token }),
      })
      if (res.ok) { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), silent ? 1000 : 2500) }
      else { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 3000) }
    } catch { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 3000) }
  }, [user, bookId, bookTitle, pdfProxyUrl, totalPages])

  useEffect(() => {
    if (saveTimerRef.current) clearInterval(saveTimerRef.current)
    saveTimerRef.current = setInterval(() => { if (totalPages > 0 && user && phase === 'reading') saveProgress(true) }, 3000)
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current) }
  }, [saveProgress, totalPages, user, phase])

  // Controls hide/show
  const resetHide = useCallback(() => {
    setShowBars(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (fullscreen) hideTimerRef.current = setTimeout(() => setShowBars(false), 3500)
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

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY }
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    const now = Date.now()
    if (now - lastTap.current < 280 && Math.abs(dx) < 15 && Math.abs(dy) < 15) { setShowBars(v => !v); setShowPanel(false); lastTap.current = 0; return }
    lastTap.current = now; resetHide()
    if (!scrollMode && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0 && currentPageRef.current < totalPages) setCurrentPage(p => p + 1)
      else if (dx > 0 && currentPageRef.current > 1) setCurrentPage(p => p - 1)
    }
  }
  const onClick = (e: React.MouseEvent) => {
    if (scrollMode) return
    const x = e.clientX, w = window.innerWidth; resetHide()
    if (x < w * 0.28 && currentPageRef.current > 1) setCurrentPage(p => p - 1)
    else if (x > w * 0.72 && currentPageRef.current < totalPages) setCurrentPage(p => p + 1)
    else { setShowBars(v => !v); setShowPanel(false) }
  }

  const switchMode = () => { scrollRenderRef.current = false; setScrollMode(v => !v); setPagesRendered(0) }
  const goTo = (p: number) => {
    const pg = Math.max(1, Math.min(p, totalPages)); setCurrentPage(pg)
    if (scrollMode && scrollContainerRef.current)
      scrollContainerRef.current.querySelector(`[data-page="${pg}"]`)?.scrollIntoView({ behavior: 'smooth' })
  }

  const pct = totalPages ? Math.round((currentPage / totalPages) * 100) : 0
  const bg = darkMode ? '#111' : '#FFF0F5'
  const barBg = darkMode ? 'rgba(10,10,10,0.97)' : 'rgba(255,255,255,0.97)'
  const border = darkMode ? '#2a0a14' : '#FFD6E7'
  const pdfFilter = darkMode ? 'invert(1) hue-rotate(180deg)' : 'none'
  const saveLbl = saveStatus === 'saved' ? '✅ Saved' : saveStatus === 'error' ? '❌ Error' : '💾 Save'
  const saveBg = saveStatus === 'saved' ? 'linear-gradient(135deg,#FF69B4,#FF1493)' : darkMode ? '#333' : '#FFD6E7'
  const saveClr = saveStatus === 'saved' ? 'white' : saveStatus === 'error' ? '#ff6b6b' : darkMode ? 'white' : '#4A1942'

  // ── INPUT SCREEN ──
  if (phase === 'input') return (
    <div style={{ minHeight:'100vh', background:'#FFF0F5', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div className="card-pink" style={{ width:'100%', maxWidth:'560px', padding:'40px' }}>
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <div style={{ fontSize:'3rem', marginBottom:'10px' }}>🔗</div>
          <h1 className="font-pacifico" style={{ fontSize:'1.8rem', color:'#FF1493', marginBottom:'8px' }}>Open Any PDF Link</h1>
          <p style={{ color:'#FF91A4', fontSize:'0.9rem' }}>Paste any archive.org PDF link and read it here with all features!</p>
        </div>

        {errorMsg && <div style={{ background:'#FFD6E7', border:'1px solid #FF69B4', borderRadius:'10px', padding:'10px', marginBottom:'16px', color:'#C7006E', fontSize:'0.85rem' }}>⚠️ {errorMsg}</div>}

        <div style={{ marginBottom:'16px' }}>
          <textarea
            value={inputUrl}
            onChange={e => { setInputUrl(e.target.value); setErrorMsg('') }}
            placeholder="Paste archive.org PDF link here...&#10;&#10;Example:&#10;https://dn721807.ca.archive.org/0/items/ggbb123/_OceanofPDF.com_Good_Girl_Bad_Blood.pdf"
            style={{ width:'100%', minHeight:'120px', background:'white', border:'2px solid #FFD6E7', borderRadius:'12px', padding:'14px', fontFamily:'Nunito,sans-serif', fontSize:'0.88rem', color:'#4A1942', resize:'vertical', outline:'none', transition:'border-color 0.3s', boxSizing:'border-box', lineHeight:1.5 }}
            onFocus={e => (e.target.style.borderColor = '#FF69B4')}
            onBlur={e => (e.target.style.borderColor = '#FFD6E7')}
          />
        </div>

        <button
          className="btn-pink"
          onClick={handleUrlSubmit}
          disabled={!inputUrl.trim()}
          style={{ width:'100%', fontSize:'1rem', padding:'14px', opacity: !inputUrl.trim() ? 0.5 : 1 }}>
          ✨ Open & Read
        </button>

        <div style={{ marginTop:'20px', padding:'14px', background:'#FFF0F5', borderRadius:'10px', fontSize:'0.8rem', color:'#FF91A4', lineHeight:1.6 }}>
          <p style={{ fontWeight:700, color:'#FF69B4', marginBottom:'6px' }}>✅ Supported links:</p>
          <p>• <code style={{ fontSize:'0.75rem' }}>https://archive.org/download/ID/file.pdf</code></p>
          <p>• <code style={{ fontSize:'0.75rem' }}>https://dn******.ca.archive.org/0/items/ID/file.pdf</code></p>
          <p style={{ marginTop:'8px' }}>💾 Progress auto-saves · 🌙 Dark mode · 📜 Scroll & page modes</p>
        </div>

        <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:'#FF91A4', cursor:'pointer', width:'100%', marginTop:'14px', fontSize:'0.85rem', fontFamily:'Nunito,sans-serif' }}>
          ← Back to search
        </button>
      </div>
    </div>
  )

  // ── LOADING SCREEN ──
  if (phase === 'loading') return (
    <div style={{ height:'100vh', background:bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:'3.5rem', marginBottom:'16px' }} className="heart-float">🌸</div>
      <p className="font-pacifico" style={{ color:'#FF1493', fontSize:'1.2rem', marginBottom:'16px' }}>{loadMsg}</p>
      <div style={{ width:'240px', height:'8px', background:'#FFD6E7', borderRadius:'4px', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${loadProgress}%`, background:'linear-gradient(90deg,#FF69B4,#FF1493)', transition:'width 0.5s' }} />
      </div>
    </div>
  )

  // ── ERROR SCREEN ──
  if (phase === 'error') return (
    <div style={{ height:'100vh', background:'#FFF0F5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', textAlign:'center' }}>
      <div style={{ fontSize:'3.5rem', marginBottom:'12px' }}>😢</div>
      <h3 className="font-pacifico" style={{ color:'#FF1493', fontSize:'1.2rem', marginBottom:'10px' }}>Couldn't load this PDF</h3>
      <p style={{ color:'#FF91A4', maxWidth:'320px', marginBottom:'20px', fontSize:'0.9rem' }}>{errorMsg}</p>
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center' }}>
        <button className="btn-pink" onClick={() => { setPhase('input'); setInputUrl('') }}>Try Another Link</button>
        <button className="btn-pink" onClick={() => loadPDF()}>🔄 Retry</button>
      </div>
    </div>
  )

  // ── READER ──
  return (
    <div style={{ height:'100vh', background:bg, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', userSelect:'none' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onMouseMove={resetHide} onClick={onClick}>

      {/* TOP BAR */}
      <div style={{ background:barBg, borderBottom:`1px solid ${border}`, backdropFilter:'blur(8px)', padding:'8px 12px', display:'flex', alignItems:'center', gap:'8px', flexShrink:0, zIndex:60, transition:'transform 0.3s,opacity 0.3s', transform:showBars?'translateY(0)':'translateY(-100%)', opacity:showBars?1:0, pointerEvents:showBars?'auto':'none' }}>
        <button onClick={(e)=>{e.stopPropagation();setPhase('input');setPdfDoc(null);setTotalPages(0);scrollRenderRef.current=false}} style={{ background:'none', border:'none', color:'#FF69B4', fontWeight:700, cursor:'pointer', fontSize:'0.9rem', padding:'4px 6px', flexShrink:0 }}>← New Link</button>
        <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#FF1493', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{bookTitle}</span>
        <div style={{ display:'flex', gap:'5px', flexShrink:0 }} onClick={e=>e.stopPropagation()}>
          <button onClick={switchMode} style={{ background:scrollMode?'linear-gradient(135deg,#FF69B4,#FF1493)':'rgba(255,105,180,0.15)', color:scrollMode?'white':'#FF69B4', border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', fontSize:'0.72rem', fontWeight:700 }}>{scrollMode?'📜':'📄'}</button>
          <button onClick={()=>setDarkMode(!darkMode)} style={{ background:darkMode?'#FF69B4':'rgba(255,105,180,0.15)', border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', fontSize:'0.85rem' }}>{darkMode?'☀️':'🌙'}</button>
          <button onClick={toggleFullscreen} style={{ background:fullscreen?'linear-gradient(135deg,#FF69B4,#FF1493)':'rgba(255,105,180,0.15)', color:fullscreen?'white':'#FF69B4', border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', fontSize:'0.85rem' }}>{fullscreen?'⊠':'⛶'}</button>
          <button onClick={(e)=>{e.stopPropagation();saveProgress(false)}} style={{ background:saveBg, color:saveClr, border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'0.72rem', fontWeight:700, transition:'all 0.3s', whiteSpace:'nowrap' }}>{saveLbl}</button>
        </div>
      </div>

      {totalPages > 0 && <div style={{ height:'3px', background:darkMode?'#222':'#FFD6E7', flexShrink:0 }}><div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#FF69B4,#FF1493)', transition:'width 0.5s' }} /></div>}

      <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
        {/* SCROLL */}
        {scrollMode && (
          <div style={{ height:'100%', overflowY:'auto', background:darkMode?'#111':'#e8e8e8', WebkitOverflowScrolling:'touch' }}>
            <div ref={scrollContainerRef} style={{ padding:'8px 6px 70px', filter:pdfFilter, transition:'filter 0.3s' }} />
          </div>
        )}
        {/* PAGE */}
        {!scrollMode && (
          <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative', background:bg }}>
            <div onClick={(e)=>{e.stopPropagation();if(currentPage>1)setCurrentPage(p=>p-1)}} style={{ position:'absolute', left:0, top:0, width:'25%', height:'100%', cursor:'pointer', zIndex:5, display:'flex', alignItems:'center', paddingLeft:'8px', opacity:0, transition:'opacity 0.2s' }} onMouseEnter={e=>(e.currentTarget.style.opacity='1')} onMouseLeave={e=>(e.currentTarget.style.opacity='0')}>
              <div style={{ background:'rgba(255,105,180,0.2)', borderRadius:'50%', width:'44px', height:'44px', display:'flex', alignItems:'center', justifyContent:'center', color:'#FF1493', fontSize:'1.2rem' }}>◀</div>
            </div>
            <div onClick={(e)=>{e.stopPropagation();if(currentPage<totalPages)setCurrentPage(p=>p+1)}} style={{ position:'absolute', right:0, top:0, width:'25%', height:'100%', cursor:'pointer', zIndex:5, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:'8px', opacity:0, transition:'opacity 0.2s' }} onMouseEnter={e=>(e.currentTarget.style.opacity='1')} onMouseLeave={e=>(e.currentTarget.style.opacity='0')}>
              <div style={{ background:'rgba(255,105,180,0.2)', borderRadius:'50%', width:'44px', height:'44px', display:'flex', alignItems:'center', justifyContent:'center', color:'#FF1493', fontSize:'1.2rem' }}>▶</div>
            </div>
            <div style={{ filter:pdfFilter, transition:'filter 0.3s', display:'flex', maxWidth:'100%', maxHeight:'100%' }}>
              <canvas ref={canvasRef} style={{ display:'block', maxWidth:'100%', maxHeight:'100%', boxShadow:'0 4px 24px rgba(0,0,0,0.3)', borderRadius:'4px' }} />
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM - page mode */}
      {!scrollMode && totalPages > 0 && (
        <div style={{ background:barBg, borderTop:`1px solid ${border}`, backdropFilter:'blur(8px)', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:'12px', flexShrink:0, zIndex:60, transition:'transform 0.3s,opacity 0.3s', transform:showBars?'translateY(0)':'translateY(100%)', opacity:showBars?1:0, pointerEvents:showBars?'auto':'none' }} onClick={e=>e.stopPropagation()}>
          <button className="btn-pink" onClick={()=>goTo(currentPage-1)} disabled={currentPage<=1} style={{ padding:'9px 18px', opacity:currentPage<=1?0.4:1 }}>← Prev</button>
          <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <input type="number" value={currentPage} onChange={e=>goTo(parseInt(e.target.value)||1)} style={{ width:'50px', textAlign:'center', border:`2px solid ${border}`, borderRadius:'8px', padding:'5px 3px', fontWeight:700, color:darkMode?'#FFB6C1':'#4A1942', background:barBg, fontSize:'0.9rem' }} min={1} max={totalPages} />
            <span style={{ fontWeight:700, color:'#FF1493', fontSize:'0.85rem' }}>/ {totalPages}</span>
          </div>
          <button className="btn-pink" onClick={()=>goTo(currentPage+1)} disabled={currentPage>=totalPages} style={{ padding:'9px 18px', opacity:currentPage>=totalPages?0.4:1 }}>Next →</button>
        </div>
      )}

      {/* BOTTOM - scroll mode always visible */}
      {scrollMode && totalPages > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:70, background:barBg, borderTop:`1px solid ${border}`, backdropFilter:'blur(10px)', padding:'8px 12px', display:'flex', alignItems:'center', gap:'8px' }} onClick={e=>e.stopPropagation()}>
          <div style={{ display:'flex', alignItems:'center', gap:'4px', flexShrink:0 }}>
            <span style={{ fontSize:'0.7rem', fontWeight:700, color:'#FF1493' }}>p.</span>
            <input type="number" value={currentPage} onChange={e=>goTo(parseInt(e.target.value)||1)} style={{ width:'42px', textAlign:'center', border:`2px solid ${border}`, borderRadius:'7px', padding:'3px 2px', fontWeight:700, color:darkMode?'#FFB6C1':'#4A1942', background:barBg, fontSize:'0.8rem' }} min={1} max={totalPages} />
            <span style={{ fontSize:'0.68rem', color:'#FF91A4' }}>/{totalPages}</span>
          </div>
          <div style={{ flex:1, height:'5px', background:darkMode?'#333':'#FFD6E7', borderRadius:'3px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#FF69B4,#FF1493)', transition:'width 0.5s' }} />
          </div>
          <button onClick={(e)=>{e.stopPropagation();saveProgress(false)}} style={{ background:saveBg, color:saveClr, border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'0.72rem', fontWeight:700, transition:'all 0.3s', whiteSpace:'nowrap', flexShrink:0 }}>{saveLbl}</button>
          <button onClick={(e)=>{e.stopPropagation();setShowPanel(v=>!v)}} style={{ background:darkMode?'#333':'#FFD6E7', border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:darkMode?'white':'#4A1942', fontSize:'0.85rem', flexShrink:0 }}>☰</button>
        </div>
      )}

      {/* SIDE PANEL */}
      {showPanel && (
        <div style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(0,0,0,0.5)' }} onClick={()=>setShowPanel(false)}>
          <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'210px', background:barBg, borderLeft:`2px solid ${border}`, padding:'18px 14px', display:'flex', flexDirection:'column', gap:'10px' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
              <span className="font-pacifico" style={{ color:'#FF1493', fontSize:'1rem' }}>Menu 🎀</span>
              <button onClick={()=>setShowPanel(false)} style={{ background:'none', border:'none', fontSize:'1.1rem', cursor:'pointer', color:'#FF69B4' }}>✕</button>
            </div>
            {[
              { label:saveLbl, action:()=>{saveProgress(false);setShowPanel(false)}, bg:saveBg, color:saveClr },
              { label:scrollMode?'📄 Page Mode':'📜 Scroll Mode', action:()=>{switchMode();setShowPanel(false)}, bg:darkMode?'#333':'#FFD6E7', color:darkMode?'white':'#4A1942' },
              { label:darkMode?'☀️ Light Mode':'🌙 Dark Mode', action:()=>{setDarkMode(!darkMode);setShowPanel(false)}, bg:darkMode?'#333':'#FFD6E7', color:darkMode?'white':'#4A1942' },
              { label:fullscreen?'⊠ Exit Fullscreen':'⛶ Fullscreen', action:()=>{toggleFullscreen();setShowPanel(false)}, bg:darkMode?'#333':'#FFD6E7', color:darkMode?'white':'#4A1942' },
              { label:'🔗 Open New Link', action:()=>{setPhase('input');setPdfDoc(null);setTotalPages(0);scrollRenderRef.current=false;setShowPanel(false)}, bg:darkMode?'#333':'#FFD6E7', color:darkMode?'white':'#4A1942' },
            ].map((btn,i)=>(
              <button key={i} onClick={btn.action} style={{ background:btn.bg, color:btn.color, border:'none', borderRadius:'10px', padding:'11px', cursor:'pointer', fontWeight:700, fontSize:'0.88rem', fontFamily:'Nunito,sans-serif', textAlign:'left' }}>{btn.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LinkPage() {
  return (
    <Suspense fallback={<div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#FFF0F5'}}><div style={{textAlign:'center'}}><div style={{fontSize:'3rem'}} className="heart-float">🌸</div><p className="font-pacifico" style={{color:'#FF1493',marginTop:'12px'}}>Loading...</p></div></div>}>
      <LinkReaderContent />
    </Suspense>
  )
}
