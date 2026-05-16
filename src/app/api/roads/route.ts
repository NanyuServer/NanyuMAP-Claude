// src/app/api/roads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

export async function GET() {
  try {
    const [nodes, edges] = await Promise.all([
      prisma.roadNode.findMany({ orderBy: { id: 'asc' } }),
      prisma.roadEdge.findMany({ orderBy: { id: 'asc' } }),
    ])
    return NextResponse.json({ nodes, edges })
  } catch (error) {
    console.error('GET /api/roads error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action, data } = body

    if (action === 'add_node') {
      const node = await prisma.roadNode.create({
        data: { x: data.x, y: data.y },
      })
      return NextResponse.json(node, { status: 201 })
    }

    if (action === 'delete_node') {
      await prisma.roadNode.delete({ where: { id: data.id } })
      return NextResponse.json({ success: true })
    }

    if (action === 'move_node') {
      const node = await prisma.roadNode.update({
        where: { id: data.id },
        data: { x: data.x, y: data.y },
      })
      return NextResponse.json(node)
    }

    if (action === 'add_edge') {
      const distance = Math.sqrt(
        (data.x2 - data.x1) ** 2 + (data.y2 - data.y1) ** 2
      )
      const edge = await prisma.roadEdge.create({
        data: { fromNode: data.fromNode, toNode: data.toNode, distance },
      })
      return NextResponse.json(edge, { status: 201 })
    }

    if (action === 'delete_edge') {
      await prisma.roadEdge.delete({ where: { id: data.id } })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/roads error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
