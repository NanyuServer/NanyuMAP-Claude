'use client'
// src/app/admin/locations/page.tsx
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, MapPin, Edit3, Check, X, Search } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import { LOCATION_CATEGORIES } from '@/types'
import type { Location } from '@/types'

const MAP_DISPLAY_W = 640
const MAP_DISPLAY_H = 427
const MAP_REAL_W = 2400
const MAP_REAL_H = 1600

interface FormData {
  category: string
  detailInfo: string
  extraInfo: string
  x: number | null
  y: number | null
}

const emptyForm = (): FormData => ({
  category: LOCATION_CATEGORIES[0],
  detailInfo: '',
  extraInfo: '',
  x: null,
  y: null,
})

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [filterQ, setFilterQ] = useState('')
  const mapRef = useRef<HTMLDivElement>(null)

  const fetchLocations = async () => {
    setLoading(true)
    const res = await fetch('/api/locations')
    const data = await res.json()
    setLocations(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchLocations() }, [])

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = mapRef.current!.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const relY = e.clientY - rect.top
    const realX = (relX / MAP_DISPLAY_W) * MAP_REAL_W
    const realY = (relY / MAP_DISPLAY_H) * MAP_REAL_H
    setForm(f => ({ ...f, x: realX, y: realY }))
  }

  const handleSave = async () => {
    if (!form.category || !form.detailInfo || form.x === null || form.y === null) {
      alert('请填写完整信息并在地图上选点')
      return
    }
    setSaving(true)
    try {
      const url = editId ? `/api/locations/${editId}` : '/api/locations'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('保存失败')
      setShowForm(false)
      setEditId(null)
      setForm(emptyForm())
      fetchLocations()
    } catch (e) {
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (loc: Location) => {
    setForm({ category: loc.category, detailInfo: loc.detailInfo, extraInfo: loc.extraInfo || '', x: loc.x, y: loc.y })
    setEditId(loc.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该地点？')) return
    await fetch(`/api/locations/${id}`, { method: 'DELETE' })
    fetchLocations()
  }

  const filtered = locations.filter(l =>
    !filterQ || l.category.includes(filterQ) || l.detailInfo.includes(filterQ) || (l.extraInfo || '').includes(filterQ)
  )

  const pinX = form.x !== null ? (form.x / MAP_REAL_W) * MAP_DISPLAY_W : null
  const pinY = form.y !== null ? (form.y / MAP_REAL_H) * MAP_DISPLAY_H : null

  return (
    <AdminShell>
      <div className="h-full flex flex-col admin-scroll" style={{ background: '#0a0a0c' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,14,0.8)' }}>
          <div>
            <h1 className="text-white text-lg font-semibold">地点管理</h1>
            <p className="text-white/35 text-xs mt-0.5">共 {locations.length} 个地点</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={filterQ}
                onChange={e => setFilterQ(e.target.value)}
                placeholder="搜索地点..."
                className="pl-8 pr-3 py-2 rounded-xl text-white/80 text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', width: 180 }}
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { setForm(emptyForm()); setEditId(null); setShowForm(true) }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
              style={{ background: 'linear-gradient(135deg,#007AFF,#005DC1)', boxShadow: '0 4px 12px rgba(0,122,255,0.3)' }}
            >
              <Plus size={15} />
              新增地点
            </motion.button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Form modal */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 rounded-2xl overflow-hidden"
                style={{ background: 'rgba(16,16,22,0.95)', border: '1px solid rgba(0,122,255,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <h2 className="text-white font-semibold text-sm">{editId ? '编辑地点' : '新增地点'}</h2>
                  <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white/70 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-6 grid grid-cols-2 gap-6">
                  {/* Left: form fields */}
                  <div className="flex flex-col gap-4">
                    {/* Category */}
                    <div>
                      <label className="text-white/50 text-xs font-medium mb-2 block">地点类型 *</label>
                      <select
                        value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full py-2.5 px-3 rounded-xl text-white/90 text-sm"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                      >
                        {LOCATION_CATEGORIES.map(c => (
                          <option key={c} value={c} style={{ background: '#111115' }}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Detail info */}
                    <div>
                      <label className="text-white/50 text-xs font-medium mb-2 block">地点详细信息 *</label>
                      <input
                        value={form.detailInfo}
                        onChange={e => setForm(f => ({ ...f, detailInfo: e.target.value }))}
                        placeholder="例：校务办公室（行政楼二楼213）"
                        className="w-full py-2.5 px-3 rounded-xl text-white/90 text-sm placeholder-white/20"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                      />
                    </div>

                    {/* Extra info */}
                    <div>
                      <label className="text-white/50 text-xs font-medium mb-2 block">地点补充信息</label>
                      <textarea
                        value={form.extraInfo}
                        onChange={e => setForm(f => ({ ...f, extraInfo: e.target.value }))}
                        placeholder="例：校务办理、招生咨询、学生事务"
                        rows={2}
                        className="w-full py-2.5 px-3 rounded-xl text-white/90 text-sm placeholder-white/20 resize-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                      />
                    </div>

                    {/* Coordinates */}
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-white/50 text-xs font-medium mb-2 block">X坐标</label>
                        <input
                          value={form.x !== null ? Math.round(form.x) : ''}
                          readOnly
                          placeholder="点击地图选点"
                          className="w-full py-2.5 px-3 rounded-xl text-white/50 text-sm"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', outline: 'none' }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-white/50 text-xs font-medium mb-2 block">Y坐标</label>
                        <input
                          value={form.y !== null ? Math.round(form.y) : ''}
                          readOnly
                          placeholder="点击地图选点"
                          className="w-full py-2.5 px-3 rounded-xl text-white/50 text-sm"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', outline: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Save button */}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold mt-1"
                      style={{ background: 'linear-gradient(135deg,#007AFF,#005DC1)', boxShadow: '0 4px 12px rgba(0,122,255,0.25)', opacity: saving ? 0.6 : 1 }}
                    >
                      <Check size={15} />
                      {saving ? '保存中...' : '保存地点'}
                    </motion.button>
                  </div>

                  {/* Right: map picker */}
                  <div>
                    <label className="text-white/50 text-xs font-medium mb-2 block">地图选点 * <span className="text-white/25">（点击地图标记位置）</span></label>
                    <div
                      ref={mapRef}
                      onClick={handleMapClick}
                      className="relative rounded-xl overflow-hidden cursor-crosshair"
                      style={{ width: MAP_DISPLAY_W, height: MAP_DISPLAY_H, maxWidth: '100%', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <img
                        src="/assets/map.png"
                        alt="地图"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                        draggable={false}
                      />

                      {/* Existing pins */}
                      {locations.filter(l => l.id !== editId).map(loc => (
                        <div
                          key={loc.id}
                          style={{
                            position: 'absolute',
                            left: (loc.x / MAP_REAL_W) * MAP_DISPLAY_W,
                            top: (loc.y / MAP_REAL_H) * MAP_DISPLAY_H,
                            transform: 'translate(-50%,-50%)',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.5)',
                            border: '1.5px solid rgba(255,255,255,0.8)',
                          }}
                        />
                      ))}

                      {/* Current pin */}
                      {pinX !== null && pinY !== null && (
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          style={{
                            position: 'absolute',
                            left: pinX,
                            top: pinY,
                            transform: 'translate(-50%,-100%)',
                          }}
                        >
                          <MapPin size={24} className="text-blue-400" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,122,255,0.6))' }} />
                        </motion.div>
                      )}

                      {!form.x && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="text-white/40 text-xs bg-black/30 px-3 py-1.5 rounded-lg">点击地图选择位置</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Locations list */}
          {loading ? (
            <div className="text-center text-white/30 py-20">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-white/25 py-20">
              <MapPin size={32} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm">暂无地点，点击"新增地点"开始标注</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((loc, i) => (
                <motion.div
                  key={loc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-xl p-4 group"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,122,255,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-blue-400 text-xs px-2 py-0.5 rounded-md" style={{ background: 'rgba(0,122,255,0.12)', border: '1px solid rgba(0,122,255,0.2)' }}>
                          {loc.category}
                        </span>
                      </div>
                      <div className="text-white/90 text-sm font-medium truncate">{loc.detailInfo}</div>
                      {loc.extraInfo && <div className="text-white/35 text-xs mt-0.5 truncate">{loc.extraInfo}</div>}
                      <div className="text-white/20 text-xs mt-1.5">x:{Math.round(loc.x)} y:{Math.round(loc.y)}</div>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(loc)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: 'rgba(0,122,255,0.1)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.1)')}
                      >
                        <Edit3 size={12} className="text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: 'rgba(255,69,58,0.1)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,69,58,0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,69,58,0.1)')}
                      >
                        <Trash2 size={12} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
