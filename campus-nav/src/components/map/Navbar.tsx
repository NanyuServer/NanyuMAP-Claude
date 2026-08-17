'use client'
// src/components/map/Navbar.tsx

import { GraduationCap, Building2, Route } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'

export default function Navbar() {
  const campus = useMapStore(state => state.campus)
  const setCampus = useMapStore(state => state.setCampus)
  const clearNavigation = useMapStore(state => state.clearNavigation)
  const setShowPresetRoutes = useMapStore(state => state.setShowPresetRoutes)

  const handleSwitch = (c: string) => {
    if (c === campus) return
    clearNavigation()
    setCampus(c)
  }

  return (
    <header
      style={{
        background: 'rgba(246, 243, 251, 0.86)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(59, 51, 86, 0.08)',
        boxShadow: '0 1px 3px rgba(59,51,86,0.04), 0 8px 24px rgba(59,51,86,0.03)',
      }}
      className="w-full z-50 sticky top-0"
    >
      <div className="max-w-7xl mx-auto px-6 h-[68px] flex items-center justify-between gap-6">
        {/* Left: title */}
        <div className="flex items-center flex-shrink-0 py-2 gap-3">
          <img src="/assets/title.webp" alt="南渝中学校园导览系统" className="h-14 w-auto object-contain" draggable={false} />
        </div>

        {/* Center: tab pills + preset routes */}
        <div className="flex items-center gap-3">
          <nav
            style={{
              background: 'rgba(59, 51, 86, 0.04)',
              border: '1px solid rgba(59, 51, 86, 0.08)',
              borderRadius: 10,
              padding: '3px',
              display: 'flex',
              gap: 2,
            }}
          >
            <TabButton
              active={campus === 'junior'}
              onClick={() => handleSwitch('junior')}
              icon={<Building2 size={13} />}
              label="初中部"
            />
            <TabButton
              active={campus === 'senior'}
              onClick={() => handleSwitch('senior')}
              icon={<GraduationCap size={13} />}
              label="高中部"
            />
          </nav>
          {campus === 'junior' && (
            <button
              onClick={() => setShowPresetRoutes(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer"
              style={{
                background: 'rgba(110,92,168,0.08)',
                border: '1px solid rgba(110,92,168,0.16)',
                color: '#6E5CA8',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(110,92,168,0.14)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(110,92,168,0.08)' }}
            >
              <Route size={13} />
              <span>预设路线</span>
            </button>
          )}
        </div>

        {/* Right: school motto seal — the signature mark */}
        <div className="flex items-center flex-shrink-0">
          <div
            className="flex items-center gap-2 py-1.5 px-3 rounded-lg"
            style={{
              background: 'rgba(169, 116, 28, 0.07)',
              border: '1px solid rgba(169, 116, 28, 0.28)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
            }}
          >
            <span className="sign-eyebrow font-seal text-seal hidden lg:block" style={{ color: '#9A7DB8' }}>
              允公允能 · 日新月异
            </span>
            <span className="font-seal text-seal text-[11px] lg:hidden" style={{ color: '#9A7DB8' }}>
              允公允能
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      style={
        active
          ? {
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(59, 51, 86, 0.08)',
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(59,51,86,0.08), 0 1px 2px rgba(59,51,86,0.04)',
              color: '#6E5CA8',
            }
          : {
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 8,
              color: '#6B6878',
            }
      }
      className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium transition-all duration-200 cursor-pointer hover:text-ink"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
