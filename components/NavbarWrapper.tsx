'use client'
import { usePathname } from 'next/navigation'
import Navbar from './Navbar'

export default function NavbarWrapper() {
  const pathname = usePathname()
  if (pathname?.startsWith('/read/') || pathname?.startsWith('/link') || pathname?.startsWith('/read-web')) return null
  return <Navbar />
}
