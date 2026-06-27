'use client'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const { user, signOut, loading } = useAuth()
  const router = useRouter()

  return (
    <nav style={{ background:'white', borderBottom:'2px solid #FFD6E7', padding:'10px 16px', position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 12px rgba(255,105,180,0.15)' }}>
      <div style={{ maxWidth:'1200px', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px' }}>
        <Link href="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
          <span style={{ fontSize:'1.4rem' }}>🎀</span>
          <span className="font-pacifico" style={{ fontSize:'1.3rem', color:'#FF1493' }}>Book Haven</span>
        </Link>

        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {/* Link reader button - always visible */}
          <Link href="/link" style={{ textDecoration:'none' }}>
            <button style={{ background:'rgba(255,105,180,0.1)', border:'2px solid #FFD6E7', borderRadius:'50px', padding:'6px 12px', color:'#FF69B4', fontWeight:700, cursor:'pointer', fontSize:'0.78rem', fontFamily:'Nunito,sans-serif', whiteSpace:'nowrap' }}>
              🔗 Open Link
            </button>
          </Link>

          {!loading && user ? (
            <>
              <Link href="/library" style={{ textDecoration:'none', color:'#FF69B4', fontWeight:700, fontSize:'0.85rem', whiteSpace:'nowrap' }}>📚 Library</Link>
              <button onClick={async () => { await signOut(); router.push('/') }}
                style={{ background:'linear-gradient(135deg,#FF69B4,#FF1493)', color:'white', border:'none', borderRadius:'50px', padding:'7px 14px', fontWeight:700, cursor:'pointer', fontSize:'0.8rem', fontFamily:'Nunito,sans-serif' }}>
                Sign Out
              </button>
            </>
          ) : !loading && !user ? (
            <button onClick={() => router.push('/login')}
              style={{ background:'linear-gradient(135deg,#FF69B4,#FF1493)', color:'white', border:'none', borderRadius:'50px', padding:'8px 18px', fontWeight:700, cursor:'pointer', fontSize:'0.85rem', fontFamily:'Nunito,sans-serif' }}>
              Sign In 🎀
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  )
}
