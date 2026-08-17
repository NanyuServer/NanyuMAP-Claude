// src/lib/astar.ts
import type { NavigationNode, NavigationEdge, StaircaseEvent, NavigationPathResult } from '@/types/navigation'

function euclidean(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

export function astar(
  nodes: NavigationNode[],
  edges: NavigationEdge[],
  startId: number,
  endId: number
): NavigationPathResult | null {
  const adjacency = new Map<number, Array<{ nodeId: number; distance: number }>>()
  for (const node of nodes) adjacency.set(node.id, [])
  for (const edge of edges) {
    adjacency.get(edge.fromNode)?.push({ nodeId: edge.toNode, distance: edge.distance })
    adjacency.get(edge.toNode)?.push({ nodeId: edge.fromNode, distance: edge.distance })
  }

  const nodeMap = new Map<number, NavigationNode>(nodes.map(n => [n.id, n]))
  const startNode = nodeMap.get(startId)
  const endNode = nodeMap.get(endId)
  if (!startNode || !endNode) return null

  interface AStarNode {
    id: number; x: number; y: number; campus: string
    g: number; h: number; f: number; parent: AStarNode | null
  }

  const heap: AStarNode[] = []
  const openMap = new Map<number, AStarNode>()
  const closedSet = new Set<number>()

  const swap = (i: number, j: number) => { const t = heap[i]; heap[i] = heap[j]; heap[j] = t }
  const siftUp = (idx: number) => {
    let i = idx
    while (i > 0) { const p = Math.floor((i - 1) / 2); if (heap[i].f < heap[p].f) { swap(i, p); i = p } else break }
  }
  const siftDown = (idx: number) => {
    let i = idx; const n = heap.length
    while (true) {
      const l = 2 * i + 1; const r = l + 1; let s = i
      if (l < n && heap[l].f < heap[s].f) s = l
      if (r < n && heap[r].f < heap[s].f) s = r
      if (s !== i) { swap(i, s); i = s } else break
    }
  }
  const heapPush = (node: AStarNode) => { heap.push(node); siftUp(heap.length - 1) }
  const heapPop = (): AStarNode | null => {
    if (heap.length === 0) return null
    const top = heap[0]; const last = heap.pop()!
    if (heap.length > 0) { heap[0] = last; siftDown(0) }
    return top
  }

  const start: AStarNode = {
    id: startId, x: startNode.x, y: startNode.y, campus: startNode.campus,
    g: 0, h: euclidean(startNode, endNode), f: euclidean(startNode, endNode), parent: null,
  }
  openMap.set(startId, start)
  heapPush(start)

  while (heap.length > 0) {
    const current = heapPop()
    if (!current) break
    const mapped = openMap.get(current.id)
    if (!mapped || mapped.f !== current.f) continue

    if (current.id === endId) {
      const path: NavigationNode[] = []
      let node: AStarNode | null = current
      while (node) { path.unshift({ id: node.id, x: node.x, y: node.y, campus: node.campus }); node = node.parent }
      return { nodes: path, totalDistance: current.g, staircaseEvents: [] }
    }

    openMap.delete(current.id)
    closedSet.add(current.id)

    for (const { nodeId, distance } of (adjacency.get(current.id) || [])) {
      if (closedSet.has(nodeId)) continue
      const neighborNode = nodeMap.get(nodeId)
      if (!neighborNode) continue
      const gScore = current.g + distance
      const existing = openMap.get(nodeId)
      if (!existing || gScore < existing.g) {
        const h = euclidean(neighborNode, endNode)
        const aNode: AStarNode = { id: nodeId, x: neighborNode.x, y: neighborNode.y, campus: neighborNode.campus, g: gScore, h, f: gScore + h, parent: current }
        openMap.set(nodeId, aNode)
        heapPush(aNode)
      }
    }
  }
  return null
}

export function findNearestNode(nodes: NavigationNode[], x: number, y: number): NavigationNode | null {
  if (nodes.length === 0) return null
  return nodes.reduce((nearest, node) => {
    const d1 = euclidean(node, { x, y })
    const d2 = euclidean(nearest, { x, y })
    return d1 < d2 ? node : nearest
  })
}

function closestPointOnSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
  const vx = bx - ax; const vy = by - ay
  const wx = px - ax; const wy = py - ay
  const vlen2 = vx * vx + vy * vy
  if (vlen2 === 0) return { x: ax, y: ay, t: 0, dist: Math.sqrt((px - ax) ** 2 + (py - ay) ** 2) }
  let t = (vx * wx + vy * wy) / vlen2
  if (t < 0) t = 0; if (t > 1) t = 1
  const cx = ax + vx * t; const cy = ay + vy * t
  return { x: cx, y: cy, t, dist: Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) }
}

