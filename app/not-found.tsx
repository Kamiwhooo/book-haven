'use client'
import { useRouter } from 'next/navigation'

export default function NotFound() {
  const router = useRouter()
  return (
    <div style={{ minHeight:'100vh', background:'#FFF0F5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', textAlign:'center' }}>
      <div style={{ fontSize:'5rem', marginBottom:'16px' }}>📚</div>
      <h1 className="font-pacifico" style={{ fontSize:'2.5rem', color:'#FF1493', marginBottom:'12px' }}>Oops!</h1>
      <p style={{ fontSize:'1.1rem', color:'#FF91A4', marginBottom:'8px', fontWeight:600 }}>This page doesn&apos;t exist 🎀</p>
      <p style={{ color:'#FFB6C1', marginBottom:'32px' }}>Looks like you got a little lost in the library!</p>
      <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', justifyContent:'center' }}>
        <button className="btn-pink" onClick={() => router.push('/')}>🏠 Go Home</button>
        <button onClick={() => router.back()} style={{ background:'white', border:'2px solid #FFD6E7', borderRadius:'50px', padding:'12px 24px', color:'#FF69B4', fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>← Go Back</button>
      </div>
    </div>
  )
}
