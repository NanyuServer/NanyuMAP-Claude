'use client'
// src/app/admin/locations/page.tsx
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, MapPin, Edit3, Check, X, Search, Layers, Flag, Navigation, SlidersHorizontal } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import { LOCATION_CATEGORIES, FLOOR_BUILDINGS, DEFAULT_FLOORS, NAV_START_POINTS, DEFAULT_NAV_SETTINGS } from '@/types'
import type { NavGlobalSettings } from '@/types'
import { normalizeNavSettings } from '@/lib/navSettings'
import type { Location } from '@prisma/client'

const MAP_SIZES: Record<string, { w: number; h: number }> = {
  junior: { w: 1560, h: 1008 },
  senior: { w: 1536, h: 1024 },
}

const FLOOR_PLAN_SIZE = { w: 1024, h: 329 }

function getMapAspect(campus: string, floor?: number | null) {
  if (campus === 'junior') return MAP_SIZES.junior.w / MAP_SIZES.junior.h
  if (floor && floor >= 1 && floor <= 5) return FLOOR_PLAN_SIZE.w / FLOOR_PLAN_SIZE.h
  return MAP_SIZES.senior.w / MAP_SIZES.senior.h
}

interface FormData {
  category: string
  detailInfo: string
  extraInfo: string
  x: number | null
  y: number | null
  floor: number | null
  isNavigable: boolean
}

const emptyForm = (): FormData => ({
  category: LOCATION_CATEGORIES.junior[0],
  detailInfo: '',
  extraInfo: '',
  x: null,
  y: null,
  floor: null,
  isNavigable: true,
})

function getMapSrc(campus: string, floor?: number | null): string {
  if (campus === 'junior') return '/assets/map.webp'
  if (floor && floor >= 1 && floor <= 5) return `/assets/floor/map2-${floor}.webp`
  return '/assets/map2-0.webp'
}

