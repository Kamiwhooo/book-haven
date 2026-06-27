import { NextRequest, NextResponse } from 'next/server'

const GROQ_API_KEY = process.env.GROQ_API_KEY

async function groqGenerateQueries(query: string): Promise<string[]> {
  if (!GROQ_API_KEY) return []
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: `You are an Internet Archive search expert. The user wants the book: "${query}". Generate 6 search query variations optimized for archive.org using underscore format. Include author name if known. Return ONLY a JSON array of strings. No explanation. Example for "good girl bad blood": ["good_girl_bad_blood", "holly_jackson_good_girl_bad_blood", "good girl bad blood holly jackson", "good_girl_bad_blood_holly_jackson", "a_good_girls_guide_to_murder_2", "holly jackson good girl"]` }],
        max_tokens: 200, temperature: 0.1,
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim())
    return Array.isArray(parsed) ? parsed.filter((s: any) => typeof s === 'string') : []
  } catch { return [] }
}

function buildVariants(query: string): string[] {
  const q = query.trim()
  const words = q.split(/\s+/)
  const underscored = words.join('_')
  return [
    q,
    underscored,
    words.join('-'),
    `"${q}"`,
    `${underscored}_pdf`,
    `title:(${q})`,
    `title:(${underscored})`,
    words.length > 2 ? words.slice(0, 3).join('_') : underscored,
  ]
}

async function searchArchive(q: string, rows = 10): Promise<any[]> {
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}+AND+mediatype:texts&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=description&fl[]=date&fl[]=num_pages&rows=${rows}&page=1&output=json`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 BookHaven/1.0' }, next: { revalidate: 60 } })
    if (!res.ok) return []
    const data = await res.json()
    return data.response?.docs || []
  } catch { return [] }
}

function scoreDoc(doc: any, query: string): number {
  const title = (doc.title || '').toLowerCase()
  const id = (doc.identifier || '').toLowerCase()
  const q = query.toLowerCase()
  const words = q.split(/\s+/)
  let score = 0
  if (title === q) score += 200
  if (title.includes(q)) score += 80
  if (id.includes(q.replace(/\s+/g, '_'))) score += 60
  const matched = words.filter(w => w.length > 2 && (title.includes(w) || id.includes(w)))
  score += (matched.length / words.length) * 50
  return score
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })
  try {
    const variants = buildVariants(query)
    const seen = new Set<string>()
    const allDocs: any[] = []

    const batch1 = await Promise.all(variants.slice(0, 4).map(v => searchArchive(v, 12)))
    for (const docs of batch1) {
      for (const doc of docs) {
        if (!seen.has(doc.identifier)) { seen.add(doc.identifier); allDocs.push(doc) }
      }
    }

    if (allDocs.length < 5) {
      for (const v of variants.slice(4)) {
        const docs = await searchArchive(v, 8)
        for (const doc of docs) {
          if (!seen.has(doc.identifier)) { seen.add(doc.identifier); allDocs.push(doc) }
        }
      }
    }

    let groqUsed = false
    if (allDocs.length < 5) {
      groqUsed = true
      const aiVariants = await groqGenerateQueries(query)
      const batch2 = await Promise.all(aiVariants.slice(0, 4).map(v => searchArchive(v, 10)))
      for (const docs of batch2) {
        for (const doc of docs) {
          if (!seen.has(doc.identifier)) { seen.add(doc.identifier); allDocs.push(doc) }
        }
      }
    }

    allDocs.sort((a, b) => scoreDoc(b, query) - scoreDoc(a, query))
    const books = allDocs.slice(0, 24).map((doc: any) => ({
      archive_id: doc.identifier,
      title: doc.title || 'Unknown Title',
      author: Array.isArray(doc.creator) ? doc.creator.join(', ') : (doc.creator || null),
      description: Array.isArray(doc.description) ? doc.description[0] : (doc.description || null),
      cover_url: `https://archive.org/services/img/${doc.identifier}`,
      pdf_url: `https://archive.org/download/${doc.identifier}/${doc.identifier}.pdf`,
      published_date: doc.date || null,
      pages: doc.num_pages || null,
    }))
    return NextResponse.json({ books, total: books.length, groq_enhanced: groqUsed })
  } catch { return NextResponse.json({ error: 'Search failed' }, { status: 500 }) }
}
