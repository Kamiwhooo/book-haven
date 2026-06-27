'use client'
import { usePathname } from 'next/navigation'
import Navbar from './Navbar'

export default function NavbarWrapper() {
  const pathname = usePathname()
  // Hide navbar completely on reader pages
  if (pathname?.startsWith('/read/')) return null
  return <Navbar />
}
