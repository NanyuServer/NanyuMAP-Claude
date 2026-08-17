import { prisma } from './prisma'
import type { RoadEdge } from '@prisma/client'

export type RoadEdgeRaw = {
  id: number
  fromNode: number
  toNode: number
  distance: number
  campus: string
  isTrunk?: boolean
}

export async function roadEdgesTableHasIsTrunk(): Promise<boolean> {
  const result = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'road_edges'
        AND column_name = 'is_trunk'
    ) AS "exists"
  `
  return result?.[0]?.exists ?? false
}

export async function safeFetchRoadEdges(campus: string): Promise<Array<RoadEdge | RoadEdgeRaw>> {
  if (await roadEdgesTableHasIsTrunk()) {
    return prisma.roadEdge.findMany({ where: { campus }, orderBy: { id: 'asc' } })
  }

  return prisma.$queryRaw<RoadEdgeRaw[]>`
    SELECT id,
           from_node AS "fromNode",
           to_node AS "toNode",
           distance,
           campus
    FROM road_edges
    WHERE campus = ${campus}
    ORDER BY id ASC
  `
}

export async function safeCreateRoadEdge(params: {
  fromNode: number
  toNode: number
  distance: number
  campus: string
}): Promise<RoadEdge | RoadEdgeRaw> {
  if (await roadEdgesTableHasIsTrunk()) {
    return prisma.roadEdge.create({ data: { ...params, isTrunk: false } })
  }

  const [edge] = await prisma.$queryRaw<RoadEdgeRaw[]>`
    INSERT INTO road_edges ("from_node", "to_node", distance, campus)
    VALUES (${params.fromNode}, ${params.toNode}, ${params.distance}, ${params.campus})
    RETURNING id,
              from_node AS "fromNode",
              to_node AS "toNode",
              distance,
              campus
  `

  if (!edge) {
    throw new Error('Failed to create road edge')
  }

  return edge
}

export async function safeUpdateRoadEdgeTrunk(id: number, isTrunk: boolean): Promise<RoadEdge | RoadEdgeRaw> {
  if (await roadEdgesTableHasIsTrunk()) {
    return prisma.roadEdge.update({ where: { id }, data: { isTrunk } })
  }

  const [edge] = await prisma.$queryRaw<RoadEdgeRaw[]>`
    SELECT id,
           from_node AS "fromNode",
           to_node AS "toNode",
           distance,
           campus
    FROM road_edges
    WHERE id = ${id}
  `

  if (!edge) {
    throw new Error('Road edge not found')
  }

  return edge
}
