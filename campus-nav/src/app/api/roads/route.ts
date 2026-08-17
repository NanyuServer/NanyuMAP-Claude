// src/app/api/roads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

export const runtime = 'nodejs'

function campusNorm(v: unknown): string { return v === 'senior' ? 'senior' : 'junior' }

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const campus = campusNorm(url.searchParams.get('campus'))

    const [nodes, edges, stairwells] = await Promise.all([
      prisma.$queryRaw<any[]>`SELECT id, x, y, campus, floor, is_staircase, staircase_floors, building_category, stairwell_id, stairwell_floor, stairwell_role FROM road_nodes WHERE campus = ${campus} ORDER BY id ASC`.catch(async () => {
        return prisma.$queryRaw<any[]>`SELECT id, x, y, campus, 0 as floor, is_staircase, staircase_floors, building_category FROM road_nodes WHERE campus = ${campus} ORDER BY id ASC`
      }),
      prisma.$queryRaw<any[]>`SELECT id, from_node, to_node, distance, campus, is_trunk, floors, road_type, is_slope, slope_floors FROM road_edges WHERE campus = ${campus} ORDER BY id ASC`.catch(async () => {
        return prisma.$queryRaw<any[]>`SELECT id, from_node, to_node, distance, campus, is_trunk, floors, road_type FROM road_edges WHERE campus = ${campus} ORDER BY id ASC`.catch(async () => {
          return prisma.$queryRaw<any[]>`SELECT id, from_node, to_node, distance, campus FROM road_edges WHERE campus = ${campus} ORDER BY id ASC`
        })
      }),
      prisma.$queryRaw<any[]>`SELECT id, campus, building_category, center_x, center_y, rect_x1, rect_y1, rect_x2, rect_y2, floors, is_trunk, weight FROM stairwells WHERE campus = ${campus} ORDER BY id ASC`.catch(async () => {
        try { await prisma.$executeRaw`ALTER TABLE stairwells ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 0` } catch {}
        return prisma.$queryRaw<any[]>`SELECT id, campus, building_category, center_x, center_y, rect_x1, rect_y1, rect_x2, rect_y2, floors, COALESCE(is_trunk, false) as is_trunk, COALESCE(weight, 0) as weight FROM stairwells WHERE campus = ${campus} ORDER BY id ASC`
      }),
    ])

    const mappedNodes = nodes.map(r => ({
      id: r.id, x: r.x, y: r.y, campus: r.campus, floor: r.floor ?? 0,
      isStaircase: !!r.is_staircase, staircaseFloors: r.staircase_floors || '[]',
      buildingCategory: r.building_category || null,
      stairwellId: r.stairwell_id ?? null, stairwellFloor: r.stairwell_floor ?? null, stairwellRole: r.stairwell_role ?? null,
    }))

    const mappedEdges = edges.map(r => ({
      id: r.id, fromNode: r.from_node, toNode: r.to_node, distance: r.distance, campus: r.campus,
      isTrunk: !!r.is_trunk, floors: r.floors || '[]', roadType: r.road_type || 'default',
      isSlope: !!r.is_slope, slopeFloors: r.slope_floors || '[]',
    }))

    const mappedStairwells = stairwells.map(r => ({
      id: r.id, campus: r.campus, buildingCategory: r.building_category,
      centerX: r.center_x, centerY: r.center_y,
      rectX1: r.rect_x1, rectY1: r.rect_y1, rectX2: r.rect_x2, rectY2: r.rect_y2,
      floors: r.floors || '[]',
      isTrunk: !!r.is_trunk,
      weight: r.weight ?? 0,
    }))

    return NextResponse.json({ nodes: mappedNodes, edges: mappedEdges, stairwells: mappedStairwells })
  } catch (error) {
    console.error('GET /api/roads error:', error)
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action, data } = body

    if (action === 'add_node') {
      const x = Number(data.x); const y = Number(data.y); const campus = campusNorm(data.campus)
      const floor = data.floor != null ? Number(data.floor) : 0
      if (Number.isNaN(x) || Number.isNaN(y)) return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
      const rows = await prisma.$queryRaw<any[]>`INSERT INTO road_nodes (x, y, campus, floor) VALUES (${x}, ${y}, ${campus}, ${floor}) RETURNING id, x, y, campus, floor`
      const node = rows[0]
      return NextResponse.json({ id: node.id, x: node.x, y: node.y, campus: node.campus, floor: node.floor ?? 0 }, { status: 201 })
    }

    if (action === 'add_stairwell_node') {
      const x = Number(data.x); const y = Number(data.y); const campus = campusNorm(data.campus)
      const floor = data.floor != null ? Number(data.floor) : 0
      const stairwellId = Number(data.stairwellId)
      const stairwellFloor = data.stairwellFloor != null ? Number(data.stairwellFloor) : floor
      const stairwellRole = String(data.stairwellRole || 'entry')
      const buildingCategory = String(data.buildingCategory || '')
      if (Number.isNaN(x) || Number.isNaN(y)) return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })

      // Check if a stairwell node already exists at this position for this floor
      const existing = await prisma.$queryRaw<any[]>`SELECT id FROM road_nodes WHERE stairwell_id = ${stairwellId} AND stairwell_floor = ${stairwellFloor} AND stairwell_role = ${stairwellRole} AND campus = ${campus}`
      if (existing.length > 0) {
        // Update existing node position
        await prisma.$executeRaw`UPDATE road_nodes SET x = ${x}, y = ${y} WHERE id = ${existing[0].id}`
        return NextResponse.json({ id: existing[0].id, x, y, campus, floor, updated: true }, { status: 200 })
      }

      const rows = await prisma.$queryRaw<any[]>`INSERT INTO road_nodes (x, y, campus, floor, building_category, stairwell_id, stairwell_floor, stairwell_role) VALUES (${x}, ${y}, ${campus}, ${floor}, ${buildingCategory || null}, ${stairwellId}, ${stairwellFloor}, ${stairwellRole}) RETURNING id, x, y, campus, floor`
      const node = rows[0]
      return NextResponse.json({ id: node.id, x: node.x, y: node.y, campus: node.campus, floor: node.floor ?? 0 }, { status: 201 })
    }

    if (action === 'cleanup_stairwell_nodes') {
      const campus = campusNorm(data.campus)
      const swNodes = await prisma.$queryRaw<any[]>`SELECT id FROM road_nodes WHERE campus = ${campus} AND stairwell_id IS NOT NULL`
      let edgesDeleted = 0
      for (const n of swNodes) {
        const edges = await prisma.$queryRaw<any[]>`DELETE FROM road_edges WHERE (from_node = ${n.id} OR to_node = ${n.id}) AND campus = ${campus}`
        edgesDeleted += edges.length
      }
      const nodesDeleted = swNodes.length
      if (swNodes.length > 0) {
        await prisma.$executeRaw`DELETE FROM road_nodes WHERE campus = ${campus} AND stairwell_id IS NOT NULL`
      }
      return NextResponse.json({ nodesDeleted, edgesDeleted })
    }

    if (action === 'delete_node') {
      const nodeId = Number(data.id)
      await prisma.$executeRaw`DELETE FROM road_edges WHERE from_node = ${nodeId} OR to_node = ${nodeId}`
      await prisma.$executeRaw`DELETE FROM road_nodes WHERE id = ${nodeId}`
      return NextResponse.json({ success: true })
    }

    if (action === 'move_node') {
      const x = Number(data.x); const y = Number(data.y); const id = Number(data.id)
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(id)) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
      await prisma.$executeRaw`UPDATE road_nodes SET x = ${x}, y = ${y} WHERE id = ${id}`
      return NextResponse.json({ id, x, y })
    }

    if (action === 'add_edge') {
      const fromNode = Number(data.fromNode); const toNode = Number(data.toNode)
      const x1 = Number(data.x1); const y1 = Number(data.y1); const x2 = Number(data.x2); const y2 = Number(data.y2)
      const campus = campusNorm(data.campus); const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
      const rows = await prisma.$queryRaw<any[]>`INSERT INTO road_edges (from_node, to_node, distance, campus, is_trunk, is_slope) VALUES (${fromNode}, ${toNode}, ${distance}, ${campus}, false, false) RETURNING id, from_node, to_node, distance, campus, is_trunk`
      const e = rows[0]
      return NextResponse.json({ id: e.id, fromNode: e.from_node, toNode: e.to_node, distance: e.distance, campus: e.campus, isTrunk: e.is_trunk ?? false }, { status: 201 })
    }

    if (action === 'add_slope_edge') {
      const fromNode = Number(data.fromNode); const toNode = Number(data.toNode)
      const x1 = Number(data.x1); const y1 = Number(data.y1); const x2 = Number(data.x2); const y2 = Number(data.y2)
      const campus = campusNorm(data.campus); const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
      const slopeFloors = String(data.slopeFloors || '[]')
      const roadType = String(data.roadType || 'default')
      const rows = await prisma.$queryRaw<any[]>`INSERT INTO road_edges (from_node, to_node, distance, campus, is_trunk, is_slope, slope_floors, road_type) VALUES (${fromNode}, ${toNode}, ${distance}, ${campus}, false, true, ${slopeFloors}, ${roadType}) RETURNING id, from_node, to_node, distance, campus, is_trunk, is_slope, slope_floors, road_type`
      const e = rows[0]
      return NextResponse.json({ id: e.id, fromNode: e.from_node, toNode: e.to_node, distance: e.distance, campus: e.campus, isTrunk: false, isSlope: true, slopeFloors: e.slope_floors, roadType: e.road_type }, { status: 201 })
    }

    if (action === 'set_trunk') {
      const id = Number(data.id); const isTrunk = !!data.isTrunk
      try { await prisma.$executeRaw`UPDATE road_edges SET is_trunk = ${isTrunk} WHERE id = ${id}`; return NextResponse.json({ id, isTrunk }) }
      catch { return NextResponse.json({ id, isTrunk: false }) }
    }

    if (action === 'delete_edge') {
      await prisma.$executeRaw`DELETE FROM road_edges WHERE id = ${Number(data.id)}`
      return NextResponse.json({ success: true })
    }

    if (action === 'set_edge_floors') {
      const id = Number(data.id); const floors = String(data.floors || '[]')
      try { await prisma.$executeRaw`UPDATE road_edges SET floors = ${floors} WHERE id = ${id}`; return NextResponse.json({ id, floors }) }
      catch { return NextResponse.json({ id, floors: '[]' }) }
    }

    if (action === 'set_slope_floors') {
      const id = Number(data.id); const slopeFloors = String(data.slopeFloors || '[]')
      try { await prisma.$executeRaw`UPDATE road_edges SET slope_floors = ${slopeFloors} WHERE id = ${id}`; return NextResponse.json({ id, slopeFloors }) }
      catch { return NextResponse.json({ id, slopeFloors: '[]' }) }
    }

    if (action === 'set_road_type') {
      const id = Number(data.id); const roadType = String(data.roadType || 'default')
      try { await prisma.$executeRaw`UPDATE road_edges SET road_type = ${roadType} WHERE id = ${id}`; return NextResponse.json({ id, roadType }) }
      catch { return NextResponse.json({ id, roadType: 'default' }) }
    }

    if (action === 'create_stairwell') {
      const campus = campusNorm(data.campus)
      const buildingCategory = String(data.buildingCategory || 'teaching_a')
      const rectX1 = Number(data.rectX1); const rectY1 = Number(data.rectY1)
      const rectX2 = Number(data.rectX2); const rectY2 = Number(data.rectY2)
      const floors: number[] = Array.isArray(data.floors) ? data.floors.map(Number) : [0, 1]
      const points: Array<{ x: number; y: number; floors: number[] }> = Array.isArray(data.points) ? data.points : []

      const centerX = (rectX1 + rectX2) / 2; const centerY = (rectY1 + rectY2) / 2

      const swRows = await prisma.$queryRaw<any[]>`INSERT INTO stairwells (campus, building_category, center_x, center_y, rect_x1, rect_y1, rect_x2, rect_y2, floors) VALUES (${campus}, ${buildingCategory}, ${centerX}, ${centerY}, ${rectX1}, ${rectY1}, ${rectX2}, ${rectY2}, ${JSON.stringify(floors)}) RETURNING id`
      const stairwellId = swRows[0].id

      for (const floor of floors) {
        await prisma.$queryRaw`INSERT INTO stairwell_floors (stairwell_id, floor, x, y, rect_x1, rect_y1, rect_x2, rect_y2, exit_x, exit_y) VALUES (${stairwellId}, ${floor}, ${centerX}, ${centerY}, ${rectX1}, ${rectY1}, ${rectX2}, ${rectY2}, ${null}, ${null}) ON CONFLICT (stairwell_id, floor) DO NOTHING`
      }

      const createdNodes: any[] = []
      const createdEdges: any[] = []

      // Each point is ONE stair opening (a single stair channel). Only connect
      // floors within the SAME opening — never cross openings — otherwise the
      // route could exit from the wrong stair mouth (e.g. exiting at an opening
      // that leads to the wrong floor).
      for (let pi = 0; pi < points.length; pi++) {
        const pt = points[pi]
        for (const floor of (pt.floors && pt.floors.length > 0 ? pt.floors : floors)) {
          const nodeRows = await prisma.$queryRaw<any[]>`INSERT INTO road_nodes (x, y, campus, floor, building_category, stairwell_id, stairwell_floor, stairwell_role) VALUES (${pt.x}, ${pt.y}, ${campus}, ${floor}, ${buildingCategory}, ${stairwellId}, ${floor}, 'entry') RETURNING id, x, y, campus`
          createdNodes.push({ ...nodeRows[0], ptIndex: pi, stairwellId, stairwellFloor: floor, stairwellRole: 'entry', buildingCategory, floor })
        }
      }

      for (let i = 0; i < createdNodes.length; i++) {
        for (let j = i + 1; j < createdNodes.length; j++) {
          const n1 = createdNodes[i]; const n2 = createdNodes[j]
          if (n1.floor === n2.floor) continue
          if (n1.ptIndex !== n2.ptIndex) continue
          const slopeDist = Math.sqrt((n1.x - n2.x) ** 2 + (n1.y - n2.y) ** 2)
          const slopeRoadType = buildingCategory === 'admin' ? 'slope_admin_internal' : 'slope_teaching_internal'
          const edgeRows = await prisma.$queryRaw<any[]>`INSERT INTO road_edges (from_node, to_node, distance, campus, is_slope, slope_floors, road_type) VALUES (${n1.id}, ${n2.id}, ${slopeDist}, ${campus}, true, ${JSON.stringify([n1.floor, n2.floor].sort())}, ${slopeRoadType}) RETURNING id, from_node, to_node, distance`
          createdEdges.push(edgeRows[0])
        }
      }

      return NextResponse.json({ stairwellId, nodes: createdNodes, edges: createdEdges }, { status: 201 })
    }

    if (action === 'delete_stairwell') {
      const stairwellId = Number(data.id)
      const nodeIds = await prisma.$queryRaw<any[]>`SELECT id FROM road_nodes WHERE stairwell_id = ${stairwellId}`
      for (const n of nodeIds) {
        await prisma.$executeRaw`DELETE FROM road_edges WHERE from_node = ${n.id} OR to_node = ${n.id}`
      }
      await prisma.$executeRaw`DELETE FROM road_nodes WHERE stairwell_id = ${stairwellId}`
      await prisma.$executeRaw`DELETE FROM stairwells WHERE id = ${stairwellId}`
      return NextResponse.json({ success: true })
    }

    if (action === 'toggle_stairwell_trunk') {
      const id = Number(data.id)
      const isTrunk = !!data.isTrunk
      try {
        await prisma.$executeRaw`UPDATE stairwells SET is_trunk = ${isTrunk} WHERE id = ${id}`
      } catch {
        try {
          await prisma.$executeRaw`ALTER TABLE stairwells ADD COLUMN IF NOT EXISTS is_trunk BOOLEAN DEFAULT false`
          await prisma.$executeRaw`UPDATE stairwells SET is_trunk = ${isTrunk} WHERE id = ${id}`
        } catch (e) {
          return NextResponse.json({ error: 'Failed to set trunk', details: String(e) }, { status: 500 })
        }
      }
      return NextResponse.json({ id, isTrunk })
    }

    if (action === 'set_stairwell_weight') {
      const id = Number(data.id)
      const weight = Math.max(0, Math.min(10, Math.round(Number(data.weight) || 0)))
      try {
        await prisma.$executeRaw`UPDATE stairwells SET weight = ${weight} WHERE id = ${id}`
      } catch {
        try {
          await prisma.$executeRaw`ALTER TABLE stairwells ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 0`
          await prisma.$executeRaw`UPDATE stairwells SET weight = ${weight} WHERE id = ${id}`
        } catch (e) {
          return NextResponse.json({ error: 'Failed to set weight', details: String(e) }, { status: 500 })
        }
      }
      return NextResponse.json({ id, weight })
    }

    if (action === 'set_stairwell_floor_label') {
      const stairwellId = Number(data.stairwellId)
      const floor = Number(data.floor)
      const label = String(data.label || '')
      try {
        await prisma.$executeRaw`UPDATE stairwell_floors SET label = ${label} WHERE stairwell_id = ${stairwellId} AND floor = ${floor}`
      } catch {
        try {
          await prisma.$executeRaw`ALTER TABLE stairwell_floors ADD COLUMN IF NOT EXISTS label TEXT DEFAULT ''`
          await prisma.$executeRaw`UPDATE stairwell_floors SET label = ${label} WHERE stairwell_id = ${stairwellId} AND floor = ${floor}`
        } catch (e) {
          return NextResponse.json({ error: 'Failed to set label', details: String(e) }, { status: 500 })
        }
      }
      return NextResponse.json({ stairwellId, floor, label })
    }

    if (action === 'get_stairwell_floors') {
      const stairwellId = Number(data.stairwellId)
      try {
        const rows = await prisma.$queryRaw<any[]>`SELECT stairwell_id, floor, x, y, exit_x, exit_y, entry_x, entry_y, label FROM stairwell_floors WHERE stairwell_id = ${stairwellId} ORDER BY floor ASC`
        return NextResponse.json(rows)
      } catch {
        const rows = await prisma.$queryRaw<any[]>`SELECT stairwell_id, floor, x, y, exit_x, exit_y, entry_x, entry_y FROM stairwell_floors WHERE stairwell_id = ${stairwellId} ORDER BY floor ASC`
        return NextResponse.json(rows.map(r => ({ ...r, label: '' })))
      }
    }

    if (action === 'fix_stairwell_nodes') {
      const campus = campusNorm(data.campus)
      const swRows = await prisma.$queryRaw<any[]>`SELECT id, building_category, floors, is_trunk FROM stairwells WHERE campus = ${campus}`

      let sfRows: any[]
      try {
        sfRows = await prisma.$queryRaw<any[]>`SELECT sf.stairwell_id, sf.floor, sf.exit_x, sf.exit_y, sf.entry_x, sf.entry_y, sf.x, sf.y, sf.target_floor_1, sf.target_floor_2 FROM stairwell_floors sf JOIN stairwells sw ON sf.stairwell_id = sw.id WHERE sw.campus = ${campus}`
      } catch {
        sfRows = await prisma.$queryRaw<any[]>`SELECT sf.stairwell_id, sf.floor, sf.exit_x, sf.exit_y, sf.entry_x, sf.entry_y, sf.x, sf.y FROM stairwell_floors sf JOIN stairwells sw ON sf.stairwell_id = sw.id WHERE sw.campus = ${campus}`
      }

      const fixed: any[] = []
      const created: any[] = []

      for (const sf of sfRows) {
        const sw = swRows.find((w: any) => w.id === sf.stairwell_id)
        if (!sw) continue
        const bCat = sw.building_category || null
        const isTrunk = !!sw.is_trunk

        const entrances: Array<{ x: number; y: number; targetFloor: number | null; role: string }> = []

        if (isTrunk && sf.target_floor_1 != null && sf.entry_x != null && sf.entry_y != null) {
          entrances.push({ x: sf.entry_x, y: sf.entry_y, targetFloor: sf.target_floor_1, role: 'entry1' })
        } else if (sf.entry_x != null && sf.entry_y != null) {
          entrances.push({ x: sf.entry_x, y: sf.entry_y, targetFloor: null, role: 'entry' })
        }

        if (isTrunk && sf.target_floor_2 != null && sf.exit_x != null && sf.exit_y != null) {
          entrances.push({ x: sf.exit_x, y: sf.exit_y, targetFloor: sf.target_floor_2, role: 'entry2' })
        } else if (sf.exit_x != null && sf.exit_y != null) {
          entrances.push({ x: sf.exit_x, y: sf.exit_y, targetFloor: null, role: 'exit' })
        }

        if (entrances.length === 0) {
          const fallbackX = sf.entry_x ?? sf.exit_x ?? sf.x
          const fallbackY = sf.entry_y ?? sf.exit_y ?? sf.y
          if (fallbackX != null && fallbackY != null) {
            entrances.push({ x: fallbackX, y: fallbackY, targetFloor: null, role: 'entry' })
          }
        }

        for (const ent of entrances) {
          const existing = await prisma.$queryRaw<any[]>`SELECT id FROM road_nodes WHERE stairwell_id = ${sf.stairwell_id} AND stairwell_floor = ${sf.floor} AND campus = ${campus} AND ABS(x - ${ent.x}) < 2 AND ABS(y - ${ent.y}) < 2 LIMIT 1`
          if (existing.length > 0) {
            fixed.push({ nodeId: existing[0].id, stairwellId: sf.stairwell_id, floor: sf.floor, targetFloor: ent.targetFloor, role: ent.role })
            continue
          }

          const near = await prisma.$queryRaw<any[]>`SELECT id, x, y FROM road_nodes WHERE campus = ${campus} AND stairwell_id IS NULL AND ABS(x - ${ent.x}) < 3 AND ABS(y - ${ent.y}) < 3 ORDER BY (ABS(x - ${ent.x}) + ABS(y - ${ent.y})) LIMIT 1`
          if (near.length > 0) {
            const nid = near[0].id
            await prisma.$executeRaw`UPDATE road_nodes SET stairwell_id = ${sf.stairwell_id}, stairwell_floor = ${sf.floor}, stairwell_role = ${ent.role}, building_category = ${bCat} WHERE id = ${nid}`
            fixed.push({ nodeId: nid, stairwellId: sf.stairwell_id, floor: sf.floor, targetFloor: ent.targetFloor, role: ent.role, action: 'updated' })
          } else {
            const rows = await prisma.$queryRaw<any[]>`INSERT INTO road_nodes (x, y, campus, floor, building_category, stairwell_id, stairwell_floor, stairwell_role) VALUES (${ent.x}, ${ent.y}, ${campus}, ${sf.floor}, ${bCat}, ${sf.stairwell_id}, ${sf.floor}, ${ent.role}) RETURNING id`
            created.push({ nodeId: rows[0].id, stairwellId: sf.stairwell_id, floor: sf.floor, targetFloor: ent.targetFloor, role: ent.role, action: 'created' })
          }
        }
      }

      const allNodes = [...fixed, ...created]
      const byStairwell = new Map<number, any[]>()
      for (const n of allNodes) {
        if (!byStairwell.has(n.stairwellId)) byStairwell.set(n.stairwellId, [])
        byStairwell.get(n.stairwellId)!.push(n)
      }

      let edgesCreated = 0
      for (const [swId, sNodes] of byStairwell) {
        const sw = swRows.find((w: any) => w.id === swId)
        const isTrunk = !!sw?.is_trunk

        for (let i = 0; i < sNodes.length; i++) {
          for (let j = i + 1; j < sNodes.length; j++) {
            const n1 = sNodes[i]; const n2 = sNodes[j]
            if (n1.floor === n2.floor) continue

            if (isTrunk) {
              const n1TargetsN2 = n1.targetFloor != null && n1.targetFloor === n2.floor
              const n2TargetsN1 = n2.targetFloor != null && n2.targetFloor === n1.floor
              if (!n1TargetsN2 || !n2TargetsN1) continue
            }

            const existingEdge = await prisma.$queryRaw<any[]>`SELECT id FROM road_edges WHERE ((from_node = ${n1.nodeId} AND to_node = ${n2.nodeId}) OR (from_node = ${n2.nodeId} AND to_node = ${n1.nodeId})) AND campus = ${campus}`
            if (existingEdge.length > 0) continue
            const n1d = await prisma.$queryRaw<any[]>`SELECT x, y FROM road_nodes WHERE id = ${n1.nodeId}`
            const n2d = await prisma.$queryRaw<any[]>`SELECT x, y FROM road_nodes WHERE id = ${n2.nodeId}`
            if (n1d.length === 0 || n2d.length === 0) continue
            const dist = Math.sqrt((n1d[0].x - n2d[0].x) ** 2 + (n1d[0].y - n2d[0].y) ** 2)
            const rType = sw?.building_category === 'admin' ? 'slope_admin_internal' : 'slope_teaching_internal'
            await prisma.$queryRaw`INSERT INTO road_edges (from_node, to_node, distance, campus, is_slope, slope_floors, road_type) VALUES (${n1.nodeId}, ${n2.nodeId}, ${dist}, ${campus}, true, ${JSON.stringify([n1.floor, n2.floor].sort())}, ${rType})`
            edgesCreated++
          }
        }
      }

      return NextResponse.json({ fixed: fixed.length, created: created.length, edgesCreated }, { status: 200 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/roads error:', error)
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 })
  }
}
