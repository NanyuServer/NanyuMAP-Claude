// src/app/api/system/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin()
    const { currentPassword, newUsername, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '请填写当前密码和新密码' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: '新密码长度不能少于6位' }, { status: 400 })
    }

    const user = await prisma.adminUser.findUnique({ where: { username: session.username } })
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: '当前密码错误' }, { status: 401 })
    }

    const updateData: { username?: string; passwordHash?: string } = {}
    if (newUsername && newUsername !== user.username) {
      const existing = await prisma.adminUser.findUnique({ where: { username: newUsername } })
      if (existing) {
        return NextResponse.json({ error: '该用户名已被使用' }, { status: 400 })
      }
      updateData.username = newUsername
    }
    updateData.passwordHash = await bcrypt.hash(newPassword, 12)

    await prisma.adminUser.update({ where: { id: user.id }, data: updateData })

    return NextResponse.json({ success: true, message: '账号信息已更新' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '修改失败' }, { status: 500 })
  }
}
