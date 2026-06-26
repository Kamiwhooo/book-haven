'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // With implicit flow, Supabase handles the token from URL hash automatically
    // Just check session and redirect
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/')
      } else {
        // Wait a moment for Supabase to process the hash
        setTimeout(async () => {
          const { data: { session: s2 } } = await supabase.auth.getSession()
          router.replace(s2 ? '/' : '/login?error=auth_failed')
        }, 1500)
      }
    }
    checkSession()
  }, [router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF0F5' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }} className="heart-float">🌸</div>
        <p className="font-pacifico" style={{ color: '#FF1493', fontSize: '1.4rem' }}>Signing you in...</p>
        <p style={{ color: '#FF91A4', marginTop: '8px' }}>Just a moment 💕</p>
      </div>
    </div>
  )
}
