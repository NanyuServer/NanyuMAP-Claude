// src/app/api/feedback/route.ts
// 用户意见反馈：POST 公开提交；GET/DELETE 需管理员鉴权
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

const VALID_TYPES = ['功能意见', '界面意见', '新的需求', '其他']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const type = String(body.type || '').trim()
    const description = String(body.description || '').trim()
    const phone = body.phone ? String(body.phone).trim().slice(0, 20) : null

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: '反馈类型无效' }, { status: 400 })
    }
    if (!description) {
      return NextResponse.json({ error: '请描述您遇到的问题' }, { status: 400 })
    }
    if (description.length > 500) {
      return NextResponse.json({ error: '描述内容过长（最多 500 字）' }, { status: 400 })
    }

    const feedback = await prisma.feedback.create({
      data: { type, description, phone },
    })

    return NextResponse.json({ id: feedback.id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/feedback error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const list = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    return NextResponse.json(list)
  } catch (error) {
    console.error('GET /api/feedback error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const id = Number(url.searchParams.get('id'))
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    await prisma.feedback.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/feedback error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
