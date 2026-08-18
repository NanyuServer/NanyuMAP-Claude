'use client'
import {
  useEffect, useState, useRef, useCallback,
  type MouseEvent, type PointerEvent,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Trash2, RefreshCcw, Loader2, X, GitMerge, Star, ArrowUpDown, Box, CircleDot } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import { ROAD_TYPE_OPTIONS, SLOPE_ROAD_TYPE_OPTIONS } from '@/types'

const MAP_NATURAL: Record<string, { w: number; h: number }> = {
  junior: { w: 1560, h: 1008 },
  senior: { w: 1536, h: 1024 },
}

type Mode = 'view' | 'addNode' | 'addEdge' | 'addSlope' | 'deleteEdge' | 'deleteNode' | 'addStairwell'

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v * 10000) / 10000))
}

function snapToRectBorder(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const candidates = [
    { x: Math.max(x1, Math.min(x2, px)), y: y1 },
    { x: Math.max(x1, Math.min(x2, px)), y: y2 },
    { x: x1, y: Math.max(y1, Math.min(y2, py)) },
    { x: x2, y: Math.max(y1, Math.min(y2, py)) },
  ]
  let best = candidates[0]; let bestDist = Infinity
  for (const c of candidates) {
    const d = Math.sqrt((c.x - px) ** 2 + (c.y - py) ** 2)
    if (d < bestDist) { bestDist = d; best = c }
  }
  return best
}

interface StairwellData {
  id: number; campus: string; buildingCategory: string
  centerX: number; centerY: number
  rectX1: number; rectY1: number; rectX2: number; rectY2: number
  floors: string
  isTrunk?: boolean
  weight?: number
}

interface StairwellPoint { x: number; y: number; floors: number[] }

