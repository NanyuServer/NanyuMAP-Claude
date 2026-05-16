// src/app/admin/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '管理后台 · 校园导航系统',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#080809' }}>
      {children}
    </div>
  )
}
