'use client'
import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

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
  const [loading, setLoading] = useState(true)
  const [loadMsg, setLoadMsg] = useState('🌸 Loading your book...')
  const [loadProgress, setLoadProgress] = useState(0)
  const [error, setError] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [book, setBook] = useState<BookMeta | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle'|'saved'|'error'>('idle')
  const [scrollMode, setScrollMode] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [showBars, setShowBars] = useState(true)
  const [pagesRendered, setPagesRendered] = useState(0)
  const [showPanel, setShowPanel] = useState(false)

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const renderTaskRef = useRef<any>(null)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const lastTapTime = useRef(0)
  const pdfDocRef = useRef<any>(null)
  const scrollRenderRef = useRef(false)
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = currentPage

  useEffect(() => {
    if (window.pdfjsLib) return
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js' }
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    fetch(`/api/books/${id}`).then(r => r.json()).then(d => { if (d.book) setBook(d.book) }).catch(() => {})
  }, [id])

  const loadPDF = useCallback(async () => {
    setLoading(true); setError(''); setLoadProgress(0); setPagesRendered(0)
    scrollRenderRef.current = false
    try {
      let tries = 0
      while (!window.pdfjsLib && tries < 60) { await new Promise(r => setTimeout(r, 200)); tries++ }
      if (!window.pdfjsLib) throw new Error('PDF.js failed to load')
      setLoadMsg('🎀 Connecting...'); setLoadProgress(20)
      const task = window.pdfjsLib.getDocument({
        url: `/api/pdf?id=${encodeURIComponent(id)}`,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
      })
      task.onProgress = (p: any) => { if (p.total) { setLoadProgress(50 + Math.round((p.loaded / p.total) * 40)); setLoadMsg('🌸 Downloading...') } }
      setLoadProgress(50)
      const pdf = await task.promise
      pdfDocRef.current = pdf; setPdfDoc(pdf); setTotalPages(pdf.numPages); setLoadProgress(100); setLoading(false)
    } catch (err: any) { setError(err.message || 'Failed to load PDF'); setLoading(false) }
  }, [id])

  useEffect(() => { setTimeout(loadPDF, 500) }, [loadPDF])

  const renderPage = useCallback(async (pageNum: number) => {
    const doc = pdfDocRef.current || pdfDoc; const canvas = canvasRef.current
    if (!doc || !canvas || scrollMode) return
    if (renderTaskRef.current) { try { renderTaskRef.current.cancel() } catch {} }
    try {
      const page = await doc.getPage(pageNum)
      const w = (canvas.parentElement?.clientWidth || window.innerWidth) - 24
      const h = (canvas.parentElement?.clientHeight || window.innerHeight) - 24
      const vp1 = page.getViewport({ scale: 1 })
      const vp = page.getViewport({ scale: Math.min(w / vp1.width, h / vp1.height, 2.5) })
      canvas.width = vp.width; canvas.height = vp.height
      const ctx = canvas.getContext('2d')!
      ctx.filter = darkMode ? 'invert(0.85) hue-rotate(180deg)' : 'none'
      const t = page.render({ canvasContext: ctx, viewport: vp })
      renderTaskRef.current = t; await t.promise
    } catch (e: any) { if (e?.name !== 'RenderingCancelledException') console.error(e) }
  }, [pdfDoc, darkMode, scrollMode])

  useEffect(() => { if (pdfDoc && !scrollMode) renderPage(currentPage) }, [pdfDoc, currentPage, darkMode, scrollMode])

  useEffect(() => {
    if (!pdfDoc || !scrollMode || scrollRenderRef.current) return
    const container = scrollContainerRef.current; if (!container) return
    container.innerHTML = ''; setPagesRendered(0); scrollRenderRef.current = true
    const startPage = parseInt(searchParams.get('page') || '1')
    const renderAll = async () => {
      const doc = pdfDocRef.current || pdfDoc
      for (let i = 1; i <= doc.numPages; i++) {
        const wrapper = document.createElement('div')
        wrapper.style.cssText = 'margin-bottom:10px;display:flex;justify-content:center;'
        wrapper.dataset.page = String(i)
        const canvas = document.createElement('canvas')
        canvas.style.cssText = `max-width:100%;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,0.1);background:${darkMode ? '#111' : 'white'};display:block;`
        wrapper.appendChild(canvas); container.appendChild(wrapper)
        try {
          const page = await doc.getPage(i)
          const w = container.clientWidth - 12; const vp1 = page.getViewport({ scale: 1 })
          const vp = page.getViewport({ scale: Math.min(w / vp1.width, 3) })
          canvas.width = vp.width; canvas.height = vp.height
          const ctx = canvas.getContext('2d')!; ctx.filter = darkMode ? 'invert(0.85) hue-rotate(180deg)' : 'none'
          await page.render({ canvasContext: ctx, viewport: vp }).promise
          setPagesRendered(i)
          if (i === Math.min(startPage, 3) && startPage > 1)
            setTimeout(() => container.querySelector(`[data-page="${startPage}"]`)?.scrollIntoView(), 100)
        } catch {}
      }
      scrollRenderRef.current = false
    }
    renderAll()
  }, [pdfDoc, scrollMode, darkMode])

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

  // Save WITH access token to fix RLS
  const saveProgress = useCallback(async (silent = true) => {
    if (!user || !book) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book, current_page: currentPageRef.current, total_pages: totalPages,
          user_id: user.id, access_token: session?.access_token,
        }),
      })
      if (res.ok) { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), silent ? 1000 : 2500) }
      else {
        const d = await res.json(); console.error('Save error:', d.error)
        setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } catch { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 3000) }
  }, [user, book, totalPages])

  useEffect(() => {
    if (saveTimerRef.current) clearInterval(saveTimerRef.current)
    saveTimerRef.current = setInterval(() => { if (totalPages > 0 && user) saveProgress(true) }, 3000)
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current) }
  }, [saveProgress, totalPages, user])

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
    if (now - lastTapTime.current < 280 && Math.abs(dx) < 15 && Math.abs(dy) < 15) { setShowBars(v => !v); setShowPanel(false); lastTapTime.current = 0; return }
    lastTapTime.current = now; resetHide()
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
  const bg = darkMode ? '#0d0d0d' : '#FFF0F5'
  const barBg = darkMode ? 'rgba(20,5,5,0.96)' : 'rgba(255,255,255,0.97)'
  const border = darkMode ? '#3d1020' : '#FFD6E7'
  const saveLbl = saveStatus === 'saved' ? '✅ Saved' : saveStatus === 'error' ? '❌ Error' : '💾 Save'
  const saveBg = saveStatus === 'saved' ? 'linear-gradient(135deg,#FF69B4,#FF1493)' : '#FFD6E7'
  const saveClr = saveStatus === 'saved' ? 'white' : saveStatus === 'error' ? '#C7006E' : '#4A1942'

  return (
    <div style={{ height:'100vh', background:bg, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', userSelect:'none' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onMouseMove={resetHide} onClick={onClick}>

      {/* TOP BAR */}
      <div style={{ background:barBg, borderBottom:`1px solid ${border}`, backdropFilter:'blur(8px)', padding:'8px 12px', display:'flex', alignItems:'center', gap:'8px', flexShrink:0, zIndex:60, transition:'transform 0.3s,opacity 0.3s', transform:showBars?'translateY(0)':'translateY(-100%)', opacity:showBars?1:0, pointerEvents:showBars?'auto':'none' }}>
        <button onClick={(e)=>{e.stopPropagation();router.back()}} style={{ background:'none', border:'none', color:'#FF69B4', fontWeight:700, cursor:'pointer', fontSize:'0.9rem', padding:'4px 6px', flexShrink:0 }}>← Back</button>
        {book && <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#FF1493', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{book.title}</span>}
        <div style={{ display:'flex', gap:'5px', flexShrink:0 }} onClick={e=>e.stopPropagation()}>
          <button onClick={switchMode} style={{ background:scrollMode?'linear-gradient(135deg,#FF69B4,#FF1493)':'#FFD6E7', color:scrollMode?'white':'#4A1942', border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', fontSize:'0.72rem', fontWeight:700 }}>{scrollMode?'📜':'📄'}</button>
          <button onClick={()=>setDarkMode(!darkMode)} style={{ background:darkMode?'#FF69B4':'#FFD6E7', border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', fontSize:'0.85rem' }}>{darkMode?'☀️':'🌙'}</button>
          <button onClick={toggleFullscreen} style={{ background:fullscreen?'linear-gradient(135deg,#FF69B4,#FF1493)':'#FFD6E7', color:fullscreen?'white':'#4A1942', border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', fontSize:'0.85rem' }}>{fullscreen?'⊠':'⛶'}</button>
          <button onClick={(e)=>{e.stopPropagation();saveProgress(false)}} style={{ background:saveBg, color:saveClr, border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', fontSize:'0.72rem', fontWeight:700, transition:'all 0.3s', whiteSpace:'nowrap' }}>{saveLbl}</button>
        </div>
      </div>

      {totalPages > 0 && <div style={{ height:'3px', background:darkMode?'#2d0a1a':'#FFD6E7', flexShrink:0 }}><div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#FF69B4,#FF1493)', transition:'width 0.5s' }} /></div>}

      <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
        {loading && <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:bg, zIndex:10 }}>
          <div style={{ fontSize:'3.5rem', marginBottom:'16px' }} className="heart-float">🌸</div>
          <p className="font-pacifico" style={{ color:'#FF1493', fontSize:'1.2rem', marginBottom:'16px' }}>{loadMsg}</p>
          <div style={{ width:'240px', height:'8px', background:'#FFD6E7', borderRadius:'4px', overflow:'hidden' }}><div style={{ height:'100%', width:`${loadProgress}%`, background:'linear-gradient(90deg,#FF69B4,#FF1493)', transition:'width 0.5s' }} /></div>
        </div>}
        {error && !loading && <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', textAlign:'center' }}>
          <div style={{ fontSize:'3.5rem', marginBottom:'12px' }}>😢</div>
          <h3 className="font-pacifico" style={{ color:'#FF1493', fontSize:'1.2rem', marginBottom:'10px' }}>Trouble loading this book</h3>
          <p style={{ color:'#FF91A4', maxWidth:'300px', marginBottom:'20px', fontSize:'0.9rem' }}>This book may not have a free PDF on Internet Archive.</p>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center' }}>
            <button className="btn-pink" onClick={(e)=>{e.stopPropagation();loadPDF()}}>🔄 Retry</button>
            <a href={`https://archive.org/details/${id}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>
              <button style={{ background:'white', border:'2px solid #FF69B4', borderRadius:'50px', padding:'10px 16px', color:'#FF1493', fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>🌐 View on Archive</button>
            </a>
          </div>
        </div>}
        {!loading && !error && scrollMode && <div ref={scrollContainerRef} style={{ height:'100%', overflowY:'auto', padding:'8px 6px 60px', background:darkMode?'#1a1a1a':'#eee', WebkitOverflowScrolling:'touch' }} />}
        {!loading && !error && !scrollMode && <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative' }}>
          <div onClick={(e)=>{e.stopPropagation();if(currentPage>1)setCurrentPage(p=>p-1)}} style={{ position:'absolute', left:0, top:0, width:'25%', height:'100%', cursor:'pointer', display:'flex', alignItems:'center', paddingLeft:'8px', opacity:0, transition:'opacity 0.2s', zIndex:5 }} onMouseEnter={e=>(e.currentTarget.style.opacity='1')} onMouseLeave={e=>(e.currentTarget.style.opacity='0')}>
            <div style={{ background:'rgba(255,105,180,0.2)', borderRadius:'50%', width:'44px', height:'44px', display:'flex', alignItems:'center', justifyContent:'center', color:'#FF1493', fontSize:'1.2rem' }}>◀</div>
          </div>
          <div onClick={(e)=>{e.stopPropagation();if(currentPage<totalPages)setCurrentPage(p=>p+1)}} style={{ position:'absolute', right:0, top:0, width:'25%', height:'100%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:'8px', opacity:0, transition:'opacity 0.2s', zIndex:5 }} onMouseEnter={e=>(e.currentTarget.style.opacity='1')} onMouseLeave={e=>(e.currentTarget.style.opacity='0')}>
            <div style={{ background:'rgba(255,105,180,0.2)', borderRadius:'50%', width:'44px', height:'44px', display:'flex', alignItems:'center', justifyContent:'center', color:'#FF1493', fontSize:'1.2rem' }}>▶</div>
          </div>
          <canvas ref={canvasRef} style={{ display:'block', maxWidth:'100%', maxHeight:'100%', boxShadow:'0 4px 24px rgba(255,20,147,0.15)', borderRadius:'4px', background:darkMode?'#111':'white' }} />
        </div>}
      </div>

      {/* PAGE MODE bottom bar */}
      {!loading && !error && !scrollMode && totalPages > 0 && (
        <div style={{ background:barBg, borderTop:`1px solid ${border}`, backdropFilter:'blur(8px)', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:'12px', flexShrink:0, zIndex:60, transition:'transform 0.3s,opacity 0.3s', transform:showBars?'translateY(0)':'translateY(100%)', opacity:showBars?1:0, pointerEvents:showBars?'auto':'none' }} onClick={e=>e.stopPropagation()}>
          <button className="btn-pink" onClick={()=>goTo(currentPage-1)} disabled={currentPage<=1} style={{ padding:'9px 18px', opacity:currentPage<=1?0.4:1 }}>← Prev</button>
          <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <input type="number" value={currentPage} onChange={e=>goTo(parseInt(e.target.value)||1)} style={{ width:'50px', textAlign:'center', border:'2px solid #FFB6C1', borderRadius:'8px', padding:'5px 3px', fontWeight:700, color:'#4A1942', fontSize:'0.9rem' }} min={1} max={totalPages} />
            <span style={{ fontWeight:700, color:'#FF1493', fontSize:'0.85rem' }}>/ {totalPages}</span>
          </div>
          <button className="btn-pink" onClick={()=>goTo(currentPage+1)} disabled={currentPage>=totalPages} style={{ padding:'9px 18px', opacity:currentPage>=totalPages?0.4:1 }}>Next →</button>
        </div>
      )}

      {/* SCROLL MODE - always-visible floating bar at bottom */}
      {!loading && !error && scrollMode && totalPages > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:70, background:barBg, borderTop:`1px solid ${border}`, backdropFilter:'blur(10px)', padding:'8px 12px', display:'flex', alignItems:'center', gap:'8px' }} onClick={e=>e.stopPropagation()}>
          <div style={{ display:'flex', alignItems:'center', gap:'4px', flexShrink:0 }}>
            <span style={{ fontSize:'0.7rem', fontWeight:700, color:'#FF1493' }}>p.</span>
            <input type="number" value={currentPage} onChange={e=>goTo(parseInt(e.target.value)||1)} style={{ width:'42px', textAlign:'center', border:'2px solid #FFB6C1', borderRadius:'7px', padding:'3px 2px', fontWeight:700, color:'#4A1942', fontSize:'0.8rem' }} min={1} max={totalPages} />
            <span style={{ fontSize:'0.68rem', color:'#FF91A4' }}>/{totalPages}</span>
          </div>
          <div style={{ flex:1, height:'5px', background:'#FFD6E7', borderRadius:'3px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#FF69B4,#FF1493)', transition:'width 0.5s' }} />
          </div>
          {/* Save button ALWAYS visible in scroll mode */}
          <button onClick={(e)=>{e.stopPropagation();saveProgress(false)}} style={{ background:saveBg, color:saveClr, border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'0.72rem', fontWeight:700, transition:'all 0.3s', whiteSpace:'nowrap', flexShrink:0 }}>{saveLbl}</button>
          <button onClick={(e)=>{e.stopPropagation();setShowPanel(v=>!v)}} style={{ background:'#FFD6E7', border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', fontSize:'0.85rem', flexShrink:0 }}>☰</button>
        </div>
      )}

      {/* SIDE PANEL */}
      {showPanel && (
        <div style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(0,0,0,0.3)' }} onClick={()=>setShowPanel(false)}>
          <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'210px', background:barBg, borderLeft:`2px solid ${border}`, padding:'18px 14px', display:'flex', flexDirection:'column', gap:'10px', backdropFilter:'blur(12px)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
              <span className="font-pacifico" style={{ color:'#FF1493', fontSize:'1rem' }}>Menu 🎀</span>
              <button onClick={()=>setShowPanel(false)} style={{ background:'none', border:'none', fontSize:'1.1rem', cursor:'pointer', color:'#FF69B4' }}>✕</button>
            </div>
            {[
              { label: saveLbl, action: ()=>{saveProgress(false);setShowPanel(false)}, bg:saveBg, color:saveClr },
              { label: scrollMode?'📄 Page Mode':'📜 Scroll Mode', action:()=>{switchMode();setShowPanel(false)}, bg:'#FFD6E7', color:'#4A1942' },
              { label: darkMode?'☀️ Light Mode':'🌙 Dark Mode', action:()=>{setDarkMode(!darkMode);setShowPanel(false)}, bg:'#FFD6E7', color:'#4A1942' },
              { label: fullscreen?'⊠ Exit Fullscreen':'⛶ Fullscreen', action:()=>{toggleFullscreen();setShowPanel(false)}, bg:'#FFD6E7', color:'#4A1942' },
              { label:'← Back to Book', action:()=>router.back(), bg:'#FFD6E7', color:'#4A1942' },
            ].map((btn,i)=>(
              <button key={i} onClick={btn.action} style={{ background:btn.bg, color:btn.color, border:'none', borderRadius:'10px', padding:'11px', cursor:'pointer', fontWeight:700, fontSize:'0.88rem', fontFamily:'Nunito,sans-serif', textAlign:'left' }}>{btn.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReaderPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#FFF0F5'}}><div style={{textAlign:'center'}}><div style={{fontSize:'3rem'}} className="heart-float">🌸</div><p className="font-pacifico" style={{color:'#FF1493',marginTop:'12px'}}>Loading...</p></div></div>}>
      <ReaderContent id={params.id} />
    </Suspense>
  )
}
