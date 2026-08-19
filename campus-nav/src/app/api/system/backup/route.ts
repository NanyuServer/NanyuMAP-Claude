// src/app/api/system/backup/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    await requireAdmin()

    const [locations, roadNodes, roadEdges, categories, systemSettings, stairwells, stairwellFloors, feedbacks, visitRoutes, floorMarkers, adminUsers] = await Promise.all([
      prisma.$queryRaw`SELECT * FROM locations ORDER BY id`,
      prisma.$queryRaw`SELECT * FROM road_nodes ORDER BY id`,
      prisma.$queryRaw`SELECT * FROM road_edges ORDER BY id`,
      prisma.$queryRaw`SELECT * FROM categories ORDER BY id`,
      prisma.$queryRaw`SELECT * FROM system_settings ORDER BY id`,
      prisma.$queryRaw`SELECT * FROM stairwells ORDER BY id`,
      prisma.$queryRaw`SELECT * FROM stairwell_floors ORDER BY id`,
      prisma.$queryRaw`SELECT * FROM feedbacks ORDER BY id`,
      prisma.$queryRaw`SELECT * FROM visit_routes ORDER BY id`,
      prisma.$queryRaw`SELECT * FROM floor_markers ORDER BY id`,
      prisma.$queryRaw`SELECT id, username FROM admin_users ORDER BY id`,
    ])

    const backup = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      data: {
        locations,
        roadNodes,
        roadEdges,
        categories,
        systemSettings,
        stairwells,
        stairwellFloors,
        feedbacks,
        visitRoutes,
        floorMarkers,
        adminUsers,
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
    console.error('Backup error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: `备份失败: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 })
  }
}
