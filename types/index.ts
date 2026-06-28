export interface Book {
  id?: string
  archive_id: string
  title: string
  author: string | null
  description: string | null
  cover_url: string | null
  pdf_url: string | null
  pages: number | null
  published_date: string | null
  created_at?: string
  // Extended fields for multi-source search
  has_pdf?: boolean
  borrow_only?: boolean
  web_url?: string
  source?: 'archive' | 'bookfrom' | 'link'
}

export interface UserBook {
  id: string
  user_id: string
  book_id: string
  book?: Book
  current_page: number
  total_pages: number
  is_saved: boolean
  last_read_at: string
  saved_at: string
}

export interface ArchiveSearchResult {
  identifier: string
  title: string
  creator?: string | string[]
  description?: string | string[]
  date?: string
  num_pages?: number
}
