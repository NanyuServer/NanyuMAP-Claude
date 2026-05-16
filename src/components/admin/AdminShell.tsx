'use client'
// src/components/admin/AdminShell.tsx
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { MapPin, Route, LogOut, ExternalLink, Map } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/admin/locations', icon: MapPin, label: '地点管理' },
  { href: '/admin/roads', icon: Route, label: '道路编辑' },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [username, setUsername] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/api/auth/verify')
      .then(r => r.json())
      .then(data => {
        if (!data.authenticated) {
          router.replace('/admin/login')
        } else {
          setUsername(data.username)
          setChecking(false)
        }
      })
      .catch(() => router.replace('/admin/login'))
  }, [router])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/admin/login')
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080809' }}>
        <div className="text-white/30 text-sm">验证中...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen" style={{ background: '#080809' }}>
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-56 flex-shrink-0 flex flex-col"
        style={{
          background: 'rgba(12,12,16,0.9)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#007AFF,#005DC1)' }}>
              <Map size={14} className="text-white" />
            </div>
            <div>
              <div className="text-white text-sm font-semibold leading-tight">导航管理</div>
              <div className="text-white/30 text-[10px]">Campus Nav Admin</div>
            </div>
          </div>
        </div>

        <div className="px-3 mb-2">
          <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-2 flex flex-col gap-1">
          {NAV_ITEMS.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: active ? 'rgba(0,122,255,0.15)' : 'transparent',
                    border: active ? '1px solid rgba(0,122,255,0.25)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => !active && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
                >
                  <item.icon size={15} className={active ? 'text-blue-400' : 'text-white/35'} />
                  <span className={`text-sm font-medium ${active ? 'text-white' : 'text-white/50'}`}>{item.label}</span>
                </motion.div>
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-5 flex flex-col gap-2">
          <div className="h-px mb-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <Link href="/" target="_blank">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/35 hover:text-white/60 transition-colors cursor-pointer">
              <ExternalLink size={14} />
              <span className="text-xs">查看前台地图</span>
            </div>
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/35 hover:text-red-400 transition-colors w-full">
            <LogOut size={14} />
            <span className="text-xs">退出登录 {username && `(${username})`}</span>
          </button>
        </div>
      </motion.aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
