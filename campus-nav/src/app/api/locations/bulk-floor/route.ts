// src/app/api/locations/bulk-floor/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

export async function PUT(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { ids, floor } = body
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
    }

    const floorValue = floor === null || floor === undefined ? null : Number(floor)
    if (floorValue !== null && (Number.isNaN(floorValue) || floorValue < 0)) {
      return NextResponse.json({ error: 'floor must be a non-negative integer or null' }, { status: 400 })
    }

    const idNumbers = ids.map(Number).filter(n => !Number.isNaN(n))

    const result = await prisma.location.updateMany({
      where: { id: { in: idNumbers } },
      data: { floor: floorValue },
    })

    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    console.error('PUT /api/locations/bulk-floor error:', error)
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 })
  }
}
