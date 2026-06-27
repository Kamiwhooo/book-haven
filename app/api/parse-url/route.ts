import { NextRequest, NextResponse } from 'next/server'

function extractFromArchiveUrl(url: string) {
  // Patterns:
  // https://archive.org/download/IDENTIFIER/filename.pdf
  // https://dn721807.ca.archive.org/0/items/IDENTIFIER/filename.pdf
  // https://ia800107.us.archive.org/...items/IDENTIFIER/filename.pdf

  let identifier = null
  let filename = null

  // Pattern 1: archive.org/download/ID/file
  const m1 = url.match(/archive\.org\/download\/([^\/]+)\/(.+\.pdf)/i)
  if (m1) { identifier = m1[1]; filename = m1[2] }

  // Pattern 2: dn*.ca.archive.org/0/items/ID/file  
  const m2 = url.match(/\.archive\.org\/\d+\/items\/([^\/]+)\/(.+\.pdf)/i)
  if (m2) { identifier = m2[1]; filename = m2[2] }

  // Extract a readable title from filename
  let title = filename || identifier || 'Unknown Book'
  title = title
    .replace(/\.pdf$/i, '')
    .replace(/_/g, ' ')
    .replace(/OceanofPDF\.com\s*/i, '')
    .replace(/\s*-\s*.*$/, '') // remove "- Author Name" suffix
    .trim()

  return { identifier, filename, title }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const { identifier, filename, title } = extractFromArchiveUrl(url)
    const proxyUrl = `/api/pdf-url?url=${encodeURIComponent(url)}`

    return NextResponse.json({
      success: true,
      pdf_url: url,
      proxy_url: proxyUrl,
      identifier,
      filename,
      title,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
