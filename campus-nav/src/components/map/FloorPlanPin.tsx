'use client'
import { useState, useRef, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface FloorPlanPinProps {
  loc: { id: number; x: number; y: number; category: string; detailInfo?: string }
  isMobile: boolean
  isTapped: boolean
  onTapToggle: () => void
  /** 楼层图当前缩放比例，用于标签反向缩放（放大图片时标签保持屏幕大小） */
  mapScale?: number
}

export default function FloorPlanPin({ loc, isMobile, isTapped, onTapToggle, mapScale }: FloorPlanPinProps) {
  const [hovered, setHovered] = useState(false)
  const [clampX, setClampX] = useState(0)
  const labelRef = useRef<HTMLDivElement | null>(null)
  const active = hovered || isTapped
  const showLabel = !isMobile || isTapped
  // 图片放大时反向缩放，使标签在屏幕上最多保持原大小（不超过 1.15 倍）
  const cs = mapScale && mapScale > 1 ? mapScale : 1

  useLayoutEffect(() => {
    if (!showLabel) { setClampX(0); return }
    const el = labelRef.current
    if (!el) return
    const plan = el.closest('[data-floor-plan]')
    if (!plan) return
    const pr = plan.getBoundingClientRect()
    const lr = el.getBoundingClientRect()

    let dx = 0
    if (lr.left < pr.left) dx = pr.left - lr.left + 4
    else if (lr.right > pr.right) dx = pr.right - lr.right - 4
    setClampX(dx)
  }, [showLabel, loc.x, loc.y])

  return (
    <div
      style={{
        position: 'absolute',
        left: `${loc.x}%`,
        top: `${loc.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: active ? 20 : 10,
        pointerEvents: 'all',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        if (isMobile) { e.stopPropagation(); onTapToggle() }
      }}
    >
      <motion.div
        // 反向缩放（1/cs）保持圆点屏幕大小，与 hover/选中放大合并
        animate={{ scale: (active ? 1.1 : 1) * (1 / cs) }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        style={{
          position: 'relative',
          width: 8,
          height: 8,
          cursor: isMobile ? 'pointer' : 'default',
          borderRadius: '50%',
          background: '#6E5CA8',
          border: '1.5px solid rgba(255,255,255,0.9)',
          boxShadow: '0 1px 3px rgba(110,92,168,0.25)',
        }}
      />
      <AnimatePresence>
        {showLabel && (
          <motion.div
            ref={labelRef}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              marginBottom: 4,
              left: '50%',
              pointerEvents: 'none',
              zIndex: 50,
            }}
          >
            <div style={{
              // 反向缩放：放大图片时标签保持屏幕大小（最多不超过 1.15 倍）
              transform: `translateX(calc(-50% + ${clampX}px)) scale(${1 / cs})`,
              transformOrigin: 'center bottom',
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: 8,
                padding: '3px 8px',
                whiteSpace: 'nowrap',
                fontSize: 11,
                fontWeight: 600,
                color: '#3B3356',
                letterSpacing: '0.01em',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>
                {loc.detailInfo || loc.category}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
