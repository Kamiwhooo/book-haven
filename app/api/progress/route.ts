import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { book, current_page, total_pages, user_id } = await request.json()

    if (!user_id || !book?.archive_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Upsert book
    const { data: bookData, error: bookError } = await supabase
      .from('books')
      .upsert({
        archive_id: book.archive_id,
        title: book.title,
        author: book.author,
        description: book.description,
        cover_url: book.cover_url,
        pdf_url: book.pdf_url,
        published_date: book.published_date,
        pages: book.pages,
      }, { onConflict: 'archive_id' })
      .select('id')
      .single()

    if (bookError) return NextResponse.json({ error: bookError.message }, { status: 500 })

    // Upsert user_books
    const { error: ubError } = await supabase
      .from('user_books')
      .upsert({
        user_id,
        book_id: bookData.id,
        current_page,
        total_pages,
        last_read_at: new Date().toISOString(),
        is_saved: true,
      }, { onConflict: 'user_id,book_id' })

    if (ubError) return NextResponse.json({ error: ubError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }
}
