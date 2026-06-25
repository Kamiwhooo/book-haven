'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { signUp } = useAuth()
  const router = useRouter()

  const handleRegister = async () => {
    if (password !== confirm) { setError('Passwords do not match!'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    setError('')
    const { error } = await signUp(email, password)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF0F5', padding: '24px' }}>
        <div className="card-pink" style={{ maxWidth: '420px', width: '100%', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
          <h2 className="font-pacifico" style={{ color: '#FF1493', fontSize: '1.8rem', marginBottom: '12px' }}>Welcome to Book Haven!</h2>
          <p style={{ color: '#FF69B4', marginBottom: '24px' }}>Check your email to confirm your account 💕</p>
          <button className="btn-pink" onClick={() => router.push('/login')} style={{ width: '100%' }}>
            Go to Sign In 🎀
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF0F5', padding: '24px' }}>
      <div className="card-pink" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🌸</div>
          <h1 className="font-pacifico" style={{ fontSize: '2rem', color: '#FF1493' }}>Join Book Haven</h1>
          <p style={{ color: '#FF91A4', marginTop: '8px' }}>Start your reading journey! 📚</p>
        </div>

        {error && (
          <div style={{ background: '#FFD6E7', border: '1px solid #FF69B4', borderRadius: '12px', padding: '12px', marginBottom: '20px', color: '#C7006E', fontSize: '0.9rem', textAlign: 'center' }}>
            😢 {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: '#4A1942', marginBottom: '6px', fontSize: '0.9rem' }}>💌 Email</label>
            <input className="input-pink" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: '#4A1942', marginBottom: '6px', fontSize: '0.9rem' }}>🔒 Password</label>
            <input className="input-pink" type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, color: '#4A1942', marginBottom: '6px', fontSize: '0.9rem' }}>🔒 Confirm Password</label>
            <input className="input-pink" type="password" placeholder="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button className="btn-pink" onClick={handleRegister} disabled={loading} style={{ width: '100%', marginTop: '8px', fontSize: '1rem', padding: '14px', opacity: loading ? 0.7 : 1 }}>
            {loading ? '🌸 Creating account...' : '🎀 Create Account'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', color: '#FF91A4', fontSize: '0.9rem' }}>
          Already a member?{' '}
          <Link href="/login" style={{ color: '#FF1493', fontWeight: 700, textDecoration: 'none' }}>Sign in 💕</Link>
        </p>
      </div>
    </div>
  )
}
