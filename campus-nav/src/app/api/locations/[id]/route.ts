// src/app/api/locations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

function campusNorm(v: unknown): string { return v === 'senior' ? 'senior' : 'junior' }

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const { category, detailInfo, extraInfo, x, y, campus, floor, isNavigable } = body
    try {
      const location = await prisma.location.update({
        where: { id: parseInt(id) },
        data: {
          category, detailInfo, extraInfo: extraInfo || null, x, y,
          campus: campus ? campusNorm(campus) : undefined,
          floor: floor !== undefined ? floor : undefined,
          isNavigable: isNavigable !== undefined ? isNavigable : undefined,
        },
      })
      return NextResponse.json({ id: location.id, category: location.category, detailInfo: location.detailInfo ?? location.category, extraInfo: location.extraInfo ?? null, x: location.x, y: location.y, campus: location.campus, floor: location.floor, isNavigable: location.isNavigable ?? true, createdAt: location.createdAt.toISOString() })
    } catch (dbError) { return NextResponse.json({ error: 'Failed to update location', details: String(dbError) }, { status: 500 }) }
  } catch (error) { return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 }) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    try { await prisma.location.delete({ where: { id: parseInt(id) } }); return NextResponse.json({ success: true }) }
    catch (dbError) { return NextResponse.json({ error: 'Failed to delete location', details: String(dbError) }, { status: 500 }) }
  } catch (error) { return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 }) }
}
