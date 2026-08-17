// src/app/api/locations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

function campusNorm(v: unknown): string { return v === 'senior' ? 'senior' : 'junior' }

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const campus = campusNorm(url.searchParams.get('campus'))
    const rawLocations = await prisma.location.findMany({ where: { campus }, orderBy: { createdAt: 'desc' } })
    const locations = rawLocations.map(l => ({
      id: l.id, category: l.category, detailInfo: l.detailInfo ?? l.category, extraInfo: l.extraInfo ?? null,
      x: l.x, y: l.y, campus: l.campus, floor: l.floor ?? null, isNavigable: l.isNavigable ?? true, createdAt: l.createdAt.toISOString(),
    }))
    return NextResponse.json(locations)
  } catch (error) {
    console.error('GET /api/locations error:', error)
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { category, detailInfo, extraInfo, x, y, campus, floor, isNavigable } = body
    if (!category || x == null || y == null) return NextResponse.json({ error: 'Missing required fields', details: 'category, x, and y are required' }, { status: 400 })

    const finalDetail = detailInfo && String(detailInfo).trim() ? detailInfo : category
    const floorVal = floor != null ? Number(floor) : null
    const navVal = isNavigable !== false

    try {
      try {
        const rows = await prisma.$queryRaw<any[]>`INSERT INTO locations (category, detail_info, extra_info, x, y, campus, floor, is_navigable) VALUES (${category}, ${finalDetail}, ${extraInfo || null}, ${x}, ${y}, ${campusNorm(campus)}, ${floorVal}, ${navVal}) RETURNING id, category, detail_info, extra_info, x, y, campus, floor, is_navigable, created_at`
        const r = rows[0]
        return NextResponse.json({ id: r.id, category: r.category, detailInfo: r.detail_info, extraInfo: r.extra_info, x: r.x, y: r.y, campus: r.campus, floor: r.floor, isNavigable: r.is_navigable ?? true, createdAt: r.created_at }, { status: 201 })
      } catch {
        const location = await prisma.location.create({ data: { category, detailInfo: finalDetail, extraInfo: extraInfo || null, x, y, campus: campusNorm(campus), isNavigable: navVal } })
        return NextResponse.json({ id: location.id, category: location.category, detailInfo: location.detailInfo ?? location.category, extraInfo: location.extraInfo ?? null, x: location.x, y: location.y, campus: location.campus, floor: location.floor, isNavigable: location.isNavigable ?? true, createdAt: location.createdAt.toISOString() }, { status: 201 })
      }
    } catch (dbError) {
      return NextResponse.json({ error: 'Failed to create location', details: String(dbError) }, { status: 500 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 })
  }
}
