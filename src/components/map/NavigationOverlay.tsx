'use client'
// src/components/map/NavigationOverlay.tsx
import { motion } from 'framer-motion'
import { Navigation2, X } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'

export default function NavigationOverlay() {
  const { navigation, clearNavigation } = useMapStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl"
      style={{
        background: 'rgba(0,122,255,0.12)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(0,122,255,0.3)',
        boxShadow: '0 4px 16px rgba(0,122,255,0.2)',
      }}
      data-no-drag
    >
      <motion.div
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
      >
        <Navigation2 size={14} className="text-blue-400" />
      </motion.div>
      <span className="text-white/80 text-xs font-medium">
        正在导航 · {navigation.destination?.category}
      </span>
      <div className="w-px h-3 bg-white/15 mx-1" />
      <span className="text-white/40 text-xs">从 {navigation.start} 出发</span>
    </motion.div>
  )
}
