'use client'
import {
  useEffect, useState, useRef, useCallback,
  type MouseEvent, type PointerEvent,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Layers, Route, Box, Plus, Trash2, RefreshCcw, Loader2, X,
  GitMerge, Copy, Save, ChevronDown, MapPin,
} from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'

const ELEVATION_NATURAL = { w: 1536, h: 1024 }
const FLOOR_NATURAL = { w: 1024, h: 329 }
const FLOOR_NUMBERS = [1, 2, 3, 4, 5]
const FLOOR_COLORS = [
  'rgba(59,130,246,0.35)',
  'rgba(16,185,129,0.35)',
  'rgba(245,158,11,0.35)',
  'rgba(239,68,68,0.35)',
  'rgba(168,85,247,0.35)',
]
const FLOOR_BORDER_COLORS = [
  'rgba(59,130,246,0.7)',
  'rgba(16,185,129,0.7)',
  'rgba(245,158,11,0.7)',
  'rgba(239,68,68,0.7)',
  'rgba(168,85,247,0.7)',
]

type Tab = 'markers' | 'roads' | 'stairwells'
type RoadMode = 'view' | 'addNode' | 'addEdge' | 'deleteEdge' | 'deleteNode'

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v * 10000) / 10000))
}

interface FloorMarker {
  id: number; campus: string; floor: number
  x: number; y: number; w: number; h: number
}

interface StairwellData {
  id: number; campus: string; buildingCategory: string
  centerX: number; centerY: number
  rectX1: number; rectY1: number; rectX2: number; rectY2: number
  floors: string; isTrunk?: boolean; weight?: number
}

interface StairwellFloorData {
  id: number; stairwellId: number; floor: number
  x: number; y: number
  rectX1: number; rectY1: number; rectX2: number; rectY2: number
  entryX: number | null; entryY: number | null
  exitX: number | null; exitY: number | null
  targetFloor1?: number | null
  targetFloor2?: number | null
}

