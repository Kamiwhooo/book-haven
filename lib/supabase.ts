import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

export type Database = {
  public: {
    Tables: {
      books: {
        Row: {
          id: string
          archive_id: string
          title: string
          author: string | null
          description: string | null
          cover_url: string | null
          pdf_url: string | null
          pages: number | null
          published_date: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['books']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['books']['Insert']>
      }
      user_books: {
        Row: {
          id: string
          user_id: string
          book_id: string
          current_page: number
          total_pages: number
          is_saved: boolean
          last_read_at: string
          saved_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_books']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['user_books']['Insert']>
      }
    }
  }
}
