import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params

  try {
    const res = await fetch(`https://archive.org/metadata/${id}`, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

    const data = await res.json()
    const meta = data.metadata || {}

    const book = {
      archive_id: id,
      title: meta.title || 'Unknown Title',
      author: Array.isArray(meta.creator) ? meta.creator.join(', ') : (meta.creator || null),
      description: Array.isArray(meta.description) ? meta.description.join(' ') : (meta.description || null),
      cover_url: `https://archive.org/services/img/${id}`,
      pdf_url: `https://archive.org/download/${id}/${id}.pdf`,
      published_date: meta.date || null,
      pages: meta.num_pages ? parseInt(meta.num_pages) : null,
      files: (data.files || []).filter((f: any) => f.name?.endsWith('.pdf')).map((f: any) => f.name),
    }

    return NextResponse.json({ book })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch book' }, { status: 500 })
  }
}