export default function FloorsPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('markers')
  const [campus, setCampus] = useState<string>('senior')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // ─── Tab 1: Floor Markers ───
  const [markers, setMarkers] = useState<FloorMarker[]>([])
  const [selectedFloor, setSelectedFloor] = useState<number>(1)
  const [markerDrawing, setMarkerDrawing] = useState(false)
  const [markerRect, setMarkerRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const markerStartRef = useRef<{ x: number; y: number } | null>(null)
  const elevationRef = useRef<HTMLDivElement | null>(null)
  const [elevW, setElevW] = useState(0)
  const [elevH, setElevH] = useState(0)

  // ─── Tab 2: Floor Roads ───
  const [roadFloor, setRoadFloor] = useState<number>(1)
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [roadMode, setRoadMode] = useState<RoadMode>('view')
  const [edgeFrom, setEdgeFrom] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const dragOffsetRef = useRef<{ ox: number; oy: number } | null>(null)
  const draggingPosRef = useRef<{ x: number; y: number } | null>(null)
  const [, forceRender] = useState(0)
  const [selectedEdgeId, setSelectedEdgeId] = useState<number | null>(null)
  const [nodeEdit, setNodeEdit] = useState<{ id: number; x: string; y: string } | null>(null)
  const floorMapRef = useRef<HTMLDivElement | null>(null)
  const [floorMapW, setFloorMapW] = useState(0)
  const [floorMapH, setFloorMapH] = useState(0)
  const [roadFloorSWData, setRoadFloorSWData] = useState<StairwellFloorData[]>([])

  // ─── Tab 3: Stairwells ───
  const [stairwells, setStairwells] = useState<StairwellData[]>([])
  const [selectedStairwell, setSelectedStairwell] = useState<number | null>(null)
  const [stairwellFloors, setStairwellFloors] = useState<StairwellFloorData[]>([])
  const [editingSF, setEditingSF] = useState<StairwellFloorData | null>(null)
  const [showCreateSW, setShowCreateSW] = useState(false)
  const [newSWCategory, setNewSWCategory] = useState('teaching_a')
  const [newSWFloors, setNewSWFloors] = useState<number[]>([1, 2])
  const swMapRef = useRef<HTMLDivElement | null>(null)
  const [swDraggingId, setSWDraggingId] = useState<number | null>(null)
  const swDragStartRef = useRef<{ mx: number; my: number; rx1: number; ry1: number; rx2: number; ry2: number } | null>(null)
  const [swPointMode, setSWPointMode] = useState<'none' | 'entry' | 'exit'>('none')

  useEffect(() => {
    setNewSWCategory(campus === 'senior' ? 'senior' : 'teaching_a')
  }, [campus])
  const [swMapW, setSwMapW] = useState(0)
  const [swMapH, setSwMapH] = useState(0)
  const [swDrawStep, setSWDrawStep] = useState<0 | 1 | 2>(0)
  const [swCorner1, setSWCorner1] = useState<{ x: number; y: number } | null>(null)
  const [swCorner2, setSWCorner2] = useState<{ x: number; y: number } | null>(null)
  const [swEditFloor, setSWEditFloor] = useState<number>(1)

  const elevationContainerH = elevW > 0 ? Math.round((elevW * ELEVATION_NATURAL.h) / ELEVATION_NATURAL.w) : 400
  const floorContainerH = floorMapW > 0 ? Math.round((floorMapW * FLOOR_NATURAL.h) / FLOOR_NATURAL.w) : 400

  // ─── Resize observers ───
  useEffect(() => {
    const setup = (ref: React.RefObject<HTMLDivElement | null>, setW: (v: number) => void, setH: (v: number) => void) => {
      const el = ref.current; if (!el) return
      const measure = () => { const r = el.getBoundingClientRect(); setW(r.width); setH(r.height) }
      measure()
      const ro = new ResizeObserver(measure); ro.observe(el)
      return () => ro.disconnect()
    }
    if (tab === 'markers') return setup(elevationRef, setElevW, setElevH)
    if (tab === 'roads') return setup(floorMapRef, setFloorMapW, setFloorMapH)
    if (tab === 'stairwells') return setup(swMapRef, setSwMapW, setSwMapH)
  }, [tab, roadFloor])

  // ─── Data fetching ───
  const fetchMarkers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/floor-markers?campus=${campus}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (res.ok) setMarkers(Array.isArray(data) ? data : [])
    } catch (e) { console.error('fetchMarkers error', e) }
    finally { setLoading(false) }
  }, [campus])

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

  const fetchStairwellFloors = useCallback(async (stairwellId: number) => {
    try {
      const res = await fetch(`/api/stairwell-floors?stairwellId=${stairwellId}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        // Normalize data to ensure all fields have valid values
        const normalized = data.map((sf: any) => ({
          id: sf.id ?? 0,
          stairwellId: sf.stairwellId ?? stairwellId,
          floor: sf.floor ?? 0,
          x: sf.x ?? 0,
          y: sf.y ?? 0,
          rectX1: sf.rectX1 ?? 0,
          rectY1: sf.rectY1 ?? 0,
          rectX2: sf.rectX2 ?? 0,
          rectY2: sf.rectY2 ?? 0,
          entryX: sf.entryX ?? null,
          entryY: sf.entryY ?? null,
          exitX: sf.exitX ?? null,
          exitY: sf.exitY ?? null,
          targetFloor1: sf.targetFloor1 ?? null,
          targetFloor2: sf.targetFloor2 ?? null,
        }))
        setStairwellFloors(normalized)
      } else {
        setStairwellFloors([])
      }
    } catch (e) { console.error('fetchStairwellFloors error', e); setStairwellFloors([]) }
  }, [])

  useEffect(() => {
    if (tab === 'markers') fetchMarkers()
    if (tab === 'roads') fetchRoads()
    if (tab === 'stairwells') fetchRoads()
  }, [tab, fetchMarkers, fetchRoads])

  useEffect(() => { fetchRoads() }, [fetchRoads])

  useEffect(() => {
    if (selectedStairwell != null) fetchStairwellFloors(selectedStairwell)
    else setStairwellFloors([])
  }, [selectedStairwell, fetchStairwellFloors])

  // Fetch all stairwell floor data for road map display
  useEffect(() => {
    if (tab !== 'roads' || stairwells.length === 0) { setRoadFloorSWData([]); return }
    let cancelled = false
    const load = async () => {
      try {
        const results = await Promise.all(
          stairwells.map(sw => fetch(`/api/stairwell-floors?stairwellId=${sw.id}`, { credentials: 'same-origin' }).then(r => r.json()).catch(() => []))
        )
        if (!cancelled) {
          const all: StairwellFloorData[] = results.flat().filter(Boolean)
          setRoadFloorSWData(all.filter(sf => sf.floor === roadFloor))
        }
      } catch { if (!cancelled) setRoadFloorSWData([]) }
    }
    load()
    return () => { cancelled = true }
  }, [tab, stairwells, roadFloor])

  const postFloorMarkers = async (action: string, data: unknown) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/floor-markers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ action, data }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.details || result?.error || '操作失败')
      return result
    } finally { setActionLoading(false) }
  }

  const postRoads = async (action: string, data: unknown) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/roads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ action, data }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.details || result?.error || '操作失败')
      return result
    } finally { setActionLoading(false) }
  }

  const postStairwellFloors = async (action: string, data: unknown) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/stairwell-floors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ action, data }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.details || result?.error || '操作失败')
      return result
    } finally { setActionLoading(false) }
  }

  // ═══════════════════════════════════════
  // Tab 1: Floor Markers
  // ═══════════════════════════════════════
  const getPct = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = elevationRef.current!.getBoundingClientRect()
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100),
    }
  }

  const handleMarkerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = getPct(e)
    markerStartRef.current = p
    setMarkerDrawing(true)
    setMarkerRect({ x1: p.x, y1: p.y, x2: p.x, y2: p.y })
  }

  const handleMarkerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!markerDrawing || !markerStartRef.current) return
    const p = getPct(e)
    setMarkerRect(prev => prev ? { ...prev, x2: p.x, y2: p.y } : null)
  }

  const handleMarkerPointerUp = () => {
    setMarkerDrawing(false)
    markerStartRef.current = null
  }

  const handleSaveMarker = async () => {
    if (!markerRect) return
    const x = Math.min(markerRect.x1, markerRect.x2)
    const y = Math.min(markerRect.y1, markerRect.y2)
    const w = Math.abs(markerRect.x2 - markerRect.x1)
    const h = Math.abs(markerRect.y2 - markerRect.y1)
    if (w < 0.5 || h < 0.5) { alert('标记区域太小，请拖动框选'); return }
    try {
      await postFloorMarkers('upsert', { campus, floor: selectedFloor, x, y, w, h })
      setMarkerRect(null)
      fetchMarkers()
    } catch (err) { alert(err instanceof Error ? err.message : '保存失败') }
  }

  const handleDeleteMarker = async (id: number) => {
    if (!confirm('确定要删除该楼层标记？')) return
    try { await postFloorMarkers('delete', { id }); fetchMarkers() }
    catch (err) { alert(err instanceof Error ? err.message : '删除失败') }
  }

  const resetMarkerDraw = () => {
    setMarkerRect(null); setMarkerDrawing(false); markerStartRef.current = null
  }

  const existingMarker = markers.find(m => m.floor === selectedFloor)

  // ═══════════════════════════════════════
  // Tab 2: Floor Roads
  // ═══════════════════════════════════════
  const floorNodes = nodes.filter(n => (n.floor ?? 0) === roadFloor)
  const floorNodeIds = new Set(floorNodes.map(n => n.id))
  const floorEdges = edges.filter(e => floorNodeIds.has(e.fromNode) && floorNodeIds.has(e.toNode))

  const pixToPercentFloor = (px: number, py: number) => ({
    x: clamp((px / floorMapW) * 100), y: clamp((py / floorContainerH) * 100),
  })

  const percentToPixFloor = (x: number, y: number) => ({
    px: (x / 100) * floorMapW, py: (y / 100) * floorContainerH,
  })

  const getNodePos = (node: any) => {
    if (draggingId === node.id && draggingPosRef.current) return draggingPosRef.current
    return { x: node.x, y: node.y }
  }

  const handleFloorMapClick = async (e: MouseEvent<HTMLDivElement>) => {
    const rect = floorMapRef.current!.getBoundingClientRect()
    const rawX = e.clientX - rect.left; const rawY = e.clientY - rect.top
    const { x, y } = pixToPercentFloor(rawX, rawY)

    if (roadMode === 'addNode') {
      try {
        const result = await postRoads('add_node', { x, y, campus, floor: roadFloor })
        if (result && typeof result.id === 'number') {
          setNodes(prev => [...prev, { id: result.id, x: result.x, y: result.y, campus: result.campus, floor: result.floor ?? roadFloor }])
        }
      } catch (err) { alert(err instanceof Error ? err.message : '添加节点失败') }
    }
  }

  const handleFloorNodeClick = async (e: MouseEvent | PointerEvent, nodeId: number) => {
    e.stopPropagation()
    if (roadMode === 'deleteNode') {
      if (!confirm('确定要删除该节点？关联的路径也会一并删除。')) return
      try { await postRoads('delete_node', { id: nodeId }); if (edgeFrom === nodeId) setEdgeFrom(null); fetchRoads() }
      catch (err) { alert(err instanceof Error ? err.message : '删除节点失败') }
      return
    }
    if (roadMode === 'addEdge') {
      if (edgeFrom === null) { setEdgeFrom(nodeId); return }
      if (edgeFrom === nodeId) { setEdgeFrom(null); return }
      const from = nodes.find((n: any) => n.id === edgeFrom); const to = nodes.find((n: any) => n.id === nodeId)
      if (!from || !to) return
      try {
        await postRoads('add_edge', { fromNode: from.id, toNode: to.id, x1: from.x, y1: from.y, x2: to.x, y2: to.y, campus })
        setEdgeFrom(nodeId); await fetchRoads()
      } catch (err) { alert(err instanceof Error ? err.message : '创建路径失败'); setEdgeFrom(null) }
    }
  }

  const handleFloorNodePointerDown = (e: PointerEvent<HTMLDivElement>, nodeId: number) => {
    if (roadMode !== 'view') return
    e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId)
    const rect = floorMapRef.current!.getBoundingClientRect()
    const node = nodes.find((n: any) => n.id === nodeId)!
    const { px, py } = percentToPixFloor(node.x, node.y)
    dragOffsetRef.current = { ox: e.clientX - rect.left - px, oy: e.clientY - rect.top - py }
    draggingPosRef.current = { x: node.x, y: node.y }; setDraggingId(nodeId)
  }

  const handleFloorNodePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (draggingId === null) return; e.stopPropagation()
    const rect = floorMapRef.current!.getBoundingClientRect()
    const rawX = e.clientX - rect.left - (dragOffsetRef.current?.ox ?? 0)
    const rawY = e.clientY - rect.top - (dragOffsetRef.current?.oy ?? 0)
    const { x, y } = pixToPercentFloor(rawX, rawY); draggingPosRef.current = { x, y }; forceRender(n => n + 1)
  }

  const handleFloorNodePointerUp = async (e: PointerEvent<HTMLDivElement>, nodeId: number) => {
    if (draggingId === null) return; e.stopPropagation()
    const pos = draggingPosRef.current; setDraggingId(null); dragOffsetRef.current = null; draggingPosRef.current = null
    if (!pos) return
    try {
      await postRoads('move_node', { id: nodeId, x: pos.x, y: pos.y })
      setNodes(prev => prev.map((n: any) => n.id === nodeId ? { ...n, x: pos.x, y: pos.y } : n))
    } catch (err) { alert(err instanceof Error ? err.message : '移动节点失败'); fetchRoads() }
  }

  const handleDeleteFloorEdge = async (id: number) => {
    if (!confirm('确定要删除这条路径吗？')) return
    try { await postRoads('delete_edge', { id }); setSelectedEdgeId(null); fetchRoads() }
    catch (err) { alert(err instanceof Error ? err.message : '删除路径失败') }
  }

  const handleFloorEdgeClick = async (e: MouseEvent, edge: any) => {
    e.stopPropagation()
    if (roadMode === 'deleteEdge') { if (!confirm('确定要删除这条路径吗？')) return; await handleDeleteFloorEdge(edge.id); return }
    setSelectedEdgeId(prev => prev === edge.id ? null : edge.id)
  }

  const handleSaveFloorNodeEdit = async () => {
    if (!nodeEdit) return
    const x = Number(nodeEdit.x); const y = Number(nodeEdit.y)
    if (Number.isNaN(x) || Number.isNaN(y)) { alert('请输入有效数值'); return }
    try {
      await postRoads('move_node', { id: nodeEdit.id, x: clamp(x), y: clamp(y) })
      setNodes(prev => prev.map((n: any) => n.id === nodeEdit.id ? { ...n, x: clamp(x), y: clamp(y) } : n))
      setNodeEdit(null); fetchRoads()
    } catch (err) { alert(err instanceof Error ? err.message : '移动节点失败') }
  }

  const setRoadModeToggle = (m: RoadMode) => {
    setRoadMode(prev => prev === m ? 'view' : m)
    setEdgeFrom(null); setSelectedEdgeId(null)
  }

  const floorMapSrc = `/assets/floor/map2-${roadFloor}.webp`

  // ═══════════════════════════════════════
  // Tab 3: Stairwells
  // ═══════════════════════════════════════
  const handleCreateStairwell = async () => {
    if (newSWFloors.length < 2) { alert('请至少选择两个楼层'); return }
    try {
      const result = await postRoads('create_stairwell', {
        campus,
        buildingCategory: newSWCategory,
        rectX1: 0, rectY1: 0, rectX2: 0, rectY2: 0,
        floors: newSWFloors,
        points: [{ x: 50, y: 50, floors: newSWFloors }],
      })
      setShowCreateSW(false); setNewSWCategory(campus === 'senior' ? 'senior' : 'teaching_a'); setNewSWFloors([1, 2])
      fetchRoads()
      if (result?.stairwellId) setSelectedStairwell(result.stairwellId)
    } catch (err) { alert(err instanceof Error ? err.message : '创建楼梯井失败') }
  }

  const handleDeleteStairwell = async (id: number) => {
    if (!confirm('确定要删除该楼梯井？所有相关数据都会被删除。')) return
    try {
      await postRoads('delete_stairwell', { id })
      if (selectedStairwell === id) setSelectedStairwell(null)
      fetchRoads()
    } catch (err) { alert(err instanceof Error ? err.message : '删除楼梯井失败') }
  }

  const handleSaveStairwellFloor = async () => {
    if (!editingSF || !selectedStairwell) return
    try {
      const result = await postStairwellFloors('upsert', {
        stairwellId: selectedStairwell,
        floor: editingSF.floor,
        x: editingSF.x ?? 50,
        y: editingSF.y ?? 50,
        rectX1: editingSF.rectX1 ?? 0,
        rectY1: editingSF.rectY1 ?? 0,
        rectX2: editingSF.rectX2 ?? 0,
        rectY2: editingSF.rectY2 ?? 0,
        entryX: editingSF.entryX,
        entryY: editingSF.entryY,
        exitX: editingSF.exitX,
        exitY: editingSF.exitY,
        targetFloor1: editingSF.targetFloor1 ?? null,
        targetFloor2: editingSF.targetFloor2 ?? null,
      })

      // Create road nodes at entry/exit positions for edge connection
      const sw = stairwells.find(s => s.id === selectedStairwell)
      const bCat = sw?.buildingCategory || 'senior'
      const floor = editingSF.floor

      if (editingSF.entryX != null && editingSF.entryY != null) {
        await postRoads('add_stairwell_node', {
          x: editingSF.entryX, y: editingSF.entryY, campus: 'senior', floor,
          stairwellId: selectedStairwell, stairwellFloor: floor, stairwellRole: 'entry',
          buildingCategory: bCat,
        })
      }
      if (editingSF.exitX != null && editingSF.exitY != null) {
        await postRoads('add_stairwell_node', {
          x: editingSF.exitX, y: editingSF.exitY, campus: 'senior', floor,
          stairwellId: selectedStairwell, stairwellFloor: floor, stairwellRole: 'exit',
          buildingCategory: bCat,
        })
      }

      setEditingSF(null)
      resetSWDraw()
      setSWPointMode('none')
      if (selectedStairwell) await fetchStairwellFloors(selectedStairwell)
      await fetchRoads()
    } catch (err) { alert(err instanceof Error ? err.message : '保存失败') }
  }

  const handleCopyFromFloor = async (fromFloor: number, toFloors: number[]) => {
    if (!selectedStairwell) return
    try {
      await postStairwellFloors('copyFrom', { stairwellId: selectedStairwell, fromFloor, toFloors })
      fetchStairwellFloors(selectedStairwell)
    } catch (err) { alert(err instanceof Error ? err.message : '复制失败') }
  }

  const handleDeleteStairwellFloor = async (id: number) => {
    if (!confirm('确定要删除该楼层的楼梯井数据？')) return
    try {
      await postStairwellFloors('delete', { id })
      if (selectedStairwell) fetchStairwellFloors(selectedStairwell)
    } catch (err) { alert(err instanceof Error ? err.message : '删除失败') }
  }

  const handleSWMapClick = (e: MouseEvent<HTMLDivElement>) => {
    if (swDraggingId != null) return
    const rect = swMapRef.current!.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * 100
    const py = ((e.clientY - rect.top) / rect.height) * 100
    const x = clamp(px); const y = clamp(py)

    if (swPointMode === 'entry' || swPointMode === 'exit') {
      if (!editingSF) return
      // Snap to nearest edge of the stairwell rectangle
      const { rectX1, rectY1, rectX2, rectY2 } = editingSF
      const candidates = [
        { x: Math.max(rectX1!, Math.min(rectX2!, x)), y: rectY1! },
        { x: Math.max(rectX1!, Math.min(rectX2!, x)), y: rectY2! },
        { x: rectX1!, y: Math.max(rectY1!, Math.min(rectY2!, y)) },
        { x: rectX2!, y: Math.max(rectY1!, Math.min(rectY2!, y)) },
      ]
      let best = candidates[0]; let bestDist = Infinity
      for (const c of candidates) {
        const d = Math.hypot(c.x - x, c.y - y)
        if (d < bestDist) { bestDist = d; best = c }
      }
      const key = swPointMode === 'entry' ? 'entry' : 'exit'
      setEditingSF(prev => prev ? { ...prev, [`${key}X`]: clamp(best.x), [`${key}Y`]: clamp(best.y) } : null)
      setSWPointMode('none')
      return
    }

    if (swDrawStep === 0) { setSWCorner1({ x, y }); setSWDrawStep(1) }
    else if (swDrawStep === 1) {
      setSWCorner2({ x, y }); setSWDrawStep(2)
      const rectX1 = Math.min(swCorner1!.x, x); const rectY1 = Math.min(swCorner1!.y, y)
      const rectX2 = Math.max(swCorner1!.x, x); const rectY2 = Math.max(swCorner1!.y, y)
      const cx = (swCorner1!.x + x) / 2; const cy = (swCorner1!.y + y) / 2

      const newData: StairwellFloorData = {
        id: editingSF?.id ?? 0,
        stairwellId: selectedStairwell!,
        floor: swEditFloor,
        x: cx, y: cy,
        rectX1, rectY1, rectX2, rectY2,
        entryX: editingSF?.entryX ?? null, entryY: editingSF?.entryY ?? null,
        exitX: editingSF?.exitX ?? null, exitY: editingSF?.exitY ?? null,
      }
      setEditingSF(newData)

      // Auto-save after drawing
      if (selectedStairwell) {
        postStairwellFloors('upsert', {
          stairwellId: selectedStairwell,
          floor: swEditFloor,
          x: cx, y: cy, rectX1, rectY1, rectX2, rectY2,
          entryX: newData.entryX, entryY: newData.entryY,
          exitX: newData.exitX, exitY: newData.exitY,
        }).then(() => {
          if (selectedStairwell) fetchStairwellFloors(selectedStairwell)
        }).catch(() => {})
      }
    }
  }

  const resetSWDraw = () => { setSWDrawStep(0); setSWCorner1(null); setSWCorner2(null) }

  const roadModeBtnClass = (m: RoadMode) =>
    `inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
      roadMode === m
        ? m === 'addNode' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
        : m === 'addEdge' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
        : m === 'deleteNode' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
        : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
        : 'bg-white/5 text-white/80 hover:bg-white/10'
    }`

  const swFloorData = stairwellFloors.find(sf => sf.floor === swEditFloor)

  return (
    <AdminShell>
      <div className="h-full flex flex-col overflow-hidden" style={{ background: '#080809' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0 flex-wrap gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,14,0.95)' }}>
          <div>
            <h1 className="text-white text-base font-semibold">高中部道路编辑</h1>
            <p className="text-white/35 text-xs mt-0.5">高中部楼层地图、道路和楼梯井管理</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={campus} onChange={e => setCampus(e.target.value === 'senior' ? 'senior' : 'junior')} className="rounded-xl py-2 px-3 text-sm bg-white/5 text-white border border-white/10" style={{ outline: 'none' }}>
              <option value="junior">初中部</option>
              <option value="senior">高中部</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 px-6 py-2 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {([
            { key: 'markers' as Tab, label: '楼层标记', icon: Layers },
            { key: 'roads' as Tab, label: '楼层道路', icon: Route },
            { key: 'stairwells' as Tab, label: '楼梯井', icon: Box },
          ]).map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); resetMarkerDraw(); resetSWDraw() }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}>
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">

          {/* ═══════════ TAB 1: FLOOR MARKERS ═══════════ */}
          {tab === 'markers' && (
            <div className="grid gap-5 px-6 py-5" style={{ gridTemplateColumns: '1fr 320px' }}>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm font-semibold">立面图标记</div>
                    <div className="text-white/35 text-xs mt-0.5">
                      {markerDrawing ? '正在框选...' : markerRect ? '已绘制矩形，可保存或重绘' : '按住鼠标拖动框选楼层区域'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span>楼层 {selectedFloor}F</span>
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    {actionLoading && <span className="text-blue-400">保存中…</span>}
                  </div>
                </div>

                <div
                  ref={elevationRef}
                  className={`relative overflow-hidden rounded-xl select-none ${markerDrawing ? 'cursor-crosshair' : 'cursor-crosshair'}`}
                  style={{ width: '100%', background: '#111', touchAction: 'none' }}
                  onPointerDown={handleMarkerPointerDown}
                  onPointerMove={handleMarkerPointerMove}
                  onPointerUp={handleMarkerPointerUp}
                >
                  <img src="/assets/map2-0.webp" alt="立面图" className="block w-full h-auto pointer-events-none" style={{ display: 'block' }} draggable={false} />

                  {markers.map(m => {
                    const ci = FLOOR_NUMBERS.indexOf(m.floor)
                    return (
                      <div key={m.id} style={{
                        position: 'absolute',
                        left: `${m.x}%`,
                        top: `${m.y}%`,
                        width: `${m.w}%`,
                        height: `${m.h}%`,
                        background: FLOOR_COLORS[ci] || 'rgba(255,255,255,0.1)',
                        border: `2px solid ${FLOOR_BORDER_COLORS[ci] || 'rgba(255,255,255,0.3)'}`,
                        borderRadius: 4, pointerEvents: 'none', zIndex: 10,
                      }}>
                        <div style={{ position: 'absolute', left: 4, top: 2, fontSize: 11, fontWeight: 700, color: FLOOR_BORDER_COLORS[ci] || '#fff' }}>
                          {m.floor}F
                        </div>
                      </div>
                    )
                  })}

                  {markerRect && (() => {
                    const x1 = Math.min(markerRect.x1, markerRect.x2)
                    const y1 = Math.min(markerRect.y1, markerRect.y2)
                    const w = Math.abs(markerRect.x2 - markerRect.x1)
                    const h = Math.abs(markerRect.y2 - markerRect.y1)
                    return (
                      <div style={{
                        position: 'absolute',
                        left: `${x1}%`,
                        top: `${y1}%`,
                        width: `${w}%`,
                        height: `${h}%`,
                        background: FLOOR_COLORS[selectedFloor - 1], border: `2px dashed ${FLOOR_BORDER_COLORS[selectedFloor - 1]}`,
                        borderRadius: 4, pointerEvents: 'none', zIndex: 15,
                      }}>
                        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                          {selectedFloor}F
                        </div>
                      </div>
                    )
                  })()}

                  {!markerRect && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
                      <div className="px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg" style={{ background: 'rgba(0,0,0,0.78)', color: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(6px)' }}>
                        按住鼠标拖动框选楼层区域
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 pt-1 text-xs text-white/35">
                  <span>{markers.length} 个楼层标记</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="text-white text-sm font-semibold mb-3">楼层选择</div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {FLOOR_NUMBERS.map(f => (
                      <button key={f} onClick={() => { setSelectedFloor(f); resetMarkerDraw() }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedFloor === f ? 'text-white shadow-lg' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                        style={selectedFloor === f ? { background: FLOOR_BORDER_COLORS[f - 1], boxShadow: `0 4px 12px ${FLOOR_COLORS[f - 1]}` } : {}}>
                        {f}F
                      </button>
                    ))}
                  </div>

                  {existingMarker && (
                    <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-white/50 text-xs mb-2">当前标记（可编辑）</div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {(['x', 'y', 'w', 'h'] as const).map(key => (
                          <div key={key}>
                            <label className="text-white/30 text-[10px] block mb-0.5">{key.toUpperCase()}</label>
                            <input
                              type="number"
                              step="0.1"
                              min={0}
                              max={100}
                              value={existingMarker[key]}
                              onChange={e => {
                                const v = parseFloat(e.target.value)
                                if (isNaN(v)) return
                                setMarkers(prev => prev.map(m => m.id === existingMarker.id ? { ...m, [key]: v } : m))
                              }}
                              className="w-full py-1 px-2 rounded-lg text-xs text-white/80"
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={async () => {
                          try {
                            await postFloorMarkers('upsert', { campus, floor: existingMarker.floor, x: existingMarker.x, y: existingMarker.y, w: existingMarker.w, h: existingMarker.h })
                            fetchMarkers()
                          } catch (err) { alert(err instanceof Error ? err.message : '保存失败') }
                        }} className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-blue-500 text-white font-medium">保存修改</button>
                        <button onClick={() => handleDeleteMarker(existingMarker.id)} className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-300 hover:bg-red-500/20">删除</button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <button onClick={resetMarkerDraw} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm bg-white/5 text-white/70 hover:bg-white/10">
                      <Plus size={14} /> {existingMarker ? '重新绘制' : '绘制标记'}
                    </button>
                    {markerRect && !markerDrawing && (
                      <div className="flex gap-2">
                        <button onClick={resetMarkerDraw} className="flex-1 px-4 py-2 rounded-xl text-sm bg-white/5 text-white/70 hover:bg-white/10">重置</button>
                        <button onClick={handleSaveMarker} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm bg-blue-500 text-white font-medium">
                          <Save size={14} />保存
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="text-white text-sm font-semibold mb-3">所有标记</div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {markers.length === 0 ? (
                      <div className="text-center text-white/30 text-xs py-6">暂无楼层标记</div>
                    ) : markers.map(m => {
                      const ci = FLOOR_NUMBERS.indexOf(m.floor)
                      return (
                        <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 cursor-pointer"
                          style={{
                            background: selectedFloor === m.floor ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${selectedFloor === m.floor ? FLOOR_BORDER_COLORS[ci] : 'rgba(255,255,255,0.07)'}`,
                          }}
                          onClick={() => { setSelectedFloor(m.floor); resetMarkerDraw() }}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold" style={{ color: FLOOR_BORDER_COLORS[ci] }}>{m.floor}F</span>
                            <span className="text-white/40 text-[10px]">({m.x.toFixed(1)}, {m.y.toFixed(1)}) {m.w.toFixed(1)}×{m.h.toFixed(1)}</span>
                          </div>
                          <button onClick={e => { e.stopPropagation(); handleDeleteMarker(m.id) }} className="text-red-400/60 hover:text-red-400">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <div className="text-blue-300 text-xs font-semibold mb-2">使用说明</div>
                  <div className="text-white/40 text-xs leading-relaxed space-y-1">
                    <div>1. 选择左侧楼层按钮</div>
                    <div>2. 在立面图上点击两个对角点</div>
                    <div>3. 确认矩形区域后点击保存</div>
                    <div>4. 标记用于定位每层楼在立面图上的位置</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB 2: FLOOR ROADS ═══════════ */}
          {tab === 'roads' && (
            <div className="px-6 py-5 space-y-5">

              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-white text-sm font-semibold">楼层道路 · {roadFloor}F</div>
                    <div className="text-white/35 text-xs mt-0.5">
                      {roadMode === 'view' && '拖拽节点可移动'}
                      {roadMode === 'addNode' && '点击空白处添加节点'}
                      {roadMode === 'addEdge' && (edgeFrom ? `起点 ${edgeFrom} · 选终点` : '选起点节点')}
                      {roadMode === 'deleteEdge' && '点击路径删除'}
                      {roadMode === 'deleteNode' && '点击节点删除'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      {FLOOR_NUMBERS.map(f => (
                        <button key={f} onClick={() => { setRoadFloor(f); setRoadMode('view'); setEdgeFrom(null); setSelectedEdgeId(null) }}
                          className={`px-3 py-1.5 text-xs font-medium transition-all ${roadFloor === f ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
                          style={roadFloor === f ? { background: FLOOR_BORDER_COLORS[f - 1] } : { background: 'rgba(255,255,255,0.03)' }}>
                          {f}F
                        </button>
                      ))}
                    </div>
                    <button onClick={fetchRoads} disabled={loading} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 text-xs">
                      <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={async () => {
                      if (!confirm('将清除所有旧的楼梯井自动节点数据，之后请重新在楼梯井中设置出入口。继续？')) return
                      try {
                        const r = await postRoads('cleanup_stairwell_nodes', { campus: 'senior' })
                        alert(`已清除 ${r.nodesDeleted} 个节点和 ${r.edgesDeleted} 条边`)
                        fetchRoads()
                      } catch (e) { alert(e instanceof Error ? e.message : '清除失败') }
                    }} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs">
                      <Trash2 size={12} />清除旧数据
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setRoadModeToggle('addNode')} className={roadModeBtnClass('addNode')}><Plus size={13} />{roadMode === 'addNode' ? '点击地图…' : '添加节点'}</button>
                  <button onClick={() => setRoadModeToggle('addEdge')} className={roadModeBtnClass('addEdge')}><GitMerge size={13} />{roadMode === 'addEdge' ? (edgeFrom ? `起点:${edgeFrom}` : '选起点…') : '创建路径'}</button>
                  <button onClick={() => setRoadModeToggle('deleteEdge')} className={roadModeBtnClass('deleteEdge')}><Trash2 size={13} />{roadMode === 'deleteEdge' ? '点击路径…' : '删除路径'}</button>
                  <button onClick={() => setRoadModeToggle('deleteNode')} className={roadModeBtnClass('deleteNode')}><Trash2 size={13} />{roadMode === 'deleteNode' ? '点击节点…' : '删除节点'}</button>
                </div>

                <div
                  ref={floorMapRef}
                  className={`relative overflow-hidden rounded-xl select-none ${
                    roadMode === 'addNode' ? 'cursor-crosshair' :
                    roadMode === 'deleteEdge' || roadMode === 'deleteNode' ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  style={{ width: '100%', background: '#111' }}
                  onClick={handleFloorMapClick}
                >
                  <img src={floorMapSrc} alt={`${roadFloor}F地图`} className="block w-full h-auto pointer-events-none" style={{ display: 'block' }} draggable={false} />

                  <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }} viewBox={`0 0 ${floorMapW || FLOOR_NATURAL.w} ${floorContainerH || FLOOR_NATURAL.h}`} preserveAspectRatio="none">
                    {floorEdges.map((edge: any) => {
                      const fn = nodes.find((n: any) => n.id === edge.fromNode); const tn = nodes.find((n: any) => n.id === edge.toNode)
                      if (!fn || !tn) return null
                      const fp = getNodePos(fn); const tp = getNodePos(tn)
                      const W = floorMapW || FLOOR_NATURAL.w; const H = floorContainerH || FLOOR_NATURAL.h
                      const x1 = (fp.x / 100) * W; const y1 = (fp.y / 100) * H; const x2 = (tp.x / 100) * W; const y2 = (tp.y / 100) * H
                      const isSelected = selectedEdgeId === edge.id
                      return (
                        <g key={edge.id} style={{ pointerEvents: 'auto' }}>
                          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} onClick={ev => handleFloorEdgeClick(ev as unknown as MouseEvent, edge)} style={{ cursor: 'pointer' }} />
                          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isSelected ? '#60a5fa' : '#38bdf8'} strokeWidth={isSelected ? 3 : 2} style={{ pointerEvents: 'none' }} />
                          {isSelected && <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={5} fill="#60a5fa" style={{ pointerEvents: 'none' }} />}
                        </g>
                      )
                    })}
                  </svg>

                  {floorNodes.map((node: any) => {
                    const pos = getNodePos(node); const W = floorMapW || FLOOR_NATURAL.w; const H = floorContainerH || FLOOR_NATURAL.h
                    const left = (pos.x / 100) * W - 7; const top = (pos.y / 100) * H - 7
                    const isDragging = draggingId === node.id; const isEdgeFrom = edgeFrom === node.id
                    const isSW = node.stairwellId != null
                    return (
                      <div key={node.id} style={{
                        position: 'absolute', left, top, width: 14, height: 14, borderRadius: '50%',
                        background: isEdgeFrom ? '#34d399' : isDragging ? '#f59e0b' : isSW ? '#34d399' : '#38bdf8',
                        border: `2px solid ${isEdgeFrom ? '#6ee7b7' : isDragging ? '#fcd34d' : isSW ? '#a7f3d0' : 'rgba(255,255,255,0.7)'}`,
                        boxShadow: isSW ? '0 0 0 3px rgba(52,211,153,0.28)' : undefined,
                        cursor: roadMode === 'view' ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                        zIndex: isDragging ? 60 : isSW ? 32 : 30, touchAction: 'none', pointerEvents: 'auto',
                      }}
                      onPointerDown={e => { if (roadMode === 'view') handleFloorNodePointerDown(e, node.id) }}
                      onPointerMove={e => { if (roadMode === 'view') handleFloorNodePointerMove(e) }}
                      onPointerUp={e => { if (roadMode === 'view') handleFloorNodePointerUp(e, node.id) }}
                      onClick={e => { if (roadMode !== 'view') handleFloorNodeClick(e, node.id) }}
                      title={`节点 ${node.id} (${node.x.toFixed(1)}, ${node.y.toFixed(1)})${isSW ? ` 井#${node.stairwellId} F${node.stairwellFloor} ${node.stairwellRole}（楼梯口路径点）` : ''}`} />
                    )
                  })}

                  {/* Stairwell floor overlays */}
                  {roadFloorSWData.map(sf => {
                    const W = floorMapW || FLOOR_NATURAL.w; const H = floorContainerH || FLOOR_NATURAL.h
                    const x1 = (sf.rectX1 / 100) * W; const y1 = (sf.rectY1 / 100) * H
                    const x2 = (sf.rectX2 / 100) * W; const y2 = (sf.rectY2 / 100) * H
                    const sw = stairwells.find(s => s.id === sf.stairwellId)
                    const isTrunk = !!sw?.isTrunk
                    return (
                      <div key={`sw-${sf.id}`}>
                        <div style={{
                          position: 'absolute', left: x1, top: y1, width: x2 - x1, height: y2 - y1,
                          background: 'rgba(245,158,11,0.08)', border: '2px dashed rgba(245,158,11,0.4)',
                          borderRadius: 4, pointerEvents: 'none', zIndex: 5,
                        }}>
                          <div style={{ position: 'absolute', left: 4, top: 2, fontSize: 9, fontWeight: 700, color: 'rgba(245,158,11,0.6)' }}>
                            井#{sf.stairwellId}
                          </div>
                        </div>
                        {sf.entryX != null && sf.entryY != null && (
                          <div
                            style={{
                              position: 'absolute', left: `${sf.entryX}%`, top: `${sf.entryY}%`, transform: 'translate(-50%,-50%)',
                              width: 14, height: 14, borderRadius: '50%', background: '#34D399', border: '2px solid white',
                              zIndex: 25, cursor: roadMode === 'addEdge' ? 'pointer' : 'default',
                              boxShadow: '0 0 6px rgba(52,211,153,0.5)',
                            }}
                            title={`井#${sf.stairwellId} 出入口1 (${sf.entryX.toFixed(1)},${sf.entryY.toFixed(1)})${isTrunk && sf.targetFloor1 != null ? ` → ${sf.targetFloor1}楼` : ''}`}
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (roadMode !== 'addEdge') return
                              try {
                                const result = await postRoads('add_stairwell_node', {
                                  x: sf.entryX, y: sf.entryY, campus: 'senior', floor: sf.floor,
                                  stairwellId: sf.stairwellId, stairwellFloor: sf.floor, stairwellRole: 'entry1',
                                  buildingCategory: sw?.buildingCategory || 'senior',
                                })
                                if (result && typeof result.id === 'number') {
                                  setNodes(prev => [...prev, { id: result.id, x: sf.entryX!, y: sf.entryY!, campus: 'senior', floor: sf.floor, stairwellId: sf.stairwellId, stairwellFloor: sf.floor, stairwellRole: 'entry1', buildingCategory: sw?.buildingCategory }])
                                  setEdgeFrom(result.id)
                                }
                              } catch { /* node may already exist */ }
                              fetchRoads()
                            }}
                          >
                            <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 8, fontWeight: 600, color: '#34D399', whiteSpace: 'nowrap' }}>
                              出入口1{isTrunk && sf.targetFloor1 != null ? `→${sf.targetFloor1}F` : ''}
                            </div>
                          </div>
                        )}
                        {sf.exitX != null && sf.exitY != null && (
                          <div
                            style={{
                              position: 'absolute', left: `${sf.exitX}%`, top: `${sf.exitY}%`, transform: 'translate(-50%,-50%)',
                              width: 14, height: 14, borderRadius: '50%', background: '#34D399', border: '2px solid white',
                              zIndex: 25, cursor: roadMode === 'addEdge' ? 'pointer' : 'default',
                              boxShadow: '0 0 6px rgba(52,211,153,0.5)',
                            }}
                            title={`井#${sf.stairwellId} 出入口2 (${sf.exitX.toFixed(1)},${sf.exitY.toFixed(1)})${isTrunk && sf.targetFloor2 != null ? ` → ${sf.targetFloor2}楼` : ''}`}
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (roadMode !== 'addEdge') return
                              try {
                                const result = await postRoads('add_stairwell_node', {
                                  x: sf.exitX, y: sf.exitY, campus: 'senior', floor: sf.floor,
                                  stairwellId: sf.stairwellId, stairwellFloor: sf.floor, stairwellRole: 'entry2',
                                  buildingCategory: sw?.buildingCategory || 'senior',
                                })
                                if (result && typeof result.id === 'number') {
                                  setNodes(prev => [...prev, { id: result.id, x: sf.exitX!, y: sf.exitY!, campus: 'senior', floor: sf.floor, stairwellId: sf.stairwellId, stairwellFloor: sf.floor, stairwellRole: 'entry2', buildingCategory: sw?.buildingCategory }])
                                  setEdgeFrom(result.id)
                                }
                              } catch { /* node may already exist */ }
                              fetchRoads()
                            }}
                          >
                            <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 8, fontWeight: 600, color: '#34D399', whiteSpace: 'nowrap' }}>
                              出入口2{isTrunk && sf.targetFloor2 != null ? `→${sf.targetFloor2}F` : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {roadMode !== 'view' && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
                      <div className="px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg" style={{ background: 'rgba(0,0,0,0.78)', color: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(6px)', whiteSpace: 'nowrap' }}>
                        {roadMode === 'addNode' && '点击空白处添加节点'}
                        {roadMode === 'addEdge' && (edgeFrom ? `起点: ${edgeFrom} · 点击目标节点` : '点击第一个节点')}
                        {roadMode === 'deleteEdge' && '点击路径删除'}
                        {roadMode === 'deleteNode' && '点击节点删除'}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 pt-1 text-xs text-white/35">
                  <span>{floorNodes.length} 节点</span>
                  <span>{floorEdges.length} 路径</span>
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {actionLoading && <span className="text-blue-400">保存中…</span>}
                </div>
              </div>

              {/* Node list + Edge list + description below map */}
              <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-white text-sm font-semibold">节点列表 · {roadFloor}F</div>
                    <div className="text-white/35 text-xs">{floorNodes.length} 个</div>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {floorNodes.length === 0 ? (
                      <div className="text-center text-white/30 text-xs py-6">暂无节点</div>
                    ) : floorNodes.map((node: any) => (
                      <div key={node.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div>
                          <span className="text-white/90 text-xs font-medium">节点 {node.id}</span>
                          <span className="text-white/35 text-xs ml-2">({node.x.toFixed(1)}, {node.y.toFixed(1)})</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => setNodeEdit({ id: node.id, x: node.x.toString(), y: node.y.toString() })} className="px-2 py-1 rounded-lg text-xs bg-white/5 text-white/70 hover:bg-white/10">编辑</button>
                          <button onClick={() => { if (confirm('确定删除?')) { postRoads('delete_node', { id: node.id }).then(fetchRoads) } }} className="px-2 py-1 rounded-lg text-xs bg-red-500/10 text-red-300 hover:bg-red-500/20">删</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-white text-sm font-semibold">路径列表 · {roadFloor}F</div>
                    <div className="text-white/35 text-xs">{floorEdges.length} 条</div>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {floorEdges.length === 0 ? (
                      <div className="text-center text-white/30 text-xs py-6">暂无路径</div>
                    ) : floorEdges.map((edge: any) => (
                      <div key={edge.id} onClick={() => setSelectedEdgeId(prev => prev === edge.id ? null : edge.id)}
                        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 cursor-pointer"
                        style={{
                          background: selectedEdgeId === edge.id ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${selectedEdgeId === edge.id ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.07)'}`,
                        }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-white/70 text-xs truncate">{edge.fromNode} → {edge.toNode}</span>
                          <span className="text-white/30 text-xs">{edge.distance.toFixed(1)}</span>
                        </div>
                        <button onClick={e => { e.stopPropagation(); handleDeleteFloorEdge(edge.id) }} className="px-2 py-1 rounded-lg text-xs bg-red-500/10 text-red-300 hover:bg-red-500/20 flex-shrink-0">删</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <div className="text-blue-300 text-xs font-semibold mb-2">楼层道路说明</div>
                  <div className="text-white/40 text-xs leading-relaxed space-y-1">
                    <div>1. 选择楼层后在地图上编辑该层的道路</div>
                    <div>2. 添加节点 → 连接路径 → 构建路网</div>
                    <div>3. 拖拽节点可调整位置</div>
                    <div>4. 节点和路径按楼层过滤显示</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB 3: STAIRWELLS ═══════════ */}
          {tab === 'stairwells' && (
            <div className="grid gap-5 px-6 py-5" style={{ gridTemplateColumns: '1fr 340px' }}>

              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm font-semibold">楼梯井管理</div>
                    <div className="text-white/35 text-xs mt-0.5">
                      {selectedStairwell ? `编辑楼梯井 #${selectedStairwell} · ${swEditFloor}F` : '选择楼梯井进行编辑'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedStairwell && (
                      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                        {FLOOR_NUMBERS.map(f => (
                          <button key={f} onClick={() => { setSWEditFloor(f); resetSWDraw() }}
                            className={`px-2.5 py-1 text-xs font-medium transition-all ${swEditFloor === f ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
                            style={swEditFloor === f ? { background: FLOOR_BORDER_COLORS[f - 1] } : { background: 'rgba(255,255,255,0.03)' }}>
                            {f}F
                          </button>
                        ))}
                      </div>
                    )}
                    {loading && <Loader2 size={14} className="animate-spin text-white/40" />}
                  </div>
                </div>

                {selectedStairwell ? (
                  <>
                    <div
                      ref={swMapRef}
                      className={`relative overflow-hidden rounded-xl select-none ${swDrawStep < 2 ? 'cursor-crosshair' : 'cursor-default'}`}
                      style={{ width: '100%', background: '#111' }}
                      onClick={handleSWMapClick}
                    >
                      <img src={`/assets/floor/map2-${swEditFloor}.webp`} alt={`${swEditFloor}F地图`} className="block w-full h-auto pointer-events-none" style={{ display: 'block' }} draggable={false} />

                      {/* Stairwell floor overlays — merge editingSF for live preview */}
                      {(() => {
                        const displayFloors = stairwellFloors.map(sf => {
                          if (editingSF && editingSF.floor === sf.floor && editingSF.stairwellId === sf.stairwellId) {
                            return { ...sf, ...editingSF }
                          }
                          return sf
                        })
                        // Add editingSF if it's a new floor not yet in stairwellFloors
                        if (editingSF && editingSF.stairwellId === selectedStairwell && !stairwellFloors.find(sf => sf.floor === editingSF.floor)) {
                          displayFloors.push(editingSF)
                        }
                        return displayFloors.map(sf => {
                          const isActive = sf.floor === swEditFloor
                          const w = sf.rectX2 - sf.rectX1; const h = sf.rectY2 - sf.rectY1
                          if (w < 0.5 || h < 0.5) return null
                          return (
                            <div key={`sf-${sf.id || sf.floor}`}>
                              <div style={{
                                position: 'absolute',
                                left: `${sf.rectX1}%`, top: `${sf.rectY1}%`,
                                width: `${w}%`, height: `${h}%`,
                                background: isActive ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.05)',
                                border: `2px ${isActive ? 'solid' : 'dashed'} rgba(245,158,11,${isActive ? 0.7 : 0.3})`,
                                borderRadius: 4, pointerEvents: 'none', zIndex: isActive ? 15 : 10,
                              }}>
                                <div style={{ position: 'absolute', left: 4, top: 2, fontSize: 10, fontWeight: 700, color: `rgba(245,158,11,${isActive ? 0.9 : 0.5})` }}>
                                  {sf.floor}F
                                </div>
                              </div>
                              {sf.entryX != null && sf.entryY != null && (
                                <div style={{ position: 'absolute', left: `${sf.entryX}%`, top: `${sf.entryY}%`, transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', background: '#34D399', border: '2px solid white', zIndex: 20, pointerEvents: 'none' }} />
                              )}
                              {sf.exitX != null && sf.exitY != null && (
                                <div style={{ position: 'absolute', left: `${sf.exitX}%`, top: `${sf.exitY}%`, transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', border: '2px solid white', zIndex: 20, pointerEvents: 'none' }} />
                              )}
                            </div>
                          )
                        })
                      })()}

                      {swCorner1 && swDrawStep >= 1 && (
                        <div style={{ position: 'absolute', left: `${swCorner1.x}%`, top: `${swCorner1.y}%`, transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', border: '2px solid white', zIndex: 25, pointerEvents: 'none' }} />
                      )}

                      {swCorner1 && swCorner2 && swDrawStep === 2 && (() => {
                        const lx = Math.min(swCorner1.x, swCorner2.x)
                        const ly = Math.min(swCorner1.y, swCorner2.y)
                        const rw = Math.abs(swCorner2.x - swCorner1.x)
                        const rh = Math.abs(swCorner2.y - swCorner1.y)
                        return (
                          <div style={{
                            position: 'absolute',
                            left: `${lx}%`, top: `${ly}%`,
                            width: `${rw}%`, height: `${rh}%`,
                            background: 'rgba(245,158,11,0.15)', border: '2px solid rgba(245,158,11,0.8)',
                            borderRadius: 4, pointerEvents: 'none', zIndex: 20,
                          }}>
                            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontSize: 11, fontWeight: 700, color: '#FBBF24' }}>
                              {swEditFloor}F
                            </div>
                          </div>
                        )
                      })()}

                      {swDrawStep < 2 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-50">
                          <div className="px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg" style={{ background: 'rgba(0,0,0,0.78)', color: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(6px)' }}>
                            {swDrawStep === 0 ? '点击定楼梯井第一角' : '点击定楼梯井第二角'}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Map drawing hint when editing */}
                    {editingSF && swDrawStep < 2 && (
                      <div className="text-amber-300/60 text-[10px] mt-2 text-center">
                        在地图上点击两个点设置矩形区域，或直接在右侧输入坐标
                      </div>
                    )}

                    {swDrawStep < 2 && (
                      <div className="flex gap-2">
                        <button onClick={() => {
                          const sf = stairwellFloors.find(f => f.floor === swEditFloor)
                          if (sf) { setEditingSF(sf); setSWDrawStep(2); setSWCorner1({ x: sf.rectX1, y: sf.rectY1 }); setSWCorner2({ x: sf.rectX2, y: sf.rectY2 }) }
                          else { resetSWDraw(); setEditingSF({ id: 0, stairwellId: selectedStairwell!, floor: swEditFloor, x: 50, y: 50, rectX1: 0, rectY1: 0, rectX2: 0, rectY2: 0, entryX: null, entryY: null, exitX: null, exitY: null }) }
                        }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30">
                          <Plus size={13} />{stairwellFloors.find(f => f.floor === swEditFloor) ? '编辑当前楼层' : '添加当前楼层'}
                        </button>
                        {stairwellFloors.length > 0 && (
                          <div className="relative group">
                            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs bg-white/5 text-white/70 hover:bg-white/10">
                              <Copy size={13} />从其他楼层复制 <ChevronDown size={11} />
                            </button>
                            <div className="absolute top-full left-0 mt-1 z-50 hidden group-hover:block">
                              <div className="rounded-xl border border-white/10 bg-slate-900 shadow-xl py-1 min-w-[140px]">
                                {stairwellFloors.filter(sf => sf.floor !== swEditFloor).map(sf => (
                                  <button key={sf.floor} onClick={() => handleCopyFromFloor(sf.floor, [swEditFloor])}
                                    className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">
                                    从 {sf.floor}F 复制
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Box size={40} className="text-white/10 mb-4" />
                    <div className="text-white/30 text-sm">请从右侧列表选择一个楼梯井</div>
                    <div className="text-white/20 text-xs mt-1">或创建新的楼梯井</div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-white text-sm font-semibold">楼梯井权重设置</div>
                    <button onClick={() => setShowCreateSW(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30">
                      <Plus size={12} />新建
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {stairwells.length === 0 ? (
                      <div className="text-center text-white/30 text-xs py-6">暂无楼梯井</div>
                    ) : (
                      stairwells.map(sw => {
                        let floorList: number[] = []
                        try { floorList = JSON.parse(sw.floors) } catch {}
                        return (
                          <div key={sw.id}
                            className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 cursor-pointer"
                            style={{
                              background: selectedStairwell === sw.id ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${selectedStairwell === sw.id ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
                            }}
                            onClick={() => setSelectedStairwell(prev => prev === sw.id ? null : sw.id)}>
                            <div>
                              <span className="text-amber-300 text-xs font-medium">#{sw.id}</span>
                              <span className="text-white/50 text-xs ml-2">{sw.buildingCategory}</span>
                              <span className="text-white/30 text-xs ml-2">{floorList.join(',')}F</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="flex items-center gap-1 mr-1">
                                <span className="text-white/30 text-[10px]">权重</span>
                                <select
                                  value={sw.weight ?? 0}
                                  onChange={e => { e.stopPropagation(); postRoads('set_stairwell_weight', { id: sw.id, weight: Number(e.target.value) }).then(fetchRoads) }}
                                  onClick={e => e.stopPropagation()}
                                  className="px-1 py-0.5 rounded text-[10px]"
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', cursor: 'pointer' }}
                                >
                                  {[0,1,2,3,4,5,6,7,8,9,10].map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                              </div>
                              <button onClick={e => {
                                e.stopPropagation()
                                postRoads('toggle_stairwell_trunk', { id: sw.id, isTrunk: !sw.isTrunk }).then(fetchRoads)
                              }}
                                className={`px-2 py-0.5 rounded text-[10px] transition-all ${sw.isTrunk ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/30 hover:text-white/50 border border-white/10'}`}>
                                {sw.isTrunk ? '已开启楼层出入口' : '开启设置出入口楼层'}
                              </button>
                              <button onClick={e => { e.stopPropagation(); handleDeleteStairwell(sw.id) }} className="text-red-400/60 hover:text-red-400">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {selectedStairwell && (() => {
                  const sw = stairwells.find(s => s.id === selectedStairwell)
                  let servedFloors: number[] = FLOOR_NUMBERS
                  try { if (sw) servedFloors = JSON.parse(sw.floors || '[]').sort((a: number, b: number) => a - b) } catch {}
                  if (servedFloors.length === 0) servedFloors = FLOOR_NUMBERS

                  if (sw?.isTrunk) {
                    return (
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <div className="text-emerald-300 text-xs font-semibold mb-3">楼层出入口 · 井#{selectedStairwell}</div>
                        <div className="space-y-3">
                          {servedFloors.map(f => {
                            const sf = stairwellFloors.find(s => s.floor === f)
                            const isEditing = editingSF?.floor === f
                            const localData = isEditing ? editingSF : sf
                            return (
                              <div key={f} className="rounded-xl px-3 py-2.5" style={{ background: sf ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${sf ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)'}` }}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold" style={{ color: FLOOR_BORDER_COLORS[f - 1] }}>{f}F</span>
                                  <div className="flex gap-1">
                                    {!isEditing && (
                                      <button onClick={() => {
                                        setSWEditFloor(f)
                                        if (sf) { setEditingSF(sf); setSWDrawStep(2); setSWCorner1({ x: sf.rectX1, y: sf.rectY1 }); setSWCorner2({ x: sf.rectX2, y: sf.rectY2 }) }
                                        else { resetSWDraw(); setEditingSF({ id: 0, stairwellId: selectedStairwell!, floor: f, x: 50, y: 50, rectX1: 0, rectY1: 0, rectX2: 0, rectY2: 0, entryX: null, entryY: null, exitX: null, exitY: null, targetFloor1: null, targetFloor2: null }) }
                                      }} className="px-2 py-1 rounded-lg text-[10px] bg-white/5 text-white/60 hover:bg-white/10">{sf ? '编辑' : '添加'}</button>
                                    )}
                                    {sf && !isEditing && (
                                      <button onClick={() => handleDeleteStairwellFloor(sf.id)} className="px-2 py-1 rounded-lg text-[10px] bg-red-500/10 text-red-300 hover:bg-red-500/20">删</button>
                                    )}
                                  </div>
                                </div>

                                {isEditing && localData && (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <label className="block text-white/40 text-[10px]">中心X<input type="number" step="0.1" value={localData.x ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, x: Number(e.target.value) || 0 } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" /></label>
                                      <label className="block text-white/40 text-[10px]">中心Y<input type="number" step="0.1" value={localData.y ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, y: Number(e.target.value) || 0 } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" /></label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <label className="block text-white/40 text-[10px]">宽度<input type="number" step="0.1" value={localData.rectX2 != null && localData.rectX1 != null ? String(Math.round((localData.rectX2 - localData.rectX1) * 10) / 10) : ''} onChange={e => { const w = Number(e.target.value); if (isNaN(w)) return; const cx = localData.x ?? 50; setEditingSF(prev => prev ? { ...prev, rectX1: clamp(cx - w / 2), rectX2: clamp(cx + w / 2) } : null) }} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" /></label>
                                      <label className="block text-white/40 text-[10px]">高度<input type="number" step="0.1" value={localData.rectY2 != null && localData.rectY1 != null ? String(Math.round((localData.rectY2 - localData.rectY1) * 10) / 10) : ''} onChange={e => { const h = Number(e.target.value); if (isNaN(h)) return; const cy = localData.y ?? 50; setEditingSF(prev => prev ? { ...prev, rectY1: clamp(cy - h / 2), rectY2: clamp(cy + h / 2) } : null) }} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" /></label>
                                    </div>

                                    <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                      <div className="text-emerald-300/80 text-[10px] font-medium mb-1.5">出入口1</div>
                                      <div className="grid grid-cols-4 gap-1.5">
                                        <label className="block text-white/40 text-[10px]">X<input type="number" step="0.1" value={localData.entryX ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, entryX: e.target.value === '' ? null : Number(e.target.value) } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" placeholder="必填" /></label>
                                        <label className="block text-white/40 text-[10px]">Y<input type="number" step="0.1" value={localData.entryY ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, entryY: e.target.value === '' ? null : Number(e.target.value) } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" placeholder="必填" /></label>
                                        <label className="block text-white/40 text-[10px]">通往楼层<select value={localData.targetFloor1 ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, targetFloor1: e.target.value === '' ? null : Number(e.target.value) } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]"><option value="">选</option>{servedFloors.filter(ff => ff !== f).map(ff => <option key={ff} value={ff}>{ff}楼</option>)}</select></label>
                                        <div className="flex items-end"><button onClick={() => { setSWEditFloor(f); setSWPointMode('entry') }} className="mt-0.5 w-full px-2 py-1.5 rounded-lg text-[10px] bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 flex items-center justify-center gap-1"><MapPin size={10} />标记</button></div>
                                      </div>
                                    </div>

                                    <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
                                      <div className="text-blue-300/80 text-[10px] font-medium mb-1.5">出入口2 <span className="text-white/20">(可选)</span></div>
                                      <div className="grid grid-cols-4 gap-1.5">
                                        <label className="block text-white/40 text-[10px]">X<input type="number" step="0.1" value={localData.exitX ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, exitX: e.target.value === '' ? null : Number(e.target.value) } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" placeholder="可选" /></label>
                                        <label className="block text-white/40 text-[10px]">Y<input type="number" step="0.1" value={localData.exitY ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, exitY: e.target.value === '' ? null : Number(e.target.value) } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" placeholder="可选" /></label>
                                        <label className="block text-white/40 text-[10px]">通往楼层<select value={localData.targetFloor2 ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, targetFloor2: e.target.value === '' ? null : Number(e.target.value) } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]"><option value="">选</option>{servedFloors.filter(ff => ff !== f).map(ff => <option key={ff} value={ff}>{ff}楼</option>)}</select></label>
                                        <div className="flex items-end"><button onClick={() => { setSWEditFloor(f); setSWPointMode('exit') }} className="mt-0.5 w-full px-2 py-1.5 rounded-lg text-[10px] bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 flex items-center justify-center gap-1"><MapPin size={10} />标记</button></div>
                                      </div>
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                      <button onClick={() => { setEditingSF(null); resetSWDraw(); setSWPointMode('none') }} className="px-3 py-1.5 rounded-lg text-[10px] bg-white/5 text-white/60 hover:bg-white/10">取消</button>
                                      <button onClick={handleSaveStairwellFloor} className="px-3 py-1.5 rounded-lg text-[10px] bg-amber-500 text-white font-medium flex items-center gap-1"><Save size={10} />保存</button>
                                    </div>
                                  </div>
                                )}

                                {!isEditing && sf && (
                                  <div className="text-white/30 text-[10px] mt-1 space-y-0.5">
                                    {sf.entryX != null && sf.entryY != null && (
                                      <div>出入口1: ({sf.entryX.toFixed(1)},{sf.entryY.toFixed(1)}) → {sf.targetFloor1 != null ? `${sf.targetFloor1}楼` : '未设置'}</div>
                                    )}
                                    {sf.exitX != null && sf.exitY != null && (
                                      <div>出入口2: ({sf.exitX.toFixed(1)},{sf.exitY.toFixed(1)}) → {sf.targetFloor2 != null ? `${sf.targetFloor2}楼` : '未设置'}</div>
                                    )}
                                    {!sf.entryX && !sf.exitX && <div className="text-white/20">未设置出入口</div>}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }

                  return (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="text-amber-300 text-xs font-semibold mb-3">楼层数据 · 井#{selectedStairwell}</div>
                    <div className="space-y-3">
                      {servedFloors.map(f => {
                        const sf = stairwellFloors.find(s => s.floor === f)
                        const isEditing = editingSF?.floor === f
                        const localData = isEditing ? editingSF : sf
                        return (
                          <div key={f} className="rounded-xl px-3 py-2.5"
                            style={{
                              background: sf ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${sf ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.05)'}`,
                            }}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold" style={{ color: FLOOR_BORDER_COLORS[f - 1] }}>{f}F</span>
                              <div className="flex gap-1">
                                {!isEditing && (
                                  <button onClick={() => {
                                    setSWEditFloor(f)
                                    if (sf) { setEditingSF(sf); setSWDrawStep(2); setSWCorner1({ x: sf.rectX1, y: sf.rectY1 }); setSWCorner2({ x: sf.rectX2, y: sf.rectY2 }) }
                                    else { resetSWDraw(); setEditingSF({ id: 0, stairwellId: selectedStairwell!, floor: f, x: 50, y: 50, rectX1: 0, rectY1: 0, rectX2: 0, rectY2: 0, entryX: null, entryY: null, exitX: null, exitY: null }) }
                                  }} className="px-2 py-1 rounded-lg text-[10px] bg-white/5 text-white/60 hover:bg-white/10">{sf ? '编辑' : '添加'}</button>
                                )}
                                {sf && !isEditing && (
                                  <button onClick={() => handleDeleteStairwellFloor(sf.id)} className="px-2 py-1 rounded-lg text-[10px] bg-red-500/10 text-red-300 hover:bg-red-500/20">删</button>
                                )}
                              </div>
                            </div>
                            {isEditing && localData && (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-1.5">
                                  <label className="block text-white/40 text-[10px]">中心X<input type="number" step="0.1" value={localData.x ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, x: Number(e.target.value) || 0 } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" /></label>
                                  <label className="block text-white/40 text-[10px]">中心Y<input type="number" step="0.1" value={localData.y ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, y: Number(e.target.value) || 0 } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" /></label>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <label className="block text-white/40 text-[10px]">宽度<input type="number" step="0.1" value={localData.rectX2 != null && localData.rectX1 != null ? String(Math.round((localData.rectX2 - localData.rectX1) * 10) / 10) : ''} onChange={e => { const w = Number(e.target.value); if (isNaN(w)) return; const cx = localData.x ?? 50; setEditingSF(prev => prev ? { ...prev, rectX1: clamp(cx - w / 2), rectX2: clamp(cx + w / 2) } : null) }} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" /></label>
                                  <label className="block text-white/40 text-[10px]">高度<input type="number" step="0.1" value={localData.rectY2 != null && localData.rectY1 != null ? String(Math.round((localData.rectY2 - localData.rectY1) * 10) / 10) : ''} onChange={e => { const h = Number(e.target.value); if (isNaN(h)) return; const cy = localData.y ?? 50; setEditingSF(prev => prev ? { ...prev, rectY1: clamp(cy - h / 2), rectY2: clamp(cy + h / 2) } : null) }} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" /></label>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <label className="block text-white/40 text-[10px]">出入口1-X<input type="number" step="0.1" value={localData.entryX ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, entryX: e.target.value === '' ? null : Number(e.target.value) } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" placeholder="必填" /></label>
                                  <label className="block text-white/40 text-[10px]">出入口1-Y<input type="number" step="0.1" value={localData.entryY ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, entryY: e.target.value === '' ? null : Number(e.target.value) } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" placeholder="必填" /></label>
                                </div>
                                <button onClick={() => { setSWEditFloor(f); setSWPointMode('entry') }} className="w-full px-3 py-1.5 rounded-lg text-[10px] bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 flex items-center justify-center gap-1"><MapPin size={10} />选点标记出入口1</button>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <label className="block text-white/40 text-[10px]">出入口2-X<input type="number" step="0.1" value={localData.exitX ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, exitX: e.target.value === '' ? null : Number(e.target.value) } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" placeholder="可选" /></label>
                                  <label className="block text-white/40 text-[10px]">出入口2-Y<input type="number" step="0.1" value={localData.exitY ?? ''} onChange={e => setEditingSF(prev => prev ? { ...prev, exitY: e.target.value === '' ? null : Number(e.target.value) } : null)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white text-[11px]" placeholder="可选" /></label>
                                </div>
                                <button onClick={() => { setSWEditFloor(f); setSWPointMode('exit') }} className="w-full px-3 py-1.5 rounded-lg text-[10px] bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 flex items-center justify-center gap-1"><MapPin size={10} />选点标记出入口2</button>
                                <div className="flex gap-2 justify-end">
                                  <button onClick={() => { setEditingSF(null); resetSWDraw(); setSWPointMode('none') }} className="px-3 py-1.5 rounded-lg text-[10px] bg-white/5 text-white/60 hover:bg-white/10">取消</button>
                                  <button onClick={handleSaveStairwellFloor} className="px-3 py-1.5 rounded-lg text-[10px] bg-amber-500 text-white font-medium flex items-center gap-1"><Save size={10} />保存</button>
                                </div>
                              </div>
                            )}
                            {!isEditing && sf && (
                              <div className="text-white/30 text-[10px] mt-1">
                                中心({sf.x.toFixed(1)},{sf.y.toFixed(1)})
                                {sf.entryX != null && sf.entryY != null && ` · 出入口1(${sf.entryX.toFixed(1)},${sf.entryY.toFixed(1)})`}
                                {sf.exitX != null && sf.exitY != null && ` · 出入口2(${sf.exitX.toFixed(1)},${sf.exitY.toFixed(1)})`}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  )
                })()}

                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="text-amber-300 text-xs font-semibold mb-2">楼梯井说明</div>
                  <div className="text-white/40 text-xs leading-relaxed space-y-1">
                    <div>1. 创建楼梯井后选择楼层编辑</div>
                    <div>2. 在地图上点击两个对角定区域</div>
                    <div>3. 设置中心点、矩形范围和出口</div>
                    <div>4. 可从已配置楼层复制到其他楼层</div>
                    <div>5. 每层楼的楼梯井位置可独立调整</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════ MODALS ═══════════ */}
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
                  <button onClick={handleSaveFloorNodeEdit} className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium">保存</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCreateSW && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-end justify-center pb-8 z-50" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowCreateSW(false)}>
              <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} className="w-full max-w-sm mx-4 rounded-2xl p-5 shadow-2xl" style={{ background: 'rgba(18,18,24,0.98)', border: '1px solid rgba(245,158,11,0.2)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div><div className="text-white text-sm font-semibold">创建楼梯井</div><div className="text-white/35 text-xs">设置建筑类型和服务楼层</div></div>
                  <button onClick={() => setShowCreateSW(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
                </div>
                <div className="mb-4">
                  <div className="text-white/50 text-xs mb-2">建筑类型</div>
                  <select value={newSWCategory} onChange={e => setNewSWCategory(e.target.value)} className="w-full py-2 px-3 rounded-xl text-white/90 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}>
                    {campus === 'senior' ? (
                      <option value="senior" style={{ background: '#111' }}>高中部</option>
                    ) : (
                      <>
                        <option value="teaching_a" style={{ background: '#111' }}>教学楼A栋</option>
                        <option value="teaching_b" style={{ background: '#111' }}>教学楼B栋</option>
                        <option value="teaching_c" style={{ background: '#111' }}>教学楼C栋</option>
                        <option value="admin" style={{ background: '#111' }}>行政楼</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="mb-4">
                  <div className="text-white/50 text-xs mb-2">服务楼层</div>
                  <div className="flex flex-wrap gap-2">
                    {FLOOR_NUMBERS.map(f => (
                      <button key={f} onClick={() => setNewSWFloors(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f].sort())}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${newSWFloors.includes(f) ? 'bg-amber-500 text-white' : 'bg-white/5 text-white/50'}`}>
                        {f}F
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowCreateSW(false)} className="px-4 py-2 rounded-xl bg-white/5 text-white/70 text-sm">取消</button>
                  <button onClick={handleCreateStairwell} disabled={newSWFloors.length < 2} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium disabled:opacity-40">创建</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </AdminShell>
  )
}
