'use client'
// src/components/map/CampusSwitchPin.tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, ArrowRight } from 'lucide-react'

interface CampusSwitchPinProps {
  targetCampus: 'junior' | 'senior'
  label: string
  x: number
  y: number
  onSwitch: () => void
}

export default function CampusSwitchPin({ targetCampus, label, x, y, onSwitch }: CampusSwitchPinProps) {
  const [hovered, setHovered] = useState(false)

  const isSenior = targetCampus === 'senior'
  const gradient = isSenior
    ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
  const shadowColor = isSenior
    ? 'rgba(139, 92, 246, 0.35)'
    : 'rgba(59, 130, 246, 0.35)'

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: hovered ? 25 : 12,
        pointerEvents: 'all',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        onSwitch()
      }}
    >
      {/* Outer halo pulse */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1.3, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute',
              inset: -16,
              borderRadius: '50%',
              background: shadowColor,
              filter: 'blur(6px)',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Main pin body */}
      <motion.div
        animate={{ scale: hovered ? 1.15 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        style={{
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Pin shape: rounded rectangle with gradient */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 20,
            background: gradient,
            border: '2px solid rgba(255,255,255,0.9)',
            boxShadow: `0 3px 12px ${shadowColor}, 0 1px 3px rgba(0,0,0,0.1)`,
            whiteSpace: 'nowrap',
          }}
        >
          <GraduationCap size={14} color="white" strokeWidth={2.2} />
          <span
            style={{
              color: 'white',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.02em',
              lineHeight: 1,
            }}
          >
            {label}
          </span>
          <ArrowRight size={12} color="rgba(255,255,255,0.8)" strokeWidth={2.5} />
        </div>

        {/* Tooltip on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                top: '110%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: 4,
                background: 'rgba(0,0,0,0.78)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: 8,
                padding: '5px 10px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 500 }}>
                {`点击切换到${label}`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
