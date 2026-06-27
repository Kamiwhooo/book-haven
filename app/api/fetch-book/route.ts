import { NextRequest, NextResponse } from 'next/server'

// Supported site patterns and their text extractors
interface SiteConfig {
  name: string
  pattern: RegExp
  extractText: (html: string) => string
  extractTitle: (html: string) => string
  extractAuthor: (html: string) => string
  extractTotalPages: (html: string) => number
  extractCurrentPage: (url: string) => number
  buildPageUrl: (url: string, page: number) => string
  extractCover: (html: string) => string | null
}

const SITES: SiteConfig[] = [
  {
    name: 'bookfrom.net',
    pattern: /archive\.bookfrom\.net|readfrom\.net|bookfrom\.net/,
    extractText: (html) => {
      // Text is between the nav links and the bottom nav
      const match = html.match(/(?:Navi On[^>]*>|voice[^>]*>)\s*([\s\S]+?)(?:\[1\]|Page \d+ of|<div class="nav)/i)
      if (match) return cleanText(match[1])
      // Fallback: grab big text blocks
      const body = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                       .replace(/<style[\s\S]*?<\/style>/gi, '')
                       .replace(/<[^>]+>/g, '\n')
                       .replace(/&nbsp;/g, ' ')
                       .replace(/&amp;/g, '&')
                       .replace(/&lt;/g, '<')
                       .replace(/&gt;/g, '>')
                       .replace(/&quot;/g, '"')
                       .replace(/&#39;/g, "'")
      // Find the biggest contiguous text block
      const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 20)
      return lines.join('\n\n')
    },
    extractTitle: (html) => {
      const m = html.match(/<title>([^<]+)<\/title>/i)
      if (!m) return 'Unknown Book'
      return m[1].split('»')[0].split('(')[0].trim()
    },
    extractAuthor: (html) => {
      const m = html.match(/\(([^)]+)\).*?<\/title>/i) || html.match(/by ([A-Z][a-z]+ [A-Z][a-z]+)/);
      return m ? m[1].trim() : ''
    },
    extractTotalPages: (html) => {
      const matches = [...html.matchAll(/page,(\d+),/g)]
      if (matches.length === 0) return 1
      const nums = matches.map(m => parseInt(m[1]))
      return Math.max(...nums)
    },
    extractCurrentPage: (url) => {
      const m = url.match(/page,(\d+),/)
      return m ? parseInt(m[1]) : 1
    },
    buildPageUrl: (url, page) => {
      // https://archive.bookfrom.net/author/page,2,123-title.html -> change page number
      return url.replace(/page,\d+,/, `page,${page},`)
                .replace(/(\/[^\/]+\.html)$/, (match) => match) // keep rest same
    },
    extractCover: (html) => {
      const m = html.match(/picture\.bookfrom\.net[^"']+\.jpg/i)
      return m ? `https://${m[0]}` : null
    },
  },
  {
    name: 'read.amazon.com / generic HTML book',
    pattern: /readfrom\.net|allfreenovel\.com|novelbright\.com|wuxiaworld\.com|royalroad\.com|scribblehub\.com/,
    extractText: (html) => {
      const body = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                       .replace(/<style[\s\S]*?<\/style>/gi, '')
                       .replace(/<[^>]+>/g, '\n')
                       .replace(/&nbsp;/g, ' ')
                       .replace(/&amp;/g, '&')
                       .replace(/&lt;/g, '<')
                       .replace(/&gt;/g, '>')
      const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 30)
      return lines.join('\n\n')
    },
    extractTitle: (html) => {
      const m = html.match(/<title>([^<]+)<\/title>/i)
      return m ? m[1].split('|')[0].split('-')[0].trim() : 'Unknown Book'
    },
    extractAuthor: (html) => {
      const m = html.match(/by\s+([A-Z][a-z]+ [A-Z][a-z]+)/i)
      return m ? m[1] : ''
    },
    extractTotalPages: (html) => {
      const m = html.match(/of\s+(\d+)\s*pages?/i) || html.match(/page\s+\d+\s+of\s+(\d+)/i)
      return m ? parseInt(m[1]) : 1
    },
    extractCurrentPage: (url) => {
      const m = url.match(/[?&]page=(\d+)/) || url.match(/\/page\/(\d+)/) || url.match(/page,(\d+),/)
      return m ? parseInt(m[1]) : 1
    },
    buildPageUrl: (url, page) => url,
    extractCover: (html) => null,
  },
]

function cleanText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '')
    .replace(/<h[1-6][^>]*>/gi, '\n\n### ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

function getSiteConfig(url: string): SiteConfig | null {
  return SITES.find(s => s.pattern.test(url)) || null
}

export async function POST(request: NextRequest) {
  try {
    const { url, page } = await request.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const config = getSiteConfig(url)
    if (!config) {
      return NextResponse.json({ 
        error: 'Site not supported yet. Try archive.bookfrom.net or paste a direct PDF link.',
        supported: SITES.map(s => s.name)
      }, { status: 400 })
    }

    // Build URL for requested page
    const targetUrl = page ? config.buildPageUrl(url, page) : url

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!res.ok) return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: res.status })

    const html = await res.text()
    const currentPage = config.extractCurrentPage(targetUrl)
    const totalPages = config.extractTotalPages(html)
    const text = config.extractText(html)
    const title = config.extractTitle(html)
    const author = config.extractAuthor(html)
    const cover = config.extractCover(html)

    if (!text || text.length < 100) {
      return NextResponse.json({ error: 'Could not extract text from this page' }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      title,
      author,
      cover,
      text,
      current_page: currentPage,
      total_pages: totalPages,
      site: config.name,
      page_url: targetUrl,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
