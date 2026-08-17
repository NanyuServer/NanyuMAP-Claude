import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

function campusNorm(v: unknown): string { return v === 'senior' ? 'senior' : 'junior' }

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const campus = campusNorm(url.searchParams.get('campus'))

    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, campus, floor, x, y, w, h FROM floor_markers WHERE campus = ${campus} ORDER BY floor ASC
    `

    const markers = rows.map(r => ({
      id: r.id, campus: r.campus, floor: r.floor,
      x: r.x, y: r.y, w: r.w, h: r.h,
    }))

    return NextResponse.json(markers)
  } catch (error) {
    console.error('GET /api/floor-markers error:', error)
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json()
    const { action, data } = body

    if (action === 'upsert') {
      const campus = campusNorm(data.campus)
      const floor = Number(data.floor)
      const x = Number(data.x); const y = Number(data.y)
      const w = Number(data.w); const h = Number(data.h)
      if (Number.isNaN(floor) || Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(w) || Number.isNaN(h)) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
      }
      const rows = await prisma.$queryRaw<any[]>`
        INSERT INTO floor_markers (campus, floor, x, y, w, h) VALUES (${campus}, ${floor}, ${x}, ${y}, ${w}, ${h})
        ON CONFLICT (campus, floor) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, w = EXCLUDED.w, h = EXCLUDED.h
        RETURNING id
      `
      return NextResponse.json({ id: rows[0].id }, { status: 201 })
    }

    if (action === 'delete') {
      const id = Number(data.id)
      if (Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
      await prisma.$executeRaw`DELETE FROM floor_markers WHERE id = ${id}`
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('POST /api/floor-markers error:', error)
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 })
  }
}
