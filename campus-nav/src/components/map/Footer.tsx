'use client'
// src/components/map/Footer.tsx
import { useEffect, useState } from 'react'

export default function Footer() {
  const [versions, setVersions] = useState<{ systemVersion: string; databaseVersion: string } | null>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    fetch('/api/system/settings')
      .then(r => r.json())
      .then(data => setVersions(data))
      .catch(() => setVersions({ systemVersion: '—', databaseVersion: '—' }))
  }, [])

  useEffect(() => {
    const detectKeyboard = () => {
      if (!window.visualViewport) return
      const diff = window.innerHeight - window.visualViewport.height
      setKeyboardOpen(diff > 120)
    }
    window.visualViewport?.addEventListener('resize', detectKeyboard)
    window.addEventListener('resize', detectKeyboard)
    return () => {
      window.visualViewport?.removeEventListener('resize', detectKeyboard)
      window.removeEventListener('resize', detectKeyboard)
    }
  }, [])

  if (keyboardOpen) return null

  return (
    <footer
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 100,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-col">
          <span className="text-neutral-400 text-[10px] md:text-[11px] tracking-wide">
            Copyright &copy; 2026 xkeyu. All Rights Reserved. 熊柯宇 版权所有
          </span>
          <span className="text-neutral-400 text-[9px] md:text-[10px] tracking-wide">
            已授权给重庆市南渝中学校使用
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <span className="text-neutral-350 text-[9px] md:text-[10px] tracking-wide">
            系统版本 {versions ? versions.systemVersion : '加载中...'}
          </span>
          <span className="text-neutral-350 text-[9px] md:text-[10px] tracking-wide">
            数据库 {versions ? versions.databaseVersion : '加载中...'}
          </span>
        </div>
      </div>
    </footer>
  )
}
