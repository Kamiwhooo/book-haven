import { NextRequest, NextResponse } from 'next/server'

const GROQ_API_KEY = process.env.GROQ_API_KEY

async function groqSmartSearch(query: string): Promise<string[]> {
  if (!GROQ_API_KEY) return [query]
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: `You are a book search expert. Given this search query: "${query}", generate 4 alternative search variations to find this book on Internet Archive. Include: exact title, title with underscores replacing spaces, author+title if known, and a short version. Return ONLY a JSON array of strings, nothing else.` }],
        max_tokens: 150, temperature: 0.3,
      }),
    })
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim())
    return Array.isArray(parsed) ? parsed : [query]
  } catch { return [query] }
}

async function searchArchive(q: string, rows = 12): Promise<any[]> {
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}+AND+mediatype:texts&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=description&fl[]=date&fl[]=num_pages&rows=${rows}&page=1&output=json`
    const res = await fetch(url, { headers: { 'User-Agent': 'BookHaven/1.0' }, next: { revalidate: 60 } })
    if (!res.ok) return []
    const data = await res.json()
    return data.response?.docs || []
  } catch { return [] }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })
  try {
    let docs = await searchArchive(query, 20)
    let usedGroq = false
    if (docs.length < 3) {
      usedGroq = true
      const variations = await groqSmartSearch(query)
      const seen = new Set(docs.map((d: any) => d.identifier))
      for (const v of variations) {
        if (v === query) continue
        const more = await searchArchive(v, 10)
        for (const doc of more) {
          if (!seen.has(doc.identifier)) { seen.add(doc.identifier); docs.push(doc) }
        }
        if (docs.length >= 15) break
      }
    }
    const books = docs.map((doc: any) => ({
      archive_id: doc.identifier,
      title: doc.title || 'Unknown Title',
      author: Array.isArray(doc.creator) ? doc.creator.join(', ') : (doc.creator || null),
      description: Array.isArray(doc.description) ? doc.description[0] : (doc.description || null),
      cover_url: `https://archive.org/services/img/${doc.identifier}`,
      pdf_url: `https://archive.org/download/${doc.identifier}/${doc.identifier}.pdf`,
      published_date: doc.date || null,
      pages: doc.num_pages || null,
    }))
    return NextResponse.json({ books, total: books.length, groq_enhanced: usedGroq })
  } catch { return NextResponse.json({ error: 'Search failed' }, { status: 500 }) }
}
