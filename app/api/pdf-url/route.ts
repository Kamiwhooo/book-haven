import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

  // Only allow archive.org URLs for safety
  let decoded = decodeURIComponent(url)
  const allowed = decoded.includes('archive.org') || decoded.includes('ia800') || decoded.includes('ia600') || decoded.startsWith('https://dn')
  if (!allowed) return NextResponse.json({ error: 'Only archive.org URLs allowed' }, { status: 403 })

  try {
    const res = await fetch(decoded, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://archive.org/',
        'Accept': 'application/pdf,*/*',
      },
      redirect: 'follow',
    })

    if (!res.ok) return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: res.status })

    const contentType = res.headers.get('content-type') || 'application/pdf'
    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
