import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { book, current_page, total_pages, user_id, access_token } = await request.json()
    if (!user_id || !book?.archive_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Use user's access token so RLS policies allow the write
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      access_token ? {
        global: { headers: { Authorization: `Bearer ${access_token}` } }
      } : {}
    )

    // Upsert book (books table allows authenticated inserts)
    const { data: bookData, error: bookErr } = await supabase
      .from('books')
      .upsert({
        archive_id: book.archive_id,
        title: book.title || 'Unknown',
        author: book.author || null,
        description: book.description || null,
        cover_url: book.cover_url || null,
        pdf_url: book.pdf_url || null,
        published_date: book.published_date || null,
        pages: book.pages || null,
      }, { onConflict: 'archive_id' })
      .select('id')
      .single()

    if (bookErr || !bookData?.id) {
      return NextResponse.json({ error: bookErr?.message || 'Book save failed' }, { status: 500 })
    }

    // Upsert user_books
    const { error: ubErr } = await supabase
      .from('user_books')
      .upsert({
        user_id,
        book_id: bookData.id,
        current_page: current_page || 1,
        total_pages: total_pages || 0,
        is_saved: true,
        last_read_at: new Date().toISOString(),
        saved_at: new Date().toISOString(),
      }, { onConflict: 'user_id,book_id' })

    if (ubErr) return NextResponse.json({ error: ubErr.message }, { status: 500 })
    return NextResponse.json({ success: true, book_id: bookData.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