export default function RoadsPage(): JSX.Element {
  const [campus, setCampus] = useState<string>('junior')
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [stairwells, setStairwells] = useState<StairwellData[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [mode, setMode] = useState<Mode>('view')
  const [edgeFrom, setEdgeFrom] = useState<number | null>(null)

  const [draggingId, setDraggingId] = useState<number | null>(null)
  const dragOffsetRef = useRef<{ ox: number; oy: number } | null>(null)
  const draggingPosRef = useRef<{ x: number; y: number } | null>(null)
  const [, forceRender] = useState(0)

  const [selectedEdgeId, setSelectedEdgeId] = useState<number | null>(null)
  const [nodeEdit, setNodeEdit] = useState<{ id: number; x: string; y: string } | null>(null)
  const [swFloorEdit, setSwFloorEdit] = useState<{ swId: number; floors: Array<{ floor: number; label: string }> } | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const [renderW, setRenderW] = useState(0)
  const [renderH, setRenderH] = useState(0)

  const [stairwellCenter, setStairwellCenter] = useState<{ x: number; y: number } | null>(null)
  const [stairwellConfig, setStairwellConfig] = useState<{ buildingCategory: string; floors: number[] } | null>(null)

  const [slopeConfig, setSlopeConfig] = useState<{ fromNode: number; toNode: number; slopeFloors: number[]; roadType: string } | null>(null)

  useEffect(() => {
    const el = mapContainerRef.current
    if (!el) return
    const measure = () => { const rect = el.getBoundingClientRect(); setRenderW(rect.width); setRenderH(rect.height) }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [campus])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!mapContainerRef.current) return
      const rect = mapContainerRef.current.getBoundingClientRect()
      setRenderW(rect.width); setRenderH(rect.height)
    }, 450)
    return () => clearTimeout(t)
  }, [])

  const natural = MAP_NATURAL[campus] ?? MAP_NATURAL.junior
  const containerH = renderW > 0 ? Math.round((renderW * natural.h) / natural.w) : 400

  const fetchRoads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/roads?campus=${campus}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (res.ok) {
        setNodes(Array.isArray(data.nodes) ? data.nodes : [])
        setEdges(Array.isArray(data.edges) ? data.edges : [])
        setStairwells(Array.isArray(data.stairwells) ? data.stairwells : [])
      }
    } catch (e) { console.error('fetchRoads error', e) }
    finally { setLoading(false) }
  }, [campus])

  useEffect(() => { fetchRoads() }, [fetchRoads])
  useEffect(() => { resetAll() }, [campus])

  const resetAll = () => {
    setMode('view'); setEdgeFrom(null); setSelectedEdgeId(null); setNodeEdit(null)
    setStairwellCenter(null); setStairwellConfig(null); setSlopeConfig(null)
  }

  const postAction = async (action: string, payload: unknown) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/roads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ action, data: payload }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.details || result?.error || '操作失败')
      return result
    } finally { setActionLoading(false) }
  }

  const pixToPercent = (px: number, py: number) => ({
    x: clamp((px / renderW) * 100), y: clamp((py / containerH) * 100),
  })

  const percentToPix = (x: number, y: number) => ({
    px: (x / 100) * renderW, py: (y / 100) * containerH,
  })

  const handleMapClick = async (e: MouseEvent<HTMLDivElement>) => {
    const rect = mapContainerRef.current!.getBoundingClientRect()
    const rawX = e.clientX - rect.left; const rawY = e.clientY - rect.top
    const { x, y } = pixToPercent(rawX, rawY)

    if (mode === 'addNode') {
      try {
        const result = await postAction('add_node', { x, y, campus })
        if (result && typeof result.id === 'number') setNodes(prev => [...prev, { id: result.id, x: result.x, y: result.y, campus: result.campus }])
      } catch (err) { alert(err instanceof Error ? err.message : '添加节点失败') }
      return
    }

    if (mode === 'addStairwell') {
      if (!stairwellCenter) {
        setStairwellCenter({ x, y })
        setStairwellConfig({ buildingCategory: 'teaching_a', floors: [0, 1] })
      }
      return
    }
  }

  const handleNodeClick = async (e: MouseEvent | PointerEvent, nodeId: number) => {
    e.stopPropagation()
    if (mode === 'deleteNode') {
      if (!confirm('确定要删除该节点？关联的路径也会一并删除。')) return
      try { await postAction('delete_node', { id: nodeId }); if (edgeFrom === nodeId) setEdgeFrom(null); fetchRoads() }
      catch (err) { alert(err instanceof Error ? err.message : '删除节点失败') }
      return
    }
    if (mode === 'addEdge' || mode === 'addSlope') {
      if (edgeFrom === null) { setEdgeFrom(nodeId); return }
      if (edgeFrom === nodeId) { setEdgeFrom(null); return }
      const from = nodes.find((n: any) => n.id === edgeFrom); const to = nodes.find((n: any) => n.id === nodeId)
      if (!from || !to) return
      if (mode === 'addSlope') { setSlopeConfig({ fromNode: from.id, toNode: to.id, slopeFloors: [0, 1], roadType: 'slope_default' }); setEdgeFrom(null); return }
      try { await postAction('add_edge', { fromNode: from.id, toNode: to.id, x1: from.x, y1: from.y, x2: to.x, y2: to.y, campus }); setEdgeFrom(nodeId); await fetchRoads() }
      catch (err) { alert(err instanceof Error ? err.message : '创建路径失败'); setEdgeFrom(null) }
      return
    }
  }

  const handleNodePointerDown = (e: PointerEvent<HTMLDivElement>, nodeId: number) => {
    if (mode !== 'view') return
    e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId)
    const rect = mapContainerRef.current!.getBoundingClientRect()
    const node = nodes.find((n: any) => n.id === nodeId)!
    const { px, py } = percentToPix(node.x, node.y)
    dragOffsetRef.current = { ox: e.clientX - rect.left - px, oy: e.clientY - rect.top - py }
    draggingPosRef.current = { x: node.x, y: node.y }; setDraggingId(nodeId)
  }
  const handleNodePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (draggingId === null) return; e.stopPropagation()
    const rect = mapContainerRef.current!.getBoundingClientRect()
    const rawX = e.clientX - rect.left - (dragOffsetRef.current?.ox ?? 0)
    const rawY = e.clientY - rect.top - (dragOffsetRef.current?.oy ?? 0)
    const { x, y } = pixToPercent(rawX, rawY); draggingPosRef.current = { x, y }; forceRender(n => n + 1)
  }
  const handleNodePointerUp = async (e: PointerEvent<HTMLDivElement>, nodeId: number) => {
    if (draggingId === null) return; e.stopPropagation()
    const pos = draggingPosRef.current; setDraggingId(null); dragOffsetRef.current = null; draggingPosRef.current = null
    if (!pos) return
    try { await postAction('move_node', { id: nodeId, x: pos.x, y: pos.y }); setNodes(prev => prev.map((n: any) => n.id === nodeId ? { ...n, x: pos.x, y: pos.y } : n)) }
    catch (err) { alert(err instanceof Error ? err.message : '移动节点失败'); fetchRoads() }
  }

  const handleDeleteEdge = async (id: number) => {
    if (!confirm('确定要删除这条路径吗？')) return
    try { await postAction('delete_edge', { id }); setSelectedEdgeId(null); fetchRoads() }
    catch (err) { alert(err instanceof Error ? err.message : '删除路径失败') }
  }
  const handleEdgeClick = async (e: MouseEvent, edge: any) => {
    e.stopPropagation()
    if (mode === 'deleteEdge') { if (!confirm('确定要删除这条路径吗？')) return; await handleDeleteEdge(edge.id); return }
    setSelectedEdgeId(prev => prev === edge.id ? null : edge.id)
  }

  const handleSaveNodeEdit = async () => {
    if (!nodeEdit) return
    const x = Number(nodeEdit.x); const y = Number(nodeEdit.y)
    if (Number.isNaN(x) || Number.isNaN(y)) { alert('请输入有效数值'); return }
    try { await postAction('move_node', { id: nodeEdit.id, x: clamp(x), y: clamp(y) }); setNodes(prev => prev.map((n: any) => n.id === nodeEdit.id ? { ...n, x: clamp(x), y: clamp(y) } : n)); setNodeEdit(null); fetchRoads() }
    catch (err) { alert(err instanceof Error ? err.message : '移动节点失败') }
  }

  const setModeToggle = (m: Mode) => {
    setMode(prev => prev === m ? 'view' : m)
    setEdgeFrom(null); setSelectedEdgeId(null)
    if (m !== 'addStairwell') { setStairwellCenter(null); setStairwellConfig(null) }
    if (m !== 'addSlope') setSlopeConfig(null)
  }

  const getNodePos = (node: any) => {
    if (draggingId === node.id && draggingPosRef.current) return draggingPosRef.current
    return { x: node.x, y: node.y }
  }

  const mapSrc = campus === 'junior' ? '/assets/map.webp' : '/assets/map2-0.webp'
  const trunkEdges = edges.filter((e: any) => e.isTrunk)
  const slopeEdges = edges.filter((e: any) => e.isSlope)

  const nodeMap = new Map(nodes.map((n: any) => [n.id, n]))
  const getEdgeStairwellId = (edge: any): number | null => {
    if (!edge.isSlope) return null
    const fn = nodeMap.get(edge.fromNode); const tn = nodeMap.get(edge.toNode)
    if (fn?.stairwellId && fn.stairwellId === tn?.stairwellId) return fn.stairwellId
    return null
  }

  const groupedEdges = (() => {
    const regular: any[] = []
    const byStairwell = new Map<number, any[]>()
    const otherSlope: any[] = []
    for (const edge of edges) {
      const swId = getEdgeStairwellId(edge)
      if (swId) { if (!byStairwell.has(swId)) byStairwell.set(swId, []); byStairwell.get(swId)!.push(edge) }
      else if (edge.isSlope) otherSlope.push(edge)
      else regular.push(edge)
    }
    return { regular, byStairwell, otherSlope }
  })()

  const handleCreateStairwell = async () => {
    if (!stairwellCenter || !stairwellConfig) return
    if (stairwellConfig.floors.length === 0) { alert('请选择至少一个服务楼层'); return }
    const sw = 0.8; const sh = 0.8
    try {
      await postAction('create_stairwell', {
        campus,
        buildingCategory: stairwellConfig.buildingCategory,
        rectX1: clamp(stairwellCenter.x - sw / 2),
        rectY1: clamp(stairwellCenter.y - sh / 2),
        rectX2: clamp(stairwellCenter.x + sw / 2),
        rectY2: clamp(stairwellCenter.y + sh / 2),
        floors: stairwellConfig.floors,
        points: [{ x: clamp(stairwellCenter.x), y: clamp(stairwellCenter.y), floors: stairwellConfig.floors }],
      })
      setStairwellCenter(null); setStairwellConfig(null); setMode('view')
      fetchRoads()
    } catch (err) { alert(err instanceof Error ? err.message : '创建楼梯井失败') }
  }

  const handleCreateSlopeEdge = async () => {
    if (!slopeConfig) return
    const from = nodes.find((n: any) => n.id === slopeConfig.fromNode); const to = nodes.find((n: any) => n.id === slopeConfig.toNode)
    if (!from || !to) return
    try {
      await postAction('add_slope_edge', { fromNode: from.id, toNode: to.id, x1: from.x, y1: from.y, x2: to.x, y2: to.y, campus, slopeFloors: JSON.stringify(slopeConfig.slopeFloors), roadType: slopeConfig.roadType })
      setSlopeConfig(null); setEdgeFrom(null); setMode('view'); fetchRoads()
    } catch (err) { alert(err instanceof Error ? err.message : '创建坡度路失败') }
  }

  const handleDeleteStairwell = async (id: number) => {
    if (!confirm('确定要删除该楼梯井？所有相关节点和路径都会被删除。')) return
    try { await postAction('delete_stairwell', { id }); fetchRoads() }
    catch (err) { alert(err instanceof Error ? err.message : '删除楼梯井失败') }
  }

  const handleOpenFloorLabels = async (swId: number) => {
    try {
      const res = await fetch('/api/roads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ action: 'get_stairwell_floors', data: { stairwellId: swId } }),
      })
      const rows = await res.json()
      if (Array.isArray(rows)) {
        setSwFloorEdit({ swId, floors: rows.map((r: any) => ({ floor: r.floor, label: r.label || '' })) })
      }
    } catch { alert('获取楼层数据失败') }
  }

  const handleSaveFloorLabel = async (swId: number, floor: number, label: string) => {
    try {
      await postAction('set_stairwell_floor_label', { stairwellId: swId, floor, label })
      setSwFloorEdit(prev => prev ? { ...prev, floors: prev.floors.map(f => f.floor === floor ? { ...f, label } : f) } : null)
    } catch { alert('保存标签失败') }
  }

  const modeBtnClass = (m: Mode) =>
    `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
      mode === m
        ? m === 'addNode' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
        : m === 'addEdge' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
        : m === 'addSlope' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
        : m === 'addStairwell' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
        : m === 'deleteNode' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
        : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
        : 'bg-white/5 text-white/80 hover:bg-white/10'
    }`

  const renderEdgeRow = (edge: any) => {
    let slopeFloorLabel = ''
    if (edge.isSlope) {
      try { const sf = JSON.parse(String(edge.slopeFloors || '[]')); if (sf.length >= 2) slopeFloorLabel = `${sf[0]}F→${sf[1]}F` } catch {}
    }
    return (
      <div key={edge.id} onClick={() => setSelectedEdgeId(prev => prev === edge.id ? null : edge.id)}
        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 cursor-pointer"
        style={{
          background: selectedEdgeId === edge.id ? 'rgba(96,165,250,0.1)' : edge.isSlope ? 'rgba(168,85,247,0.04)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${selectedEdgeId === edge.id ? 'rgba(96,165,250,0.3)' : edge.isSlope ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.07)'}`,
        }}>
        <div className="flex items-center gap-2 min-w-0">
          {edge.isTrunk && <Star size={10} className="text-yellow-400 flex-shrink-0" fill="currentColor" />}
          {edge.isSlope && <ArrowUpDown size={10} className="text-purple-400 flex-shrink-0" />}
          <span className="text-white/70 text-xs truncate">{edge.fromNode} → {edge.toNode}</span>
          <span className="text-white/30 text-xs">{edge.distance.toFixed(1)}</span>
          {edge.isSlope && slopeFloorLabel && <span className="text-purple-300 text-[10px] ml-1">{slopeFloorLabel}</span>}
        </div>
        <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
          <button onClick={e => { e.stopPropagation(); postAction('set_trunk', { id: edge.id, isTrunk: !edge.isTrunk }).then(fetchRoads) }} className={`px-2 py-1 rounded-lg text-xs ${edge.isTrunk ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/5 text-white/50'}`}>{edge.isTrunk ? '主干' : '普通'}</button>
          {!edge.isSlope && (
            <select value={edge.roadType || 'default'} onClick={e => e.stopPropagation()} onChange={async e => { await postAction('set_road_type', { id: edge.id, roadType: e.target.value }); fetchRoads() }} className="px-1.5 py-1 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', cursor: 'pointer' }}>
              {(ROAD_TYPE_OPTIONS[campus] || ROAD_TYPE_OPTIONS.junior).map((opt: any) => <option key={opt.value} value={opt.value} style={{ background: '#111' }}>{opt.label}</option>)}
            </select>
          )}
          {edge.isSlope && (
            <select value={edge.roadType || 'slope_default'} onClick={e => e.stopPropagation()} onChange={async e => { await postAction('set_road_type', { id: edge.id, roadType: e.target.value }); fetchRoads() }} className="px-1.5 py-1 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(168,85,247,0.2)', color: '#fff', outline: 'none', cursor: 'pointer' }}>
              {SLOPE_ROAD_TYPE_OPTIONS.map((opt: any) => <option key={opt.value} value={opt.value} style={{ background: '#111' }}>{opt.label}</option>)}
            </select>
          )}
          {!edge.isSlope && (
            <>
              <span className="px-1.5 py-1 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.2)' }}>0F</span>
              {[1, 2, 3, 4, 5].map(f => { let ef: number[] = []; try { ef = JSON.parse(String(edge.floors || '[]')) } catch {}; const has = ef.includes(f); return <button key={f} onClick={async e => { e.stopPropagation(); const nf = has ? ef.filter((x: number) => x !== f) : [...ef, f].sort(); await postAction('set_edge_floors', { id: edge.id, floors: JSON.stringify(nf) }); fetchRoads() }} className={`px-1.5 py-1 rounded-lg text-xs ${has ? 'bg-violet-500/30 text-violet-300' : 'bg-white/5 text-white/30'}`}>{f}F</button> })}
            </>
          )}
          {edge.isSlope && (
            <>
              {[0, 1, 2, 3, 4, 5].map(f => { let sf: number[] = []; try { sf = JSON.parse(String(edge.slopeFloors || '[]')) } catch {}; const has = sf.includes(f); return <button key={f} onClick={async e => { e.stopPropagation(); const nf = has ? sf.filter((x: number) => x !== f) : [...sf, f].sort(); await postAction('set_slope_floors', { id: edge.id, slopeFloors: JSON.stringify(nf) }); fetchRoads() }} className={`px-1.5 py-1 rounded-lg text-xs ${has ? 'bg-purple-500/30 text-purple-300' : 'bg-white/5 text-white/30'}`}>{f}F</button> })}
            </>
          )}
          <button onClick={e => { e.stopPropagation(); handleDeleteEdge(edge.id) }} className="px-2 py-1 rounded-lg text-xs bg-red-500/10 text-red-300 hover:bg-red-500/20">删</button>
        </div>
      </div>
    )
  }

  return (
    <AdminShell>
      <div className="h-full flex flex-col overflow-hidden" style={{ background: '#080809' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0 flex-wrap gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,14,0.95)' }}>
          <div>
            <h1 className="text-white text-base font-semibold">初中部道路编辑</h1>
            <p className="text-white/35 text-xs mt-0.5">管理初中部道路和节点</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setModeToggle('addNode')} className={modeBtnClass('addNode')}><Plus size={15} />{mode === 'addNode' ? '点击地图…' : '添加节点'}</button>
            <button onClick={() => setModeToggle('addEdge')} className={modeBtnClass('addEdge')}><GitMerge size={15} />{mode === 'addEdge' ? (edgeFrom ? `起点:${edgeFrom}` : '选起点…') : '创建路径'}</button>
            <button onClick={() => setModeToggle('addSlope')} className={modeBtnClass('addSlope')}><ArrowUpDown size={15} />{mode === 'addSlope' ? (edgeFrom ? `起点:${edgeFrom}` : '选起点…') : '坡度道路'}</button>
            <button onClick={() => setModeToggle('addStairwell')} className={modeBtnClass('addStairwell')}><Box size={15} />{mode === 'addStairwell' ? '点击地图…' : '楼梯井'}</button>
            <button onClick={() => setModeToggle('deleteEdge')} className={modeBtnClass('deleteEdge')}><Trash2 size={15} />{mode === 'deleteEdge' ? '点击路径…' : '删除路径'}</button>
            <button onClick={() => setModeToggle('deleteNode')} className={modeBtnClass('deleteNode')}><Trash2 size={15} />{mode === 'deleteNode' ? '点击节点…' : '删除节点'}</button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button onClick={fetchRoads} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 text-sm"><RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="grid gap-5 px-6 py-5" style={{ gridTemplateColumns: '1fr 340px' }}>

            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white text-sm font-semibold">地图预览</div>
                  <div className="text-white/35 text-xs mt-0.5">
                    {mode === 'view' && '拖拽节点可移动'}
                    {mode === 'addNode' && '点击空白处添加节点'}
                    {mode === 'addEdge' && (edgeFrom ? `起点 ${edgeFrom} · 选终点` : '选起点节点')}
                    {mode === 'addSlope' && (edgeFrom ? `坡度路起点 ${edgeFrom} · 选终点` : '选坡度路起点')}
                    {mode === 'addStairwell' && (!stairwellCenter ? '点击地图放置楼梯井' : '在右侧面板配置')}
                    {mode === 'deleteEdge' && '点击路径删除'}
                    {mode === 'deleteNode' && '点击节点删除'}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/40 flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />普通节点</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />出入口</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400 inline-block" />主干道</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-400 inline-block" />坡度路</span>
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {actionLoading && <span className="text-blue-400">保存中…</span>}
                </div>
              </div>

              <div
                ref={mapContainerRef}
                className={`relative overflow-hidden rounded-xl select-none ${
                  mode === 'addNode' || mode === 'addStairwell' ? 'cursor-crosshair' :
                  mode === 'deleteEdge' || mode === 'deleteNode' ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{ width: '100%', height: containerH > 0 ? containerH : undefined, aspectRatio: containerH === 0 ? `${natural.w} / ${natural.h}` : undefined, background: '#111' }}
                onClick={handleMapClick}
              >
                <img src={mapSrc} alt="校园地图" className="absolute inset-0 w-full h-full pointer-events-none" style={{ objectFit: 'fill', display: 'block' }} draggable={false} />

                {stairwells.map(sw => {
                  const W = renderW || natural.w; const H = containerH || natural.h
                  const cx = (sw.centerX / 100) * W; const cy = (sw.centerY / 100) * H
                  return (
                    <div key={`sw-${sw.id}`} style={{ position: 'absolute', left: cx - 10, top: cy - 10, width: 20, height: 20, borderRadius: '50%', background: 'rgba(245,158,11,0.3)', border: '2px dashed rgba(245,158,11,0.7)', pointerEvents: 'none', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontSize: 8, color: '#FBBF24', fontWeight: 700 }}>#{sw.id}</div>
                    </div>
                  )
                })}

                {mode === 'addStairwell' && stairwellCenter && (() => {
                  const W = renderW || natural.w; const H = containerH || natural.h
                  const cx = (stairwellCenter.x / 100) * W; const cy = (stairwellCenter.y / 100) * H
                  return (
                    <div style={{ position: 'absolute', left: cx - 12, top: cy - 12, width: 24, height: 24, borderRadius: '50%', background: 'rgba(245,158,11,0.4)', border: '2px solid rgba(245,158,11,0.8)', pointerEvents: 'none', zIndex: 15, boxShadow: '0 2px 8px rgba(245,158,11,0.4)' }} />
                  )
                })()}

                <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }} viewBox={`0 0 ${renderW || natural.w} ${containerH || natural.h}`} preserveAspectRatio="none">
                  {edges.map((edge: any) => {
                    const fn = nodes.find((n: any) => n.id === edge.fromNode); const tn = nodes.find((n: any) => n.id === edge.toNode)
                    if (!fn || !tn) return null
                    const fp = getNodePos(fn); const tp = getNodePos(tn)
                    const W = renderW || natural.w; const H = containerH || natural.h
                    const x1 = (fp.x / 100) * W; const y1 = (fp.y / 100) * H; const x2 = (tp.x / 100) * W; const y2 = (tp.y / 100) * H
                    const isSelected = selectedEdgeId === edge.id; const isSlope = edge.isSlope
                    const strokeColor = isSlope ? '#a855f7' : edge.isTrunk ? '#facc15' : isSelected ? '#60a5fa' : '#38bdf8'
                    return (
                      <g key={edge.id} style={{ pointerEvents: 'auto' }}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} onClick={ev => handleEdgeClick(ev as unknown as MouseEvent, edge)} style={{ cursor: 'pointer' }} />
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={strokeColor} strokeWidth={isSelected ? 3 : 2} strokeDasharray={isSlope ? '6 3' : undefined} style={{ pointerEvents: 'none' }} />
                        {isSelected && <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={5} fill={isSlope ? '#a855f7' : '#60a5fa'} style={{ pointerEvents: 'none' }} />}
                      </g>
                    )
                  })}
                </svg>

                {nodes.map((node: any) => {
                  const pos = getNodePos(node); const W = renderW || natural.w; const H = containerH || natural.h
                  const left = (pos.x / 100) * W - 7; const top = (pos.y / 100) * H - 7
                  const isDragging = draggingId === node.id; const isEdgeFrom = edgeFrom === node.id; const isSW = node.stairwellId != null
                  return (
                    <div key={node.id} style={{
                      position: 'absolute', left, top, width: 14, height: 14, borderRadius: '50%',
                      background: isEdgeFrom ? '#34d399' : isDragging ? '#f59e0b' : isSW ? '#f59e0b' : '#38bdf8',
                      border: `2px solid ${isEdgeFrom ? '#6ee7b7' : isDragging ? '#fcd34d' : isSW ? '#fbbf24' : 'rgba(255,255,255,0.7)'}`,
                      cursor: mode === 'view' ? (isDragging ? 'grabbing' : 'grab') : mode === 'addEdge' || mode === 'addSlope' ? 'pointer' : mode === 'deleteNode' ? 'pointer' : 'default',
                      zIndex: isDragging ? 60 : 30, touchAction: 'none', pointerEvents: 'auto',
                    }}
                    onPointerDown={e => { if (mode === 'view') handleNodePointerDown(e, node.id) }}
                    onPointerMove={e => { if (mode === 'view') handleNodePointerMove(e) }}
                    onPointerUp={e => { if (mode === 'view') handleNodePointerUp(e, node.id) }}
                    onClick={e => { if (mode !== 'view') handleNodeClick(e, node.id) }}
                    title={`节点 ${node.id} (${node.x.toFixed(1)}, ${node.y.toFixed(1)})${isSW ? ` 井#${node.stairwellId} F${node.stairwellFloor} ${node.stairwellRole}` : ''}`} />
                  )
                })}

                {mode !== 'view' && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg" style={{ background: 'rgba(0,0,0,0.78)', color: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(6px)', whiteSpace: 'nowrap' }}>
                      {mode === 'addNode' && '点击空白处添加节点'}
                      {mode === 'addEdge' && (edgeFrom ? `起点: ${edgeFrom} · 点击目标节点` : '点击第一个节点')}
                      {mode === 'addSlope' && (edgeFrom ? `坡度路起点: ${edgeFrom} · 点击终点` : '点击起点节点')}
                      {mode === 'addStairwell' && (!stairwellCenter ? '点击地图放置楼梯井中心' : '请在右侧配置面板操作')}
                      {mode === 'deleteEdge' && '点击路径删除'}
                      {mode === 'deleteNode' && '点击节点删除'}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 pt-1 text-xs text-white/35">
                <span>{nodes.length} 节点</span><span>{edges.length} 路径</span>
                <span className="text-yellow-400/70">{trunkEdges.length} 主干道</span>
                <span className="text-purple-400/70">{slopeEdges.length} 坡度路</span>
                <span className="text-amber-400/70">{stairwells.length} 楼梯井</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-white text-sm font-semibold">节点列表</div>
                  <div className="text-white/35 text-xs">{nodes.length} 个</div>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                  {nodes.length === 0 ? <div className="text-center text-white/30 text-xs py-6">暂无节点</div> : nodes.map((node: any) => (
                    <div key={node.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div>
                        <span className="text-white/90 text-xs font-medium">节点 {node.id}</span>
                        <span className="text-white/35 text-xs ml-2">({node.x.toFixed(1)}, {node.y.toFixed(1)})</span>
                        {node.stairwellId != null && <span className="ml-2 text-amber-400 text-[10px]">井#{node.stairwellId} F{node.stairwellFloor} {node.stairwellRole}</span>}
                        {node.buildingCategory && <span className="ml-1.5 text-amber-400/60 text-[10px]">{node.buildingCategory}</span>}
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => setNodeEdit({ id: node.id, x: node.x.toString(), y: node.y.toString() })} className="px-2 py-1 rounded-lg text-xs bg-white/5 text-white/70 hover:bg-white/10">编辑</button>
                        <button onClick={() => { if (confirm('确定删除?')) { postAction('delete_node', { id: node.id }).then(fetchRoads) } }} className="px-2 py-1 rounded-lg text-xs bg-red-500/10 text-red-300 hover:bg-red-500/20">删</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {stairwells.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="text-amber-300 text-xs font-semibold mb-3">楼梯井权重设置</div>
                  <div className="space-y-1.5">
                    {stairwells.map(sw => (
                      <div key={sw.id} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-amber-300 text-xs font-medium">#{sw.id}</span>
                            <span className="text-white/50 text-xs ml-2">{sw.buildingCategory}</span>
                            <span className="text-white/30 text-xs ml-2">{(() => { try { return JSON.parse(sw.floors).join(',') } catch { return '' } })()}F</span>
                          </div>
                          <div className="flex gap-1.5">
                            <div className="flex items-center gap-1">
                              <span className="text-white/30 text-[10px]">权重</span>
                              <select
                                value={sw.weight ?? 0}
                                onChange={e => { postAction('set_stairwell_weight', { id: sw.id, weight: Number(e.target.value) }).then(fetchRoads) }}
                                className="px-1 py-0.5 rounded text-[10px]"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', cursor: 'pointer' }}
                              >
                                {[0,1,2,3,4,5,6,7,8,9,10].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </div>
                            <button onClick={async () => { await postAction('toggle_stairwell_trunk', { id: sw.id, isTrunk: !sw.isTrunk }); fetchRoads() }} className={`px-2 py-1 rounded-lg text-xs transition-colors ${sw.isTrunk ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-white/10'}`}>
                              {sw.isTrunk ? '已开启楼层出入口' : '开启设置出入口楼层'}
                            </button>
                            <button onClick={() => handleDeleteStairwell(sw.id)} className="px-2 py-1 rounded-lg text-xs bg-red-500/10 text-red-300 hover:bg-red-500/20">删</button>
                          </div>
                        </div>
                        {sw.isTrunk && (
                          <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(245,158,11,0.1)' }}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-white/40 text-[10px]">每层设置一个出入口</span>
                              <button onClick={() => handleOpenFloorLabels(sw.id)} className="px-2 py-1 rounded-lg text-[10px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30">编辑楼口名称</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
                <div className="text-purple-300 text-xs font-semibold mb-2">楼梯井说明</div>
                <div className="text-white/40 text-xs leading-relaxed space-y-1">
                  <div>1. 点击「楼梯井」→ 点击地图放置中心点</div>
                  <div>2. 选择建筑类型和服务楼层</div>
                  <div>3. 系统自动生成每层的道路节点和跨层连接</div>
                  <div>4. 管理员可用「创建路径」将节点与普通道路相连</div>
                </div>
              </div>
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <div className="flex items-center gap-2 mb-2"><Star size={12} className="text-yellow-400" fill="currentColor" /><div className="text-yellow-300 text-xs font-semibold">主干道说明</div></div>
                <div className="text-white/40 text-xs leading-relaxed">主干道显示为<span className="text-yellow-400">黄色</span>，导航算法优先走主干道。</div>
              </div>
            </div>
          </div>

          <div className="px-6 pb-5">
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-white text-sm font-semibold">路径列表</div>
                <div className="text-white/35 text-xs">{edges.length} 条</div>
              </div>
              <div className="overflow-x-auto">
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                  {edges.length === 0 && <div className="text-center text-white/30 text-xs py-6">暂无路径</div>}

                  {groupedEdges.regular.length > 0 && (
                    <div>
                      <div className="text-white/50 text-xs font-medium mb-1.5 px-1">普通路径 ({groupedEdges.regular.length})</div>
                      <div className="space-y-1">{groupedEdges.regular.map(renderEdgeRow)}</div>
                    </div>
                  )}

                  {Array.from(groupedEdges.byStairwell.entries()).map(([swId, swEdges]) => {
                    const sw = stairwells.find(s => s.id === swId)
                    return (
                      <div key={`sw-edges-${swId}`}>
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                          <Box size={11} className="text-amber-400" />
                          <span className="text-amber-300 text-xs font-medium">楼梯井 #{swId}</span>
                          {sw && <span className="text-white/30 text-[10px]">{sw.buildingCategory}</span>}
                          <span className="text-white/25 text-[10px]">({swEdges.length})</span>
                        </div>
                        <div className="space-y-1">{swEdges.map(renderEdgeRow)}</div>
                      </div>
                    )
                  })}

                  {groupedEdges.otherSlope.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 px-1">
                        <ArrowUpDown size={11} className="text-purple-400" />
                        <span className="text-purple-300 text-xs font-medium">独立坡度路 ({groupedEdges.otherSlope.length})</span>
                      </div>
                      <div className="space-y-1">{groupedEdges.otherSlope.map(renderEdgeRow)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {nodeEdit && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-end justify-center pb-8 z-50" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setNodeEdit(null)}>
              <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} className="w-full max-w-sm mx-4 rounded-2xl p-5 shadow-2xl" style={{ background: 'rgba(18,18,24,0.98)', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div><div className="text-white text-sm font-semibold">编辑节点 {nodeEdit.id}</div><div className="text-white/35 text-xs">精确修改坐标（0–100）</div></div>
                  <button onClick={() => setNodeEdit(null)} className="text-white/40 hover:text-white"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <label className="block text-white/50 text-xs">X 坐标<input value={nodeEdit.x} onChange={e => setNodeEdit(p => p ? { ...p, x: e.target.value } : null)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white text-sm" /></label>
                  <label className="block text-white/50 text-xs">Y 坐标<input value={nodeEdit.y} onChange={e => setNodeEdit(p => p ? { ...p, y: e.target.value } : null)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white text-sm" /></label>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setNodeEdit(null)} className="px-4 py-2 rounded-xl bg-white/5 text-white/70 text-sm">取消</button>
                  <button onClick={handleSaveNodeEdit} className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium">保存</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {slopeConfig && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-end justify-center pb-8 z-50" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => { setSlopeConfig(null); setEdgeFrom(null) }}>
              <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} className="w-full max-w-sm mx-4 rounded-2xl p-5 shadow-2xl" style={{ background: 'rgba(18,18,24,0.98)', border: '1px solid rgba(168,85,247,0.2)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div><div className="text-white text-sm font-semibold">创建坡度路</div><div className="text-white/35 text-xs">节点 {slopeConfig.fromNode} → {slopeConfig.toNode}</div></div>
                  <button onClick={() => { setSlopeConfig(null); setEdgeFrom(null) }} className="text-white/40 hover:text-white"><X size={16} /></button>
                </div>
                <div className="mb-4">
                  <div className="text-white/50 text-xs mb-2">连接楼层</div>
                  <div className="flex flex-wrap gap-2">
                    {[0, 1, 2, 3, 4, 5].map(f => <button key={f} onClick={() => setSlopeConfig(p => p ? { ...p, slopeFloors: p.slopeFloors.includes(f) ? p.slopeFloors.filter(x => x !== f) : [...p.slopeFloors, f].sort() } : null)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${slopeConfig.slopeFloors.includes(f) ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/50'}`}>{f}楼</button>)}
                  </div>
                </div>
                <div className="mb-4">
                  <div className="text-white/50 text-xs mb-2">道路类型</div>
                  <select value={slopeConfig.roadType} onChange={e => setSlopeConfig(p => p ? { ...p, roadType: e.target.value } : null)} className="w-full py-2 px-3 rounded-xl text-white/90 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}>
                    {SLOPE_ROAD_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value} style={{ background: '#111' }}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setSlopeConfig(null); setEdgeFrom(null) }} className="px-4 py-2 rounded-xl bg-white/5 text-white/70 text-sm">取消</button>
                  <button onClick={handleCreateSlopeEdge} disabled={slopeConfig.slopeFloors.length < 2} className="px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium disabled:opacity-40">创建</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {mode === 'addStairwell' && stairwellCenter && stairwellConfig && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-end justify-center pb-8 z-50" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => { setStairwellCenter(null); setStairwellConfig(null); setMode('view') }}>
              <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} className="w-full max-w-sm mx-4 rounded-2xl p-5 shadow-2xl" style={{ background: 'rgba(18,18,24,0.98)', border: '1px solid rgba(245,158,11,0.2)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div><div className="text-white text-sm font-semibold">创建楼梯井</div><div className="text-white/35 text-xs">选择建筑类型和服务楼层，系统自动生成跨层道路节点</div></div>
                  <button onClick={() => { setStairwellCenter(null); setStairwellConfig(null); setMode('view') }} className="text-white/40 hover:text-white"><X size={16} /></button>
                </div>
                <div className="mb-4">
                  <div className="text-white/50 text-xs mb-2">建筑类型</div>
                  <select value={stairwellConfig.buildingCategory} onChange={e => setStairwellConfig(p => p ? { ...p, buildingCategory: e.target.value } : null)} className="w-full py-2 px-3 rounded-xl text-white/90 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}>
                    <option value="teaching_a" style={{ background: '#111' }}>教学楼A栋</option>
                    <option value="teaching_b" style={{ background: '#111' }}>教学楼B栋</option>
                    <option value="teaching_c" style={{ background: '#111' }}>教学楼C栋</option>
                    <option value="admin" style={{ background: '#111' }}>行政楼</option>
                  </select>
                </div>
                <div className="mb-4">
                  <div className="text-white/50 text-xs mb-2">服务楼层</div>
                  <div className="flex flex-wrap gap-2">
                    {[0, 1, 2, 3, 4, 5].map(f => <button key={f} onClick={() => setStairwellConfig(p => p ? { ...p, floors: p.floors.includes(f) ? p.floors.filter(x => x !== f) : [...p.floors, f].sort() } : null)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${stairwellConfig.floors.includes(f) ? 'bg-amber-500 text-white' : 'bg-white/5 text-white/50'}`}>{f}楼</button>)}
                  </div>
                </div>
                <div className="mb-3 rounded-xl px-3 py-2" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div className="text-amber-300 text-xs">位置：({stairwellCenter.x.toFixed(1)}, {stairwellCenter.y.toFixed(1)})</div>
                  <div className="text-white/30 text-[10px] mt-0.5">将在每层生成道路节点，可与普通道路连接</div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setStairwellCenter(null); setStairwellConfig(null); setMode('view') }} className="px-4 py-2 rounded-xl bg-white/5 text-white/70 text-sm">取消</button>
                  <button onClick={handleCreateStairwell} disabled={stairwellConfig.floors.length === 0} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium disabled:opacity-40">创建楼梯井</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {swFloorEdit && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-end justify-center pb-8 z-50" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setSwFloorEdit(null)}>
              <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} className="w-full max-w-md mx-4 rounded-2xl p-5 shadow-2xl" style={{ background: 'rgba(18,18,24,0.98)', border: '1px solid rgba(245,158,11,0.2)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div><div className="text-white text-sm font-semibold">编辑楼梯井 #{swFloorEdit.swId} 楼口</div><div className="text-white/35 text-xs">为每个楼层设置楼口名称，如"1楼口"、"2楼口"</div></div>
                  <button onClick={() => setSwFloorEdit(null)} className="text-white/40 hover:text-white"><X size={16} /></button>
                </div>
                <div className="space-y-3 mb-4">
                  {swFloorEdit.floors.map(f => (
                    <div key={f.floor} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}>
                      <span className="text-amber-300 text-xs font-medium w-8">{f.floor}楼</span>
                      <input
                        value={f.label}
                        placeholder={`例：${f.floor}楼口`}
                        onChange={e => {
                          const newLabel = e.target.value
                          setSwFloorEdit(prev => prev ? { ...prev, floors: prev.floors.map(x => x.floor === f.floor ? { ...x, label: newLabel } : x) } : null)
                        }}
                        onBlur={e => handleSaveFloorLabel(swFloorEdit.swId, f.floor, e.target.value)}
                        className="flex-1 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/20"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setSwFloorEdit(null)} className="px-4 py-2 rounded-xl bg-white/5 text-white/70 text-sm">关闭</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminShell>
  )
}
