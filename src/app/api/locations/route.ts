// src/app/api/locations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

export async function GET() {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(locations)
  } catch (error) {
    console.error('GET /api/locations error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { category, detailInfo, extraInfo, x, y } = body

    if (!category || !detailInfo || x == null || y == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const location = await prisma.location.create({
      data: { category, detailInfo, extraInfo: extraInfo || null, x, y },
    })

    return NextResponse.json(location, { status: 201 })
  } catch (error) {
    console.error('POST /api/locations error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