export default function LocationsPage(): JSX.Element {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [showBatch, setShowBatch] = useState(false)
  const [batchRows, setBatchRows] = useState<FormData[]>([])
  const [activeBatchIndex, setActiveBatchIndex] = useState<number | null>(null)
  const [batchSaving, setBatchSaving] = useState(false)
  const [campus, setCampus] = useState<string>('junior')
  const [categories, setCategories] = useState<string[] | null>(null)
  const [showCategoriesModal, setShowCategoriesModal] = useState(false)
  const [editingCats, setEditingCats] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [batchCommonCategory, setBatchCommonCategory] = useState<string | null>(null)
  const [filterQ, setFilterQ] = useState('')
  const defaultCategories = LOCATION_CATEGORIES[campus] || LOCATION_CATEGORIES.junior
  const [showBatchFloor, setShowBatchFloor] = useState(false)
  const [batchFloorSelectedIds, setBatchFloorSelectedIds] = useState<Set<number>>(new Set())
  const [batchFloorValue, setBatchFloorValue] = useState<number>(0)
  const [batchFloorSaving, setBatchFloorSaving] = useState(false)
  const [batchFloorCategoryFilter, setBatchFloorCategoryFilter] = useState<string | null>(null)
  const [showStartPointModal, setShowStartPointModal] = useState(false)
  const [editingStartPoint, setEditingStartPoint] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement | null>(null)

  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameRows, setRenameRows] = useState<{ id: number; original: string; newName: string }[]>([])
  const [renameSaving, setRenameSaving] = useState(false)

  const [showNavSettings, setShowNavSettings] = useState(false)
  const [navSettings, setNavSettings] = useState<NavGlobalSettings>(DEFAULT_NAV_SETTINGS)
  const [navSaving, setNavSaving] = useState(false)

  const openNavSettings = async () => {
    setShowNavSettings(true)
    try {
      const res = await fetch('/api/system/settings', { credentials: 'same-origin' })
      const data = await res.json()
      setNavSettings(normalizeNavSettings(data.navSettings))
    } catch {
      setNavSettings(DEFAULT_NAV_SETTINGS)
    }
  }

  const saveNavSettings = async () => {
    setNavSaving(true)
    try {
      const res = await fetch('/api/system/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ navSettings: JSON.stringify(navSettings) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '保存失败')
      setShowNavSettings(false)
    } catch (e) {
      alert(`保存失败: ${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setNavSaving(false)
    }
  }

  const START_POINTS = ['大门', '一楼', '二楼', '三楼', '四楼', '五楼']

  const fetchLocations = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/locations?campus=${campus}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) {
        console.error('Failed to fetch locations:', data)
        setLocations([])
      } else {
        setLocations(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Error fetching locations:', e)
      setLocations([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/categories?campus=${campus}&t=${Date.now()}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (Array.isArray(data)) setCategories(data)
    } catch (e) {
      setCategories(null)
    }
  }

  useEffect(() => { fetchLocations(); fetchCategories() }, [campus])

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = mapRef.current!.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const relY = e.clientY - rect.top
    // Convert to percentage coordinates (0-100)
    const percentX = (relX / rect.width) * 100
    const percentY = (relY / rect.height) * 100
    setForm(f => ({ ...f, x: Math.round(percentX * 10) / 10, y: Math.round(percentY * 10) / 10 }))
  }

  const handleBatchMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeBatchIndex === null) return
    const rect = mapRef.current!.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const relY = e.clientY - rect.top
    const percentX = Math.round((relX / rect.width) * 1000) / 10
    const percentY = Math.round((relY / rect.height) * 1000) / 10
    setBatchRows(rows => rows.map((r, i) => i === activeBatchIndex ? ({ ...r, x: percentX, y: percentY }) : r))
  }

  const addBatchRow = () => {
    setBatchRows(prev => {
      const defaultCat = batchCommonCategory ?? (categories && categories.length ? categories[0] : defaultCategories[0])
      const newRow: FormData = { ...emptyForm(), category: defaultCat }
      const next = [...prev, newRow]
      setActiveBatchIndex(next.length - 1)
      return next
    })
  }

  const removeBatchRow = (index: number) => {
    setBatchRows(prev => {
      const next = prev.filter((_, i) => i !== index)
      setActiveBatchIndex(prevIdx => {
        if (prevIdx === null) return null
        if (prevIdx === index) return null
        return prevIdx > index ? prevIdx - 1 : prevIdx
      })
      return next
    })
  }

  const handleBatchSave = async () => {
    if (batchRows.length === 0) {
      alert('请先添加至少一个地点')
      return
    }
    // validate each row
    for (const r of batchRows) {
      if (!r.category || r.x === null || r.y === null) {
        alert('请为每个地点选择类型并在地图上选点')
        return
      }
    }
    setBatchSaving(true)
    try {
      const payload = batchRows.map(r => ({
        category: r.category,
        detailInfo: r.detailInfo && String(r.detailInfo).trim() ? r.detailInfo : r.category,
        extraInfo: r.extraInfo && String(r.extraInfo).trim() ? r.extraInfo : null,
        x: r.x,
        y: r.y,
        campus,
        floor: r.floor,
      }))

      const res = await fetch('/api/locations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        const errorMsg = data.details || data.error || '保存失败'
        throw new Error(errorMsg)
      }
      setShowBatch(false)
      setBatchRows([])
      setActiveBatchIndex(null)
      fetchLocations()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '批量保存失败'
      alert(`批量保存失败: ${msg}`)
      console.error('Batch save error:', e)
    } finally {
      setBatchSaving(false)
    }
  }

  const handleSave = async () => {
    if (!form.category || form.x === null || form.y === null) {
      alert('请选择地点类型并在地图上选点')
      return
    }
    setSaving(true)
    try {
      const url = editId ? `/api/locations/${editId}` : '/api/locations'
      const method = editId ? 'PUT' : 'POST'
      const payload = {
        category: form.category,
        detailInfo: form.detailInfo && String(form.detailInfo).trim() ? form.detailInfo : form.category,
        extraInfo: form.extraInfo && String(form.extraInfo).trim() ? form.extraInfo : null,
        x: form.x,
        y: form.y,
        floor: form.floor,
        isNavigable: form.isNavigable,
      }

      console.log(`Saving location with ${method} to ${url}:`, { ...payload, campus })
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...payload, campus }),
      })
      const data = await res.json()
      console.log(`Location save response (${method}):`, res.status, data)
      
      if (!res.ok) {
        const errorMsg = data.details || data.error || '保存失败'
        throw new Error(errorMsg)
      }
      setShowForm(false)
      setEditId(null)
      setForm(emptyForm())
      fetchLocations()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '保存失败'
      console.error('Save error:', e)
      alert(`保存失败: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (loc: Location) => {
    setForm({ category: loc.category, detailInfo: loc.detailInfo, extraInfo: loc.extraInfo || '', x: loc.x, y: loc.y, floor: loc.floor ?? null, isNavigable: (loc as any).isNavigable ?? true })
    setEditId(loc.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该地点？')) return
    const res = await fetch(`/api/locations/${id}`, { method: 'DELETE', credentials: 'same-origin' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(`删除失败: ${data?.details || data?.error || '服务器返回错误'}`)
      return
    }
    fetchLocations()
  }

  const filtered = locations.filter(l =>
    !filterQ || l.category.includes(filterQ) || l.detailInfo.includes(filterQ) || (l.extraInfo || '').includes(filterQ)
  )

  const toggleBatchFloorSelect = (id: number) => {
    setBatchFloorSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const batchFloorSelectAll = () => {
    const targetLocations = batchFloorCategoryFilter
      ? locations.filter(l => l.category === batchFloorCategoryFilter)
      : locations
    setBatchFloorSelectedIds(new Set(targetLocations.map(l => l.id)))
  }

  const batchFloorClearAll = () => {
    setBatchFloorSelectedIds(new Set())
  }

  const handleBatchFloorSave = async () => {
    if (batchFloorSelectedIds.size === 0) {
      alert('请至少选择一个地点')
      return
    }
    setBatchFloorSaving(true)
    try {
      const res = await fetch('/api/locations/bulk-floor', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ids: Array.from(batchFloorSelectedIds), floor: batchFloorValue }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.details || data?.error || '操作失败')
      }
      setShowBatchFloor(false)
      setBatchFloorSelectedIds(new Set())
      fetchLocations()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '批量设置楼层失败'
      alert(`保存失败: ${msg}`)
      console.error('Batch floor save error:', e)
    } finally {
      setBatchFloorSaving(false)
    }
  }

  const openRenameModal = () => {
    setRenameRows(locations.map(l => ({ id: l.id, original: l.detailInfo || l.category, newName: l.detailInfo || l.category })))
    setShowRenameModal(true)
  }

  const handleRenameSave = async () => {
    const payload = renameRows
      .filter(r => {
        const name = (r.newName || '').trim()
        return name && name !== r.original
      })
      .map(r => ({ id: r.id, name: (r.newName || '').trim() }))
    if (payload.length === 0) {
      setShowRenameModal(false)
      return
    }
    setRenameSaving(true)
    try {
      const res = await fetch('/api/locations/bulk-rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ renames: payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.details || data?.error || '操作失败')
      }
      setShowRenameModal(false)
      setRenameRows([])
      fetchLocations()
      fetchCategories()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '批量修改失败'
      alert(`批量修改失败: ${msg}`)
      console.error('Batch rename error:', e)
    } finally {
      setRenameSaving(false)
    }
  }

  const handleStartPointMapPick = async (percentX: number, percentY: number) => {
    const name = editingStartPoint
    if (!name) return
    const spFloor = DEFAULT_FLOORS[name] ?? null
    try {
      // Delete any existing entry with same category+campus, then create fresh
      const check = await fetch(`/api/locations?campus=${campus}&t=${Date.now()}`, { credentials: 'same-origin' })
      const allLocs = await check.json()
      const existing = Array.isArray(allLocs) ? allLocs.find((l: any) => l.category === name) : null
      if (existing) {
        await fetch(`/api/locations/${existing.id}`, { method: 'DELETE', credentials: 'same-origin' })
      }
      await fetch('/api/locations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ category: name, detailInfo: name, x: percentX, y: percentY, campus, floor: spFloor }),
      })
      fetchLocations()
      setEditingStartPoint(null)
    } catch (e) {
      alert('保存起点坐标失败')
    }
  }

  // Pass editingStartPoint to map click
  const handleMapClickWithStartPoint = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editingStartPoint) {
      const rect = e.currentTarget.getBoundingClientRect()
      const percentX = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10
      const percentY = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10
      handleStartPointMapPick(percentX, percentY)
      return
    }
    handleMapClick(e)
  }

  const pinX = form.x !== null
  const pinY = form.y !== null

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
              onClick={() => { setForm({ ...emptyForm(), category: categories && categories.length ? categories[0] : defaultCategories[0] }); setEditId(null); setShowForm(true) }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
              style={{ background: 'linear-gradient(135deg,#007AFF,#005DC1)', boxShadow: '0 4px 12px rgba(0,122,255,0.3)' }}
            >
              <Plus size={15} />
              新增地点
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { setBatchRows([{ ...emptyForm(), category: categories && categories.length ? categories[0] : defaultCategories[0] }]); setActiveBatchIndex(0); setShowBatch(true) }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
              style={{ background: 'linear-gradient(135deg,#22C55E,#16A34A)', boxShadow: '0 4px 12px rgba(34,197,94,0.18)' }}
            >
              <Plus size={15} />
              批量新增
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { setBatchFloorSelectedIds(new Set()); setBatchFloorValue(0); setBatchFloorCategoryFilter(null); setShowBatchFloor(true) }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <Layers size={15} />
              批量设置楼层
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={openRenameModal}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <Edit3 size={15} />
              批量修改地点名称
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { setEditingCats(categories && categories.length ? [...categories] : [...defaultCategories]); setShowCategoriesModal(true) }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              编辑一级地点
            </motion.button>
            {campus === 'senior' && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { setShowStartPointModal(true); setEditingStartPoint(null) }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-medium"
              style={{ background: 'rgba(168,85,247,0.15)' }}
            >
              <Flag size={15} className="text-violet-400" />
              导航起点设置
            </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={openNavSettings}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <SlidersHorizontal size={15} />
              导航全局设置
            </motion.button>
            <select value={campus} onChange={e => setCampus(e.target.value === 'senior' ? 'senior' : 'junior')} className="rounded-xl py-2 px-3 text-sm bg-white/5">
              <option value="junior">初中部</option>
              <option value="senior">高中部</option>
            </select>
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
                        onChange={e => {
                          const cat = e.target.value
                          const defaultFloor = DEFAULT_FLOORS[cat]
                          setForm(f => ({ ...f, category: cat, floor: defaultFloor ?? (FLOOR_BUILDINGS[cat] ? null : null) }))
                        }}
                        className="w-full py-2.5 px-3 rounded-xl text-white/90 text-sm"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                      >
                        {(categories || defaultCategories).map(c => (
                          <option key={c} value={c} style={{ background: '#111115' }}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Floor selector */}
                    {(FLOOR_BUILDINGS[form.category] || campus === 'senior') && (
                      <div>
                        <label className="text-white/50 text-xs font-medium mb-2 block">楼层 *</label>
                        <select
                          value={form.floor ?? ''}
                          onChange={e => setForm(f => ({ ...f, floor: e.target.value ? Number(e.target.value) : null }))}
                          className="w-full py-2.5 px-3 rounded-xl text-white/90 text-sm"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                        >
                          <option value="" style={{ background: '#111115' }}>请选择楼层</option>
                          {(FLOOR_BUILDINGS[form.category] || [1, 2, 3, 4, 5]).map(f => (
                            <option key={f} value={f} style={{ background: '#111115' }}>{f}楼</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Navigable toggle - only for primary locations */}
                    {(!form.detailInfo || form.detailInfo === form.category) && (
                      <div className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div>
                          <div className="text-white/70 text-xs font-medium">作为导航项</div>
                          <div className="text-white/30 text-[10px] mt-0.5">关闭后搜索栏无法搜索到此地点</div>
                        </div>
                        <button
                          onClick={() => setForm(f => ({ ...f, isNavigable: !f.isNavigable }))}
                          className="relative w-10 h-5 rounded-full transition-colors"
                          style={{ background: form.isNavigable ? '#007AFF' : 'rgba(255,255,255,0.15)' }}
                        >
                          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: form.isNavigable ? 22 : 2 }} />
                        </button>
                      </div>
                    )}

                    {/* Detail info */}
                    <div>
                      <label className="text-white/50 text-xs font-medium mb-2 block">地点详细信息 <span className="text-white/35 text-xs">(可选)</span></label>
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
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={form.x !== null ? String(form.x) : ''}
                          onChange={e => {
                            const v = parseFloat(e.target.value)
                            if (!isNaN(v) && v >= 0 && v <= 100) setForm(f => ({ ...f, x: Math.round(v * 10) / 10 }))
                            else if (e.target.value === '') setForm(f => ({ ...f, x: null }))
                          }}
                          placeholder="输入X坐标或点击地图"
                          className="w-full py-2.5 px-3 rounded-xl text-white/80 text-sm placeholder-white/20"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-white/50 text-xs font-medium mb-2 block">Y坐标</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={form.y !== null ? String(form.y) : ''}
                          onChange={e => {
                            const v = parseFloat(e.target.value)
                            if (!isNaN(v) && v >= 0 && v <= 100) setForm(f => ({ ...f, y: Math.round(v * 10) / 10 }))
                            else if (e.target.value === '') setForm(f => ({ ...f, y: null }))
                          }}
                          placeholder="输入Y坐标或点击地图"
                          className="w-full py-2.5 px-3 rounded-xl text-white/80 text-sm placeholder-white/20"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
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
                      onClick={handleMapClickWithStartPoint}
                      className="relative rounded-xl overflow-hidden cursor-crosshair"
                      style={{ width: '100%', aspectRatio: `${getMapAspect(campus, form.floor)}`, border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <img
                        src={getMapSrc(campus, form.floor)}
                        alt="地图"
                        style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }}
                        draggable={false}
                      />

                      {/* Existing pins */}
                      {locations.filter(l => l.id !== editId).map(loc => (
                        <div
                          key={loc.id}
                          style={{
                            position: 'absolute',
                            left: `${loc.x}%`,
                            top: `${loc.y}%`,
                            transform: 'translate(-50%,-50%)',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#A855F7',
                            border: '1px solid rgba(255,255,255,0.8)',
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
                            left: `${form.x}%`,
                            top: `${form.y}%`,
                            transform: 'translate(-50%,-50%)',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: '#A855F7',
                            border: '2px solid rgba(255,255,255,0.9)',
                            boxShadow: '0 1px 4px rgba(119,58,218,0.3)',
                          }}
                        />
                      )}

                      {form.x === null && (
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

          {/* Categories edit modal */}
          <AnimatePresence>
            {showCategoriesModal && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 rounded-2xl overflow-hidden"
                style={{ background: 'rgba(16,16,22,0.95)', border: '1px solid rgba(0,122,255,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <h2 className="text-white font-semibold text-sm">编辑一级地点</h2>
                  <button onClick={() => setShowCategoriesModal(false)} className="text-white/40 hover:text-white/70 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-6 grid gap-4">
                  <div className="space-y-2">
                    {editingCats.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={c} onChange={e => setEditingCats(prev => prev.map((p, idx) => idx === i ? e.target.value : p))} className="flex-1 py-2 px-3 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.03)' }} />
                        <button onClick={() => setEditingCats(prev => prev.filter((_, idx) => idx !== i))} className="px-3 py-2 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.02)' }}>删除</button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="新增一级地点名称" className="flex-1 py-2 px-3 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.03)' }} />
                    <button onClick={() => {
                      const v = (newCategory || '').trim()
                      if (!v) return
                      setEditingCats(prev => [...prev, v])
                      setNewCategory('')
                    }} className="px-4 py-2 rounded-xl text-sm" style={{ background: 'linear-gradient(135deg,#07C1A6,#06A78E)' }}>添加</button>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button onClick={() => setShowCategoriesModal(false)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">取消</button>
                    <button onClick={async () => {
                      try {
                        console.log('Saving categories for campus:', campus, 'categories:', editingCats)
                        const res = await fetch('/api/categories', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'same-origin',
                          body: JSON.stringify({ campus, categories: editingCats }),
                        })
                        const data = await res.json()
                        console.log('Categories save response:', res.status, data)
                        if (!res.ok) {
                          const errorMsg = data?.details || data?.error || '保存失败'
                          throw new Error(errorMsg)
                        }
                        await fetchCategories()
                        setShowCategoriesModal(false)
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : '保存分类失败'
                        console.error('Save categories error:', err)
                        alert(msg)
                      }
                    }} className="rounded-2xl bg-sky-500 px-4 py-2 text-sm text-white">保存</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Batch form modal */}
          <AnimatePresence>
                {showBatch && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 rounded-2xl overflow-hidden"
                style={{ background: 'rgba(16,16,22,0.95)', border: '1px solid rgba(0,122,255,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <h2 className="text-white font-semibold text-sm">批量新增地点</h2>
                  <button onClick={() => setShowBatch(false)} className="text-white/40 hover:text-white/70 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-6 grid grid-cols-2 gap-6">
                  <div className="col-span-2 mb-2">
                    <label className="text-white/50 text-xs font-medium mb-2 block">批量一级地点（适用于新增多个同类详细地点）</label>
                      <select value={batchCommonCategory || ''} onChange={e => setBatchCommonCategory(e.target.value || null)} className="w-1/2 py-2 px-3 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <option value="">-- 不使用统一类型 --</option>
                      {(categories || defaultCategories).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  {/* Left: rows */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="text-white/50 text-xs">批量地点条目</div>
                      <div className="flex items-center gap-2">
                        <button onClick={addBatchRow} className="px-3 py-1 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>添加一行</button>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {batchRows.map((row, i) => (
                        <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: activeBatchIndex === i ? '1px solid rgba(0,122,255,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-white/80 text-sm">条目 #{i + 1}</div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setActiveBatchIndex(i) }} className="px-2 py-1 rounded text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>选点</button>
                              <button onClick={() => removeBatchRow(i)} className="px-2 py-1 rounded text-sm text-red-400" style={{ background: 'rgba(255,255,255,0.02)' }}>删除</button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {batchCommonCategory ? (
                              <div className="py-2 px-2 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>{batchCommonCategory}</div>
                            ) : (
                              <select value={row.category} onChange={e => { const cat = e.target.value; const df = DEFAULT_FLOORS[cat]; setBatchRows(rows => rows.map((r, idx) => idx === i ? ({ ...r, category: cat, floor: df ?? r.floor }) : r)) }} className="py-2 px-2 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                {(categories || defaultCategories).map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            )}
                            <input value={row.detailInfo} onChange={e => setBatchRows(rows => rows.map((r, idx) => idx === i ? ({ ...r, detailInfo: e.target.value }) : r))} placeholder="地点详细信息（可选）" className="py-2 px-2 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.03)' }} />
                          </div>

                          <div className="mt-2">
                            <textarea value={row.extraInfo} onChange={e => setBatchRows(rows => rows.map((r, idx) => idx === i ? ({ ...r, extraInfo: e.target.value }) : r))} placeholder="补充信息（可选）" rows={2} className="w-full py-2 px-2 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.03)' }} />
                          </div>

                          <div className="flex gap-2 mt-2">
                            <input type="number" step="0.1" min="0" max="100" value={row.x !== null ? String(row.x) : ''} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0 && v <= 100) setBatchRows(rows => rows.map((r, idx) => idx === i ? ({ ...r, x: Math.round(v * 10) / 10 }) : r)); else if (e.target.value === '') setBatchRows(rows => rows.map((r, idx) => idx === i ? ({ ...r, x: null }) : r)) }} placeholder="X坐标" className="flex-1 py-2 px-2 rounded-xl text-sm text-white/80" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }} />
                            <input type="number" step="0.1" min="0" max="100" value={row.y !== null ? String(row.y) : ''} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0 && v <= 100) setBatchRows(rows => rows.map((r, idx) => idx === i ? ({ ...r, y: Math.round(v * 10) / 10 }) : r)); else if (e.target.value === '') setBatchRows(rows => rows.map((r, idx) => idx === i ? ({ ...r, y: null }) : r)) }} placeholder="Y坐标" className="flex-1 py-2 px-2 rounded-xl text-sm text-white/80" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }} />
                          </div>
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            <span className="text-white/30 text-[10px] self-center mr-1">楼层</span>
                            {[0, 1, 2, 3, 4, 5].map(f => (
                              <button
                                key={f}
                                onClick={() => setBatchRows(rows => rows.map((r, idx) => idx === i ? ({ ...r, floor: r.floor === f ? null : f }) : r))}
                                className="px-2 py-1 rounded-lg text-[11px] font-medium transition-all"
                                style={{
                                  background: row.floor === f ? 'rgba(0,122,255,0.2)' : 'rgba(255,255,255,0.04)',
                                  border: row.floor === f ? '1px solid rgba(0,122,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
                                  color: row.floor === f ? '#60A5FA' : 'rgba(255,255,255,0.35)',
                                }}
                              >
                                {f}F
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      {activeBatchIndex !== null && batchRows[activeBatchIndex] && batchRows[activeBatchIndex].x !== null && batchRows[activeBatchIndex].y !== null && (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            const src = batchRows[activeBatchIndex!]
                            if (src.x === null || src.y === null) return
                            setBatchRows(rows => rows.map(r => ({ ...r, x: src.x, y: src.y })))
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
                          style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 12px rgba(139,92,246,0.25)' }}
                        >
                          坐标运用到全部地点
                        </motion.button>
                      )}
                      <motion.button whileTap={{ scale: 0.97 }} onClick={handleBatchSave} disabled={batchSaving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg,#07C1A6,#06A78E)' }}>{batchSaving ? '保存中...' : '提交全部'}</motion.button>
                      <button onClick={() => { setShowBatch(false); setBatchRows([]); setActiveBatchIndex(null) }} className="px-4 py-2 rounded-xl text-white/70 text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>取消</button>
                    </div>
                  </div>

                  {/* Right: map picker */}
                  <div>
                    <label className="text-white/50 text-xs font-medium mb-2 block">地图选点（先在左侧选择条目后，点击地图标注）</label>
                    <div ref={mapRef} onClick={handleBatchMapClick} className="relative rounded-xl overflow-hidden cursor-crosshair" style={{ width: '100%', aspectRatio: `${getMapAspect(campus, activeBatchIndex != null ? batchRows[activeBatchIndex]?.floor : null)}`, border: '1px solid rgba(255,255,255,0.1)' }}>
                      <img
                        src={getMapSrc(campus, activeBatchIndex != null ? batchRows[activeBatchIndex]?.floor : null)}
                        alt="地图"
                        style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }}
                        draggable={false}
                      />

                      {/* Existing pins */}
                      {locations.filter(l => l.id !== editId).map(loc => (
                        <div key={loc.id} style={{ position: 'absolute', left: `${loc.x}%`, top: `${loc.y}%`, transform: 'translate(-50%,-50%)', width: 6, height: 6, borderRadius: '50%', background: '#A855F7', border: '1px solid rgba(255,255,255,0.8)' }} />
                      ))}

                      {/* Batch unsaved pins */}
                      {batchRows.map((r, i) => r.x !== null && r.y !== null && (
                        <div key={`batch-${i}`} style={{
                          position: 'absolute',
                          left: `${r.x}%`,
                          top: `${r.y}%`,
                          transform: 'translate(-50%,-50%)',
                          zIndex: 30,
                          width: i === activeBatchIndex ? 10 : 8,
                          height: i === activeBatchIndex ? 10 : 8,
                          borderRadius: '50%',
                          background: i === activeBatchIndex ? '#A855F7' : 'rgba(168,85,247,0.6)',
                          border: '1.5px solid rgba(255,255,255,0.9)',
                          boxShadow: i === activeBatchIndex ? '0 1px 4px rgba(119,58,218,0.3)' : 'none',
                        }} />
                      ))}

                      {/* Current pin indicator for active row */}
                      {activeBatchIndex !== null && batchRows[activeBatchIndex] && batchRows[activeBatchIndex].x !== null && (
                        <div style={{
                          position: 'absolute',
                          left: `${batchRows[activeBatchIndex].x}%`,
                          top: `${batchRows[activeBatchIndex].y}%`,
                          transform: 'translate(-50%,-50%)',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: '#A855F7',
                          border: '2px solid rgba(255,255,255,0.9)',
                          boxShadow: '0 2px 6px rgba(119,58,218,0.4)',
                        }}
                      />
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Start point setting modal - senior campus */}
          <AnimatePresence>
            {showStartPointModal && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 rounded-2xl overflow-hidden"
                style={{ background: 'rgba(16,16,22,0.95)', border: '1px solid rgba(168,85,247,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <h2 className="text-white font-semibold text-sm">导航起点设置（高中部）</h2>
                  <button onClick={() => { setShowStartPointModal(false); setEditingStartPoint(null) }} className="text-white/40 hover:text-white/70 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                {editingStartPoint ? (
                  <div className="p-6">
                    {(() => {
                      const spFloor = DEFAULT_FLOORS[editingStartPoint] ?? null
                      const spMapSrc = getMapSrc(campus, spFloor)
                      const spAspect = getMapAspect(campus, spFloor)
                      const existingId = locations.find(loc => loc.category === editingStartPoint)?.id
                      const sameFloorLocs = spFloor
                        ? locations.filter(l => l.floor === spFloor && l.id !== existingId)
                        : locations.filter(l => l.id !== existingId)
                      return (
                        <>
                          <p className="text-violet-300 text-sm mb-3">正在设置 &quot;{editingStartPoint}&quot; 的坐标，请在下方{spFloor ? `${spFloor}楼平面图` : '地图'}上点击</p>
                          <div
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              const percentX = ((e.clientX - rect.left) / rect.width) * 100
                              const percentY = ((e.clientY - rect.top) / rect.height) * 100
                              handleStartPointMapPick(percentX, percentY)
                            }}
                            className="relative rounded-xl overflow-hidden cursor-crosshair mb-3"
                            style={{ width: '100%', aspectRatio: `${spAspect}`, border: '1px solid rgba(168,85,247,0.3)' }}
                          >
                            <img
                              src={spMapSrc}
                              alt={`${editingStartPoint} 地图`}
                              style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }}
                              draggable={false}
                            />
                            {sameFloorLocs.map(loc => (
                              <div key={loc.id} style={{ position: 'absolute', left: `${loc.x}%`, top: `${loc.y}%`, transform: 'translate(-50%,-50%)', width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', border: '1.5px solid rgba(255,255,255,0.8)' }} />
                            ))}
                            {(() => {
                              const loc = locations.find(l => l.category === editingStartPoint)
                              if (loc) return <div style={{ position: 'absolute', left: `${loc.x}%`, top: `${loc.y}%`, transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', background: '#A855F7', border: '2px solid white', boxShadow: '0 0 8px rgba(168,85,247,0.6)' }} />
                              return null
                            })()}
                          </div>
                          <div className="flex gap-3">
                            <button onClick={() => setEditingStartPoint(null)} className="px-4 py-2 rounded-xl bg-white/5 text-white/70 text-sm">取消选择</button>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="p-6 grid gap-3">
                    {START_POINTS.map(name => {
                      const loc = locations.find(l => l.category === name)
                      const spFloor = DEFAULT_FLOORS[name]
                      return (
                        <div key={name} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <div className="flex items-center gap-3">
                            <Flag size={14} className="text-violet-400" />
                            <span className="text-white/80 text-sm">{name}</span>
                            {spFloor && <span className="text-white/30 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.1)' }}>{spFloor}楼平面图</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            {loc ? (
                              <span className="text-white/40 text-xs">x:{loc.x.toFixed(1)} y:{loc.y.toFixed(1)}</span>
                            ) : (
                              <span className="text-red-400/60 text-xs">未设置</span>
                            )}
                            <button
                              onClick={() => setEditingStartPoint(name)}
                              className="px-3 py-1.5 rounded-lg text-xs text-white/80"
                              style={{ background: 'rgba(168,85,247,0.15)' }}
                            >设置坐标</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Batch floor modal */}
          <AnimatePresence>
            {showBatchFloor && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 rounded-2xl overflow-hidden"
                style={{ background: 'rgba(16,16,22,0.95)', border: '1px solid rgba(255,140,0,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <h2 className="text-white font-semibold text-sm">批量设置楼层</h2>
                  <button onClick={() => setShowBatchFloor(false)} className="text-white/40 hover:text-white/70 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-6">
                  {/* Controls row */}
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    <div>
                      <label className="text-white/50 text-xs block mb-1.5">设置楼层为</label>
                      <select
                        value={batchFloorValue}
                        onChange={e => setBatchFloorValue(Number(e.target.value))}
                        className="py-2 px-3 rounded-xl text-white/90 text-sm"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                      >
                        <option value={0} style={{ background: '#111115' }}>0楼</option>
                        {[1, 2, 3, 4, 5].map(f => (
                          <option key={f} value={f} style={{ background: '#111115' }}>{f}楼</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-white/50 text-xs block mb-1.5">按类型筛选</label>
                      <select
                        value={batchFloorCategoryFilter || ''}
                        onChange={e => { setBatchFloorCategoryFilter(e.target.value || null); setBatchFloorSelectedIds(new Set()) }}
                        className="py-2 px-3 rounded-xl text-white/90 text-sm"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                      >
                        <option value="" style={{ background: '#111115' }}>全部类型</option>
                        {(categories || defaultCategories).map(c => (
                          <option key={c} value={c} style={{ background: '#111115' }}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end gap-2" style={{ paddingTop: 11 }}>
                      <button
                        onClick={batchFloorSelectAll}
                        className="px-3 py-1.5 rounded-lg text-xs text-white/70"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      >全选</button>
                      <button
                        onClick={batchFloorClearAll}
                        className="px-3 py-1.5 rounded-lg text-xs text-white/50"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >清空</button>
                    </div>
                  </div>

                  {/* Location checklist */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto mb-4">
                    {(batchFloorCategoryFilter
                      ? locations.filter(l => l.category === batchFloorCategoryFilter)
                      : locations
                    ).map(loc => (
                      <label
                        key={loc.id}
                        className="flex items-center gap-2 p-2 rounded-lg cursor-pointer"
                        style={{
                          background: batchFloorSelectedIds.has(loc.id)
                            ? 'rgba(255,140,0,0.12)'
                            : 'rgba(255,255,255,0.02)',
                          border: batchFloorSelectedIds.has(loc.id)
                            ? '1px solid rgba(255,140,0,0.3)'
                            : '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={batchFloorSelectedIds.has(loc.id)}
                          onChange={() => toggleBatchFloorSelect(loc.id)}
                          className="w-4 h-4 rounded accent-orange-500"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-white/80 text-xs truncate block">{loc.detailInfo}</span>
                          <span className="text-white/30 text-[10px]">{loc.category} · {loc.floor != null ? `${loc.floor}楼` : '0楼'}</span>
                        </div>
                      </label>
                    ))}
                    {locations.filter(l => !batchFloorCategoryFilter || l.category === batchFloorCategoryFilter).length === 0 && (
                      <div className="col-span-2 text-center text-white/30 text-xs py-4">无匹配地点</div>
                    )}
                  </div>

                  {/* Bottom actions */}
                  <div className="flex items-center justify-between">
                    <div className="text-white/35 text-xs">
                      已选 {batchFloorSelectedIds.size} 个地点 · 将设为 {batchFloorValue}楼
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowBatchFloor(false)}
                        className="px-4 py-2 rounded-xl text-white/50 text-sm"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >取消</button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleBatchFloorSave}
                        disabled={batchFloorSaving || batchFloorSelectedIds.size === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
                        style={{
                          background: 'linear-gradient(135deg,#F97316,#EA580C)',
                          boxShadow: '0 4px 12px rgba(249,115,22,0.25)',
                          opacity: batchFloorSaving || batchFloorSelectedIds.size === 0 ? 0.6 : 1,
                        }}
                      >
                        <Check size={15} />
                        {batchFloorSaving ? '保存中...' : '确认设置'}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Batch rename locations modal */}
          <AnimatePresence>
            {showRenameModal && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 rounded-2xl overflow-hidden"
                style={{ background: 'rgba(16,16,22,0.95)', border: '1px solid rgba(0,122,255,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <h2 className="text-white font-semibold text-sm">批量修改地点名称</h2>
                  <button onClick={() => setShowRenameModal(false)} className="text-white/40 hover:text-white/70 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-6">
                  <p className="text-white/40 text-xs mb-4">
                    当前 {campus === 'senior' ? '高中部' : '初中部'} 地点数据已作为「原数据」展示在左侧，请在右侧为新地点名称填写内容，留空或与原数据相同则不修改。
                  </p>
                  <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <th className="text-left px-4 py-3 text-white/60 font-medium text-xs w-1/2 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>原数据地点名称</th>
                          <th className="text-left px-4 py-3 text-white/60 font-medium text-xs w-1/2">新地点名称</th>
                        </tr>
                      </thead>
                      <tbody>
                        {renameRows.map((row, i) => (
                          <tr key={row.id} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                            <td className="px-4 py-2 border-r align-middle" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                              <span className="text-white/80 text-sm">{row.original}</span>
                            </td>
                            <td className="px-4 py-2 align-middle">
                              <input
                                value={row.newName}
                                onChange={e => setRenameRows(prev => prev.map((r, idx) => idx === i ? { ...r, newName: e.target.value } : r))}
                                placeholder="填写新名称"
                                className="w-full py-2 px-3 rounded-xl text-white/90 text-sm placeholder-white/20"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {renameRows.length === 0 && (
                      <div className="text-center text-white/25 text-xs py-8">暂无地点数据</div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-4">
                    <button onClick={() => setShowRenameModal(false)} className="px-4 py-2 rounded-xl text-white/70 text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      取消
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleRenameSave}
                      disabled={renameSaving}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
                      style={{ background: 'linear-gradient(135deg,#007AFF,#005DC1)', boxShadow: '0 4px 12px rgba(0,122,255,0.25)', opacity: renameSaving ? 0.6 : 1 }}
                    >
                      <Check size={15} />
                      {renameSaving ? '保存中...' : '应用修改'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation global settings modal */}
          <AnimatePresence>
            {showNavSettings && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 rounded-2xl overflow-hidden"
                style={{ background: 'rgba(16,16,22,0.95)', border: '1px solid rgba(0,122,255,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <h2 className="text-white font-semibold text-sm">导航全局设置</h2>
                  <button onClick={() => setShowNavSettings(false)} className="text-white/40 hover:text-white/70 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {(['junior', 'senior'] as const).map(c => (
                    <div key={c} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-white text-sm font-semibold mb-3">{c === 'junior' ? '初中部' : '高中部'}</div>

                      <div className="space-y-2 mb-3">
                        {NAV_START_POINTS[c].map(p => (
                          <div key={p} className="flex items-center justify-between">
                            <span className="text-white/70 text-sm">{p}</span>
                            <button
                              onClick={() => setNavSettings(prev => ({ ...prev, [c]: { ...prev[c], startPoints: { ...prev[c].startPoints, [p]: !prev[c].startPoints[p] } } }))}
                              style={{ width: 40, height: 22, borderRadius: 11, background: navSettings[c].startPoints[p] ? '#007AFF' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.15s', border: 'none', cursor: 'pointer' }}
                            >
                              <div style={{ position: 'absolute', top: 2, left: navSettings[c].startPoints[p] ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10 }}>
                        <span className="text-white/70 text-sm">从当前位置出发</span>
                        <button
                          onClick={() => setNavSettings(prev => ({ ...prev, [c]: { ...prev[c], useCurrentLocation: !prev[c].useCurrentLocation } }))}
                          style={{ width: 40, height: 22, borderRadius: 11, background: navSettings[c].useCurrentLocation ? '#007AFF' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.15s', border: 'none', cursor: 'pointer' }}
                        >
                          <div style={{ position: 'absolute', top: 2, left: navSettings[c].useCurrentLocation ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10 }}>
                        <span className="text-white/70 text-sm">在地图上点击位置作为起点</span>
                        <button
                          onClick={() => setNavSettings(prev => ({ ...prev, [c]: { ...prev[c], allowClickStart: !prev[c].allowClickStart } }))}
                          style={{ width: 40, height: 22, borderRadius: 11, background: navSettings[c].allowClickStart ? '#007AFF' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.15s', border: 'none', cursor: 'pointer' }}
                        >
                          <div style={{ position: 'absolute', top: 2, left: navSettings[c].allowClickStart ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                        </button>
                      </div>

                      <div>
                        <div className="text-white/40 text-xs mb-2">地理坐标（可选，用于"从当前位置出发"定位换算）</div>
                        <div className="grid grid-cols-3 gap-2">
                          {(['originLat', 'originLng', 'metersPerWidth'] as const).map(field => (
                            <input
                              key={field}
                              type="number"
                              step="any"
                              placeholder={field === 'originLat' ? '原点纬度' : field === 'originLng' ? '原点经度' : '地图宽度(米)'}
                              value={navSettings[c].geo && navSettings[c].geo![field] ? navSettings[c].geo![field] : ''}
                              onChange={e => {
                                const v = parseFloat(e.target.value)
                                const geo = navSettings[c].geo ? { ...navSettings[c].geo!, [field]: v } : { originLat: 0, originLng: 0, metersPerWidth: 0, [field]: v }
                                setNavSettings(prev => ({ ...prev, [c]: { ...prev[c], geo } }))
                              }}
                              className="w-full px-2 py-1.5 rounded-lg text-white/80 text-xs"
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <button onClick={() => setShowNavSettings(false)} className="px-4 py-2 rounded-xl text-white/70 text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    取消
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={saveNavSettings}
                    disabled={navSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
                    style={{ background: 'linear-gradient(135deg,#007AFF,#005DC1)', boxShadow: '0 4px 12px rgba(0,122,255,0.25)', opacity: navSaving ? 0.6 : 1 }}
                  >
                    <Check size={15} />
                    {navSaving ? '保存中...' : '保存'}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Locations list - grouped by category */}
          {loading ? (
            <div className="text-center text-white/30 py-20">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-white/25 py-20">
              <MapPin size={32} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm">暂无地点，点击"新增地点"开始标注</div>
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                const grouped: Record<string, typeof filtered> = {}
                for (const loc of filtered) {
                  if (!grouped[loc.category]) grouped[loc.category] = []
                  grouped[loc.category].push(loc)
                }
                const categoryOrder = categories || defaultCategories
                const sortedKeys = Object.keys(grouped).sort((a, b) => {
                  const ai = categoryOrder.indexOf(a)
                  const bi = categoryOrder.indexOf(b)
                  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
                })
                return sortedKeys.map(cat => (
                  <div key={cat}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-blue-400 text-sm font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(0,122,255,0.1)', border: '1px solid rgba(0,122,255,0.2)' }}>
                        {cat}
                      </span>
                      <span className="text-white/30 text-xs">{grouped[cat].length} 个地点</span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {grouped[cat].map((loc, i) => (
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
                              <div className="flex items-center gap-2">
                                <div className="text-white/90 text-sm font-medium truncate">{loc.detailInfo}</div>
                                {loc.detailInfo === loc.category && !(loc as any).isNavigable && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">不可导航</span>
                                )}
                              </div>
                              {loc.extraInfo && <div className="text-white/35 text-xs mt-0.5 truncate">{loc.extraInfo}</div>}
                              <div className="text-white/20 text-xs mt-1.5">x:{Math.round(loc.x)} y:{Math.round(loc.y)}</div>
                              <span className="text-white/25 text-[10px] mt-0.5 inline-block">{loc.floor != null ? `${loc.floor}楼` : '0楼'}</span>
                            </div>
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {loc.detailInfo === loc.category && (
                                <button
                                  onClick={async () => {
                                    const newVal = !(loc as any).isNavigable
                                    try {
                                      await fetch(`/api/locations/${loc.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'same-origin',
                                        body: JSON.stringify({ isNavigable: newVal }),
                                      })
                                      fetchLocations()
                                    } catch {}
                                  }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                                  style={{ background: (loc as any).isNavigable ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)' }}
                                  title={(loc as any).isNavigable ? '点击关闭导航' : '点击开启导航'}
                                >
                                  <Navigation size={12} className={(loc as any).isNavigable ? 'text-emerald-400' : 'text-white/30'} />
                                </button>
                              )}
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
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
