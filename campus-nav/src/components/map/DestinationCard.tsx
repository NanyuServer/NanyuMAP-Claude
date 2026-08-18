'use client'
// src/components/map/DestinationCard.tsx
import { useMemo, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Flag, Navigation, X, Timer, AlertTriangle } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'
import type { SearchResult } from '@/types'

const CUBIC_BEZIER = [0.25, 0.46, 0.45, 0.94] as const

type DestinationCardProps = {
  destination: SearchResult
  inline?: boolean
}

const MAP_NATURAL_W: Record<string, number> = { junior: 1560, senior: 1536 }

function parseScale(value: string | undefined): number | null {
  if (!value) return null
  const m = /([\d.]+)px=([\d.]+)m/i.exec(value.trim())
  if (!m) return null
  const px = parseFloat(m[1])
  const meters = parseFloat(m[2])
  if (!px || px <= 0 || !meters || meters <= 0) return null
  return meters / px
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return '不足 1 分钟'
  return `约 ${Math.round(minutes)} 分钟`
}

export default function DestinationCard({ destination, inline = false }: DestinationCardProps) {
  const { navigation, clearNavigation, locations, campus } = useMapStore()
  const { start, visitWaypoints, staircaseEvents } = navigation
  const [metersPerPx, setMetersPerPx] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/system/settings')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const raw = campus === 'senior' ? data.seniorScale : data.juniorScale
        setMetersPerPx(parseScale(raw))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [campus])

  const startLabel = useMemo(() => {
    if (!start) return '出发地'
    if (start.type === 'category') return start.value
    if (start.type === 'current') return '当前位置'
    if (start.type === 'coords') {
      let bestName = `(${start.x},${start.y})`
      let bestDist = Infinity
      for (const loc of locations) {
        const dx = loc.x - start.x
        const dy = loc.y - start.y
        const d = dx * dx + dy * dy
        if (d < bestDist) {
          bestDist = d
          bestName = loc.category
        }
      }
      return bestName
    }
    return '出发地'
  }, [start, locations])

  const eta = useMemo(() => {
    if (metersPerPx == null || navigation.totalDistance <= 0) return null
    const naturalW = MAP_NATURAL_W[campus] ?? 1560
    const pixelDist = (navigation.totalDistance * naturalW) / 100
    const meters = pixelDist * metersPerPx
    const minutes = meters / 72
    return formatMinutes(minutes)
  }, [metersPerPx, navigation.totalDistance, campus])

  // 检测是否涉及跨楼层导航（初中 0↔1 不算）
  const isCrossFloor = useMemo(() => {
    if (!staircaseEvents || staircaseEvents.length === 0) return false
    return staircaseEvents.some(e => {
      if (campus === 'junior') {
        const floors = [e.fromFloor, e.toFloor].sort((a, b) => a - b)
        if (floors[0] === 0 && floors[1] === 1) return false
        return true
      }
      return true
    })
  }, [staircaseEvents, campus])

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ duration: 0.35, ease: CUBIC_BEZIER, delay: 1.2 }}
      className={inline
        ? "w-full z-40"
        : "absolute bottom-4 right-4 md:bottom-6 md:right-6 z-40 w-[calc(100%-2rem)] max-w-sm md:w-80"}
      data-no-drag
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.62)',
          backdropFilter: 'blur(50px) saturate(200%)',
          WebkitBackdropFilter: 'blur(50px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.45)',
          borderRadius: 20,
          boxShadow: '0 8px 32px rgba(95,82,110,0.1), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 2,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.95) 100%)',
          }}
        />

        <AnimatePresence initial={false} mode="wait">
        {collapsed ? (
          /* ── 收起态：向下收起 ── */
          <motion.div
            key="collapsed"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: CUBIC_BEZIER }}
            style={{ overflow: 'hidden' }}
          >
          <div className="p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin size={13} className="text-[#B394BF] flex-shrink-0" />
              <span className="text-ink text-[13px] font-semibold truncate">目的地：{destination.detailInfo}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => setCollapsed(false)}
                className="px-2.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(179,148,191,0.15)', color: '#5F526E' }}
              >
                展开
              </button>
              <button
                onClick={clearNavigation}
                aria-label="结束导航"
                title="结束导航"
                className="w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-95"
                style={{ background: 'rgba(95, 82, 110, 0.08)', color: '#5F526E' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          </motion.div>
        ) : (
          /* ── 展开态：向上展开 ── */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: CUBIC_BEZIER }}
            style={{ overflow: 'hidden' }}
          >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div
                style={{
                  background: 'rgba(52,199,89,0.1)',
                  borderRadius: 10,
                }}
                className="flex items-center gap-1.5 px-2.5 py-1"
              >
                <Navigation size={11} className="text-green-500" />
                <span className="text-green-600 text-[11px] font-semibold">
                  {startLabel}
                </span>
              </div>

              <div className="flex-1 flex items-center justify-center">
                <div className="h-px flex-1 bg-neutral-200/40" />
                <div className="px-1.5">
                  <Flag size={11} className="text-blue-400/60" />
                </div>
                <div className="h-px flex-1 bg-neutral-200/40" />
              </div>

              <div
                style={{
                  background: 'rgba(95, 82, 110, 0.06)',
                  borderRadius: 12,
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 min-w-0"
              >
                <MapPin size={11} className="text-ink/60" />
                <span className="text-ink/80 text-[11px] font-semibold truncate">{destination.detailInfo}</span>
              </div>
            </div>

            {eta && (
              <div className="mb-3 flex items-center gap-1.5 px-1">
                <Timer size={12} className="text-ink/40" />
                <span className="text-ink/70 text-xs">预计用时</span>
                <span className="text-ink font-semibold text-xs">{eta}</span>
              </div>
            )}

            {visitWaypoints.length > 0 && (
              <div className="mb-3 px-1">
                <div className="text-neutral-400 text-[10px] font-medium mb-1.5">途经点</div>
                <div className="flex flex-wrap gap-1.5">
                  {visitWaypoints.map((wp, i) => (
                    <div key={wp.id} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#059669' }}>
                      <span className="text-emerald-400/60">{i + 1}</span>
                      <span className="truncate max-w-[80px]">{wp.detailInfo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 跨楼层提示 */}
            {isCrossFloor && (
              <div className="mb-3 flex items-start gap-2 p-2.5 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-amber-700 text-[11px] font-semibold leading-relaxed">本次导航路线涉及跨楼层，请您以地点标注的实际楼层为主，导航显示的楼层引导仅供参考</span>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div
                style={{
                  background: 'rgba(95, 82, 110, 0.06)',
                  borderRadius: 14,
                }}
                className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              >
                <MapPin size={16} className="text-ink/60" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-seal text-ink font-semibold text-[15px] leading-tight truncate">
                  {destination.detailInfo}
                </div>
                <div className="text-ink/50 text-[13px] mt-1 font-medium">{destination.category}</div>
                {destination.extraInfo && (
                  <div className="text-neutral-400 text-[13px] mt-1.5 leading-relaxed">
                    {destination.extraInfo}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={clearNavigation}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-ink text-[13px] font-semibold transition-all active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(50px) saturate(200%)', WebkitBackdropFilter: 'blur(50px) saturate(200%)', border: '1px solid rgba(255,255,255,0.45)', boxShadow: '0 4px 14px rgba(143,111,168,0.2), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35)' }}
              >
                <X size={13} />
                结束导航
              </button>
              <button
                onClick={() => setCollapsed(true)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(95, 82, 110, 0.08)', color: '#5F526E' }}
              >
                收起
              </button>
            </div>
          </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
