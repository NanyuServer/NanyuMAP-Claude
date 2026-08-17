// src/app/api/locations/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

function campusNorm(v: unknown): string { return v === 'senior' ? 'senior' : 'junior' }

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    if (!Array.isArray(body) || body.length === 0) return NextResponse.json({ error: 'No data', details: 'Body must be a non-empty array' }, { status: 400 })

    const items = body.map((it: any) => {
      const { category, detailInfo, extraInfo, x, y, campus, floor } = it
      if (!category || x == null || y == null) throw new Error(`Missing required fields: category=${category}, x=${x}, y=${y}`)
      return { category, detailInfo: detailInfo && String(detailInfo).trim() ? detailInfo : category, extraInfo: extraInfo && String(extraInfo).trim() ? extraInfo : null, x, y, campus: campusNorm(campus), floor: floor != null ? Number(floor) : null }
    })

    try { const result = await prisma.location.createMany({ data: items }); return NextResponse.json({ count: result.count }, { status: 201 }) }
    catch (dbError) { return NextResponse.json({ error: 'Failed to create locations', details: String(dbError) }, { status: 500 }) }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (error instanceof Error && msg.includes('Missing required fields')) return NextResponse.json({ error: 'Missing required fields', details: msg }, { status: 400 })
    return NextResponse.json({ error: 'Server error', details: msg }, { status: 500 })
  }
}
