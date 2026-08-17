// src/app/api/visit-routes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

function campusNorm(v: unknown): string { return v === 'senior' ? 'senior' : 'junior' }

function safeParse(str: string | null, fallback: any): any {
  if (!str) return fallback
  try { return JSON.parse(str) } catch { return fallback }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const campus = url.searchParams.get('campus')
    const where = campus ? { campus: campusNorm(campus) } : {}
    const routes = await prisma.visitRoute.findMany({ where, orderBy: { createdAt: 'desc' } })
    return NextResponse.json(routes.map(r => ({
      id: r.id, campus: r.campus, name: r.name,
      locationIds: safeParse(r.locationIds, []),
      checkpoints: safeParse(r.checkpoints, []),
      customCheckpoints: safeParse((r as any).customCheckpoints, []),
      routePoints: safeParse(r.routePoints, []),
      imageCrop: safeParse(r.imageCrop, {}),
    })))
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { action, data } = body

    if (action === 'create') {
      const route = await prisma.visitRoute.create({
        data: {
          campus: campusNorm(data.campus),
          name: String(data.name || '未命名路线'),
          locationIds: JSON.stringify(data.locationIds || []),
          checkpoints: JSON.stringify(data.checkpoints || []),
          routePoints: JSON.stringify(data.routePoints || []),
          imageCrop: JSON.stringify(data.imageCrop || {}),
        },
      })
      // Update customCheckpoints separately (Prisma might not know the field yet)
      if (data.customCheckpoints) {
        try { await prisma.$executeRaw`UPDATE visit_routes SET custom_checkpoints = ${JSON.stringify(data.customCheckpoints)} WHERE id = ${route.id}` } catch {}
      }
      return NextResponse.json({ id: route.id }, { status: 201 })
    }

    if (action === 'update') {
      const updateData: any = {}
      if (data.name !== undefined) updateData.name = String(data.name)
      if (data.locationIds !== undefined) updateData.locationIds = JSON.stringify(data.locationIds)
      if (data.checkpoints !== undefined) updateData.checkpoints = JSON.stringify(data.checkpoints)
      if (data.routePoints !== undefined) updateData.routePoints = JSON.stringify(data.routePoints)
      if (data.imageCrop !== undefined) updateData.imageCrop = JSON.stringify(data.imageCrop)
      await prisma.visitRoute.update({ where: { id: Number(data.id) }, data: updateData })
      // Update customCheckpoints via raw SQL
      if (data.customCheckpoints !== undefined) {
        try { await prisma.$executeRaw`UPDATE visit_routes SET custom_checkpoints = ${JSON.stringify(data.customCheckpoints)} WHERE id = ${Number(data.id)}` } catch {}
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      await prisma.visitRoute.delete({ where: { id: Number(data.id) } })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
