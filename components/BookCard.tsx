'use client'
import { Book } from '@/types'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export default function BookCard({ book }: { book: Book }) {
  const router = useRouter()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) { router.push('/login'); return }
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book, current_page: 1, total_pages: book.pages || 0, user_id: user.id, access_token: session?.access_token }),
      })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  const handleClick = () => {
    // If it's a bookfrom.net web book, open web reader
    if ((book as any).web_url) {
      router.push(`/read-web?url=${encodeURIComponent((book as any).web_url)}`)
      return
    }
    router.push(`/book/${book.archive_id}`)
  }

  const isWebBook = !!(book as any).web_url
  const hasPdf = (book as any).has_pdf
  const borrowOnly = (book as any).borrow_only

  return (
    <div className="book-card card-pink" onClick={handleClick} style={{ overflow:'hidden', position:'relative', cursor:'pointer' }}>
      {/* Cover */}
      <div style={{ position:'relative', paddingTop:'140%', background:'#FFF0F5', overflow:'hidden' }}>
        <img
          src={book.cover_url || `https://archive.org/services/img/${book.archive_id}`}
          alt={book.title}
          style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', objectFit:'cover' }}
          onError={(e) => {
            const t = e.target as HTMLImageElement
            t.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iI0ZGRDBFNyIvPjx0ZXh0IHg9IjEwMCIgeT0iMTMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjMwIj7wn4ScPC90ZXh0Pjx0ZXh0IHg9IjEwMCIgeT0iMTYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjExIiBmaWxsPSIjOTk2Nzg4Ij5ObyBDb3ZlcjwvdGV4dD48L3N2Zz4='
          }}
        />

        {/* Source badge */}
        <div style={{ position:'absolute', top:'6px', left:'6px' }}>
          {isWebBook ? (
            <span style={{ background:'rgba(255,105,180,0.9)', color:'white', fontSize:'0.6rem', fontWeight:700, padding:'2px 6px', borderRadius:'10px', backdropFilter:'blur(4px)' }}>📖 Read Free</span>
          ) : hasPdf && !borrowOnly ? (
            <span style={{ background:'rgba(34,197,94,0.85)', color:'white', fontSize:'0.6rem', fontWeight:700, padding:'2px 6px', borderRadius:'10px', backdropFilter:'blur(4px)' }}>✅ Free PDF</span>
          ) : borrowOnly ? (
            <span style={{ background:'rgba(100,100,100,0.8)', color:'white', fontSize:'0.6rem', fontWeight:700, padding:'2px 6px', borderRadius:'10px', backdropFilter:'blur(4px)' }}>🔒 Borrow</span>
          ) : null}
        </div>

        {/* Save button */}
        {user && !isWebBook && (
          <button onClick={handleSave} disabled={saving}
            style={{ position:'absolute', top:'6px', right:'6px', background:saved?'linear-gradient(135deg,#FF69B4,#FF1493)':'rgba(255,255,255,0.92)', border:'none', borderRadius:'50%', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:'0.8rem', boxShadow:'0 2px 8px rgba(0,0,0,0.15)', transition:'all 0.2s' }}>
            {saving ? '⏳' : saved ? '✅' : '🔖'}
          </button>
        )}
      </div>

      {/* Info */}
      <div style={{ padding:'10px' }}>
        <h3 style={{ fontSize:'0.82rem', fontWeight:700, color:'#4A1942', lineHeight:1.3, marginBottom:'3px', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {book.title}
        </h3>
        <p style={{ fontSize:'0.72rem', color:'#FF69B4', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {book.author || 'Unknown Author'}
        </p>
      </div>
    </div>
  )
}
