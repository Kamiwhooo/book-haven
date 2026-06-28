export default function Loading() {
  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'60vh', background:'#FFF0F5' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'3rem', marginBottom:'12px' }} className="heart-float">🌸</div>
        <p className="font-pacifico" style={{ color:'#FF1493', fontSize:'1.2rem' }}>Loading...</p>
      </div>
    </div>
  )
}
