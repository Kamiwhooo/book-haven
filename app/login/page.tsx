'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message || 'Login failed')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF0F5', padding: '24px' }}>
      <div className="card-pink" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎀</div>
          <h1 className="font-pacifico" style={{ fontSize: '2rem', color: '#FF1493' }}>Welcome Back!</h1>
          <p style={{ color: '#FF91A4', marginTop: '8px' }}>Sign in to continue reading 💕</p>
        </div>

        {error && (
          <div style={{ background: '#FFD6E7', border: '1px solid #FF69B4', borderRadius: '12px', padding: '12px', marginBottom: '20px', color: '#C7006E', fontSize: '0.9rem', textAlign: 'center' }}>
            😢 {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: '#4A1942', marginBottom: '6px', fontSize: '0.9rem' }}>
              💌 Email
            </label>
            <input
              className="input-pink"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, color: '#4A1942', marginBottom: '6px', fontSize: '0.9rem' }}>
              🔒 Password
            </label>
            <input
              className="input-pink"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin(e as any)}
            />
          </div>

          <button
            className="btn-pink"
            onClick={handleLogin}
            disabled={loading}
            style={{ width: '100%', marginTop: '8px', fontSize: '1rem', padding: '14px', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '🌸 Signing in...' : '✨ Sign In'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', color: '#FF91A4', fontSize: '0.9rem' }}>
          New here?{' '}
          <Link href="/register" style={{ color: '#FF1493', fontWeight: 700, textDecoration: 'none' }}>
            Create account 🎀
          </Link>
        </p>
      </div>
    </div>
  )
}