export function findNearestEdgeEndpoint(nodes: NavigationNode[], edges: NavigationEdge[], x: number, y: number, floor?: number | null) {
  if (edges.length === 0 || nodes.length === 0) return null
  const nodeMap = new Map<number, NavigationNode>(nodes.map(n => [n.id, n]))

  let candidateEdges = edges
  if (floor != null && floor > 0) {
    candidateEdges = edges.filter(e => {
      const fArr = parseJsonArray(e.floors)
      return fArr.length === 0 || fArr.includes(floor)
    })
  }
  if (candidateEdges.length === 0) candidateEdges = edges

  let best = { edge: candidateEdges[0], dist: Infinity, closestPoint: { x: 0, y: 0 }, nearestEndpointId: candidateEdges[0].fromNode, t: 0 }
  for (const edge of candidateEdges) {
    const a = nodeMap.get(edge.fromNode); const b = nodeMap.get(edge.toNode)
    if (!a || !b) continue
    const cp = closestPointOnSegment(a.x, a.y, b.x, b.y, x, y)
    if (cp.dist < best.dist) {
      const da = Math.sqrt((cp.x - a.x) ** 2 + (cp.y - a.y) ** 2)
      const db = Math.sqrt((cp.x - b.x) ** 2 + (cp.y - b.y) ** 2)
      best = { edge, dist: cp.dist, closestPoint: { x: cp.x, y: cp.y }, nearestEndpointId: da <= db ? a.id : b.id, t: cp.t }
    }
  }
  return best
}

function parseJsonArray(s: string | undefined | null): number[] {
  try { const arr = JSON.parse(String(s || '[]')); return Array.isArray(arr) ? arr.map(Number) : [] } catch { return [] }
}

