'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/')
    }
  }, [user, authLoading, router])

  // Check for error in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error')) {
      setError('Sign in failed. Please try again.')
    }
  }, [])

  const handleGoogle = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) throw error
      // If data.url exists, redirect manually
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect with Google')
      setLoading(false)
    }
  }

  if (authLoading || user) return (
    <div style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF0F5' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }} className="heart-float">🌸</div>
        <p className="font-pacifico" style={{ color: '#FF1493', marginTop: '12px' }}>Loading...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF0F5', padding: '24px' }}>
      <div className="card-pink" style={{ width: '100%', maxWidth: '420px', padding: '48px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🎀</div>
        <h1 className="font-pacifico" style={{ fontSize: '2.2rem', color: '#FF1493', marginBottom: '8px' }}>Welcome Back!</h1>
        <p style={{ color: '#FF91A4', marginBottom: '40px', fontSize: '1rem' }}>Sign in to your reading paradise 💕</p>

        {error && (
          <div style={{ background: '#FFD6E7', border: '1px solid #FF69B4', borderRadius: '12px', padding: '12px', marginBottom: '24px', color: '#C7006E', fontSize: '0.9rem' }}>
            😢 {error}
          </div>
        )}

        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: 'white',
            border: '2px solid #FFD6E7',
            borderRadius: '50px',
            padding: '16px 24px',
            fontSize: '1rem',
            fontWeight: 700,
            color: '#4A1942',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 15px rgba(255,105,180,0.2)',
            transition: 'all 0.3s ease',
            opacity: loading ? 0.7 : 1,
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          {loading ? (
            <>
              <span style={{ fontSize: '1.3rem' }}>🌸</span>
              <span>Redirecting to Google...</span>
            </>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div style={{ marginTop: '32px', padding: '16px', background: '#FFF0F5', borderRadius: '12px' }}>
          <p style={{ fontSize: '0.85rem', color: '#FF91A4', lineHeight: 1.6 }}>
            🌸 Sign in once and read from any device<br/>
            💕 Your progress is always saved
          </p>
        </div>
      </div>
    </div>
  )
}
