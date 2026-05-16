// src/lib/astar.ts
import type { RoadNode, RoadEdge, NavigationPath } from '@/types'

interface AStarNode {
  id: number
  x: number
  y: number
  g: number  // cost from start
  h: number  // heuristic to end
  f: number  // g + h
  parent: AStarNode | null
}

function euclidean(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

export function astar(
  nodes: RoadNode[],
  edges: RoadEdge[],
  startId: number,
  endId: number
): NavigationPath | null {
  // Build adjacency list
  const adjacency = new Map<number, Array<{ nodeId: number; distance: number }>>()
  for (const node of nodes) {
    adjacency.set(node.id, [])
  }
  for (const edge of edges) {
    adjacency.get(edge.fromNode)?.push({ nodeId: edge.toNode, distance: edge.distance })
    adjacency.get(edge.toNode)?.push({ nodeId: edge.fromNode, distance: edge.distance })
  }

  const nodeMap = new Map<number, RoadNode>(nodes.map(n => [n.id, n]))
  const startNode = nodeMap.get(startId)
  const endNode = nodeMap.get(endId)
  if (!startNode || !endNode) return null

  const openSet = new Map<number, AStarNode>()
  const closedSet = new Set<number>()

  const start: AStarNode = {
    id: startId,
    x: startNode.x,
    y: startNode.y,
    g: 0,
    h: euclidean(startNode, endNode),
    f: euclidean(startNode, endNode),
    parent: null,
  }
  openSet.set(startId, start)

  while (openSet.size > 0) {
    // Find lowest f-score node
    let current: AStarNode | null = null
    for (const node of openSet.values()) {
      if (!current || node.f < current.f) current = node
    }
    if (!current) break

    if (current.id === endId) {
      // Reconstruct path
      const path: RoadNode[] = []
      let node: AStarNode | null = current
      while (node) {
        path.unshift({ id: node.id, x: node.x, y: node.y })
        node = node.parent
      }
      return {
        nodes: path,
        totalDistance: current.g,
      }
    }

    openSet.delete(current.id)
    closedSet.add(current.id)

    const neighbors = adjacency.get(current.id) || []
    for (const { nodeId, distance } of neighbors) {
      if (closedSet.has(nodeId)) continue

      const neighborNode = nodeMap.get(nodeId)
      if (!neighborNode) continue

      const gScore = current.g + distance

      const existing = openSet.get(nodeId)
      if (!existing || gScore < existing.g) {
        const h = euclidean(neighborNode, endNode)
        const aNode: AStarNode = {
          id: nodeId,
          x: neighborNode.x,
          y: neighborNode.y,
          g: gScore,
          h,
          f: gScore + h,
          parent: current,
        }
        openSet.set(nodeId, aNode)
      }
    }
  }

  return null // No path found
}

/**
 * Find the nearest road node to a given point
 */
export function findNearestNode(nodes: RoadNode[], x: number, y: number): RoadNode | null {
  if (nodes.length === 0) return null
  return nodes.reduce((nearest, node) => {
    const d1 = euclidean(node, { x, y })
    const d2 = euclidean(nearest, { x, y })
    return d1 < d2 ? node : nearest
  })
}
