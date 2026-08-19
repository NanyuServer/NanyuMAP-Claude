// src/app/api/navigation/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { astar, astarFloorAware, findNearestEdgeEndpoint } from '@/lib/astar'
import { BUILDING_CATEGORY_MAP, ROAD_TYPE_PRIORITY_MAP, DEFAULT_FLOORS } from '@/types'
import type { NavigationNode, NavigationEdge } from '@/types/navigation'

function campusNorm(v: unknown): string {
  return v === 'senior' ? 'senior' : 'junior'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { start, destinationId, campus, routeMode } = body

    const isTrunkMode = routeMode === 'trunk'

    if (!start || !destinationId) return NextResponse.json({ error: 'Missing start or destinationId' }, { status: 400 })

    const rawDestination = await prisma.location.findUnique({ where: { id: parseInt(destinationId) } })
    if (!rawDestination) return NextResponse.json({ error: 'Destination not found' }, { status: 404 })

    const destination = {
      id: rawDestination.id,
      category: rawDestination.category,
      detailInfo: rawDestination.detailInfo ?? rawDestination.category,
      extraInfo: rawDestination.extraInfo ?? null,
      x: rawDestination.x,
      y: rawDestination.y,
      floor: rawDestination.floor ?? null,
    }

    const destBuildingCategory = BUILDING_CATEGORY_MAP[rawDestination.category] || null

    const campusFilter = campusNorm(campus)

    let rawNodes: any[]
    try {
      rawNodes = await prisma.$queryRaw<any[]>`SELECT id, x, y, campus, is_staircase, staircase_floors, building_category, stairwell_id, stairwell_floor, stairwell_role FROM road_nodes WHERE campus = ${campusFilter} ORDER BY id ASC`
    } catch {
      try {
        rawNodes = await prisma.$queryRaw<any[]>`SELECT id, x, y, campus, is_staircase, staircase_floors, building_category FROM road_nodes WHERE campus = ${campusFilter} ORDER BY id ASC`
      } catch {
        rawNodes = await prisma.$queryRaw<any[]>`SELECT id, x, y, campus FROM road_nodes WHERE campus = ${campusFilter} ORDER BY id ASC`
      }
    }

    let rawEdges: any[]
    try {
      rawEdges = await prisma.$queryRaw<any[]>`SELECT id, from_node, to_node, distance, campus, is_trunk, floors, road_type, is_slope, slope_floors FROM road_edges WHERE campus = ${campusFilter} ORDER BY id ASC`
    } catch {
      try {
        rawEdges = await prisma.$queryRaw<any[]>`SELECT id, from_node, to_node, distance, campus, is_trunk, floors, road_type FROM road_edges WHERE campus = ${campusFilter} ORDER BY id ASC`
      } catch {
        rawEdges = await prisma.$queryRaw<any[]>`SELECT id, from_node, to_node, distance, campus FROM road_edges WHERE campus = ${campusFilter} ORDER BY id ASC`
      }
    }

    const nodes: NavigationNode[] = rawNodes.map(n => ({
      id: n.id, x: n.x, y: n.y, campus: n.campus,
      isStaircase: n.isStaircase ?? false,
      staircaseFloors: n.staircaseFloors ?? '[]',
      buildingCategory: n.building_category ?? n.buildingCategory ?? null,
      stairwellId: n.stairwell_id ?? n.stairwellId ?? null,
      stairwellFloor: n.stairwell_floor ?? n.stairwellFloor ?? null,
      stairwellRole: n.stairwell_role ?? n.stairwellRole ?? null,
    }))

    if (nodes.length === 0) return NextResponse.json({ error: 'No road network configured for this campus' }, { status: 400 })

    let startCoords: { x: number; y: number } | null = null
    let startLocationObj: any = null

    if (typeof start === 'string') {
      startLocationObj = await prisma.location.findFirst({ where: { category: start, campus: campusFilter }, orderBy: { id: 'desc' } })
      if (!startLocationObj) return NextResponse.json({ error: `Start location "${start}" not found for campus ${campusFilter}` }, { status: 404 })
      startCoords = { x: startLocationObj.x, y: startLocationObj.y }
    } else if (start && typeof start === 'object' && start.x != null && start.y != null) {
      startCoords = { x: Number(start.x), y: Number(start.y) }
      if (start.id) {
        const locById = await prisma.location.findUnique({ where: { id: Number(start.id) } })
        if (locById) {
          startLocationObj = { id: locById.id, x: locById.x, y: locById.y, floor: locById.floor ?? null, category: locById.category, detailInfo: locById.detailInfo ?? locById.category }
        } else {
          startLocationObj = { x: startCoords.x, y: startCoords.y }
        }
      } else {
        startLocationObj = { x: startCoords.x, y: startCoords.y }
      }
    } else {
      return NextResponse.json({ error: 'Invalid start format' }, { status: 400 })
    }

    const TRUNK_FACTOR_NORMAL = 0.8
    const TRUNK_FACTOR_PRIORITY = 0.15
    const ROAD_TYPE_FACTOR = 0.4
    const SLOPE_TIME_COST = 15
    const BUILD_EDGES = (factor: number, addSlopeCost: boolean) => rawEdges.map((e: any) => {
      let distance = e.distance
      if (e.isTrunk) distance *= factor
      const roadType = e.road_type || e.roadType || 'default'
      if (roadType !== 'default' && destBuildingCategory) {
        const priority = ROAD_TYPE_PRIORITY_MAP[roadType]
        if (priority && priority.buildingCategories.includes(destBuildingCategory)) {
          distance *= ROAD_TYPE_FACTOR
        }
      }
      const isSlope = !!(e.is_slope || e.isSlope)
      if (addSlopeCost && isSlope) distance += SLOPE_TIME_COST
      if (isSlope && roadType.includes('admin') && destBuildingCategory !== 'admin') {
        distance *= 8
      }
      return {
        id: e.id, fromNode: e.from_node || e.fromNode, toNode: e.to_node || e.toNode, campus: e.campus,
        distance, isTrunk: !!e.isTrunk, floors: e.floors || '[]', roadType,
        isSlope, slopeFloors: e.slope_floors || e.slopeFloors || '[]',
      } as NavigationEdge
    })

    const trunkFactor = isTrunkMode ? TRUNK_FACTOR_PRIORITY : TRUNK_FACTOR_NORMAL
    const adjustedEdges = BUILD_EDGES(trunkFactor, !isTrunkMode)

    let destFloor: number | null = destination.floor ?? null

    let startFloor = 0
    if (startLocationObj && typeof startLocationObj.floor === 'number' && startLocationObj.floor > 0) {
      startFloor = startLocationObj.floor
    }
    if (campusFilter === 'senior') {
      if (startFloor === 0 && typeof start === 'string') {
        startFloor = DEFAULT_FLOORS[start] || 1
      }
      if (startFloor === 0) startFloor = 1
      if (destFloor == null || destFloor <= 0) destFloor = startFloor
    }

    // Same-floor senior routes must not traverse staircase roads or enter stairwells.
    const avoidStairs = campusFilter === 'senior' && startFloor === destFloor
    const routingEdges = avoidStairs ? adjustedEdges.filter(e => e.roadType !== 'staircase') : adjustedEdges

    const snapFloor = campusFilter === 'senior'
    const startEdgeInfo = findNearestEdgeEndpoint(nodes, routingEdges, startCoords.x, startCoords.y, snapFloor ? startFloor : null)
    let endEdgeInfo = findNearestEdgeEndpoint(nodes, routingEdges, destination.x, destination.y, snapFloor ? destFloor : null)
    if (!startEdgeInfo || !endEdgeInfo) return NextResponse.json({ error: 'Cannot find road nodes or edges' }, { status: 400 })

    let trunkEndpointSnapshot: { x: number; y: number } | null = null
    if (isTrunkMode) {
      let trunkEdges = rawEdges.filter((e: any) => !!e.isTrunk)
      if (avoidStairs) trunkEdges = trunkEdges.filter((e: any) => (e.road_type || e.roadType || 'default') !== 'staircase')
      if (trunkEdges.length > 0) {
        const trunkNavEdges: NavigationEdge[] = trunkEdges.map((e: any) => ({
          id: e.id, fromNode: e.from_node || e.fromNode, toNode: e.to_node || e.toNode, campus: e.campus, distance: e.distance, isTrunk: true, floors: e.floors || '[]', roadType: e.road_type || e.roadType || 'default',
          isSlope: !!(e.is_slope || e.isSlope), slopeFloors: e.slope_floors || e.slopeFloors || '[]',
        }))
        const trunkEndInfo = findNearestEdgeEndpoint(nodes, trunkNavEdges, destination.x, destination.y, snapFloor ? destFloor : null)
        if (trunkEndInfo) {
          const nearestNode = nodes.find(n => n.id === trunkEndInfo.nearestEndpointId)
          if (nearestNode) {
            trunkEndpointSnapshot = { x: nearestNode.x, y: nearestNode.y }
            endEdgeInfo = trunkEndInfo
          }
        }
      }
    }

    const startNodeId = startEdgeInfo.nearestEndpointId
    const endNodeId = endEdgeInfo.nearestEndpointId
    const virtualStart = startEdgeInfo.closestPoint
    const virtualEnd = endEdgeInfo.closestPoint
    const startIsSnapped = startEdgeInfo.t <= 0.001 || startEdgeInfo.t >= 0.999
    const endIsSnapped = endEdgeInfo.t <= 0.001 || endEdgeInfo.t >= 0.999

    let pathNodes: NavigationNode[]
    let totalDistance: number
    let staircaseEvents: Array<{ nodeId: number; x: number; y: number; fromFloor: number; toFloor: number; buildingCategory?: string | null; roadType?: string | null; fromX?: number; fromY?: number }> = []

    let preferredStairNodeId: number | undefined
    const trunkStairwellIds = new Set<number>()
    const stairwellWeightMap = new Map<number, number>()

    if (campusFilter === 'senior') {
      try {
        const swRows = await prisma.$queryRaw<any[]>`SELECT id, is_trunk, COALESCE(weight, 0) as weight FROM stairwells WHERE campus = 'senior'`
        for (const sw of swRows) {
          if (sw.is_trunk) trunkStairwellIds.add(sw.id)
          stairwellWeightMap.set(sw.id, sw.weight ?? 0)
        }
      } catch {}
    }

    if (campusFilter === 'junior') {
      try {
        const swRows = await prisma.$queryRaw<any[]>`SELECT id, COALESCE(weight, 0) as weight FROM stairwells WHERE campus = 'junior'`
        for (const sw of swRows) {
          stairwellWeightMap.set(sw.id, sw.weight ?? 0)
        }
      } catch {}
    }

    if (destFloor != null && destFloor !== startFloor) {
      let bestStairId: number | undefined
      let bestScore = Infinity
      for (const n of nodes) {
        if (!n.stairwellId) continue
        // entry/entry1/entry2/center 都是有效的楼梯入口节点
        const role = n.stairwellRole || ''
        if (role !== 'entry' && role !== 'entry1' && role !== 'entry2' && role !== 'center') continue
        const distFromStart = Math.sqrt((n.x - startCoords.x) ** 2 + (n.y - startCoords.y) ** 2)
        const distFromEnd = Math.sqrt((n.x - destination.x) ** 2 + (n.y - destination.y) ** 2)
        const stairCat = n.buildingCategory || null
        const categoryMatch = stairCat && destBuildingCategory && stairCat === destBuildingCategory
        const score = distFromStart + distFromEnd * 0.3 + (categoryMatch ? 0 : 50)
        if (score < bestScore) {
          bestScore = score
          bestStairId = n.id
        }
      }
      preferredStairNodeId = bestStairId
    }

    if (startNodeId === endNodeId && startIsSnapped && endIsSnapped) {
      const node = nodes.find(n => n.id === startNodeId)!
      pathNodes = [node]; totalDistance = 0
    } else if (startNodeId === endNodeId && (!startIsSnapped || !endIsSnapped)) {
      const node = nodes.find(n => n.id === startNodeId)!
      pathNodes = []
      if (!startIsSnapped) pathNodes.push({ id: -1, x: virtualStart.x, y: virtualStart.y, campus: campusFilter })
      pathNodes.push(node)
      if (!endIsSnapped) pathNodes.push({ id: -2, x: virtualEnd.x, y: virtualEnd.y, campus: campusFilter })
      totalDistance = 0
      for (let i = 1; i < pathNodes.length; i++) { const dx = pathNodes[i].x - pathNodes[i - 1].x; const dy = pathNodes[i].y - pathNodes[i - 1].y; totalDistance += Math.sqrt(dx * dx + dy * dy) }
    } else {
      let result: { nodes: NavigationNode[]; totalDistance: number; staircaseEvents?: Array<{ nodeId: number; x: number; y: number; fromFloor: number; toFloor: number; buildingCategory?: string | null; roadType?: string | null; fromX?: number; fromY?: number }> } | null = null
      if (destFloor != null && destFloor !== startFloor) {
        result = astarFloorAware(nodes, adjustedEdges, startNodeId, endNodeId, startFloor, destFloor, destBuildingCategory, preferredStairNodeId, campusFilter === 'senior', isTrunkMode ? trunkStairwellIds : undefined, stairwellWeightMap)
        if (!result && campusFilter === 'senior') {
          return NextResponse.json({ error: '无法找到跨楼层路线，请确认楼梯井道路已正确配置' }, { status: 400 })
        }
      }
      if (!result) result = astar(nodes, routingEdges, startNodeId, endNodeId)
      if (!result) return NextResponse.json({ error: 'No path found' }, { status: 400 })

      pathNodes = [...result.nodes]; totalDistance = result.totalDistance; staircaseEvents = result.staircaseEvents || []

      if (!startIsSnapped && pathNodes.length > 0) {
        const first = pathNodes[0]
        const second = pathNodes[1] || first
        const segLen2 = (second.x - first.x) ** 2 + (second.y - first.y) ** 2
        const d1 = Math.sqrt((virtualStart.x - first.x) ** 2 + (virtualStart.y - first.y) ** 2)
        const d2 = Math.sqrt((virtualStart.x - second.x) ** 2 + (virtualStart.y - second.y) ** 2)
        const segLen = Math.sqrt(segLen2)
        if (segLen > 0.1 && d1 + d2 - segLen < 0.5) {
          totalDistance += d2
          pathNodes[0] = { id: -1, x: virtualStart.x, y: virtualStart.y, campus: campusFilter }
        } else {
          const dx = first.x - virtualStart.x; const dy = first.y - virtualStart.y
          totalDistance += Math.sqrt(dx * dx + dy * dy)
          pathNodes.unshift({ id: -1, x: virtualStart.x, y: virtualStart.y, campus: campusFilter })
        }
      }

      if (!endIsSnapped && pathNodes.length > 0) {
        const last = pathNodes[pathNodes.length - 1]
        const prev = pathNodes[pathNodes.length - 2] || last
        const segLen2 = (last.x - prev.x) ** 2 + (last.y - prev.y) ** 2
        const d1 = Math.sqrt((virtualEnd.x - prev.x) ** 2 + (virtualEnd.y - prev.y) ** 2)
        const d2 = Math.sqrt((virtualEnd.x - last.x) ** 2 + (virtualEnd.y - last.y) ** 2)
        const segLen = Math.sqrt(segLen2)
        if (segLen > 0.1 && d1 + d2 - segLen < 0.5) {
          totalDistance += d1
          pathNodes[pathNodes.length - 1] = { id: -2, x: virtualEnd.x, y: virtualEnd.y, campus: campusFilter }
        } else {
          const dx = virtualEnd.x - last.x; const dy = virtualEnd.y - last.y
          totalDistance += Math.sqrt(dx * dx + dy * dy)
          pathNodes.push({ id: -2, x: virtualEnd.x, y: virtualEnd.y, campus: campusFilter })
        }
      }
      if (isTrunkMode && trunkEndpointSnapshot && pathNodes.length > 0) {
        const last = pathNodes[pathNodes.length - 1]
        const dx = destination.x - trunkEndpointSnapshot.x
        const dy = destination.y - trunkEndpointSnapshot.y
        const extraDist = Math.sqrt(dx * dx + dy * dy)
        if (extraDist > 0.01) {
          totalDistance += extraDist
          pathNodes.push({ id: -3, x: destination.x, y: destination.y, campus: campusFilter })
        }
      }
    }

    let fallbackToShortest = false
    let shortestDist: number | null = null
    let trunkDistance: number | null = null
    if (isTrunkMode && totalDistance > 0) {
      trunkDistance = totalDistance
      const normalEdgesBase = BUILD_EDGES(TRUNK_FACTOR_NORMAL, true)
      const normalEdges = avoidStairs ? normalEdgesBase.filter(e => e.roadType !== 'staircase') : normalEdgesBase
      const normalStart = findNearestEdgeEndpoint(nodes, normalEdges, startCoords.x, startCoords.y, snapFloor ? startFloor : null)
      const normalEnd = findNearestEdgeEndpoint(nodes, normalEdges, destination.x, destination.y, snapFloor ? destFloor : null)
      if (normalStart && normalEnd) {
        let normalResult: { nodes: NavigationNode[]; totalDistance: number; staircaseEvents?: Array<{ nodeId: number; x: number; y: number; fromFloor: number; toFloor: number; buildingCategory?: string | null; roadType?: string | null; fromX?: number; fromY?: number }> } | null = null
        if (destFloor != null && destFloor !== startFloor) {
          normalResult = astarFloorAware(nodes, normalEdges, normalStart.nearestEndpointId, normalEnd.nearestEndpointId, startFloor, destFloor, destBuildingCategory, preferredStairNodeId)
        }
        if (!normalResult && !(campusFilter === 'senior' && destFloor != null && destFloor !== startFloor)) {
          normalResult = astar(nodes, normalEdges, normalStart.nearestEndpointId, normalEnd.nearestEndpointId)
        }
        if (normalResult) {
          shortestDist = normalResult.totalDistance
          const FALLBACK_RATIO = 1.5
          if (totalDistance > shortestDist * FALLBACK_RATIO && shortestDist > 0) {
            totalDistance = normalResult.totalDistance
            pathNodes = [...normalResult.nodes]
            staircaseEvents = normalResult.staircaseEvents || []
            fallbackToShortest = true
            if (!startIsSnapped && pathNodes.length > 0) {
              const first = pathNodes[0]; const second = pathNodes[1] || first
              const sx = normalStart.closestPoint.x; const sy = normalStart.closestPoint.y
              const segLen2 = (second.x - first.x) ** 2 + (second.y - first.y) ** 2
              const d1 = Math.sqrt((sx - first.x) ** 2 + (sy - first.y) ** 2)
              const d2 = Math.sqrt((sx - second.x) ** 2 + (sy - second.y) ** 2)
              const segLen = Math.sqrt(segLen2)
              if (segLen > 0.1 && d1 + d2 - segLen < 0.5) {
                totalDistance += d2
                pathNodes[0] = { id: -1, x: sx, y: sy, campus: campusFilter }
              } else {
                totalDistance += Math.sqrt((first.x - sx) ** 2 + (first.y - sy) ** 2)
                pathNodes.unshift({ id: -1, x: sx, y: sy, campus: campusFilter })
              }
            }
            if (!endIsSnapped && pathNodes.length > 0) {
              const last = pathNodes[pathNodes.length - 1]; const prev = pathNodes[pathNodes.length - 2] || last
              const ex = normalEnd.closestPoint.x; const ey = normalEnd.closestPoint.y
              const segLen2 = (last.x - prev.x) ** 2 + (last.y - prev.y) ** 2
              const d1 = Math.sqrt((ex - prev.x) ** 2 + (ey - prev.y) ** 2)
              const d2 = Math.sqrt((ex - last.x) ** 2 + (ey - last.y) ** 2)
              const segLen = Math.sqrt(segLen2)
              if (segLen > 0.1 && d1 + d2 - segLen < 0.5) {
                totalDistance += d1
                pathNodes[pathNodes.length - 1] = { id: -2, x: ex, y: ey, campus: campusFilter }
              } else {
                totalDistance += Math.sqrt((ex - last.x) ** 2 + (ey - last.y) ** 2)
                pathNodes.push({ id: -2, x: ex, y: ey, campus: campusFilter })
              }
            }
          }
        }
      }
    }

    if (pathNodes.length > 0) {
      const firstNode = pathNodes[0]
      const distToStart = Math.sqrt((firstNode.x - startCoords.x) ** 2 + (firstNode.y - startCoords.y) ** 2)
      if (distToStart > 0.5) {
        totalDistance += distToStart
        pathNodes.unshift({ id: -10, x: startCoords.x, y: startCoords.y, campus: campusFilter })
      }

      const lastNode = pathNodes[pathNodes.length - 1]
      const distToEnd = Math.sqrt((lastNode.x - destination.x) ** 2 + (lastNode.y - destination.y) ** 2)
      if (distToEnd > 0.5) {
        totalDistance += distToEnd
        pathNodes.push({ id: -11, x: destination.x, y: destination.y, campus: campusFilter })
      }
    }

    if (campusFilter === 'junior') {
      staircaseEvents = staircaseEvents.filter(e => {
        const rt = (e.roadType || '').toLowerCase()
        if (rt.includes('slope_admin')) {
          if (e.fromFloor === 0 && e.toFloor === 1) return false
          if (e.fromFloor === 1 && e.toFloor === 0) return false
        }
        return true
      })
    }

    return NextResponse.json({ path: pathNodes, totalDistance, startLocation: startLocationObj, destination, staircaseEvents, fallbackToShortest, trunkDistance, shortestDistance: shortestDist, startFloor, endFloor: destFloor })
  } catch (error) {
    console.error('POST /api/navigation error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
