'use client'
// src/components/map/LocationPin.tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Location } from '@prisma/client'

interface LocationPinProps {
  location: Location
  isActive?: boolean
  showLabel?: boolean
  isTapped?: boolean
  onTapToggle?: () => void
  mapScale?: number
}

export default function LocationPin({ location, isActive = false, showLabel = true, isTapped = false, onTapToggle, mapScale }: LocationPinProps) {
  const [hovered, setHovered] = useState(false)
  const active = hovered || isActive || isTapped

  const showTooltip = showLabel ? true : active

  const cs = mapScale && mapScale > 1 ? mapScale : 1

  const tooltipAbove = showLabel || location.y >= 12
  const tooltipAtLeft = !showLabel && location.x < 8
  const tooltipAtRight = !showLabel && location.x > 92

  return (
    <div
      style={{
        position: 'absolute',
        left: `${location.x}%`,
        top: `${location.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: active ? 20 : 10,
        pointerEvents: 'all',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        if (!showLabel && onTapToggle) {
          e.stopPropagation()
          onTapToggle()
        }
      }}
    >
      {/* Dot with white border (constant on-screen size regardless of map zoom) */}
      <div style={{ transform: cs > 1 ? `scale(${1 / cs})` : undefined, transformOrigin: 'center center' }}>
        <motion.div
          animate={{ scale: isActive ? 1.3 : active ? 1.1 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          style={{
            position: 'relative',
            width: 10,
            height: 10,
            cursor: 'pointer',
            borderRadius: '50%',
            background: '#B394BF',
            border: '2px solid rgba(255,255,255,0.95)',
            boxShadow: '0 1px 4px rgba(179,148,191,0.45), 0 0 0 3px rgba(179,148,191,0.12)',
          }}
        />
      </div>

      {/* Label / Tooltip */}
      <AnimatePresence>
        {showLabel ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute',
              left: '108%',
              top: '50%',
              transform: `translateY(-50%)${cs > 1 ? ` scale(${1 / cs})` : ''}`,
              transformOrigin: 'left center',
              pointerEvents: 'none',
              zIndex: 40,
            }}
          >
            <div style={{
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(18px) saturate(180%)',
              WebkitBackdropFilter: 'blur(18px) saturate(180%)',
              borderRadius: 9,
              padding: '4px 10px',
              whiteSpace: 'nowrap',
              fontSize: 12,
              fontWeight: 600,
              color: '#5F526E',
              letterSpacing: '0.01em',
              border: '1px solid rgba(255,255,255,0.7)',
              boxShadow: '0 0 0 1px rgba(179,148,191,0.15), 0 0 14px rgba(179,148,191,0.35), 0 2px 10px rgba(95,82,110,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}>
              {location.category}
            </div>
          </motion.div>
        ) : (
          showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: tooltipAbove ? 5 : -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: tooltipAbove ? 5 : -5 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                ...(tooltipAbove ? { bottom: `${8 + 6 / cs}px` } : { top: `${8 + 6 / cs}px` }),
                ...(tooltipAtRight ? { right: 0 } : tooltipAtLeft ? { left: 0 } : { left: '50%' }),
                pointerEvents: 'none',
                zIndex: 50,
              }}
            >
              <div style={{
                transform: [
                  !tooltipAtLeft && !tooltipAtRight ? 'translateX(-50%)' : '',
                  cs > 1 ? `scale(${1 / cs})` : '',
                ].filter(Boolean).join(' ') || undefined,
                transformOrigin: `${tooltipAtLeft ? 'left' : tooltipAtRight ? 'right' : 'center'} ${tooltipAbove ? 'bottom' : 'top'}`,
              }}>
                <div style={{
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(18px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                  borderRadius: 9,
                  padding: '4px 10px',
                  whiteSpace: 'nowrap',
                  border: '1px solid rgba(255,255,255,0.7)',
                  boxShadow: '0 0 0 1px rgba(179,148,191,0.15), 0 0 14px rgba(179,148,191,0.35), 0 2px 10px rgba(95,82,110,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#5F526E', letterSpacing: '0.01em' }}>{location.category}</div>
                </div>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  )
}
