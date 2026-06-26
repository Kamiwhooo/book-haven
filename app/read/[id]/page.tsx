'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

declare global {
  interface Window { pdfjsLib: any }
}

interface BookMeta {
  archive_id: string
  title: string
  author: string | null
  cover_url: string
  pdf_url: string
  pages: number | null
}

export default function ReaderPage({ params }: { params: { id: string } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()

  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'))
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(true)
  const [loadMsg, setLoadMsg] = useState('🌸 Loading your book...')
  const [loadProgress, setLoadProgress] = useState(0)
  const [error, setError] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [book, setBook] = useState<BookMeta | null>(null)
  const [saved, setSaved] = useState(false)
  const [rendering, setRendering] = useState(false)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const renderTaskRef = useRef<any>(null)

  // Load PDF.js
  useEffect(() => {
    if (window.pdfjsLib) return
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    }
    document.head.appendChild(script)
  }, [])

  // Fetch book metadata
  useEffect(() => {
    fetch(`/api/books/${params.id}`)
      .then(r => r.json())
      .then(data => setBook(data.book))
      .catch(() => {})
  }, [params.id])

  const waitForPDFJS = async () => {
    let tries = 0
    while (!window.pdfjsLib && tries < 50) {
      await new Promise(r => setTimeout(r, 200))
      tries++
    }
    if (!window.pdfjsLib) throw new Error('PDF.js failed to load')
  }

  const loadPDF = useCallback(async () => {
    setLoading(true)
    setError('')
    setLoadProgress(0)

    try {
      await waitForPDFJS()

      setLoadMsg('🎀 Finding your book on Internet Archive...')
      setLoadProgress(20)

      // Use our proxy API to avoid CORS
      const proxyUrl = `/api/pdf?id=${encodeURIComponent(params.id)}`

      setLoadMsg('🌸 Loading pages...')
      setLoadProgress(50)

      const loadingTask = window.pdfjsLib.getDocument({
        url: proxyUrl,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
      })

      loadingTask.onProgress = (progress: any) => {
        if (progress.total) {
          const pct = Math.round((progress.loaded / progress.total) * 40) + 50
          setLoadProgress(Math.min(pct, 90))
          setLoadMsg(`💕 Loading... ${Math.round((progress.loaded / progress.total) * 100)}%`)
        }
      }

      const pdf = await loadingTask.promise
      setLoadProgress(100)
      setPdfDoc(pdf)
      setTotalPages(pdf.numPages)
      setLoading(false)
    } catch (err: any) {
      console.error('PDF load error:', err)
      setError(err.message || 'Failed to load PDF')
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    const timer = setTimeout(loadPDF, 600)
    return () => clearTimeout(timer)
  }, [loadPDF])

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel() } catch {}
    }
    setRendering(true)
    try {
      const page = await pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')!
      canvas.width = viewport.width
      canvas.height = viewport.height
      ctx.filter = darkMode ? 'invert(0.85) hue-rotate(180deg)' : 'none'
      const task = page.render({ canvasContext: ctx, viewport })
      renderTaskRef.current = task
      await task.promise
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') console.error(e)
    } finally {
      setRendering(false)
    }
  }, [pdfDoc, scale, darkMode])

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage)
  }, [pdfDoc, currentPage, scale, darkMode])

  // Auto-save every 2 seconds
  const saveProgress = useCallback(async () => {
    if (!user || !book || !totalPages) return
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book, current_page: currentPage, total_pages: totalPages, user_id: user.id }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch {}
  }, [user, book, currentPage, totalPages])

  useEffect(() => {
    if (saveTimerRef.current) clearInterval(saveTimerRef.current)
    saveTimerRef.current = setInterval(saveProgress, 2000)
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current) }
  }, [saveProgress])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { if (currentPage < totalPages) setCurrentPage(p => p + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { if (currentPage > 1) setCurrentPage(p => p - 1) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentPage, totalPages])

  const goTo = (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  const progressPct = totalPages ? Math.round((currentPage / totalPages) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: darkMode ? '#1a0a0a' : '#FFF0F5', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: darkMode ? '#2d0a1a' : 'white', borderBottom: `2px solid ${darkMode ? '#5d1a30' : '#FFD6E7'}`, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', position: 'sticky', top: '64px', zIndex: 50 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#FF69B4', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>← Back</button>
        {book && <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FF1493', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>📚 {book.title}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} style={{ background: '#FFD6E7', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>−</button>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: '40px', textAlign: 'center', color: darkMode ? '#FFB6C1' : '#4A1942' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.2))} style={{ background: '#FFD6E7', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>+</button>
          <button onClick={() => setScale(1.2)} style={{ background: '#FFD6E7', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>Reset</button>
          <button onClick={() => setDarkMode(!darkMode)} style={{ background: darkMode ? '#FF69B4' : '#FFD6E7', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>{darkMode ? '☀️' : '🌙'}</button>
          {saved && <span style={{ color: '#FF1493', fontSize: '0.8rem', fontWeight: 700 }}>💾 Saved!</span>}
        </div>
      </div>

      {/* Progress bar */}
      {totalPages > 0 && (
        <div style={{ height: '4px', background: '#FFD6E7' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #FF69B4, #FF1493)', transition: 'width 0.3s' }} />
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', gap: '20px' }}>
        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 24px', maxWidth: '400px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }} className="heart-float">🌸</div>
            <p className="font-pacifico" style={{ color: '#FF1493', fontSize: '1.3rem', marginBottom: '16px' }}>{loadMsg}</p>
            <div style={{ width: '100%', height: '8px', background: '#FFD6E7', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${loadProgress}%`, background: 'linear-gradient(90deg, #FF69B4, #FF1493)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>
            <p style={{ color: '#FFB6C1', fontSize: '0.85rem', marginTop: '12px' }}>🎀 Preparing your magical reading experience...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ textAlign: 'center', padding: '60px 24px', maxWidth: '500px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>😢</div>
            <h3 className="font-pacifico" style={{ color: '#FF1493', fontSize: '1.4rem', marginBottom: '12px' }}>Oops! Trouble loading this book</h3>
            <p style={{ color: '#FF91A4', marginBottom: '8px' }}>
              This book might not have a freely available PDF on Internet Archive.
            </p>
            <p style={{ color: '#FFB6C1', fontSize: '0.85rem', marginBottom: '24px' }}>
              Try searching for a different edition, or view it directly on Archive.org.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-pink" onClick={loadPDF}>🔄 Try Again</button>
              <a href={`https://archive.org/details/${params.id}`} target="_blank" rel="noopener noreferrer">
                <button style={{ background: 'white', border: '2px solid #FF69B4', borderRadius: '50px', padding: '12px 24px', color: '#FF1493', fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>
                  🌐 View on Archive.org
                </button>
              </a>
              <button style={{ background: 'white', border: '2px solid #FFD6E7', borderRadius: '50px', padding: '12px 24px', color: '#FF69B4', fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }} onClick={() => router.push('/')}>
                🔍 Search Another Book
              </button>
            </div>
          </div>
        )}

        {/* Canvas */}
        {!loading && !error && (
          <div style={{ boxShadow: '0 8px 40px rgba(255,20,147,0.2)', borderRadius: '8px', overflow: 'hidden', maxWidth: '100%', background: darkMode ? '#111' : 'white' }}>
            <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }} />
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      {!loading && !error && totalPages > 0 && (
        <div style={{ position: 'sticky', bottom: 0, background: darkMode ? '#2d0a1a' : 'white', borderTop: `2px solid ${darkMode ? '#5d1a30' : '#FFD6E7'}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button className="btn-pink" onClick={() => goTo(currentPage - 1)} disabled={currentPage <= 1} style={{ padding: '10px 20px', opacity: currentPage <= 1 ? 0.4 : 1 }}>← Prev</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: '#FF1493' }}>Page</span>
            <input type="number" value={currentPage} onChange={(e) => goTo(parseInt(e.target.value) || 1)} style={{ width: '60px', textAlign: 'center', border: '2px solid #FFB6C1', borderRadius: '8px', padding: '6px', fontWeight: 700, color: '#4A1942', fontSize: '0.9rem' }} min={1} max={totalPages} />
            <span style={{ fontWeight: 700, color: '#FF1493' }}>of {totalPages}</span>
          </div>
          <button className="btn-pink" onClick={() => goTo(currentPage + 1)} disabled={currentPage >= totalPages} style={{ padding: '10px 20px', opacity: currentPage >= totalPages ? 0.4 : 1 }}>Next →</button>
        </div>
      )}
    </div>
  )
}
