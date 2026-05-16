// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length === 0) {
      return NextResponse.json([])
    }

    const results = await prisma.location.findMany({
      where: {
        OR: [
          { detailInfo: { contains: q, mode: 'insensitive' } },
          { extraInfo: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('GET /api/search error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
