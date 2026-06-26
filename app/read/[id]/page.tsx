'use client'
import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

declare global { interface Window { pdfjsLib: any } }

interface BookMeta {
  archive_id: string; title: string; author: string | null
  cover_url: string; pdf_url: string; pages: number | null; description: string | null
}

function ReaderContent({ id }: { id: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()

  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'))
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [loadMsg, setLoadMsg] = useState('🌸 Loading your book...')
  const [loadProgress, setLoadProgress] = useState(0)
  const [error, setError] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [book, setBook] = useState<BookMeta | null>(null)
  const [saved, setSaved] = useState(false)
  const [scrollMode, setScrollMode] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [pagesRendered, setPagesRendered] = useState<Set<number>>(new Set())
  const [isMobile, setIsMobile] = useState(false)

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const renderTaskRef = useRef<any>(null)
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const pdfDocRef = useRef<any>(null)
  const scrollRenderingRef = useRef(false)

  useEffect(() => {
    const mobile = window.innerWidth < 768
    setIsMobile(mobile)
    if (mobile) { setScrollMode(true); setScale(0.65) }
  }, [])

  // Load PDF.js
  useEffect(() => {
    if (window.pdfjsLib) return
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js' }
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    fetch(`/api/books/${id}`).then(r => r.json()).then(d => setBook(d.book)).catch(() => {})
  }, [id])

  const waitForPDFJS = async () => {
    let t = 0
    while (!window.pdfjsLib && t < 50) { await new Promise(r => setTimeout(r, 200)); t++ }
    if (!window.pdfjsLib) throw new Error('PDF.js failed to load')
  }

  const loadPDF = useCallback(async () => {
    setLoading(true); setError(''); setLoadProgress(0); setPagesRendered(new Set())
    try {
      await waitForPDFJS()
      setLoadMsg('🎀 Connecting to Internet Archive...'); setLoadProgress(20)
      const proxyUrl = `/api/pdf?id=${encodeURIComponent(id)}`
      setLoadMsg('🌸 Downloading pages...'); setLoadProgress(50)
      const task = window.pdfjsLib.getDocument({
        url: proxyUrl,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
      })
      task.onProgress = (p: any) => { if (p.total) setLoadProgress(50 + Math.round((p.loaded/p.total)*40)) }
      const pdf = await task.promise
      pdfDocRef.current = pdf
      setPdfDoc(pdf)
      setTotalPages(pdf.numPages)
      setLoadProgress(100)
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to load PDF')
      setLoading(false)
    }
  }, [id])

  useEffect(() => { setTimeout(loadPDF, 500) }, [loadPDF])

  // Page mode render
  const renderPage = useCallback(async (pageNum: number) => {
    const doc = pdfDocRef.current || pdfDoc
    const canvas = canvasRef.current
    if (!doc || !canvas || scrollMode) return
    if (renderTaskRef.current) { try { renderTaskRef.current.cancel() } catch {} }
    try {
      const page = await doc.getPage(pageNum)
      const containerW = canvas.parentElement?.clientWidth || window.innerWidth
      const containerH = canvas.parentElement?.clientHeight || window.innerHeight
      const defaultVP = page.getViewport({ scale: 1 })
      const scaleW = (containerW - 40) / defaultVP.width
      const scaleH = (containerH - 40) / defaultVP.height
      const autoScale = Math.min(scaleW, scaleH, scale * 1.5)
      const vp = page.getViewport({ scale: autoScale })
      canvas.width = vp.width; canvas.height = vp.height
      const ctx = canvas.getContext('2d')!
      ctx.filter = darkMode ? 'invert(0.85) hue-rotate(180deg)' : 'none'
      const task = page.render({ canvasContext: ctx, viewport: vp })
      renderTaskRef.current = task
      await task.promise
    } catch (e: any) { if (e?.name !== 'RenderingCancelledException') console.error(e) }
  }, [pdfDoc, scale, darkMode, scrollMode])

  useEffect(() => { if (pdfDoc && !scrollMode) renderPage(currentPage) }, [pdfDoc, currentPage, scale, darkMode, scrollMode])

  // Scroll mode: render pages one by one into container
  useEffect(() => {
    if (!pdfDoc || !scrollMode || scrollRenderingRef.current) return
    const container = scrollContainerRef.current
    if (!container) return
    container.innerHTML = ''
    setPagesRendered(new Set())
    scrollRenderingRef.current = true

    const renderAll = async () => {
      const doc = pdfDocRef.current || pdfDoc
      for (let i = 1; i <= doc.numPages; i++) {
        const wrapper = document.createElement('div')
        wrapper.style.cssText = 'margin-bottom:16px;display:flex;justify-content:center;padding:0 8px;'
        wrapper.dataset.page = String(i)
        const canvas = document.createElement('canvas')
        canvas.style.cssText = `max-width:100%;border-radius:8px;box-shadow:0 4px 20px rgba(255,20,147,0.12);background:${darkMode?'#111':'white'};`
        wrapper.appendChild(canvas)
        container.appendChild(wrapper)
        try {
          const page = await doc.getPage(i)
          const containerW = container.clientWidth - 32
          const defaultVP = page.getViewport({ scale: 1 })
          const fitScale = Math.min(containerW / defaultVP.width, 2.5)
          const vp = page.getViewport({ scale: fitScale })
          canvas.width = vp.width; canvas.height = vp.height
          const ctx = canvas.getContext('2d')!
          ctx.filter = darkMode ? 'invert(0.85) hue-rotate(180deg)' : 'none'
          await page.render({ canvasContext: ctx, viewport: vp }).promise
          setPagesRendered(prev => new Set([...prev, i]))
        } catch {}
      }
      scrollRenderingRef.current = false
    }
    renderAll()
  }, [pdfDoc, scrollMode, darkMode])

  // Track current page in scroll mode
  useEffect(() => {
    if (!scrollMode) return
    const container = scrollContainerRef.current
    if (!container) return
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && (e.intersectionRatio > 0.3)) {
          setCurrentPage(parseInt((e.target as HTMLElement).dataset.page || '1'))
        }
      })
    }, { root: container, threshold: 0.3 })
    const wrappers = container.querySelectorAll('[data-page]')
    wrappers.forEach(w => obs.observe(w))
    return () => obs.disconnect()
  }, [pagesRendered, scrollMode])

  // Auto-save every 2s
  const saveProgress = useCallback(async (silent = true) => {
    if (!user || !book || !totalPages) return
    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book, current_page: currentPage, total_pages: totalPages, user_id: user.id }),
      })
      if (res.ok && !silent) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    } catch {}
  }, [user, book, currentPage, totalPages])

  useEffect(() => {
    if (saveTimerRef.current) clearInterval(saveTimerRef.current)
    saveTimerRef.current = setInterval(() => saveProgress(true), 2000)
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current) }
  }, [saveProgress])

  // Controls auto-hide in fullscreen
  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    if (fullscreen) controlsTimerRef.current = setTimeout(() => setShowControls(false), 3500)
  }, [fullscreen])

  useEffect(() => { resetControlsTimer() }, [fullscreen])

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!fullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => {})
      setFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setFullscreen(false)
    }
  }, [fullscreen])

  useEffect(() => {
    const h = () => { if (!document.fullscreenElement) setFullscreen(false) }
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (scrollMode) return
      if (['ArrowRight','ArrowDown',' '].includes(e.key)) { if (currentPage < totalPages) setCurrentPage(p => p+1); e.preventDefault() }
      else if (['ArrowLeft','ArrowUp'].includes(e.key)) { if (currentPage > 1) setCurrentPage(p => p-1); e.preventDefault() }
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [currentPage, totalPages, scrollMode, toggleFullscreen])

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    resetControlsTimer()
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (scrollMode) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0 && currentPage < totalPages) setCurrentPage(p => p+1)
      else if (dx > 0 && currentPage > 1) setCurrentPage(p => p-1)
    }
  }

  // Click zones (left 30% = prev, right 30% = next, middle = toggle controls)
  const handleClick = (e: React.MouseEvent) => {
    resetControlsTimer()
    if (scrollMode) return
    const x = e.clientX, w = window.innerWidth
    if (x < w * 0.3) { if (currentPage > 1) setCurrentPage(p => p-1) }
    else if (x > w * 0.7) { if (currentPage < totalPages) setCurrentPage(p => p+1) }
    else setShowControls(v => !v)
  }

  const goTo = (page: number) => {
    const p = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(p)
    if (scrollMode && scrollContainerRef.current) {
      scrollContainerRef.current.querySelector(`[data-page="${p}"]`)?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const switchMode = () => {
    scrollRenderingRef.current = false
    setScrollMode(v => !v)
    setPagesRendered(new Set())
  }

  const pct = totalPages ? Math.round((currentPage/totalPages)*100) : 0
  const bg = darkMode ? '#0d0d0d' : '#FFF0F5'
  const barBg = darkMode ? '#1a0a0a' : 'white'
  const barBorder = darkMode ? '#3d1020' : '#FFD6E7'

  return (
    <div style={{ height:'100vh', background:bg, display:'flex', flexDirection:'column', overflow:'hidden', userSelect:'none', position:'relative' }}
      onMouseMove={resetControlsTimer} onClick={handleClick} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* TOP BAR */}
      <div style={{ background:barBg, borderBottom:`2px solid ${barBorder}`, padding:'8px 14px', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', zIndex:60, flexShrink:0,
        transition:'opacity 0.3s, transform 0.3s', opacity:showControls?1:0, transform:showControls?'translateY(0)':'translateY(-100%)', pointerEvents:showControls?'auto':'none' }}>

        <button onClick={(e)=>{e.stopPropagation();router.back()}}
          style={{ background:'none', border:'none', color:'#FF69B4', fontWeight:700, cursor:'pointer', fontSize:'0.9rem', flexShrink:0, padding:'4px 8px' }}>← Back</button>

        {book && <span style={{ fontSize:'0.8rem', fontWeight:700, color:'#FF1493', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:isMobile?'120px':'200px' }}>
          📚 {book.title}
        </span>}

        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginLeft:'auto' }} onClick={e=>e.stopPropagation()}>
          {/* Mode toggle */}
          <button onClick={switchMode} style={{ background:scrollMode?'linear-gradient(135deg,#FF69B4,#FF1493)':'#FFD6E7', color:scrollMode?'white':'#4A1942', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'0.72rem', fontWeight:700, whiteSpace:'nowrap' }}>
            {scrollMode ? '📜 Scroll' : '📄 Pages'}
          </button>

          {!scrollMode && <>
            <button onClick={()=>setScale(s=>Math.max(0.4,s-0.15))} style={{ background:'#FFD6E7', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontWeight:700, color:'#4A1942', fontSize:'0.9rem' }}>−</button>
            <span style={{ fontSize:'0.72rem', fontWeight:700, minWidth:'34px', textAlign:'center', color:darkMode?'#FFB6C1':'#4A1942' }}>{Math.round(scale*100)}%</span>
            <button onClick={()=>setScale(s=>Math.min(3,s+0.15))} style={{ background:'#FFD6E7', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontWeight:700, color:'#4A1942', fontSize:'0.9rem' }}>+</button>
          </>}

          <button onClick={()=>setDarkMode(!darkMode)} style={{ background:darkMode?'#FF69B4':'#FFD6E7', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'0.9rem' }}>
            {darkMode?'☀️':'🌙'}
          </button>

          <button onClick={toggleFullscreen} style={{ background:fullscreen?'linear-gradient(135deg,#FF69B4,#FF1493)':'#FFD6E7', color:fullscreen?'white':'#4A1942', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontWeight:700, fontSize:'0.85rem' }}>
            {fullscreen?'⊠':'⛶'}
          </button>

          <button onClick={(e)=>{e.stopPropagation();saveProgress(false)}}
            style={{ background:saved?'linear-gradient(135deg,#FF69B4,#FF1493)':'#FFD6E7', color:saved?'white':'#4A1942', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'0.72rem', fontWeight:700, whiteSpace:'nowrap', transition:'all 0.3s' }}>
            {saved?'💾 Saved!':'💾 Save'}
          </button>
        </div>
      </div>

      {/* Reading progress bar */}
      {totalPages > 0 && (
        <div style={{ height:'3px', background:darkMode?'#2d0a1a':'#FFD6E7', flexShrink:0 }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#FF69B4,#FF1493)', transition:'width 0.4s' }} />
        </div>
      )}

      {/* MAIN AREA */}
      <div style={{ flex:1, overflow:'hidden', position:'relative' }}>

        {/* Loading */}
        {loading && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:bg, zIndex:10 }}>
            <div style={{ fontSize:'4rem', marginBottom:'16px' }} className="heart-float">🌸</div>
            <p className="font-pacifico" style={{ color:'#FF1493', fontSize:'1.2rem', marginBottom:'16px' }}>{loadMsg}</p>
            <div style={{ width:'240px', height:'8px', background:'#FFD6E7', borderRadius:'4px', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${loadProgress}%`, background:'linear-gradient(90deg,#FF69B4,#FF1493)', transition:'width 0.5s' }} />
            </div>
            <p style={{ color:'#FFB6C1', fontSize:'0.8rem', marginTop:'10px' }}>🎀 Preparing your reading experience...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', textAlign:'center' }}>
            <div style={{ fontSize:'4rem', marginBottom:'14px' }}>😢</div>
            <h3 className="font-pacifico" style={{ color:'#FF1493', fontSize:'1.3rem', marginBottom:'10px' }}>Trouble loading this book</h3>
            <p style={{ color:'#FF91A4', maxWidth:'360px', marginBottom:'6px' }}>This book may not have a free PDF available on Internet Archive.</p>
            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center', marginTop:'16px' }}>
              <button className="btn-pink" onClick={(e)=>{e.stopPropagation();loadPDF()}}>🔄 Try Again</button>
              <a href={`https://archive.org/details/${id}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>
                <button style={{ background:'white', border:'2px solid #FF69B4', borderRadius:'50px', padding:'12px 18px', color:'#FF1493', fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>🌐 Archive.org</button>
              </a>
              <button onClick={(e)=>{e.stopPropagation();router.push('/')}} style={{ background:'white', border:'2px solid #FFD6E7', borderRadius:'50px', padding:'12px 18px', color:'#FF69B4', fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>🔍 Search Again</button>
            </div>
          </div>
        )}

        {/* SCROLL MODE */}
        {!loading && !error && scrollMode && (
          <div ref={scrollContainerRef} style={{ height:'100%', overflowY:'auto', padding:'12px 8px', background:darkMode?'#222':'#f5f5f5' }} />
        )}

        {/* PAGE MODE */}
        {!loading && !error && !scrollMode && (
          <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative' }}>
            {/* Hover zones desktop */}
            {!isMobile && <>
              <div style={{ position:'absolute', left:0, top:0, width:'28%', height:'100%', zIndex:5, cursor:'w-resize', display:'flex', alignItems:'center', justifyContent:'flex-start', paddingLeft:'12px', opacity:0, transition:'opacity 0.2s' }}
                onMouseEnter={e=>(e.currentTarget.style.opacity='1')} onMouseLeave={e=>(e.currentTarget.style.opacity='0')}
                onClick={(e)=>{e.stopPropagation();if(currentPage>1)setCurrentPage(p=>p-1)}}>
                <div style={{ background:'rgba(255,105,180,0.25)', backdropFilter:'blur(4px)', borderRadius:'50%', width:'52px', height:'52px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', color:'#FF1493', fontWeight:700 }}>◀</div>
              </div>
              <div style={{ position:'absolute', right:0, top:0, width:'28%', height:'100%', zIndex:5, cursor:'e-resize', display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:'12px', opacity:0, transition:'opacity 0.2s' }}
                onMouseEnter={e=>(e.currentTarget.style.opacity='1')} onMouseLeave={e=>(e.currentTarget.style.opacity='0')}
                onClick={(e)=>{e.stopPropagation();if(currentPage<totalPages)setCurrentPage(p=>p+1)}}>
                <div style={{ background:'rgba(255,105,180,0.25)', backdropFilter:'blur(4px)', borderRadius:'50%', width:'52px', height:'52px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', color:'#FF1493', fontWeight:700 }}>▶</div>
              </div>
            </>}
            <canvas ref={canvasRef} style={{ display:'block', maxWidth:'100%', maxHeight:'100%', boxShadow:'0 8px 40px rgba(255,20,147,0.18)', borderRadius:'6px', background:darkMode?'#111':'white' }} />
          </div>
        )}
      </div>

      {/* BOTTOM BAR - page mode */}
      {!loading && !error && !scrollMode && totalPages > 0 && (
        <div style={{ background:barBg, borderTop:`2px solid ${barBorder}`, padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:'12px', flexShrink:0,
          transition:'opacity 0.3s, transform 0.3s', opacity:showControls?1:0, transform:showControls?'translateY(0)':'translateY(100%)', pointerEvents:showControls?'auto':'none' }}
          onClick={e=>e.stopPropagation()}>
          <button className="btn-pink" onClick={()=>goTo(currentPage-1)} disabled={currentPage<=1} style={{ padding:'9px 18px', opacity:currentPage<=1?0.4:1, fontSize:'0.9rem' }}>← Prev</button>
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ fontWeight:700, color:'#FF1493', fontSize:'0.85rem' }}>Page</span>
            <input type="number" value={currentPage} onChange={e=>goTo(parseInt(e.target.value)||1)}
              style={{ width:'52px', textAlign:'center', border:'2px solid #FFB6C1', borderRadius:'8px', padding:'6px 4px', fontWeight:700, color:'#4A1942', fontSize:'0.9rem' }} min={1} max={totalPages} />
            <span style={{ fontWeight:700, color:'#FF1493', fontSize:'0.85rem' }}>/ {totalPages}</span>
          </div>
          <button className="btn-pink" onClick={()=>goTo(currentPage+1)} disabled={currentPage>=totalPages} style={{ padding:'9px 18px', opacity:currentPage>=totalPages?0.4:1, fontSize:'0.9rem' }}>Next →</button>
        </div>
      )}

      {/* Floating page indicator in scroll mode */}
      {!loading && !error && scrollMode && totalPages > 0 && (
        <div style={{ position:'fixed', bottom:'20px', right:'16px', background:'rgba(255,20,147,0.88)', color:'white', borderRadius:'20px', padding:'6px 14px', fontSize:'0.8rem', fontWeight:700, zIndex:50, pointerEvents:'none', backdropFilter:'blur(4px)' }}>
          {currentPage} / {totalPages} · {pct}%
        </div>
      )}

      {/* Mobile hint */}
      {isMobile && !scrollMode && !loading && !error && showControls && (
        <div style={{ position:'fixed', bottom:'70px', left:'50%', transform:'translateX(-50%)', background:'rgba(255,105,180,0.75)', color:'white', borderRadius:'12px', padding:'5px 14px', fontSize:'0.72rem', fontWeight:700, zIndex:50, pointerEvents:'none', whiteSpace:'nowrap', backdropFilter:'blur(4px)' }}>
          👈 Tap sides or swipe to turn pages
        </div>
      )}
    </div>
  )
}

export default function ReaderPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#FFF0F5'}}><div style={{textAlign:'center'}}><div style={{fontSize:'4rem'}} className="heart-float">🌸</div><p className="font-pacifico" style={{color:'#FF1493',marginTop:'12px'}}>Loading...</p></div></div>}>
      <ReaderContent id={params.id} />
    </Suspense>
  )
}
