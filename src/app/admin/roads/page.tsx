'use client'
// src/app/admin/roads/page.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Info, MousePointer, Link2, Move } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import type { RoadNode, RoadEdge } from '@/types'

type Mode = 'add_node' | 'connect' | 'delete' | 'move'

const MAP_DISPLAY_W = 900
const MAP_DISPLAY_H = 600
const MAP_REAL_W = 2400
const MAP_REAL_H = 1600

function toDisplay(val: number, mapW: boolean) {
  return mapW ? (val / MAP_REAL_W) * MAP_DISPLAY_W : (val / MAP_REAL_H) * MAP_DISPLAY_H
}
function toReal(val: number, mapW: boolean) {
  return mapW ? (val / MAP_DISPLAY_W) * MAP_REAL_W : (val / MAP_DISPLAY_H) * MAP_REAL_H
}

export default function RoadsPage() {
  const [nodes, setNodes] = useState<RoadNode[]>([])
  const [edges, setEdges] = useState<RoadEdge[]>([])
  const [mode, setMode] = useState<Mode>('add_node')
  const [selectedNode, setSelectedNode] = useState<number | null>(null)
  const [draggingNode, setDraggingNode] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef<SVGSVGElement>(null)

  const fetchRoads = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/roads')
    const data = await res.json()
    setNodes(data.nodes || [])
    setEdges(data.edges || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRoads() }, [fetchRoads])

  const api = async (action: string, data: Record<string, unknown>) => {
    const res = await fetch('/api/roads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data }),
    })
    return res.json()
  }

  const handleSvgClick = async (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingNode !== null) return
    const rect = mapRef.current!.getBoundingClientRect()
    const dx = e.clientX - rect.left
    const dy = e.clientY - rect.top
    const rx = toReal(dx, true)
    const ry = toReal(dy, false)

    if (mode === 'add_node') {
      const node = await api('add_node', { x: rx, y: ry })
      setNodes(prev => [...prev, node])
    }
  }

  const handleNodeClick = async (e: React.MouseEvent, nodeId: number) => {
    e.stopPropagation()
    if (mode === 'delete') {
      await api('delete_node', { id: nodeId })
      setNodes(prev => prev.filter(n => n.id !== nodeId))
      setEdges(prev => prev.filter(ed => ed.fromNode !== nodeId && ed.toNode !== nodeId))
      if (selectedNode === nodeId) setSelectedNode(null)
      return
    }
    if (mode === 'connect') {
      if (selectedNode === null) {
        setSelectedNode(nodeId)
      } else if (selectedNode !== nodeId) {
        const n1 = nodes.find(n => n.id === selectedNode)!
        const n2 = nodes.find(n => n.id === nodeId)!
        // Check if edge already exists
        const exists = edges.some(
          ed => (ed.fromNode === selectedNode && ed.toNode === nodeId) ||
            (ed.fromNode === nodeId && ed.toNode === selectedNode)
        )
        if (!exists) {
          const edge = await api('add_edge', {
            fromNode: selectedNode, toNode: nodeId,
            x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y,
          })
          setEdges(prev => [...prev, edge])
        }
        setSelectedNode(null)
      } else {
        setSelectedNode(null)
      }
    }
    if (mode === 'move') {
      setSelectedNode(nodeId)
    }
  }

  const handleEdgeClick = async (e: React.MouseEvent, edgeId: number) => {
    e.stopPropagation()
    if (mode === 'delete') {
      await api('delete_edge', { id: edgeId })
      setEdges(prev => prev.filter(ed => ed.id !== edgeId))
    }
  }

  // Drag for move mode
  const dragRef = useRef<{ startX: number; startY: number; nodeX: number; nodeY: number } | null>(null)

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: number) => {
    if (mode !== 'move') return
    e.stopPropagation()
    setDraggingNode(nodeId)
    const node = nodes.find(n => n.id === nodeId)!
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    }
  }

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingNode === null || !dragRef.current) return
    const rect = mapRef.current!.getBoundingClientRect()
    const dx = e.clientX - rect.left
    const dy = e.clientY - rect.top
    const rx = Math.max(0, Math.min(MAP_REAL_W, toReal(dx, true)))
    const ry = Math.max(0, Math.min(MAP_REAL_H, toReal(dy, false)))
    setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x: rx, y: ry } : n))
  }

  const handleSvgMouseUp = async () => {
    if (draggingNode !== null) {
      const node = nodes.find(n => n.id === draggingNode)!
      await api('move_node', { id: draggingNode, x: node.x, y: node.y })
      // Recalculate edge distances
      const updatedEdges = await fetch('/api/roads').then(r => r.json()).then(d => d.edges)
      setEdges(updatedEdges)
      setDraggingNode(null)
      dragRef.current = null
    }
  }

  const MODES = [
    { id: 'add_node' as Mode, icon: Plus, label: '添加节点', color: '#30D158' },
    { id: 'connect' as Mode, icon: Link2, label: '连接节点', color: '#007AFF' },
    { id: 'move' as Mode, icon: Move, label: '移动节点', color: '#FF9F0A' },
    { id: 'delete' as Mode, icon: Trash2, label: '删除', color: '#FF453A' },
  ]

  return (
    <AdminShell>
      <div className="h-full flex flex-col" style={{ background: '#0a0a0c' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,14,0.8)' }}>
          <div>
            <h1 className="text-white text-lg font-semibold">道路网络编辑器</h1>
            <p className="text-white/35 text-xs mt-0.5">{nodes.length} 个节点 · {edges.length} 条连接</p>
          </div>
          <div className="flex items-center gap-2">
            {MODES.map(m => (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => { setMode(m.id); setSelectedNode(null) }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: mode === m.id ? `${m.color}20` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${mode === m.id ? m.color + '50' : 'rgba(255,255,255,0.08)'}`,
                  color: mode === m.id ? m.color : 'rgba(255,255,255,0.45)',
                }}
              >
                <m.icon size={13} />
                {m.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Help text */}
        <div className="px-8 py-2.5 flex items-center gap-2" style={{ background: 'rgba(0,122,255,0.04)', borderBottom: '1px solid rgba(0,122,255,0.1)' }}>
          <Info size={12} className="text-blue-400/60 flex-shrink-0" />
          <span className="text-white/35 text-xs">
            {mode === 'add_node' && '点击地图空白处添加道路节点'}
            {mode === 'connect' && (selectedNode ? `已选择节点 #${selectedNode}，再点击另一节点连接` : '点击一个节点作为起点，再点击另一节点创建连接')}
            {mode === 'move' && '拖动节点调整位置'}
            {mode === 'delete' && '点击节点或连接线删除（节点删除将同时删除其所有连接）'}
          </span>
        </div>

        {/* Map editor */}
        <div className="flex-1 overflow-auto flex items-start justify-center p-6">
          {loading ? (
            <div className="text-white/30 text-sm mt-20">加载中...</div>
          ) : (
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', flexShrink: 0 }}
            >
              <img
                src="/assets/map.png"
                alt="地图"
                style={{ width: MAP_DISPLAY_W, height: MAP_DISPLAY_H, display: 'block', pointerEvents: 'none', userSelect: 'none' }}
                draggable={false}
              />
              <svg
                ref={mapRef}
                style={{ position: 'absolute', inset: 0, width: MAP_DISPLAY_W, height: MAP_DISPLAY_H, cursor: mode === 'add_node' ? 'crosshair' : mode === 'move' ? 'grab' : 'pointer' }}
                onClick={handleSvgClick}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleSvgMouseUp}
                onMouseLeave={handleSvgMouseUp}
              >
                {/* Edges */}
                {edges.map(edge => {
                  const from = nodes.find(n => n.id === edge.fromNode)
                  const to = nodes.find(n => n.id === edge.toNode)
                  if (!from || !to) return null
                  return (
                    <g key={edge.id}>
                      {/* Clickable wider hit area */}
                      <line
                        x1={toDisplay(from.x, true)} y1={toDisplay(from.y, false)}
                        x2={toDisplay(to.x, true)} y2={toDisplay(to.y, false)}
                        stroke="transparent"
                        strokeWidth={12}
                        onClick={e => handleEdgeClick(e, edge.id)}
                        style={{ cursor: mode === 'delete' ? 'pointer' : 'default' }}
                      />
                      <line
                        x1={toDisplay(from.x, true)} y1={toDisplay(from.y, false)}
                        x2={toDisplay(to.x, true)} y2={toDisplay(to.y, false)}
                        stroke={mode === 'delete' ? 'rgba(255,69,58,0.6)' : 'rgba(0,122,255,0.7)'}
                        strokeWidth={2}
                        strokeDasharray={mode === 'delete' ? '4,4' : ''}
                        onClick={e => handleEdgeClick(e, edge.id)}
                        style={{ cursor: mode === 'delete' ? 'pointer' : 'default', pointerEvents: 'none' }}
                      />
                    </g>
                  )
                })}

                {/* Nodes */}
                {nodes.map(node => {
                  const dx = toDisplay(node.x, true)
                  const dy = toDisplay(node.y, false)
                  const isSelected = selectedNode === node.id
                  return (
                    <circle
                      key={node.id}
                      cx={dx} cy={dy} r={isSelected ? 7 : 5}
                      fill={isSelected ? '#007AFF' : mode === 'delete' ? '#FF453A' : '#30D158'}
                      stroke="white"
                      strokeWidth={isSelected ? 2 : 1.5}
                      style={{ cursor: 'pointer', filter: isSelected ? 'drop-shadow(0 0 4px rgba(0,122,255,0.8))' : 'none' }}
                      onClick={e => handleNodeClick(e, node.id)}
                      onMouseDown={e => handleNodeMouseDown(e, node.id)}
                    />
                  )
                })}
              </svg>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
