// src/app/api/roads/deduplicate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

function campusNorm(v: unknown): string {
  return v === 'senior' ? 'senior' : 'junior'
}

interface EdgeScore {
  id: number
  isTrunk: boolean
  roadType: string
  floors: string
  [key: string]: any
}

function scoreEdge(e: EdgeScore): number {
  let score = 0
  if (e.isTrunk) score += 3
  if (e.roadType && e.roadType !== 'default') score += 2
  try {
    const f = JSON.parse(String(e.floors || '[]'))
    if (Array.isArray(f) && f.length > 0) score += 1
  } catch { /* ignore */ }
  return score
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const campus = campusNorm(body.campus || 'junior')
    const dryRun = body.dryRun !== false // default dryRun=true for safety

    // Fetch all edges for the campus
    let edges: any[]
    try {
      edges = await prisma.roadEdge.findMany({ where: { campus }, orderBy: { id: 'asc' } })
    } catch {
      const rows = await prisma.$queryRaw<any[]>`SELECT id, from_node as "fromNode", to_node as "toNode", distance, is_trunk as "isTrunk", campus, floors, road_type as "roadType" FROM road_edges WHERE campus = ${campus} ORDER BY id ASC`
      edges = rows
    }

    if (edges.length === 0) {
      return NextResponse.json({ success: true, message: '0 edges found', duplicatesRemoved: 0 })
    }

    // Group by canonical node pair (min, max)
    const groups = new Map<string, EdgeScore[]>()
    for (const e of edges) {
      const a = Math.min(e.fromNode, e.toNode)
      const b = Math.max(e.fromNode, e.toNode)
      const key = `${a}_${b}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(e)
    }

    const toDelete: number[] = []
    for (const [key, group] of groups) {
      if (group.length <= 1) continue
      // Sort by score descending, then by id ascending (older ID wins ties)
      group.sort((a, b) => {
        const sa = scoreEdge(a)
        const sb = scoreEdge(b)
        if (sa !== sb) return sb - sa
        return a.id - b.id
      })
      // Keep the first (best), delete the rest
      const [keep, ...dupes] = group
      for (const d of dupes) {
        toDelete.push(d.id)
      }
    }

    if (toDelete.length === 0) {
      return NextResponse.json({ success: true, message: '0 duplicates found', duplicatesRemoved: 0 })
    }

    if (!dryRun) {
      try {
        await prisma.$executeRaw`DELETE FROM road_edges WHERE id = ANY(${toDelete}::int[])`
      } catch {
        // Fallback: delete one by one
        await prisma.roadEdge.deleteMany({ where: { id: { in: toDelete } } })
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      duplicatesRemoved: toDelete.length,
      removedIds: toDelete,
      campus,
    })
  } catch (error) {
    console.error('POST /api/roads/deduplicate error:', error)
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 })
  }
}
