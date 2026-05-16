'use client'
// src/components/map/StartModal.tsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Navigation, X, MapPin } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'

const START_OPTIONS = ['北门', '东南门'] as const

export default function StartModal() {
  const { selectedLocation, setShowStartModal, startNavigation, clearSearch } = useMapStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!selectedLocation) return null

  const handleStart = async (startPoint: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: startPoint, destinationId: selectedLocation.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '导航失败')
      startNavigation(startPoint, selectedLocation, data.path, data.totalDistance)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '导航失败，请确认已配置道路网络')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && setShowStartModal(false)}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          background: 'rgba(18,18,22,0.97)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24,
          width: '100%',
          maxWidth: 380,
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-white font-semibold text-base">选择出发地点</h2>
            <p className="text-white/40 text-xs mt-0.5">请选择您的出发入口</p>
          </div>
          <button
            onClick={() => { setShowStartModal(false); clearSearch() }}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <X size={14} className="text-white/60" />
          </button>
        </div>

        {/* Destination info */}
        <div className="mx-6 mb-4 p-3.5 rounded-2xl" style={{ background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.2)' }}>
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,122,255,0.2)' }}>
              <MapPin size={13} className="text-blue-400" />
            </div>
            <div>
              <div className="text-white/90 text-sm font-medium">{selectedLocation.detailInfo}</div>
              <div className="text-blue-400/70 text-xs mt-0.5">{selectedLocation.category}</div>
              {selectedLocation.extraInfo && (
                <div className="text-white/35 text-xs mt-0.5">{selectedLocation.extraInfo}</div>
              )}
            </div>
          </div>
        </div>

        {/* Start options */}
        <div className="px-6 pb-6 flex flex-col gap-2.5">
          {START_OPTIONS.map(opt => (
            <motion.button
              key={opt}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleStart(opt)}
              disabled={loading}
              className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0,122,255,0.1)'
                e.currentTarget.style.border = '1px solid rgba(0,122,255,0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(48,209,88,0.15)' }}>
                <Navigation size={16} className="text-green-400" />
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{opt}</div>
                <div className="text-white/35 text-xs mt-0.5">从{opt}出发导航</div>
              </div>
            </motion.button>
          ))}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl text-center text-sm"
              style={{ background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.2)', color: '#FF6B6B' }}
            >
              {error}
            </motion.div>
          )}

          {loading && (
            <div className="text-center text-white/40 text-sm py-1">正在规划路线...</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
