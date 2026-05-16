'use client'
// src/components/map/LocationPin.tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Location } from '@/types'

interface Props {
  location: Location
  scale: number
}

// Category color mapping
const categoryColors: Record<string, string> = {
  '北门': '#30D158',
  '东南门': '#30D158',
  '图书馆': '#007AFF',
  '行政办公楼': '#FF9F0A',
  '食堂': '#FF453A',
  '教学楼A栋': '#BF5AF2',
  '教学楼B栋': '#BF5AF2',
  '教学楼C栋': '#BF5AF2',
  '学术报告厅': '#5E5CE6',
  '礼堂': '#5E5CE6',
  '大操场': '#34C759',
  '风雨操场': '#34C759',
  '网球场': '#34C759',
  '羽毛球场': '#34C759',
  '篮球场': '#34C759',
  '乒乓球场': '#34C759',
  '匹克球场': '#34C759',
  '耕读园': '#30B0C7',
  '女生公寓': '#FF6B9D',
  '男生公寓': '#64D2FF',
}

export default function LocationPin({ location, scale }: Props) {
  const [hovered, setHovered] = useState(false)
  const color = categoryColors[location.category] || '#007AFF'

  // Only render if scale is large enough to see
  if (scale < 0.35) return null

  const pinSize = Math.max(6, Math.min(10, 8 / scale))
  const fontSize = Math.max(8, Math.min(13, 11 / scale))

  return (
    <div
      style={{
        position: 'absolute',
        left: location.x * scale,
        top: location.y * scale,
        transform: 'translate(-50%, -50%)',
        zIndex: hovered ? 20 : 10,
        pointerEvents: 'all',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Pin dot */}
      <motion.div
        animate={{ scale: hovered ? 1.3 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        style={{
          width: pinSize * 2,
          height: pinSize * 2,
          borderRadius: '50%',
          background: color,
          border: `2px solid rgba(255,255,255,0.9)`,
          boxShadow: `0 0 0 ${hovered ? 6 : 3}px ${color}40, 0 2px 8px rgba(0,0,0,0.4)`,
          cursor: 'pointer',
          transition: 'box-shadow 0.2s ease',
        }}
      />

      {/* Label */}
      <AnimatePresence>
        {(hovered || scale > 0.7) && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: 4,
              whiteSpace: 'nowrap',
              background: hovered ? 'rgba(10,10,12,0.95)' : 'rgba(10,10,12,0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid ${hovered ? color + '60' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              padding: `${fontSize * 0.3}px ${fontSize * 0.6}px`,
              boxShadow: hovered ? `0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px ${color}30` : '0 2px 8px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
            }}
          >
            <span style={{ color: hovered ? color : 'rgba(255,255,255,0.85)', fontSize, fontWeight: 600, letterSpacing: '0.01em' }}>
              {location.category}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
