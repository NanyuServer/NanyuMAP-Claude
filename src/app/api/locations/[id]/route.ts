// src/app/api/locations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { category, detailInfo, extraInfo, x, y } = body

    const location = await prisma.location.update({
      where: { id: parseInt(id) },
      data: {
        category,
        detailInfo,
        extraInfo: extraInfo || null,
        x,
        y,
      },
    })

    return NextResponse.json(location)
  } catch (error) {
    console.error('PUT /api/locations/[id] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await prisma.location.delete({ where: { id: parseInt(id) } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/locations/[id] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
