'use client'
// src/components/map/StartModal.tsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navigation, X, MapPin, Zap, Route, LocateFixed } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'
import { NAV_START_POINTS } from '@/types'
import { normalizeNavSettings } from '@/lib/navSettings'

const FLOOR_NUMBERS = [1, 2, 3, 4, 5]

const CUBIC_BEZIER = [0.25, 0.46, 0.45, 0.94] as const

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export default function StartModal() {
  const { selectedLocation, setShowStartModal, startNavigation, clearSearch, setSelectingStart, setPickDestination, campus, routeMode, setRouteMode, navSettings } = useMapStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fallbackNotice, setFallbackNotice] = useState<{ trunkDist: number; shortestDist: number } | null>(null)
  const [pickFloor, setPickFloor] = useState<number | null>(null)

  // Keep the modal in sync with admin-side nav settings whenever it opens
  useEffect(() => {
    if (!selectedLocation) return
    fetch('/api/system/settings')
      .then(r => r.json())
      .then(d => { try { useMapStore.getState().setNavSettings(normalizeNavSettings(d.navSettings)) } catch { /* keep current */ } })
      .catch(() => { /* keep current */ })
  }, [selectedLocation])

  if (!selectedLocation) return null

  const campusSettings = navSettings[campus as 'junior' | 'senior'] ?? navSettings.junior
  const allPoints = NAV_START_POINTS[campus] ?? NAV_START_POINTS.junior
  const enabledPoints = allPoints.filter(p => campusSettings.startPoints[p] !== false)
  const showCurrentLocation = !!campusSettings.useCurrentLocation

  const handleStart = async (startPoint: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: startPoint, destinationId: selectedLocation.id, campus, routeMode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '导航失败')
      if (data.fallbackToShortest) {
        setFallbackNotice({ trunkDist: data.trunkDistance, shortestDist: data.shortestDistance })
      }
      startNavigation({ type: 'category', value: startPoint }, selectedLocation, data.path, data.totalDistance, data.staircaseEvents || [], [], data.startFloor ?? null, data.endFloor ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '导航失败，请确认已配置道路网络')
    } finally {
      setLoading(false)
    }
  }

  const handleUseCurrentLocation = async () => {
    const geo = campusSettings.geo
    if (!('geolocation' in navigator)) { setError('当前浏览器不支持定位'); return }
    if (!geo) { setError('管理员尚未配置该校区的地理坐标，无法使用当前位置出发'); return }
    setLoading(true)
    setError(null)
    const onSuccess = async (pos: GeolocationPosition) => {
      try {
        const { latitude, longitude } = pos.coords
        const metersPerDegLat = 111320
        const metersPerDegLng = 111320 * Math.cos(geo.originLat * Math.PI / 180)
        const dx = (longitude - geo.originLng) * metersPerDegLng
        const dy = (latitude - geo.originLat) * metersPerDegLat
        const px = clamp((dx / geo.metersPerWidth) * 100, 0, 100)
        const py = clamp((-dy / geo.metersPerWidth) * 100, 0, 100)
        const res = await fetch('/api/navigation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start: { x: px, y: py }, destinationId: selectedLocation.id, campus, routeMode }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '导航失败')
        if (data.fallbackToShortest) {
          setFallbackNotice({ trunkDist: data.trunkDistance, shortestDist: data.shortestDistance })
        }
        startNavigation({ type: 'current' }, selectedLocation, data.path, data.totalDistance, data.staircaseEvents || [], [], data.startFloor ?? null, data.endFloor ?? null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '导航失败，请确认已配置道路网络')
      } finally {
        setLoading(false)
      }
    }
    const onError = () => { setLoading(false); setError('无法获取当前位置，请检查定位权限') }
    navigator.geolocation.getCurrentPosition(onSuccess, onError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  }

  const handleMapPick = () => {
    if (campus === 'senior' && pickFloor == null) return
    setPickDestination(selectedLocation)
    setShowStartModal(false)
    clearSearch()
    setSelectingStart(true)
  }

  const startLabel = enabledPoints.length === 1 ? `从${enabledPoints[0]}出发` : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: CUBIC_BEZIER }}
      className="fixed inset-0 z-[110] flex items-center justify-center"
      style={{ background: 'rgba(95, 82, 110, 0.35)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '16px', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      onClick={e => e.target === e.currentTarget && setShowStartModal(false)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.3, ease: CUBIC_BEZIER }}
        style={{
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(50px) saturate(200%)',
          WebkitBackdropFilter: 'blur(50px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: 24,
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 8px 32px rgba(95,82,110,0.14), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(255,255,255,0.4)',
          maxHeight: '85vh',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          <div>
            <h2 className="text-neutral-800 font-bold text-base">选择出发地点</h2>
            <p className="text-neutral-400 text-[13px] mt-0.5">从以下入口开始导航</p>
          </div>
          <button
            onClick={() => { setShowStartModal(false); clearSearch() }}
            style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 10 }}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/50 transition-colors"
          >
            <X size={14} className="text-neutral-400" />
          </button>
        </div>

        <div className="px-5 pb-5 pt-4 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {/* Destination info */}
          <div className="p-3.5 rounded-2xl" style={{ background: 'rgba(95,82,110,0.05)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)' }}>
            <div className="flex items-start gap-3">
              <div style={{ background: 'rgba(179,148,191,0.14)', borderRadius: 12 }} className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                <MapPin size={14} className="text-ink/70" />
              </div>
              <div className="min-w-0">
                <div className="font-seal text-ink text-[15px] font-semibold truncate">{selectedLocation.detailInfo}</div>
                <div className="text-[13px] mt-0.5 font-medium text-ink/50">{selectedLocation.category}</div>
              </div>
            </div>
          </div>

          {/* Route mode selector */}
          <div>
            <p className="text-neutral-400 text-xs mb-2">导航策略</p>
            <div className="flex gap-2">
              <button onClick={() => setRouteMode('trunk')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: routeMode === 'trunk' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: routeMode === 'trunk' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.3)', boxShadow: routeMode === 'trunk' ? 'inset 0 1px 0 rgba(255,255,255,0.8)' : 'none', color: routeMode === 'trunk' ? '#d97706' : '#737373' }}>
                <Route size={13} />主干道路优先
              </button>
              <button onClick={() => setRouteMode('shortest')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: routeMode === 'shortest' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: routeMode === 'shortest' ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.3)', boxShadow: routeMode === 'shortest' ? 'inset 0 1px 0 rgba(255,255,255,0.8)' : 'none', color: routeMode === 'shortest' ? '#2563eb' : '#737373' }}>
                <Zap size={13} />最近路线优先
              </button>
            </div>
          </div>

          {/* Start options */}
          {enabledPoints.length > 0 && (
            <div>
              {startLabel ? (
                <div>
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <Navigation size={13} className="text-blue-500" />
                    <span className="text-blue-500 text-[13px] font-medium">{startLabel}</span>
                  </div>
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => handleStart(enabledPoints[0])} disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl transition-all"
                    style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(50px) saturate(200%)', WebkitBackdropFilter: 'blur(50px) saturate(200%)', border: '1px solid rgba(255,255,255,0.45)', boxShadow: '0 4px 16px rgba(179,148,191,0.2), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35)', opacity: loading ? 0.6 : 1 }}>
                    <Navigation size={14} className="text-[#B394BF]" />
                    <span className="text-ink font-semibold text-[15px]">开始导航</span>
                  </motion.button>
                </div>
              ) : (
                <>
                  <p className="text-neutral-400 text-xs mb-2">选择入口</p>
                  <div className="flex flex-col gap-2">
                    {enabledPoints.map(opt => (
                      <motion.button key={opt} whileTap={{ scale: 0.98 }} onClick={() => handleStart(opt)} disabled={loading}
                        className="w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all"
                        style={{ background: loading ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.55)', backdropFilter: 'blur(50px) saturate(200%)', WebkitBackdropFilter: 'blur(50px) saturate(200%)', border: '1px solid rgba(255,255,255,0.45)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35), 0 2px 8px rgba(95,82,110,0.06)', opacity: loading ? 0.6 : 1 }}>
                        <div style={{ background: 'rgba(179,148,191,0.14)', borderRadius: 12 }} className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                          <Navigation size={15} className="text-ink/60" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-neutral-800 font-semibold text-[15px]">{opt}</div>
                          <div className="text-neutral-400 text-xs mt-0.5">从此处出发</div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* From current location */}
          {showCurrentLocation && (
            <motion.button whileTap={{ scale: 0.98 }} onClick={handleUseCurrentLocation} disabled={loading}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all"
              style={{ background: loading ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.55)', backdropFilter: 'blur(50px) saturate(200%)', WebkitBackdropFilter: 'blur(50px) saturate(200%)', border: '1px solid rgba(255,255,255,0.45)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35), 0 2px 8px rgba(59,130,246,0.06)', opacity: loading ? 0.6 : 1 }}>
              <div style={{ background: 'rgba(59,130,246,0.12)', borderRadius: 10 }} className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                <LocateFixed size={15} className="text-blue-500" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-neutral-800 font-semibold text-[15px]">以当前位置出发</div>
                <div className="text-neutral-400 text-xs mt-0.5">使用设备定位作为起点</div>
              </div>
            </motion.button>
          )}

          {/* Map click option（由管理端“在地图上点击位置作为起点”开关控制） */}
          {campusSettings.allowClickStart !== false && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(50px) saturate(200%)', WebkitBackdropFilter: 'blur(50px) saturate(200%)', border: '1px solid rgba(255,255,255,0.45)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35), 0 2px 8px rgba(95,82,110,0.06)' }}>
            <div className="p-3.5">
              <div className="flex items-center gap-3">
                <div style={{ background: 'rgba(179,148,191,0.14)', borderRadius: 12 }} className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                  <MapPin size={15} className="text-ink/60" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-neutral-800 font-semibold text-[15px]">在地图上点击位置作为起点</div>
                  <div className="text-neutral-400 text-xs mt-0.5">
                    {campus === 'senior' ? '请先选择所在楼层' : '不支持立体楼层的导航'}
                  </div>
                </div>
              </div>
              {campus === 'senior' && (
                <div className="mt-3">
                  <p className="text-neutral-400 text-xs mb-1.5">选择所在楼层</p>
                  <div className="flex flex-wrap gap-1.5">
                      {FLOOR_NUMBERS.map(f => (
                        <button key={f} onClick={() => setPickFloor(f)}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                          style={{
                            background: pickFloor === f ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: pickFloor === f ? '1px solid rgba(179,148,191,0.5)' : '1px solid rgba(255,255,255,0.3)',
                            boxShadow: pickFloor === f ? 'inset 0 1px 0 rgba(255,255,255,0.7)' : 'none',
                            color: pickFloor === f ? '#5F526E' : '#737373',
                          }}>
                          {f}楼
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleMapPick}
                disabled={campus === 'senior' && pickFloor == null}
                className="w-full mt-3 py-2.5 rounded-2xl text-sm font-semibold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.55)',
                  backdropFilter: 'blur(50px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(50px) saturate(200%)',
                  border: '1px solid rgba(255,255,255,0.45)',
                  color: '#5F526E',
                  boxShadow: '0 4px 16px rgba(179,148,191,0.2), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35)',
                  opacity: campus === 'senior' && pickFloor == null ? 0.4 : 1,
                }}
              >
                在地图上选点
              </motion.button>
            </div>
          </div>
          )}

          {/* Error / fallback */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 rounded-xl" style={{ background: 'rgba(255,59,48,0.06)' }}>
                <p className="text-red-500 text-[13px] font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {fallbackNotice && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 rounded-xl flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
                <div className="flex-1">
                  <p className="text-amber-700 text-[12px] font-semibold mb-0.5">主干道路优先距离过长，已自动切换为最短路线</p>
                  <p className="text-amber-600/70 text-[11px]">主干路线 {fallbackNotice.trunkDist.toFixed(1)}m，最短路线 {fallbackNotice.shortestDist.toFixed(1)}m</p>
                </div>
                <button onClick={() => setFallbackNotice(null)} className="flex-shrink-0 text-amber-400 hover:text-amber-600"><X size={12} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={() => { setShowStartModal(false); clearSearch() }}
            className="w-full p-3 rounded-2xl text-neutral-400 font-medium text-[13px] hover:bg-white/30 transition-colors"
            style={{ background: 'rgba(255,255,255,0.35)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.3)' }}>
            取消
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
