'use client'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const { user, signOut, loading } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <nav style={{ background: 'white', borderBottom: '2px solid #FFD6E7', padding: '12px 24px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(255,105,180,0.15)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.8rem' }}>🎀</span>
          <span className="font-pacifico" style={{ fontSize: '1.6rem', color: '#FF1493' }}>Book Haven</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {!loading && user ? (
            <>
              <Link href="/library" style={{ textDecoration: 'none', color: '#FF69B4', fontWeight: 700, fontSize: '0.95rem' }}>
                📚 My Library
              </Link>
              <span style={{ color: '#FF69B4', fontSize: '0.85rem' }}>
                💕 {user.user_metadata?.name?.split(' ')[0] || user.email?.split('@')[0]}
              </span>
              <button onClick={handleSignOut} className="btn-pink" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
                Sign Out
              </button>
            </>
          ) : !loading && !user ? (
            <button onClick={() => router.push('/login')} className="btn-pink" style={{ padding: '10px 24px', fontSize: '0.9rem' }}>
              Sign In 🎀
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  )
}
