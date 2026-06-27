import { NextRequest, NextResponse } from 'next/server'

const GROQ_API_KEY = process.env.GROQ_API_KEY

// Generate smart variants for archive.org
function buildArchiveVariants(query: string): string[] {
  const q = query.trim()
  const words = q.split(/\s+/)
  const underscored = words.join('_')
  const hyphenated = words.join('-')
  return [
    q,
    underscored,
    hyphenated,
    `"${q}"`,
    `${underscored}_pdf`,
    `title:(${q})`,
    `title:(${underscored})`,
    words.length > 1 ? words.slice(0, 3).join('_') : underscored,
  ]
}

// Search Internet Archive
async function searchArchive(q: string, rows = 10): Promise<any[]> {
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}+AND+mediatype:texts&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=description&fl[]=date&fl[]=num_pages&fl[]=access-restricted-item&rows=${rows}&page=1&output=json`
    const res = await fetch(url, { headers: { 'User-Agent': 'BookHaven/1.0' }, next: { revalidate: 60 } })
    if (!res.ok) return []
    const data = await res.json()
    return data.response?.docs || []
  } catch { return [] }
}

// Check if archive.org item has a free downloadable PDF (not borrow-only)
async function checkArchivePdfAvailable(identifier: string): Promise<{ hasPdf: boolean; pdfFile: string | null; borrowOnly: boolean }> {
  try {
    const res = await fetch(`https://archive.org/metadata/${identifier}`, { next: { revalidate: 3600 } })
    if (!res.ok) return { hasPdf: false, pdfFile: null, borrowOnly: false }
    const data = await res.json()
    const meta = data.metadata || {}

    // Check if borrow-only
    const borrowOnly = meta['access-restricted-item'] === 'true' || 
                       (data.files || []).some((f: any) => f.name?.endsWith('.acsm') || f.name?.endsWith('.epub'))

    // Find PDF files
    const pdfFiles = (data.files || []).filter((f: any) => f.name?.toLowerCase().endsWith('.pdf'))

    if (pdfFiles.length === 0) return { hasPdf: false, pdfFile: null, borrowOnly }

    // Prefer files that aren't OCR/text-only, prefer main file
    const mainPdf = pdfFiles.find((f: any) => 
      !f.name.includes('_text') && 
      !f.name.includes('_jp2') &&
      (f.name.toLowerCase().includes(identifier.toLowerCase()) || f.source === 'original')
    ) || pdfFiles[0]

    return { hasPdf: true, pdfFile: mainPdf.name, borrowOnly }
  } catch { return { hasPdf: false, pdfFile: null, borrowOnly: false } }
}

// Search bookfrom.net for web-readable books  
async function searchBookFrom(query: string): Promise<any[]> {
  try {
    const searchUrl = `https://archive.bookfrom.net/build_in_search/?s=${encodeURIComponent(query)}`
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const html = await res.text()

    // Parse book links from search results
    const books: any[] = []
    const linkPattern = /href="(https:\/\/archive\.bookfrom\.net\/[^\/]+\/\d+-[^"]+\.html)"/g
    const titlePattern = /<a[^>]+href="(https:\/\/archive\.bookfrom\.net\/[^\/]+\/\d+-[^"]+\.html)"[^>]*>([^<]+)<\/a>/g

    let match
    while ((match = titlePattern.exec(html)) !== null && books.length < 6) {
      const bookUrl = match[1]
      const title = match[2].trim()
      if (title.length < 3 || title.includes('BookFrom') || title.includes('Search')) continue

      // Extract author from URL path
      const authorSlug = bookUrl.match(/bookfrom\.net\/([^\/]+)\//)?.[1]?.replace(/-/g, ' ') || ''
      const bookId = bookUrl.match(/(\d+)-/)?.[1] || ''

      books.push({
        archive_id: `bookfrom_${bookId}`,
        title,
        author: authorSlug,
        description: 'Read online for free on BookFrom.Net',
        cover_url: null,
        pdf_url: null,
        web_url: bookUrl,
        source: 'bookfrom',
        published_date: null,
        pages: null,
      })
    }
    return books
  } catch { return [] }
}

