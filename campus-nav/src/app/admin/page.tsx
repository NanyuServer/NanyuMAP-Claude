'use client'
// src/app/admin/page.tsx
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/locations')
  }, [router])
  return null
}
