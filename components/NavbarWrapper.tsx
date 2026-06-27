'use client'
import { usePathname } from 'next/navigation'
import Navbar from './Navbar'

export default function NavbarWrapper() {
  const pathname = usePathname()
  // Hide navbar on reader and link pages
  if (pathname?.startsWith('/read/') || pathname?.startsWith('/link')) return null
  return <Navbar />
}
