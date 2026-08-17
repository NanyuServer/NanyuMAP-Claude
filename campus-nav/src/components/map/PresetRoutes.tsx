'use client'
// src/components/map/PresetRoutes.tsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MapPin, Search, ArrowRight, Flag, AlertCircle, GraduationCap, UserRoundCheck } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'
import type { SearchResult } from '@/types'

interface VisitRouteData {
  id: number; campus: string; name: string
  locationIds: { x: number; y: number }[]
  checkpoints: number[]
  customCheckpoints: { x: number; y: number; name: string }[]
  imageCrop: Record<string, { x?: number; y?: number; scale?: number }>
}

type PresetType = 'freshman' | 'access' | 'visit' | null

const PRESETS = [
  { type: 'freshman' as const, title: '新生报到', desc: '选择校区与班级，导航至对应教室', icon: GraduationCap },
  { type: 'access' as const, title: '来访访问', desc: '搜索受访地点，按预约前往', icon: UserRoundCheck },
  { type: 'visit' as const, title: '家长参观', desc: '沿校园参观路线，打卡校园地标', icon: Flag },
]

const CUBIC_BEZIER = [0.25, 0.46, 0.45, 0.94] as const

export default function PresetRoutes() {
  const { campus, locations, setCampus, setShowStartModal, setSelectedLocation, showPresetRoutes, setShowPresetRoutes, startNavigation, routeMode } = useMapStore()
  const [selected, setSelected] = useState<PresetType>(null)
  const [freshmanCampus, setFreshmanCampus] = useState<string | null>(null)
  const [className, setClassName] = useState('')
  const [accessSearch, setAccessSearch] = useState('')
  const [accessResults, setAccessResults] = useState<SearchResult[]>([])
  const [visitRoutes, setVisitRoutes] = useState<VisitRouteData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    setShowPresetRoutes(false)
    setSelected(null)
    setError(null)
    setFreshmanCampus(null)
    setClassName('')
    setAccessSearch('')
  }

  useEffect(() => {
    if (selected === 'visit') {
      setLoading(true)
      fetch(`/api/visit-routes?campus=${campus}`)
        .then(r => r.json())
        .then(data => setVisitRoutes(Array.isArray(data) ? data : []))
        .catch(() => setVisitRoutes([]))
        .finally(() => setLoading(false))
    }
  }, [selected, campus])

  useEffect(() => {
    if (selected === 'access' && accessSearch.trim()) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(accessSearch)}&campus=${campus}`)
          const data = await res.json()
          setAccessResults(Array.isArray(data) ? data : [])
        } catch { setAccessResults([]) }
      }, 200)
      return () => clearTimeout(timer)
    } else {
      setAccessResults([])
    }
  }, [accessSearch, selected, campus])

  const handleFreshmanNav = async () => {
    if (!freshmanCampus || !className.trim()) { setError('请选择校区并输入班级'); return }
    const prefix = freshmanCampus === 'junior' ? '初一' : '高一'
    const fullName = `${prefix}${className.trim()}`

    // If the chosen campus differs from the current one, switch campus and load its locations
    let pool = locations
    if (freshmanCampus !== campus) {
      setCampus(freshmanCampus)
      try {
        const res = await fetch(`/api/locations?campus=${freshmanCampus}`)
        const data = await res.json()
        if (Array.isArray(data)) pool = data
      } catch { /* fall through to search current pool */ }
    }

    const matchingLoc = pool.find(l =>
      l.detailInfo?.includes(fullName) || l.category?.includes(fullName) || l.extraInfo?.includes(fullName)
    )
    if (!matchingLoc) { setError(`未找到"${fullName}"对应的教室，请确认班级信息`); return }
    setError(null)
    setSelectedLocation({ id: matchingLoc.id, category: matchingLoc.category, detailInfo: matchingLoc.detailInfo ?? matchingLoc.category, extraInfo: matchingLoc.extraInfo, x: matchingLoc.x, y: matchingLoc.y })
    setShowPresetRoutes(false)
    setShowStartModal(true)
  }

  const handleAccessNav = (loc: SearchResult) => {
    setSelectedLocation(loc)
    setShowPresetRoutes(false)
    setShowStartModal(true)
  }

  const handleVisitNav = (route: VisitRouteData) => {
    if (!route.locationIds || route.locationIds.length === 0) { setError('该路线暂无路径数据，请联系管理员'); return }

    // Build waypoints from location checkpoints with coordinates
    const waypoints = route.checkpoints.map(id => {
      const loc = locations.find(l => l.id === id)
      return loc ? { id: loc.id, detailInfo: loc.detailInfo ?? loc.category, category: loc.category, x: loc.x, y: loc.y } : null
    }).filter(Boolean) as { id: number; detailInfo: string; category: string; x: number; y: number }[]

    // Add custom checkpoints as waypoints with coordinates
    const customWPs = (route.customCheckpoints || []).map((c, i) => ({
      id: -200 - i, detailInfo: c.name || `自定义点${i + 1}`, category: '自定义', x: c.x, y: c.y,
    }))
    const allWaypoints = [...waypoints, ...customWPs]

    // Find gate name from route name
    const gateName = route.name.includes('北门') ? '北门' : '东南门'
    const gateLoc = locations.find(l => l.category === gateName)

    // Use the last waypoint as destination
    const lastWP = allWaypoints[allWaypoints.length - 1]
    const destLoc = lastWP ? locations.find(l => l.id === lastWP.id) : null

    if (!destLoc && !lastWP) { setError('未找到目的地'); return }

    setError(null)
    setShowPresetRoutes(false)

    // Build path from stored route data
    const path = route.locationIds.map((p, i) => ({
      id: -100 - i, x: p.x, y: p.y, campus: campus,
    }))

    // Calculate total distance
    let totalDistance = 0
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i-1].x
      const dy = path[i].y - path[i-1].y
      totalDistance += Math.sqrt(dx * dx + dy * dy)
    }

    // Use last path point as destination if no location match
    const lastPathPt = path[path.length - 1]
    const dest = destLoc
      ? { id: destLoc.id, category: destLoc.category, detailInfo: destLoc.detailInfo ?? destLoc.category, extraInfo: destLoc.extraInfo, x: destLoc.x, y: destLoc.y }
      : { id: -999, category: '自定义', detailInfo: lastWP?.detailInfo || '目的地', extraInfo: null, x: lastPathPt.x, y: lastPathPt.y }

    startNavigation(
      { type: 'category', value: gateName },
      dest,
      path,
      totalDistance,
      [],
      allWaypoints,
      null,
      null,
    )
  }

  if (!showPresetRoutes) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: CUBIC_BEZIER }}
      className="fixed inset-0 z-[110] flex items-center justify-center"
      style={{ background: 'rgba(95, 82, 110, 0.35)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '16px', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      onClick={e => e.target === e.currentTarget && handleClose()}
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
        <AnimatePresence mode="wait">
          {!selected ? (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: CUBIC_BEZIER }}>
              <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(95,82,110,0.08)' }}>
                <div>
                  <div className="sign-eyebrow" style={{ color: '#B394BF' }}>南渝中学</div>
                  <h2 className="font-seal text-ink font-semibold text-lg">预设路线</h2>
                </div>
                <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 12 }} className="w-8 h-8 flex items-center justify-center hover:bg-white/50 transition-colors">
                  <X size={14} className="text-[#5F526E]" />
                </button>
              </div>

              <div className="px-5 pb-5 pt-4 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
                {PRESETS.map((p, i) => (
                  <motion.button
                    key={p.type}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3, ease: CUBIC_BEZIER }}
                    onClick={() => setSelected(p.type)}
                    className="w-full rounded-2xl transition-all text-left overflow-hidden cursor-pointer"
                    style={{
                      background: 'rgba(255,255,255,0.55)',
                      backdropFilter: 'blur(50px) saturate(200%)',
                      WebkitBackdropFilter: 'blur(50px) saturate(200%)',
                      border: '1px solid rgba(255,255,255,0.45)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35), 0 2px 8px rgba(95,82,110,0.06)',
                    }}
                  >
                    <div className="px-4 py-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(179,148,191,0.14)' }}>
                        <p.icon size={18} className="text-[#B394BF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-seal text-ink text-[16px] font-semibold">{p.title}</div>
                        <div className="text-ink/45 text-xs mt-0.5 leading-relaxed">{p.desc}</div>
                      </div>
                      <ArrowRight size={16} className="text-[#B394BF] flex-shrink-0" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : selected === 'freshman' ? (
            <motion.div key="freshman" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25, ease: CUBIC_BEZIER }}>
              <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(95,82,110,0.08)' }}>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelected(null); setError(null); setFreshmanCampus(null); setClassName('') }} className="text-[#B394BF] hover:text-[#5F526E] transition-colors">
                    <ArrowRight size={16} className="rotate-180" />
                  </button>
                  <div>
                    <h2 className="font-seal text-ink font-semibold text-lg">新生报到</h2>
                    <p className="text-neutral-400 text-[13px] mt-0.5">选择校区和班级开始导航</p>
                  </div>
                </div>
                <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 12 }} className="w-8 h-8 flex items-center justify-center hover:bg-white/50 transition-colors">
                  <X size={14} className="text-[#5F526E]" />
                </button>
              </div>
              <div className="px-5 pb-5 pt-4 space-y-4">
                <div>
                  <label className="text-neutral-500 text-xs font-medium mb-2 block">选择校区</label>
                  <div className="flex gap-2">
                    {['junior', 'senior'].map(c => (
                      <button key={c} onClick={() => setFreshmanCampus(c)}
                        className="flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all"
                        style={{
                          background: freshmanCampus === c ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)',
                          backdropFilter: 'blur(30px)',
                          WebkitBackdropFilter: 'blur(30px)',
                          border: freshmanCampus === c ? '1px solid rgba(179,148,191,0.5)' : '1px solid rgba(255,255,255,0.3)',
                          boxShadow: freshmanCampus === c ? 'inset 0 1px 0 rgba(255,255,255,0.7)' : 'none',
                          color: freshmanCampus === c ? '#5F526E' : '#737373',
                        }}>
                        {c === 'junior' ? '初中部' : '高中部'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-neutral-500 text-xs font-medium mb-2 block">输入班级</label>
                  <input value={className} onChange={e => setClassName(e.target.value)} placeholder="如：1班、2班、3班"
                    className="w-full py-2.5 px-3 rounded-2xl text-[#5F526E] text-sm placeholder-[#B394BF] outline-none"
                    style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.4)' }} />
                  {className.trim() && freshmanCampus && (
                    <div className="text-neutral-400 text-xs mt-1.5">
                      将导航至：<span className="text-ink font-medium">{freshmanCampus === 'junior' ? '初一' : '高一'}{className.trim()}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-2 p-3 rounded-2xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-amber-700 text-xs">请先扫描校门口分班查询二维码获取分班信息</span>
                </div>
                {error && <div className="text-red-500 text-xs">{error}</div>}
                <button onClick={handleFreshmanNav} disabled={!freshmanCampus || !className.trim()}
                  className="w-full py-3 rounded-2xl text-ink text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(50px) saturate(200%)', WebkitBackdropFilter: 'blur(50px) saturate(200%)', border: '1px solid rgba(255,255,255,0.45)', boxShadow: '0 4px 16px rgba(179,148,191,0.2), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35)', opacity: !freshmanCampus || !className.trim() ? 0.5 : 1 }}>
                  开始导航
                </button>
              </div>
            </motion.div>
          ) : selected === 'access' ? (
            <motion.div key="access" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25, ease: CUBIC_BEZIER }}>
              <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(95,82,110,0.08)' }}>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelected(null); setError(null); setAccessSearch('') }} className="text-[#B394BF] hover:text-[#5F526E] transition-colors">
                    <ArrowRight size={16} className="rotate-180" />
                  </button>
                  <div>
                    <h2 className="font-seal text-ink font-semibold text-lg">来访访问</h2>
                    <p className="text-neutral-400 text-[13px] mt-0.5">搜索目的地开始导航</p>
                  </div>
                </div>
                <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 12 }} className="w-8 h-8 flex items-center justify-center hover:bg-white/50 transition-colors">
                  <X size={14} className="text-[#5F526E]" />
                </button>
              </div>
              <div className="px-5 pb-5 pt-4 space-y-4">
                <div className="flex items-start gap-2 p-3 rounded-2xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <AlertCircle size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <span className="text-blue-700 text-xs">请确认您已通过"南渝中学智慧校园访客预约"进行预约。</span>
                </div>
                <div>
                  <label className="text-neutral-500 text-xs font-medium mb-2 block">搜索目的地</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B394BF]" />
                    <input value={accessSearch} onChange={e => setAccessSearch(e.target.value)} placeholder="输入地点名称"
                      className="w-full py-2.5 pl-9 pr-3 rounded-2xl text-[#5F526E] text-sm placeholder-[#B394BF] outline-none"
                      style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.4)' }} />
                  </div>
                </div>
                {accessResults.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {accessResults.map(loc => (
                      <button key={loc.id} onClick={() => handleAccessNav(loc)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                        style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.25)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.55)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.35)' }}>
                        <MapPin size={14} className="text-[#B394BF] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[#5F526E] text-sm font-medium truncate">{loc.detailInfo}</div>
                          <div className="text-neutral-400 text-xs">{loc.category}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {error && <div className="text-red-500 text-xs">{error}</div>}
              </div>
            </motion.div>
          ) : (
            <motion.div key="visit" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25, ease: CUBIC_BEZIER }}>
              <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(95,82,110,0.08)' }}>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelected(null); setError(null) }} className="text-[#B394BF] hover:text-[#5F526E] transition-colors">
                    <ArrowRight size={16} className="rotate-180" />
                  </button>
                  <div>
                    <h2 className="font-seal text-ink font-semibold text-lg">家长参观</h2>
                    <p className="text-neutral-400 text-[13px] mt-0.5">选择出发门开始参观</p>
                  </div>
                </div>
                <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 12 }} className="w-8 h-8 flex items-center justify-center hover:bg-white/50 transition-colors">
                  <X size={14} className="text-[#5F526E]" />
                </button>
              </div>
              <div className="px-5 pb-5 pt-4 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 100px)' }}>
                {loading ? (
                  <div className="text-center text-neutral-400 text-sm py-8">加载中...</div>
                ) : visitRoutes.length === 0 ? (
                  <div className="text-center text-neutral-400 text-sm py-8">暂未设置参观路线</div>
                ) : visitRoutes.map((route, i) => (
                  <motion.button key={route.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3, ease: CUBIC_BEZIER }}
                    onClick={() => handleVisitNav(route)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all text-left"
                    style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(50px) saturate(200%)', WebkitBackdropFilter: 'blur(50px) saturate(200%)', border: '1px solid rgba(255,255,255,0.45)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35), 0 2px 8px rgba(95,82,110,0.06)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
                      <Flag size={18} className="text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <div className="font-seal text-ink text-[15px] font-semibold">{route.name}</div>
                      <div className="text-neutral-400 text-xs mt-0.5">{route.checkpoints.length + (route.customCheckpoints?.length || 0)} 个打卡点</div>
                    </div>
                    <ArrowRight size={16} className="text-[#B394BF]" />
                  </motion.button>
                ))}
                {error && <div className="text-red-500 text-xs">{error}</div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
