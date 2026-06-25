'use client'
import { Book } from '@/types'
import { useRouter } from 'next/navigation'

export default function BookCard({ book }: { book: Book }) {
  const router = useRouter()

  return (
    <div
      className="book-card card-pink"
      onClick={() => router.push(`/book/${book.archive_id}`)}
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      <div style={{ position: 'relative', paddingTop: '140%', background: '#FFF0F5', overflow: 'hidden' }}>
        <img
          src={book.cover_url || `https://archive.org/services/img/${book.archive_id}`}
          alt={book.title}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iI0ZGRDBFNyIvPjx0ZXh0IHg9IjEwMCIgeT0iMTMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjMwIj7wn4ScPC90ZXh0Pjx0ZXh0IHg9IjEwMCIgeT0iMTcwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk2Nzg4Ij5ObyBDb3ZlcjwvdGV4dD48L3N2Zz4='
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(255,20,147,0.6) 0%, transparent 50%)', opacity: 0, transition: 'opacity 0.3s' }}
          className="book-overlay" />
      </div>
      <div style={{ padding: '12px' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4A1942', lineHeight: 1.3, marginBottom: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {book.title}
        </h3>
        <p style={{ fontSize: '0.75rem', color: '#FF69B4', fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {book.author || 'Unknown Author'}
        </p>
      </div>
    </div>
  )
}
