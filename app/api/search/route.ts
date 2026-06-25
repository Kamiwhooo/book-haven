import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}+AND+mediatype:texts&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=description&fl[]=date&fl[]=num_pages&rows=20&page=1&output=json`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'BookHaven/1.0' },
      next: { revalidate: 300 },
    })

    if (!res.ok) throw new Error('Archive API failed')

    const data = await res.json()
    const books = (data.response?.docs || []).map((doc: any) => ({
      archive_id: doc.identifier,
      title: doc.title || 'Unknown Title',
      author: Array.isArray(doc.creator) ? doc.creator.join(', ') : (doc.creator || null),
      description: Array.isArray(doc.description) ? doc.description[0] : (doc.description || null),
      cover_url: `https://archive.org/services/img/${doc.identifier}`,
      pdf_url: `https://archive.org/download/${doc.identifier}/${doc.identifier}.pdf`,
      published_date: doc.date || null,
      pages: doc.num_pages || null,
    }))

    return NextResponse.json({ books, total: data.response?.numFound || 0 })
  } catch (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
