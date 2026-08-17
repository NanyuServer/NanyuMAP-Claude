// src/app/api/navigation/multi-waypoint/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { astar, findNearestEdgeEndpoint } from '@/lib/astar'
import type { NavigationNode, NavigationEdge } from '@/types/navigation'

function campusNorm(v: unknown): string { return v === 'senior' ? 'senior' : 'junior' }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { waypointIds, customWaypoints, campus, startGate } = body
    // waypointIds: number[] (location IDs)
    // customWaypoints: {x: number, y: number, name: string}[]

    if ((!Array.isArray(waypointIds) || waypointIds.length === 0) && (!Array.isArray(customWaypoints) || customWaypoints.length === 0)) {
      return NextResponse.json({ error: 'waypointIds or customWaypoints required' }, { status: 400 })
    }

    const campusFilter = campusNorm(campus)

    // Load road network
    let rawNodes: any[]
    try {
      rawNodes = await prisma.$queryRaw<any[]>`SELECT id, x, y, campus FROM road_nodes WHERE campus = ${campusFilter} ORDER BY id ASC`
    } catch { rawNodes = [] }

    let rawEdges: any[]
    try {
      rawEdges = await prisma.$queryRaw<any[]>`SELECT id, from_node, to_node, distance, campus, is_trunk FROM road_edges WHERE campus = ${campusFilter} ORDER BY id ASC`
    } catch { rawEdges = [] }

    const nodes: NavigationNode[] = rawNodes.map(n => ({
      id: n.id, x: n.x, y: n.y, campus: n.campus,
    }))

    const edges: NavigationEdge[] = rawEdges.map(e => ({
      id: e.id, fromNode: e.from_node || e.fromNode, toNode: e.to_node || e.toNode,
      campus: e.campus, distance: e.distance, isTrunk: !!e.isTrunk,
    }))

    if (nodes.length === 0) return NextResponse.json({ error: 'No road network' }, { status: 400 })

    // Load waypoint locations
    let waypointLocs: any[] = []
    if (Array.isArray(waypointIds) && waypointIds.length > 0) {
      waypointLocs = await prisma.location.findMany({
        where: { id: { in: waypointIds.map(Number) } },
      })
    }
    const locMap = new Map(waypointLocs.map(l => [l.id, l]))

    // Build coordinate list: start gate → checkpoints (ordered)
    // We need to merge waypointIds and customWaypoints in order
    // The admin page stores them as a unified ordered list
    const coords: { x: number; y: number; id: number | string; name: string }[] = []

    // Add start gate as first point
    if (startGate) {
      const gateLoc = await prisma.location.findFirst({ where: { category: startGate, campus: campusFilter } })
      if (gateLoc) coords.push({ x: gateLoc.x, y: gateLoc.y, id: gateLoc.id, name: gateLoc.detailInfo || gateLoc.category })
    }

    // Add checkpoints from IDs
    if (Array.isArray(waypointIds)) {
      for (const wid of waypointIds) {
        const loc = locMap.get(Number(wid))
        if (loc) coords.push({ x: loc.x, y: loc.y, id: loc.id, name: loc.detailInfo || loc.category })
      }
    }

    // Add custom waypoints
    if (Array.isArray(customWaypoints)) {
      for (const cw of customWaypoints) {
        if (cw && typeof cw.x === 'number' && typeof cw.y === 'number') {
          coords.push({ x: cw.x, y: cw.y, id: `custom_${cw.x}_${cw.y}`, name: cw.name || '自定义点' })
        }
      }
    }

    if (coords.length < 2) return NextResponse.json({ error: 'Need at least 2 points' }, { status: 400 })

    // Calculate path through all waypoints.
    // 关键：把每个途经点(标记点)自身的坐标也写入 path，
    // 这样绘制出的轨迹线会精确穿过每个标记点，与打卡点标记对齐。
    const fullPath: { x: number; y: number }[] = []
    let totalDistance = 0

    for (let i = 0; i < coords.length - 1; i++) {
      const from = coords[i]
      const to = coords[i + 1]

      // 起点途经点坐标入轨（仅首段，避免重复）
      if (fullPath.length === 0) fullPath.push({ x: from.x, y: from.y })

      const startInfo = findNearestEdgeEndpoint(nodes, edges, from.x, from.y)
      const endInfo = findNearestEdgeEndpoint(nodes, edges, to.x, to.y)

      if (startInfo && endInfo) {
        const result = astar(nodes, edges, startInfo.nearestEndpointId, endInfo.nearestEndpointId)

        if (result && result.nodes.length > 0) {
          const segmentNodes = result.nodes.map(n => ({ x: n.x, y: n.y }))
          // 去掉与上一段末尾重合的首节点，避免折返
          if (segmentNodes.length > 0) {
            const prev = fullPath[fullPath.length - 1]
            const first = segmentNodes[0]
            if (Math.abs(prev.x - first.x) < 1e-6 && Math.abs(prev.y - first.y) < 1e-6) segmentNodes.shift()
          }
          fullPath.push(...segmentNodes)
          totalDistance += result.totalDistance
        }
      }

      // 终点途经点坐标入轨，保证轨迹线到达标记点
      fullPath.push({ x: to.x, y: to.y })
    }

    // 去重连续相同点（避免零长度线段）
    const deduped: { x: number; y: number }[] = []
    for (const p of fullPath) {
      const last = deduped[deduped.length - 1]
      if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) continue
      deduped.push(p)
    }

    return NextResponse.json({
      path: deduped,
      totalDistance,
      waypoints: coords.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y })),
    })
  } catch (error) {
    console.error('POST /api/navigation/multi-waypoint error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