export function astarFloorAware(
  nodes: NavigationNode[],
  edges: NavigationEdge[],
  startId: number,
  endId: number,
  startFloor: number,
  endFloor: number,
  destBuildingCategory: string | null = null,
  preferredStairNodeId?: number,
  isSenior: boolean = false,
  trunkOnlyStairwellIds?: Set<number>,
  stairwellWeightMap?: Map<number, number>,
): NavigationPathResult | null {
  const nodeMap = new Map<number, NavigationNode>(nodes.map(n => [n.id, n]))
  const startNode = nodeMap.get(startId); const endNode = nodeMap.get(endId)
  if (!startNode || !endNode) return null

  const edgeFloorsMap = new Map<number, Set<number>>()
  const slopeFloorsMap = new Map<number, number[]>()
  for (const e of edges) {
    edgeFloorsMap.set(e.id, new Set(parseJsonArray(e.floors)))
    if (e.isSlope) slopeFloorsMap.set(e.id, parseJsonArray(e.slopeFloors))
  }

  const stairwellNodeFloorMap = new Map<number, Map<number, number>>()
  for (const n of nodes) {
    if (n.stairwellId && n.stairwellFloor != null && n.stairwellRole) {
      if (!stairwellNodeFloorMap.has(n.stairwellId)) stairwellNodeFloorMap.set(n.stairwellId, new Map())
      const roleMap = stairwellNodeFloorMap.get(n.stairwellId)!
      const key = n.stairwellFloor * 1000 + (n.stairwellRole === 'center' ? 0 : n.stairwellRole === 'entry' ? 1 : 2)
      roleMap.set(key, n.id)
    }
  }

  const adjByFloor = new Map<number, Map<number, Array<{ to: number; dist: number; edgeId: number }>>>()
  const floorTransitions: Array<{ fromFloor: number; fromNode: number; toNode: number; toFloor: number; dist: number; buildingCategory: string | null; roadType: string }> = []

  const ensureFloor = (f: number) => { if (!adjByFloor.has(f)) adjByFloor.set(f, new Map()) }
  ensureFloor(startFloor); ensureFloor(endFloor)

  for (const e of edges) {
    if (isSenior && e.roadType === 'staircase') {
      const fPair = [...parseJsonArray(e.floors)].sort((a, b) => a - b)
      for (const f of fPair) ensureFloor(f)
      const a = nodeMap.get(e.fromNode)
      const b = nodeMap.get(e.toNode)
      const sameSpot = a && b && Math.hypot(a.x - b.x, a.y - b.y) < 3
      for (const [floor] of adjByFloor) {
        // 同层连接仅在同一物理位置的节点间建立（避免不同位置节点穿墙误连）
        if (!sameSpot) break
        const adj = adjByFloor.get(floor)!
        if (!adj.has(e.fromNode)) adj.set(e.fromNode, [])
        if (!adj.has(e.toNode)) adj.set(e.toNode, [])
        adj.get(e.fromNode)!.push({ to: e.toNode, dist: e.distance, edgeId: e.id })
        adj.get(e.toNode)!.push({ to: e.fromNode, dist: e.distance, edgeId: e.id })
      }
      // 楼梯只能逐层上下：仅连接相邻楼层，禁止跳层
      // 使用 stairwellFloor 确定每个节点实际所在的楼层
      const fromFloorSA = a?.stairwellFloor
      const toFloorSA = b?.stairwellFloor
      for (let i = 0; i < fPair.length - 1; i++) {
        const fA = fPair[i]
        const fB = fPair[i + 1]
        if (fB - fA !== 1) continue
        let lowNode: number, highNode: number
        if (fromFloorSA === fA && toFloorSA === fB) {
          lowNode = e.fromNode; highNode = e.toNode
        } else if (fromFloorSA === fB && toFloorSA === fA) {
          lowNode = e.toNode; highNode = e.fromNode
        } else {
          lowNode = e.fromNode; highNode = e.toNode
        }
        floorTransitions.push({ fromFloor: fA, fromNode: lowNode, toNode: highNode, toFloor: fB, dist: e.distance, buildingCategory: null, roadType: 'staircase' })
        floorTransitions.push({ fromFloor: fB, fromNode: highNode, toNode: lowNode, toFloor: fA, dist: e.distance, buildingCategory: null, roadType: 'staircase' })
      }
      continue
    }

    if (e.isSlope) {
      const sFloors = slopeFloorsMap.get(e.id) || []
      for (const f of sFloors) ensureFloor(f)

      const fromNode = nodeMap.get(e.fromNode)
      const toNodeData = nodeMap.get(e.toNode)
      const bCat = fromNode?.buildingCategory || null
      const rType = e.roadType || 'default'

      // Skip non-trunk stairwell edges in trunk-only mode
      if (trunkOnlyStairwellIds && trunkOnlyStairwellIds.size > 0) {
        const fromSW = fromNode?.stairwellId
        const toSW = toNodeData?.stairwellId
        if (fromSW && !trunkOnlyStairwellIds.has(fromSW)) continue
        if (toSW && !trunkOnlyStairwellIds.has(toSW)) continue
      }

      // Apply stairwell weight to reduce cost (higher weight = lower cost)
      let adjustedDist = e.distance
      if (stairwellWeightMap && stairwellWeightMap.size > 0) {
        const swId = fromNode?.stairwellId || toNodeData?.stairwellId
        if (swId && stairwellWeightMap.has(swId)) {
          const w = stairwellWeightMap.get(swId)!
          adjustedDist = e.distance / (1 + w * 0.3)
        }
      }

      // 楼梯只能逐层上下：仅连接相邻楼层，禁止跳层（如 1↔3 直达）
      // 使用 stairwellFloor 确定每个节点实际所在的楼层，避免因边方向任意导致楼层映射错误
      const sortedFloors = [...sFloors].sort((a, b) => a - b)
      const fromFloorActual = fromNode?.stairwellFloor
      const toFloorActual = toNodeData?.stairwellFloor
      for (let i = 0; i < sortedFloors.length - 1; i++) {
        const fA = sortedFloors[i]
        const fB = sortedFloors[i + 1]
        if (fB - fA !== 1) continue
        // 根据节点实际楼层决定方向：哪个节点在 fA 就作为 fromNode，哪个在 fB 就作为 toNode
        let lowNode: number, highNode: number
        if (fromFloorActual === fA && toFloorActual === fB) {
          lowNode = e.fromNode; highNode = e.toNode
        } else if (fromFloorActual === fB && toFloorActual === fA) {
          lowNode = e.toNode; highNode = e.fromNode
        } else {
          // 无法确定时回退到边方向
          lowNode = e.fromNode; highNode = e.toNode
        }
        floorTransitions.push({ fromFloor: fA, fromNode: lowNode, toNode: highNode, toFloor: fB, dist: adjustedDist, buildingCategory: bCat, roadType: rType })
        floorTransitions.push({ fromFloor: fB, fromNode: highNode, toNode: lowNode, toFloor: fA, dist: adjustedDist, buildingCategory: bCat, roadType: rType })
      }

      // 同层连接：slope 边本质是跨楼层连接；只有当两端点位于同一物理位置
      // （同一楼梯口上下楼）时才在同层内连通，否则会错误连接不同位置的
      // 节点，导致路线穿墙/错位。
      const sameSpot = fromNode && toNodeData && Math.hypot(fromNode.x - toNodeData.x, fromNode.y - toNodeData.y) < 3
      if (sameSpot) {
        for (const f of sFloors) {
          const adj = adjByFloor.get(f)!
          if (!adj.has(e.fromNode)) adj.set(e.fromNode, [])
          if (!adj.has(e.toNode)) adj.set(e.toNode, [])
          adj.get(e.fromNode)!.push({ to: e.toNode, dist: adjustedDist, edgeId: e.id })
          adj.get(e.toNode)!.push({ to: e.fromNode, dist: adjustedDist, edgeId: e.id })
        }
      }
      continue
    }

    const floors = edgeFloorsMap.get(e.id)!
    for (const [floor] of adjByFloor) {
      if (floors.size > 0 && !floors.has(floor)) continue
      const adj = adjByFloor.get(floor)!
      if (!adj.has(e.fromNode)) adj.set(e.fromNode, [])
      if (!adj.has(e.toNode)) adj.set(e.toNode, [])
      adj.get(e.fromNode)!.push({ to: e.toNode, dist: e.distance, edgeId: e.id })
      adj.get(e.toNode)!.push({ to: e.fromNode, dist: e.distance, edgeId: e.id })
    }
  }

  const allFloors = Array.from(adjByFloor.keys()).sort()
  for (const f of allFloors) ensureFloor(f)

  const transByFloorNode = new Map<number, Map<number, Array<{ toNode: number; toFloor: number; dist: number; buildingCategory: string | null; roadType: string }>>>()
  for (const st of floorTransitions) {
    if (!transByFloorNode.has(st.fromFloor)) transByFloorNode.set(st.fromFloor, new Map())
    const m = transByFloorNode.get(st.fromFloor)!
    if (!m.has(st.fromNode)) m.set(st.fromNode, [])
    m.get(st.fromNode)!.push({ toNode: st.toNode, toFloor: st.toFloor, dist: st.dist, buildingCategory: st.buildingCategory, roadType: st.roadType })
  }

  type StateKey = string
  const key = (nid: number, f: number): StateKey => `${nid}_${f}`
  interface FNode { nid: number; floor: number; g: number; h: number; f: number; parent: FNode | null; transitionInfo?: { buildingCategory: string | null; roadType: string } }

  const euclid = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
  const heap: FNode[] = []
  const swapFn = (i: number, j: number) => { const t = heap[i]; heap[i] = heap[j]; heap[j] = t }
  const siftUp = (idx: number) => { let i = idx; while (i > 0) { const p = Math.floor((i - 1) / 2); if (heap[i].f < heap[p].f) { swapFn(i, p); i = p } else break } }
  const siftDown = (idx: number) => { let i = idx; const n = heap.length; while (true) { const l = 2 * i + 1; const r = l + 1; let s = i; if (l < n && heap[l].f < heap[s].f) s = l; if (r < n && heap[r].f < heap[s].f) s = r; if (s !== i) { swapFn(i, s); i = s } else break } }

  const openMap = new Map<StateKey, FNode>()
  const closed = new Set<StateKey>()

  const startFNode: FNode = { nid: startId, floor: startFloor, g: 0, h: euclid(startNode, endNode), f: euclid(startNode, endNode), parent: null }
  openMap.set(key(startId, startFloor), startFNode)
  heap.push(startFNode); siftUp(0)

  const preferredStairNode = preferredStairNodeId != null ? nodeMap.get(preferredStairNodeId) : null

  while (heap.length > 0) {
    const cur = heap[0]
    const last = heap.pop()!; if (heap.length > 0) { heap[0] = last; siftDown(0) }
    const ck = key(cur.nid, cur.floor)
    const mapped = openMap.get(ck); if (!mapped || mapped.g !== cur.g) continue
    openMap.delete(ck); closed.add(ck)

    if (cur.nid === endId && cur.floor === endFloor) {
      const path: NavigationNode[] = []; const staircaseEvents: StaircaseEvent[] = []
      let node: FNode | null = cur
      while (node) {
        const rn = nodeMap.get(node.nid)!
        path.unshift({ id: rn.id, x: rn.x, y: rn.y, campus: rn.campus })
        if (node.parent && node.floor !== node.parent.floor) {
          const fromF = node.parent.floor
          const toF = node.floor
          const bCat = node.transitionInfo?.buildingCategory || rn.buildingCategory || null
          const rType = node.transitionInfo?.roadType || ''
          staircaseEvents.unshift({ nodeId: node.nid, x: rn.x, y: rn.y, fromFloor: fromF, toFloor: toF, buildingCategory: bCat, roadType: rType })
        }
        node = node.parent
      }
      return { nodes: path, totalDistance: cur.g, staircaseEvents }
    }

    const floorAdj = adjByFloor.get(cur.floor)
    if (floorAdj) {
      for (const { to, dist } of (floorAdj.get(cur.nid) || [])) {
        const nk = key(to, cur.floor); if (closed.has(nk)) continue
        const ng = cur.g + dist; const existing = openMap.get(nk)
        if (existing && existing.g <= ng) continue
        const nn = nodeMap.get(to)!; let h = euclid(nn, endNode)
        if (preferredStairNode && cur.floor === startFloor && to !== preferredStairNodeId) {
          h = euclid(nn, preferredStairNode) + euclid(preferredStairNode, endNode)
        }
        const fNode: FNode = { nid: to, floor: cur.floor, g: ng, h, f: ng + h, parent: cur }
        openMap.set(nk, fNode); heap.push(fNode); siftUp(heap.length - 1)
      }
    }

    const transitions = transByFloorNode.get(cur.floor)?.get(cur.nid)
    if (transitions) {
      for (const tr of transitions) {
        const nk = key(tr.toNode, tr.toFloor); if (closed.has(nk)) continue
        let transDist = tr.dist
        if (tr.roadType.includes('admin') && destBuildingCategory && destBuildingCategory !== 'admin') {
          transDist *= 8
        }
        const ng = cur.g + transDist; const existing = openMap.get(nk)
        if (existing && existing.g <= ng) continue
        const nn = nodeMap.get(tr.toNode)!; const h = euclid(nn, endNode)
        const fNode: FNode = { nid: tr.toNode, floor: tr.toFloor, g: ng, h, f: ng + h, parent: cur, transitionInfo: { buildingCategory: tr.buildingCategory, roadType: tr.roadType } }
        openMap.set(nk, fNode); heap.push(fNode); siftUp(heap.length - 1)
      }
    }
  }
  return null
}
