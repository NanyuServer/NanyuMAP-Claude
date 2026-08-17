// src/app/api/system/reset/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function POST() {
  try {
    await requireAdmin()

    await prisma.$transaction([
      prisma.roadEdge.deleteMany(),
      prisma.roadNode.deleteMany(),
      prisma.location.deleteMany(),
      prisma.category.deleteMany(),
      prisma.systemSetting.deleteMany(),
    ])

    return NextResponse.json({ success: true, message: '所有数据已删除' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '重置失败' }, { status: 500 })
  }
}
