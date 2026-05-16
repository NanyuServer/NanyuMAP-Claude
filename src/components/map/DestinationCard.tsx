'use client'
// src/components/map/DestinationCard.tsx
import { motion } from 'framer-motion'
import { MapPin, Flag, Navigation, X } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'

export default function DestinationCard() {
  const { navigation, clearNavigation } = useMapStore()
  const { destination, start, totalDistance } = navigation

  if (!destination) return null

  const distanceM = Math.round(totalDistance)

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30, delay: 0.8 }}
      className="fixed bottom-8 left-4 right-20 z-40 max-w-sm"
      data-no-drag
    >
      <div
        style={{
          background: 'rgba(12,12,16,0.95)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,122,255,0.15)',
          overflow: 'hidden',
        }}
      >
        {/* Top accent line */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, #007AFF, #30D158)' }} />

        <div className="p-4">
          {/* Route info row */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)' }}>
              <Navigation size={10} className="text-green-400" />
              <span className="text-green-400 text-xs font-medium">{start}</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span className="text-white/30 text-xs px-2">{distanceM > 0 ? `~${distanceM}m` : '规划中'}</span>
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,122,255,0.1)', border: '1px solid rgba(0,122,255,0.2)' }}>
              <Flag size={10} className="text-blue-400" />
              <span className="text-blue-400 text-xs font-medium">目的地</span>
            </div>
          </div>

          {/* Destination details */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,122,255,0.15)' }}>
              <MapPin size={15} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm leading-tight">{destination.detailInfo}</div>
              <div className="text-blue-400/80 text-xs mt-0.5">{destination.category}</div>
              {destination.extraInfo && (
                <div className="text-white/40 text-xs mt-1 leading-relaxed">{destination.extraInfo}</div>
              )}
            </div>
            <button
              onClick={clearNavigation}
              className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            >
              <X size={12} className="text-white/50" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
