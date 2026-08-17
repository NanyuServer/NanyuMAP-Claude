// src/app/api/locations/bulk-rename/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { renames } = body
    if (!Array.isArray(renames) || renames.length === 0) {
      return NextResponse.json({ error: 'renames must be a non-empty array' }, { status: 400 })
    }

    let updated = 0
    const errors: string[] = []

    await prisma.$transaction(async (tx) => {
      for (const item of renames) {
        const id = Number(item?.id)
        const name = typeof item?.name === 'string' ? item.name.trim() : ''
        if (!id || !name) continue

        const loc = await tx.location.findUnique({ where: { id } })
        if (!loc) {
          errors.push(`未找到地点 #${id}`)
          continue
        }

        const data: { detailInfo: string; category?: string } = { detailInfo: name }
        if (loc.detailInfo === loc.category) data.category = name
        await tx.location.update({ where: { id }, data })
        updated++
      }
    })

    return NextResponse.json({ success: true, count: updated, errors })
  } catch (error) {
    console.error('POST /api/locations/bulk-rename error:', error)
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 })
  }
}
