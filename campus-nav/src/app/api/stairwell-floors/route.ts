// src/app/api/stairwell-floors/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

const TARGET_COLS_EXIST = { target_floor_1: false, target_floor_2: false }

async function ensureTargetColumns() {
  if (TARGET_COLS_EXIST.target_floor_1 && TARGET_COLS_EXIST.target_floor_2) return
  try {
    await prisma.$executeRaw`ALTER TABLE stairwell_floors ADD COLUMN IF NOT EXISTS target_floor_1 INTEGER`
    await prisma.$executeRaw`ALTER TABLE stairwell_floors ADD COLUMN IF NOT EXISTS target_floor_2 INTEGER`
    TARGET_COLS_EXIST.target_floor_1 = true
    TARGET_COLS_EXIST.target_floor_2 = true
  } catch {}
}

async function queryStairwellFloors(stairwellId: number) {
  try {
    await ensureTargetColumns()
    return await prisma.$queryRaw<any[]>`
      SELECT id, stairwell_id, floor, x, y, rect_x1, rect_y1, rect_x2, rect_y2,
             entry_x, entry_y, exit_x, exit_y, target_floor_1, target_floor_2
      FROM stairwell_floors WHERE stairwell_id = ${stairwellId} ORDER BY floor ASC
    `
  } catch {
    try {
      return await prisma.$queryRaw<any[]>`
        SELECT id, stairwell_id, floor, x, y, rect_x1, rect_y1, rect_x2, rect_y2,
               entry_x, entry_y, exit_x, exit_y
        FROM stairwell_floors WHERE stairwell_id = ${stairwellId} ORDER BY floor ASC
      `
    } catch {
      return await prisma.$queryRaw<any[]>`
        SELECT id, stairwell_id, floor, x, y, rect_x1, rect_y1, rect_x2, rect_y2, exit_x, exit_y
        FROM stairwell_floors WHERE stairwell_id = ${stairwellId} ORDER BY floor ASC
      `
    }
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const stairwellId = url.searchParams.get('stairwellId')
    if (!stairwellId) return NextResponse.json({ error: 'Missing stairwellId' }, { status: 400 })

    const rows = await queryStairwellFloors(Number(stairwellId))

    return NextResponse.json(rows.map(r => ({
      id: r.id, stairwellId: r.stairwell_id, floor: r.floor,
      x: r.x ?? 0, y: r.y ?? 0,
      rectX1: r.rect_x1 ?? 0, rectY1: r.rect_y1 ?? 0, rectX2: r.rect_x2 ?? 0, rectY2: r.rect_y2 ?? 0,
      entryX: r.entry_x ?? null, entryY: r.entry_y ?? null,
      exitX: r.exit_x ?? null, exitY: r.exit_y ?? null,
      targetFloor1: r.target_floor_1 ?? null,
      targetFloor2: r.target_floor_2 ?? null,
    })))
  } catch (error) {
    console.error('GET /api/stairwell-floors error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { action, data } = body

    if (action === 'upsert') {
      const { stairwellId, floor } = data
      const x = Number(data.x) || 50
      const y = Number(data.y) || 50
      const rectX1 = Number(data.rectX1) || 0
      const rectY1 = Number(data.rectY1) || 0
      const rectX2 = Number(data.rectX2) || 0
      const rectY2 = Number(data.rectY2) || 0
      const entryX = data.entryX != null ? Number(data.entryX) : null
      const entryY = data.entryY != null ? Number(data.entryY) : null
      const exitX = data.exitX != null ? Number(data.exitX) : null
      const exitY = data.exitY != null ? Number(data.exitY) : null
      const targetFloor1 = data.targetFloor1 != null ? Number(data.targetFloor1) : null
      const targetFloor2 = data.targetFloor2 != null ? Number(data.targetFloor2) : null

      await ensureTargetColumns()

      try {
        const rows = await prisma.$queryRaw<any[]>`
          INSERT INTO stairwell_floors (stairwell_id, floor, x, y, rect_x1, rect_y1, rect_x2, rect_y2, entry_x, entry_y, exit_x, exit_y, target_floor_1, target_floor_2)
          VALUES (${Number(stairwellId)}, ${Number(floor)}, ${x}, ${y}, ${rectX1}, ${rectY1}, ${rectX2}, ${rectY2}, ${entryX}, ${entryY}, ${exitX}, ${exitY}, ${targetFloor1}, ${targetFloor2})
          ON CONFLICT (stairwell_id, floor) DO UPDATE SET
            x = EXCLUDED.x, y = EXCLUDED.y,
            rect_x1 = EXCLUDED.rect_x1, rect_y1 = EXCLUDED.rect_y1,
            rect_x2 = EXCLUDED.rect_x2, rect_y2 = EXCLUDED.rect_y2,
            entry_x = EXCLUDED.entry_x, entry_y = EXCLUDED.entry_y,
            exit_x = EXCLUDED.exit_x, exit_y = EXCLUDED.exit_y,
            target_floor_1 = EXCLUDED.target_floor_1,
            target_floor_2 = EXCLUDED.target_floor_2
          RETURNING id
        `
        return NextResponse.json({ id: rows[0].id }, { status: 201 })
      } catch {
        const rows = await prisma.$queryRaw<any[]>`
          INSERT INTO stairwell_floors (stairwell_id, floor, x, y, rect_x1, rect_y1, rect_x2, rect_y2, entry_x, entry_y, exit_x, exit_y)
          VALUES (${Number(stairwellId)}, ${Number(floor)}, ${x}, ${y}, ${rectX1}, ${rectY1}, ${rectX2}, ${rectY2}, ${entryX}, ${entryY}, ${exitX}, ${exitY})
          ON CONFLICT (stairwell_id, floor) DO UPDATE SET
            x = EXCLUDED.x, y = EXCLUDED.y,
            rect_x1 = EXCLUDED.rect_x1, rect_y1 = EXCLUDED.rect_y1,
            rect_x2 = EXCLUDED.rect_x2, rect_y2 = EXCLUDED.rect_y2,
            entry_x = EXCLUDED.entry_x, entry_y = EXCLUDED.entry_y,
            exit_x = EXCLUDED.exit_x, exit_y = EXCLUDED.exit_y
          RETURNING id
        `
        return NextResponse.json({ id: rows[0].id }, { status: 201 })
      }
    }

    if (action === 'delete') {
      await prisma.$executeRaw`DELETE FROM stairwell_floors WHERE id = ${Number(data.id)}`
      return NextResponse.json({ success: true })
    }

    if (action === 'copyFrom') {
      const { stairwellId, fromFloor, toFloors } = data
      const srcRows = await prisma.$queryRaw<any[]>`
        SELECT * FROM stairwell_floors WHERE stairwell_id = ${Number(stairwellId)} AND floor = ${Number(fromFloor)}
      `
      if (srcRows.length === 0) return NextResponse.json({ error: 'Source floor not found' }, { status: 404 })
      const src = srcRows[0]
      for (const toFloor of toFloors) {
        try {
          await prisma.$queryRaw`
            INSERT INTO stairwell_floors (stairwell_id, floor, x, y, rect_x1, rect_y1, rect_x2, rect_y2, entry_x, entry_y, exit_x, exit_y)
            VALUES (${Number(stairwellId)}, ${Number(toFloor)}, ${src.x}, ${src.y},
                    ${src.rect_x1}, ${src.rect_y1}, ${src.rect_x2}, ${src.rect_y2},
                    ${src.entry_x ?? null}, ${src.entry_y ?? null}, ${src.exit_x ?? null}, ${src.exit_y ?? null})
            ON CONFLICT (stairwell_id, floor) DO UPDATE SET
              x = EXCLUDED.x, y = EXCLUDED.y,
              rect_x1 = EXCLUDED.rect_x1, rect_y1 = EXCLUDED.rect_y1,
              rect_x2 = EXCLUDED.rect_x2, rect_y2 = EXCLUDED.rect_y2,
              entry_x = EXCLUDED.entry_x, entry_y = EXCLUDED.entry_y,
              exit_x = EXCLUDED.exit_x, exit_y = EXCLUDED.exit_y
          `
        } catch {
          await prisma.$queryRaw`
            INSERT INTO stairwell_floors (stairwell_id, floor, x, y, rect_x1, rect_y1, rect_x2, rect_y2, exit_x, exit_y)
            VALUES (${Number(stairwellId)}, ${Number(toFloor)}, ${src.x}, ${src.y},
                    ${src.rect_x1}, ${src.rect_y1}, ${src.rect_x2}, ${src.rect_y2},
                    ${src.exit_x ?? null}, ${src.exit_y ?? null})
            ON CONFLICT (stairwell_id, floor) DO UPDATE SET
              x = EXCLUDED.x, y = EXCLUDED.y,
              rect_x1 = EXCLUDED.rect_x1, rect_y1 = EXCLUDED.rect_y1,
              rect_x2 = EXCLUDED.rect_x2, rect_y2 = EXCLUDED.rect_y2,
              exit_x = EXCLUDED.exit_x, exit_y = EXCLUDED.exit_y
          `
        }
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('POST /api/stairwell-floors error:', error)
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 })
  }
}
