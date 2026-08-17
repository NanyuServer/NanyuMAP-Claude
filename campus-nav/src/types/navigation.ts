// src/types/navigation.ts

export interface NavigationNode {
  id: number
  x: number
  y: number
  campus: string
  isStaircase?: boolean
  staircaseFloors?: string
  buildingCategory?: string | null
  stairwellId?: number | null
  stairwellFloor?: number | null
  stairwellRole?: string | null
}

export interface NavigationEdge {
  id: number
  fromNode: number
  toNode: number
  campus: string
  distance: number
  isTrunk?: boolean
  floors?: string
  roadType?: string
  isSlope?: boolean
  slopeFloors?: string
}

export interface StaircaseEvent {
  nodeId: number
  x: number
  y: number
  fromFloor: number
  toFloor: number
  buildingCategory?: string | null
  roadType?: string | null
}

export interface NavigationPathResult {
  nodes: NavigationNode[]
  totalDistance: number
  staircaseEvents: StaircaseEvent[]
}
