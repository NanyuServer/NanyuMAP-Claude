'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Save, X, Flag, RefreshCcw, Loader2, Crop, ArrowRight, Eye, MapPin, Trash2, MousePointer } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'

const MAP_NATURAL = { w: 1560, h: 1008 }

interface VisitRouteData {
  id: number; campus: string; name: string
  locationIds: any[]; checkpoints: number[]
  customCheckpoints: { x: number; y: number; name: string }[]
  routePoints: any[]; imageCrop: Record<string, { x?: number; y?: number; scale?: number }>
}

interface LocationItem {
  id: number; category: string; detailInfo: string; extraInfo: string | null; x: number; y: number; campus: string
}

const ROUTE_TABS = [
  { key: 'north', name: '北门出发', gate: '北门' },
  { key: 'southeast', name: '东南门出发', gate: '东南门' },
]

const PRESET_IMAGES = [
  { type: 'freshman', title: '新生报到', image: '/assets/Default/Freshman.webp', desc: '校园导航指引' },
  { type: 'access', title: '来访访问', image: '/assets/Default/Access.webp', desc: '访客导航服务' },
  { type: 'visit', title: '家长参观', image: '/assets/Default/Visit.webp', desc: '校园参观导览' },
]

export default function VisitRoutesPage() {
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [showCrop, setShowCrop] = useState(false)
  const [formImageCrop, setFormImageCrop] = useState<Record<string, { x?: number; y?: number; scale?: number }>>({})

  const [activeTab, setActiveTab] = useState<'north' | 'southeast'>('north')
  const [routes, setRoutes] = useState<Record<string, VisitRouteData | null>>({ north: null, southeast: null })
  const [checkpoints, setCheckpoints] = useState<Record<string, number[]>>({ north: [], southeast: [] })
  const [customCheckpoints, setCustomCheckpoints] = useState<Record<string, { x: number; y: number; name: string }[]>>({ north: [], southeast: [] })
  const [calculatedPaths, setCalculatedPaths] = useState<Record<string, { x: number; y: number }[]>>({ north: [], southeast: [] })

  const [inputMode, setInputMode] = useState<'select' | 'click'>('select')
  const [newPointName, setNewPointName] = useState('')

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const [renderW, setRenderW] = useState(0)

  useEffect(() => {
    const el = mapContainerRef.current
    if (!el) return
    const measure = () => setRenderW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const natural = MAP_NATURAL
  const containerH = renderW > 0 ? Math.round((renderW * natural.h) / natural.w) : 400

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [routesRes, locsRes, settingsRes] = await Promise.all([
        fetch('/api/visit-routes?campus=junior', { credentials: 'same-origin' }),
        fetch('/api/locations?campus=junior', { credentials: 'same-origin' }),
        fetch('/api/system/settings', { credentials: 'same-origin' }),
      ])
      const routesData = await routesRes.json()
      const locsData = await locsRes.json()
      const settingsData = await settingsRes.json()

      if (Array.isArray(locsData)) setLocations(locsData)
      try { setFormImageCrop(JSON.parse(settingsData.presetImageCrops || '{}')) } catch {}

      const newRoutes: Record<string, VisitRouteData | null> = { north: null, southeast: null }
      const newCheckpoints: Record<string, number[]> = { north: [], southeast: [] }
      const newCustom: Record<string, { x: number; y: number; name: string }[]> = { north: [], southeast: [] }
      const newPaths: Record<string, { x: number; y: number }[]> = { north: [], southeast: [] }

      if (Array.isArray(routesData)) {
        for (const r of routesData) {
          const tab = ROUTE_TABS.find(t => t.name === r.name)
          if (tab) {
            newRoutes[tab.key] = r
            newCheckpoints[tab.key] = Array.isArray(r.checkpoints) ? r.checkpoints : []
            newCustom[tab.key] = Array.isArray(r.customCheckpoints) ? r.customCheckpoints : []
            newPaths[tab.key] = Array.isArray(r.locationIds) ? r.locationIds : []
          }
        }
      }

      setRoutes(newRoutes)
      setCheckpoints(newCheckpoints)
      setCustomCheckpoints(newCustom)
      setCalculatedPaths(newPaths)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const currentTab = ROUTE_TABS.find(t => t.key === activeTab)!
  const currentCheckpoints = checkpoints[activeTab] || []
  const currentCustom = customCheckpoints[activeTab] || []
  const currentPath = calculatedPaths[activeTab] || []
  const currentRoute = routes[activeTab]

  const toggleCheckpoint = (id: number) => {
    setCheckpoints(prev => {
      const list = prev[activeTab] || []
      const newList = list.includes(id) ? list.filter(x => x !== id) : [...list, id]
      return { ...prev, [activeTab]: newList }
    })
    setCalculatedPaths(prev => ({ ...prev, [activeTab]: [] }))
  }

  const moveCheckpoint = (idx: number, dir: -1 | 1) => {
    setCheckpoints(prev => {
      const list = [...(prev[activeTab] || [])]
      const toIdx = idx + dir
      if (toIdx < 0 || toIdx >= list.length) return prev
      const tmp = list[idx]; list[idx] = list[toIdx]; list[toIdx] = tmp
      return { ...prev, [activeTab]: list }
    })
    setCalculatedPaths(prev => ({ ...prev, [activeTab]: [] }))
  }

  const removeCheckpoint = (id: number) => {
    setCheckpoints(prev => ({ ...prev, [activeTab]: (prev[activeTab] || []).filter(x => x !== id) }))
    setCalculatedPaths(prev => ({ ...prev, [activeTab]: [] }))
  }

  const removeCustomCheckpoint = (idx: number) => {
    setCustomCheckpoints(prev => {
      const list = [...(prev[activeTab] || [])]
      list.splice(idx, 1)
      return { ...prev, [activeTab]: list }
    })
    setCalculatedPaths(prev => ({ ...prev, [activeTab]: [] }))
  }

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (inputMode !== 'click') return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10
    const py = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10
    const name = newPointName.trim() || `点${currentCustom.length + 1}`
    setCustomCheckpoints(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), { x: px, y: py, name }],
    }))
    setNewPointName('')
    setCalculatedPaths(prev => ({ ...prev, [activeTab]: [] }))
  }

  const handleCalculatePath = async () => {
    if (currentCheckpoints.length === 0 && currentCustom.length === 0) { alert('请先选择打卡点'); return }
    setCalculating(true)
    try {
      const res = await fetch('/api/navigation/multi-waypoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waypointIds: currentCheckpoints,
          customWaypoints: currentCustom,
          campus: 'junior',
          startGate: currentTab.gate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '计算失败')
      setCalculatedPaths(prev => ({ ...prev, [activeTab]: data.path || [] }))
    } catch (e) { alert(e instanceof Error ? e.message : '计算路线失败') }
    finally { setCalculating(false) }
  }

  const handleSave = async () => {
    if (currentCheckpoints.length === 0 && currentCustom.length === 0) { alert('请先选择打卡点'); return }
    if (currentPath.length === 0) { alert('请先计算路线'); return }
    setSaving(true)
    try {
      const action = currentRoute ? 'update' : 'create'
      const data = currentRoute
        ? { id: currentRoute.id, name: currentTab.name, checkpoints: currentCheckpoints, customCheckpoints: currentCustom, locationIds: currentPath }
        : { campus: 'junior', name: currentTab.name, checkpoints: currentCheckpoints, customCheckpoints: currentCustom, locationIds: currentPath }
      const res = await fetch('/api/visit-routes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ action, data }),
      })
      if (!res.ok) throw new Error('保存失败')
      fetchData()
    } catch (e) { alert(e instanceof Error ? e.message : '保存失败') }
    finally { setSaving(false) }
  }

  const handleDeleteRoute = async () => {
    if (!currentRoute) return
    if (!confirm('确定要删除这条参观路线吗？')) return
    try {
      await fetch('/api/visit-routes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ action: 'delete', data: { id: currentRoute.id } }),
      })
      fetchData()
    } catch { alert('删除失败') }
  }

  const getLocationById = (id: number) => locations.find(l => l.id === id)

  const allCheckpointsOrdered = [
    ...currentCheckpoints.map(id => ({ type: 'location' as const, id, loc: getLocationById(id) })),
    ...currentCustom.map((c, i) => ({ type: 'custom' as const, id: `custom_${i}`, loc: { x: c.x, y: c.y, detailInfo: c.name, id: `custom_${i}` } })),
  ]

  return (
    <AdminShell>
      <div className="h-full flex flex-col overflow-hidden" style={{ background: '#080809' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0 flex-wrap gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,14,0.95)' }}>
          <div>
            <h1 className="text-white text-base font-semibold">参观路线设置</h1>
            <p className="text-white/35 text-xs mt-0.5">选择打卡点或在地图上点击选点，系统沿道路规划路线</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowCrop(!showCrop)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium" style={{ background: showCrop ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)', color: showCrop ? '#C084FC' : 'rgba(255,255,255,0.7)' }}>
              <Crop size={14} />图片裁剪
            </button>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 text-sm">
              <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Route tabs */}
        <div className="flex gap-2 px-6 pt-4">
          {ROUTE_TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.key ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.05)',
                border: activeTab === tab.key ? '1px solid rgba(0,122,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                color: activeTab === tab.key ? '#60A5FA' : 'rgba(255,255,255,0.5)',
              }}>
              <MapPin size={14} />{tab.name}
              {routes[tab.key] && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          <AnimatePresence>
            {showCrop && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-purple-300 text-sm font-semibold">预设路线图片裁剪</div>
                    <button onClick={() => setShowCrop(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
                  </div>
                  <div className="text-white/35 text-xs mb-5">调整裁剪参数，下方实时预览用户端看到的效果。</div>
                  <div className="grid grid-cols-3 gap-6">
                    {PRESET_IMAGES.map(p => {
                      const crop = formImageCrop[p.type] || {}
                      const cx = crop.x ?? 50; const cy = crop.y ?? 50; const cs = crop.scale ?? 1
                      return (
                        <div key={p.type} className="space-y-3">
                          <div className="text-white/50 text-xs font-medium">{p.title}</div>
                          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.5)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 3px rgba(0,0,0,0.04)' }}>
                            <div className="w-full overflow-hidden" style={{ height: 112 }}>
                              <img src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${cx}% ${cy}%`, transform: `scale(${cs})` }} />
                            </div>
                            <div className="px-4 py-3 flex items-center justify-between">
                              <div>
                                <div className="text-neutral-800 font-semibold text-[15px]">{p.title}</div>
                                <div className="text-neutral-400 text-xs mt-0.5">{p.desc}</div>
                              </div>
                              <ArrowRight size={16} className="text-neutral-300" />
                            </div>
                          </div>
                          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-white/30 text-[10px] block mb-1">X</label>
                                <input type="range" min="0" max="100" value={cx} onChange={e => setFormImageCrop(prev => ({ ...prev, [p.type]: { ...prev[p.type], x: Number(e.target.value) } }))} className="w-full accent-purple-500" />
                                <div className="text-white/50 text-[10px] text-center">{cx}%</div>
                              </div>
                              <div className="flex-1">
                                <label className="text-white/30 text-[10px] block mb-1">Y</label>
                                <input type="range" min="0" max="100" value={cy} onChange={e => setFormImageCrop(prev => ({ ...prev, [p.type]: { ...prev[p.type], y: Number(e.target.value) } }))} className="w-full accent-purple-500" />
                                <div className="text-white/50 text-[10px] text-center">{cy}%</div>
                              </div>
                            </div>
                            <div>
                              <label className="text-white/30 text-[10px] block mb-1">缩放 {cs.toFixed(1)}x</label>
                              <input type="range" min="10" max="30" value={Math.round(cs * 10)} onChange={e => setFormImageCrop(prev => ({ ...prev, [p.type]: { ...prev[p.type], scale: Number(e.target.value) / 10 } }))} className="w-full accent-purple-500" />
                            </div>
                            <button onClick={() => setFormImageCrop(prev => ({ ...prev, [p.type]: { x: 50, y: 50, scale: 1 } }))} className="text-white/25 hover:text-white/50 text-[10px]">重置</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4">
                    <button onClick={async () => {
                      try {
                        await fetch('/api/system/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ presetImageCrops: JSON.stringify(formImageCrop) }) })
                        alert('裁剪设置已保存')
                      } catch { alert('保存失败') }
                    }} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
                      <Save size={14} className="inline mr-1.5" />保存裁剪设置
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 340px' }}>
            {/* Map preview */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-white text-sm font-semibold">{currentTab.name} · 路线预览</div>
                <span className="text-white/35 text-xs">{currentCheckpoints.length + currentCustom.length} 个打卡点 · {currentPath.length} 个路径点</span>
              </div>
              <div ref={mapContainerRef}
                className="relative overflow-hidden rounded-xl"
                style={{ width: '100%', aspectRatio: `${natural.w / natural.h}`, background: '#111', cursor: inputMode === 'click' ? 'crosshair' : 'default' }}
                onClick={handleMapClick}>
                <img src="/assets/map.webp" alt="地图" style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} draggable={false} />

                {/* Calculated route path */}
                {currentPath.length >= 2 && (() => {
                  const W = renderW || natural.w; const H = containerH || natural.h
                  const pts = currentPath.map(p => ({ x: (p.x / 100) * W, y: (p.y / 100) * H }))
                  return (
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                      {pts.map((p, i) => i > 0 && <line key={i} x1={pts[i-1].x} y1={pts[i-1].y} x2={p.x} y2={p.y} stroke="rgba(119,58,218,0.6)" strokeWidth="3" />)}
                    </svg>
                  )
                })()}

                {/* Gate marker */}
                {(() => {
                  const gateLoc = locations.find(l => l.category === currentTab.gate)
                  if (!gateLoc) return null
                  return (
                    <div style={{ position: 'absolute', left: `${gateLoc.x}%`, top: `${gateLoc.y}%`, transform: 'translate(-50%,-50%)', zIndex: 25 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#22C55E', border: '2px solid white', boxShadow: '0 2px 6px rgba(34,197,94,0.5)' }} />
                      <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#4ADE80', fontWeight: 700, whiteSpace: 'nowrap' }}>{currentTab.gate}</div>
                    </div>
                  )
                })()}

                {/* Location checkpoint markers */}
                {currentCheckpoints.map((id, i) => {
                  const loc = getLocationById(id)
                  if (!loc) return null
                  return (
                    <div key={`loc-${id}`} style={{ position: 'absolute', left: `${loc.x}%`, top: `${loc.y}%`, transform: 'translate(-50%,-50%)', zIndex: 20 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#EAB308', border: '2px solid white', boxShadow: '0 2px 6px rgba(234,179,8,0.5)' }} />
                      <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#FBBF24', fontWeight: 700, whiteSpace: 'nowrap' }}>{i + 1}. {loc.detailInfo}</div>
                    </div>
                  )
                })}

                {/* Custom checkpoint markers */}
                {currentCustom.map((cp, i) => (
                  <div key={`custom-${i}`} style={{ position: 'absolute', left: `${cp.x}%`, top: `${cp.y}%`, transform: 'translate(-50%,-50%)', zIndex: 20 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#F97316', border: '2px solid white', boxShadow: '0 2px 6px rgba(249,115,22,0.5)' }} />
                    <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#FB923C', fontWeight: 700, whiteSpace: 'nowrap' }}>{currentCheckpoints.length + i + 1}. {cp.name}</div>
                  </div>
                ))}

                {/* Click mode hint */}
                {inputMode === 'click' && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg" style={{ background: 'rgba(0,0,0,0.78)', color: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(6px)' }}>
                      点击地图放置打卡点
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right panel */}
            <div className="space-y-4">
              {/* Input mode toggle */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <div className="text-white text-sm font-semibold mb-3">打卡点输入方式</div>
                <div className="flex gap-2">
                  <button onClick={() => setInputMode('select')}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{ background: inputMode === 'select' ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.05)', color: inputMode === 'select' ? '#60A5FA' : 'rgba(255,255,255,0.5)', border: inputMode === 'select' ? '1px solid rgba(0,122,255,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                    <MapPin size={14} />选择地点
                  </button>
                  <button onClick={() => setInputMode('click')}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{ background: inputMode === 'click' ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)', color: inputMode === 'click' ? '#FB923C' : 'rgba(255,255,255,0.5)', border: inputMode === 'click' ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                    <MousePointer size={14} />地图选点
                  </button>
                </div>
                {inputMode === 'click' && (
                  <div className="mt-3">
                    <input value={newPointName} onChange={e => setNewPointName(e.target.value)} placeholder="点名称（可选）"
                      className="w-full py-2 px-3 rounded-xl text-white/80 text-sm"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }} />
                  </div>
                )}
              </div>

              {/* Location list (select mode) */}
              {inputMode === 'select' && (
                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-white text-sm font-semibold">选择打卡点</div>
                    <span className="text-white/35 text-xs">{currentCheckpoints.length} 个</span>
                  </div>
                  <div className="space-y-1 max-h-[30vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {locations.map(loc => {
                      const idx = currentCheckpoints.indexOf(loc.id)
                      const selected = idx >= 0
                      return (
                        <div key={loc.id} onClick={() => toggleCheckpoint(loc.id)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all"
                          style={{ background: selected ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.02)', border: selected ? '1px solid rgba(234,179,8,0.2)' : '1px solid rgba(255,255,255,0.04)' }}>
                          <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: selected ? '#EAB308' : 'rgba(255,255,255,0.08)' }}>
                            {selected && <span className="text-white text-[10px] font-bold">{idx + 1}</span>}
                          </div>
                          <span className="text-white/70 text-xs flex-1 truncate">{loc.detailInfo || loc.category}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Checkpoint order list */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-white text-sm font-semibold">打卡顺序</div>
                  <span className="text-white/35 text-xs">{allCheckpointsOrdered.length} 个</span>
                </div>
                <div className="text-white/30 text-[10px] mb-2">拖拽调整顺序，橙色为地图选点</div>
                <div className="space-y-1 max-h-[25vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {allCheckpointsOrdered.length === 0 ? (
                    <div className="text-center text-white/20 text-xs py-4">暂无打卡点</div>
                  ) : allCheckpointsOrdered.map((item, i) => (
                    <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: item.type === 'custom' ? 'rgba(249,115,22,0.06)' : 'rgba(234,179,8,0.06)', border: `1px solid ${item.type === 'custom' ? 'rgba(249,115,22,0.15)' : 'rgba(234,179,8,0.15)'}` }}>
                      <span className="text-white/40 text-[10px] w-4 text-center">{i + 1}</span>
                      <span className="text-white/70 text-xs flex-1 truncate">{item.loc?.detailInfo || '未知'}</span>
                      {item.type === 'custom' && <span className="text-orange-400/60 text-[9px]">自定义</span>}
                      <div className="flex gap-1 flex-shrink-0">
                        {item.type === 'location' && <button onClick={() => moveCheckpoint(currentCheckpoints.indexOf(item.id as number), -1)} className="text-white/30 hover:text-white/60 text-[10px]">↑</button>}
                        {item.type === 'location' && <button onClick={() => moveCheckpoint(currentCheckpoints.indexOf(item.id as number), 1)} className="text-white/30 hover:text-white/60 text-[10px]">↓</button>}
                        {item.type === 'location' && <button onClick={() => removeCheckpoint(item.id as number)} className="text-red-400/50 hover:text-red-400"><Trash2 size={10} /></button>}
                        {item.type === 'custom' && <button onClick={() => removeCustomCheckpoint(currentCustom.findIndex(c => `custom_${currentCustom.indexOf(c)}` === item.id))} className="text-red-400/50 hover:text-red-400"><Trash2 size={10} /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={handleCalculatePath} disabled={calculating || (currentCheckpoints.length === 0 && currentCustom.length === 0)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', opacity: calculating || (currentCheckpoints.length === 0 && currentCustom.length === 0) ? 0.5 : 1 }}>
                  {calculating ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                  {calculating ? '计算中...' : '计算路线'}
                </button>
                <button onClick={handleSave} disabled={saving || currentPath.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg,#007AFF,#005DC1)', opacity: saving || currentPath.length === 0 ? 0.5 : 1 }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? '保存中...' : '保存路线'}
                </button>
              </div>

              {currentRoute && (
                <button onClick={handleDeleteRoute} className="w-full px-4 py-2 rounded-xl text-red-400 text-sm" style={{ background: 'rgba(255,59,48,0.06)' }}>
                  删除当前路线
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
