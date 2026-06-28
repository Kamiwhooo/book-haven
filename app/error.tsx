'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter()
  useEffect(() => { console.error(error) }, [error])
  return (
    <div style={{ minHeight:'100vh', background:'#FFF0F5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', textAlign:'center' }}>
      <div style={{ fontSize:'4rem', marginBottom:'16px' }}>😢</div>
      <h2 className="font-pacifico" style={{ fontSize:'2rem', color:'#FF1493', marginBottom:'12px' }}>Something went wrong!</h2>
      <p style={{ color:'#FF91A4', marginBottom:'28px' }}>Don&apos;t worry, it happens to the best of us 💕</p>
      <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', justifyContent:'center' }}>
        <button className="btn-pink" onClick={reset}>🔄 Try Again</button>
        <button onClick={() => router.push('/')} style={{ background:'white', border:'2px solid #FFD6E7', borderRadius:'50px', padding:'12px 24px', color:'#FF69B4', fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>🏠 Go Home</button>
      </div>
    </div>
  )
}