// Use Groq to generate smarter search terms
async function groqEnhance(query: string): Promise<string[]> {
  if (!GROQ_API_KEY) return []
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{
          role: 'user',
          content: `Book search expert. Query: "${query}". Give me 5 variations for archive.org search optimized with underscores. Include author+title combo if you know who wrote this book. Return ONLY JSON array of strings.`
        }],
        max_tokens: 150, temperature: 0.1,
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''
    const parsed = JSON.parse(content.replace(/\`\`\`json|\`\`\`/g, '').trim())
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function scoreDoc(doc: any, query: string): number {
  const title = (doc.title || '').toLowerCase()
  const id = (doc.identifier || '').toLowerCase()
  const q = query.toLowerCase()
  const words = q.split(/\s+/).filter(w => w.length > 2)
  let score = 0
  if (title === q) score += 200
  if (title.includes(q)) score += 100
  if (id.includes(q.replace(/\s+/g, '_'))) score += 80
  if (id.includes(q.replace(/\s+/g, ''))) score += 60
  const matched = words.filter(w => title.includes(w) || id.includes(w))
  score += (matched.length / Math.max(words.length, 1)) * 60
  // Penalize borrow-only on archive
  if (doc.borrowOnly) score -= 50
  // Boost if has free PDF
  if (doc.hasPdf) score += 40
  return score
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  try {
    const variants = buildArchiveVariants(query)
    const seen = new Set<string>()
    let allDocs: any[] = []

    // 1. Search archive.org with multiple variants in parallel
    const batch1 = await Promise.all(variants.slice(0, 4).map(v => searchArchive(v, 12)))
    for (const docs of batch1) {
      for (const doc of docs) {
        if (!seen.has(doc.identifier)) { seen.add(doc.identifier); allDocs.push(doc) }
      }
    }

    // 2. If < 5 results, try more archive.org variants
    if (allDocs.length < 5) {
      for (const v of variants.slice(4)) {
        const docs = await searchArchive(v, 8)
        for (const doc of docs) {
          if (!seen.has(doc.identifier)) { seen.add(doc.identifier); allDocs.push(doc) }
        }
      }
    }

    // 3. If still < 4, use Groq for smarter variants
    let groqUsed = false
    if (allDocs.length < 4) {
      groqUsed = true
      const aiVariants = await groqEnhance(query)
      const batch2 = await Promise.all(aiVariants.slice(0, 4).map(v => searchArchive(v, 10)))
      for (const docs of batch2) {
        for (const doc of docs) {
          if (!seen.has(doc.identifier)) { seen.add(doc.identifier); allDocs.push(doc) }
        }
      }
    }

    // 4. Check PDF availability for top archive.org results (top 8)
    const topDocs = allDocs.slice(0, 8)
    const pdfChecks = await Promise.all(topDocs.map(doc => checkArchivePdfAvailable(doc.identifier)))
    topDocs.forEach((doc, i) => {
      doc.hasPdf = pdfChecks[i].hasPdf
      doc.borrowOnly = pdfChecks[i].borrowOnly
      doc.pdfFile = pdfChecks[i].pdfFile
    })

    // 5. Search bookfrom.net in parallel
    const [bookFromResults] = await Promise.all([searchBookFrom(query)])

    // 6. Build final book list
    allDocs.sort((a, b) => scoreDoc(b, query) - scoreDoc(a, query))

    const archiveBooks = allDocs.slice(0, 20).map((doc: any) => {
      const pdfUrl = doc.pdfFile 
        ? `https://archive.org/download/${doc.identifier}/${doc.pdfFile}`
        : `https://archive.org/download/${doc.identifier}/${doc.identifier}.pdf`
      return {
        archive_id: doc.identifier,
        title: doc.title || 'Unknown Title',
        author: Array.isArray(doc.creator) ? doc.creator.join(', ') : (doc.creator || null),
        description: Array.isArray(doc.description) ? doc.description[0] : (doc.description || null),
        cover_url: `https://archive.org/services/img/${doc.identifier}`,
        pdf_url: pdfUrl,
        published_date: doc.date || null,
        pages: doc.num_pages || null,
        has_pdf: doc.hasPdf || false,
        borrow_only: doc.borrowOnly || false,
        source: 'archive',
      }
    })

    // Combine: free PDFs first, then web-readable books, then borrow-only
    const freePdfs = archiveBooks.filter(b => b.has_pdf && !b.borrow_only)
    const borrowOnly = archiveBooks.filter(b => b.borrow_only || !b.has_pdf)
    const allBooks = [...freePdfs, ...bookFromResults, ...borrowOnly]

    return NextResponse.json({ 
      books: allBooks, 
      total: allBooks.length,
      groq_enhanced: groqUsed,
      sources: {
        archive_free: freePdfs.length,
        web_readable: bookFromResults.length,
        borrow_only: borrowOnly.length,
      }
    })
  } catch (err) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
