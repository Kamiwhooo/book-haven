import { NextRequest, NextResponse } from 'next/server'

const GROQ_API_KEY = process.env.GROQ_API_KEY

// Generates archive.org optimized query variations silently behind the scenes
async function groqGenerateQueries(query: string): Promise<string[]> {
  // Always generate rule-based variations first (no AI needed)
  const clean = query.trim()
  const underscored = clean.replace(/\s+/g, '_')
  const hyphenated = clean.replace(/\s+/g, '-')
  const noSpaces = clean.replace(/\s+/g, '')
  const words = clean.split(/\s+/)

  const rulesBased = [
    clean,                              // "good girl bad blood"
    underscored,                        // "good_girl_bad_blood"
    hyphenated,                         // "good-girl-bad-blood"
    `${underscored}_pdf`,              // "good_girl_bad_blood_pdf"
    `${underscored} pdf`,              // "good_girl_bad_blood pdf"
    `"${clean}"`,                       // exact phrase match
    words.join('+'),                    // "good+girl+bad+blood"
    `${words[0]} ${words.slice(-1)[0]}`, // first + last word
  ]

  // If Groq key exists, also get AI-generated variations (author name, alternate titles etc)
  if (GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages: [{
            role: 'user',
            content: `You are an Internet Archive search expert. The user wants to find the book: "${clean}"

Generate 6 search query variations optimized for archive.org's search engine. Use these formats:
- title_with_underscores (most important - archive.org filenames use this)
- author_lastname title_with_underscores  
- title with author full name
- common abbreviations or alternate title versions
- title_with_underscores_pdf
- series name if part of a series

Return ONLY a JSON array of strings. No explanation. Example for "harry potter sorcerer stone":
["harry_potter_sorcerers_stone", "rowling harry_potter", "harry potter philosopher stone", "harry_potter_and_the_sorcerers_stone", "harry_potter_sorcerers_stone_pdf", "rowling_harry_potter_1"]`
          }],
          max_tokens: 200,
          temperature: 0.1,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content?.trim() || ''
        const parsed = JSON.parse(content.replace(/\`\`\`json|\`\`\`/g, '').trim())
        if (Array.isArray(parsed)) {
          return [...new Set([...rulesBased, ...parsed])]
        }
      }
    } catch {}
  }

  return rulesBased
}

async function searchArchive(q: string, rows = 10): Promise<any[]> {
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}+AND+mediatype:texts&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=description&fl[]=date&fl[]=num_pages&rows=${rows}&page=1&output=json`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 BookHaven/1.0' },
      next: { revalidate: 60 }
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.response?.docs || []
  } catch { return [] }
}

// Score results by relevance to original query
function scoreResult(doc: any, originalQuery: string): number {
  const title = (doc.title || '').toLowerCase()
  const q = originalQuery.toLowerCase()
  const qWords = q.split(/\s+/)

  let score = 0
  // Exact title match = highest score
  if (title === q) score += 100
  // Title contains full query
  if (title.includes(q)) score += 50
  // All words present
  const matchedWords = qWords.filter(w => title.includes(w))
  score += (matchedWords.length / qWords.length) * 30
  // Has PDF available (identifier hints)
  if (doc.identifier?.includes('pdf')) score += 5

  return score
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  try {
    // Generate all query variations silently
    const queries = await groqGenerateQueries(query)

    // Search all variations in parallel, deduplicate results
    const seen = new Set<string>()
    const allDocs: any[] = []

    // Run searches - first 3 in parallel, then rest if needed
    const firstBatch = queries.slice(0, 4)
    const firstResults = await Promise.all(firstBatch.map(q => searchArchive(q, 12)))

    for (const docs of firstResults) {
      for (const doc of docs) {
        if (!seen.has(doc.identifier)) {
          seen.add(doc.identifier)
          allDocs.push(doc)
        }
      }
    }

    // If still not enough, try remaining queries
    if (allDocs.length < 5) {
      const remaining = queries.slice(4)
      for (const q of remaining) {
        const docs = await searchArchive(q, 8)
        for (const doc of docs) {
          if (!seen.has(doc.identifier)) {
            seen.add(doc.identifier)
            allDocs.push(doc)
          }
        }
        if (allDocs.length >= 15) break
      }
    }

    // Sort by relevance score
    allDocs.sort((a, b) => scoreResult(b, query) - scoreResult(a, query))

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

    return NextResponse.json({ 
      books, 
      total: books.length,
      // Never expose internal queries to user - just a simple flag
      enhanced: true
    })
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
