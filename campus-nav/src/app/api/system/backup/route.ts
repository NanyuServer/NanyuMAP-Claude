// src/app/api/system/backup/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    await requireAdmin()

    const [locations, roadNodes, roadEdges, categories, systemSettings] = await Promise.all([
      prisma.location.findMany(),
      prisma.roadNode.findMany(),
      prisma.roadEdge.findMany(),
      prisma.category.findMany(),
      prisma.systemSetting.findMany(),
    ])

    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {
        locations,
        roadNodes,
        roadEdges,
        categories,
        systemSettings,
      },
    }

    const json = JSON.stringify(backup, null, 2)
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="nanyu-nav-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '备份失败' }, { status: 500 })
  }
}
