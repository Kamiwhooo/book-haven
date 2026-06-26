import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Try multiple URL patterns
  const urls = [
    `https://archive.org/download/${id}/${id}.pdf`,
    `https://archive.org/download/${id}/${id}_text.pdf`,
    `https://archive.org/download/${id}/`,
  ]

  // First, try to find the actual PDF filename from the metadata
  try {
    const metaRes = await fetch(`https://archive.org/metadata/${id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 BookHaven/1.0' },
    })
    if (metaRes.ok) {
      const meta = await metaRes.json()
      const files = meta.files || []
      // Find PDF files, prefer the main one
      const pdfFiles = files
        .filter((f: any) => f.name?.toLowerCase().endsWith('.pdf'))
        .map((f: any) => f.name)

      if (pdfFiles.length > 0) {
        // Put the best match first
        const mainPdf = pdfFiles.find((f: string) => 
          f.toLowerCase().includes(id.toLowerCase()) || 
          !f.toLowerCase().includes('_text')
        ) || pdfFiles[0]

        urls.unshift(`https://archive.org/download/${id}/${mainPdf}`)
      }
    }
  } catch {}

  // Try each URL and proxy the first successful one
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://archive.org/',
          'Accept': 'application/pdf,*/*',
        },
        redirect: 'follow',
      })

      if (res.ok && res.headers.get('content-type')?.includes('pdf')) {
        const buffer = await res.arrayBuffer()
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    } catch {}
  }

  return NextResponse.json({ 
    error: 'PDF not available',
    tried: urls 
  }, { status: 404 })
}
