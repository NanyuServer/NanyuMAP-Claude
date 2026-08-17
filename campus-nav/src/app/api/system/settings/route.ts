// src/app/api/system/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { normalizeNavSettings } from '@/lib/navSettings'

export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany()
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    let navSettings
    try {
      navSettings = normalizeNavSettings(JSON.parse(map['nav_global_settings'] || '{}'))
    } catch {
      navSettings = normalizeNavSettings(null)
    }
    return NextResponse.json({
      systemVersion: map['system_version'] || '1.0.0',
      databaseVersion: map['database_version'] || 'PostgreSQL 16',
      juniorScale: map['junior_scale'] || '',
      seniorScale: map['senior_scale'] || '',
      presetImageCrops: map['preset_image_crops'] || '{}',
      navSettings,
    })
  } catch (error) {
    return NextResponse.json({ systemVersion: '1.0.0', databaseVersion: 'PostgreSQL 16', juniorScale: '', seniorScale: '', navSettings: normalizeNavSettings(null) })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()

    const allowedKeys: Record<string, string> = {
      systemVersion: 'system_version',
      databaseVersion: 'database_version',
      juniorScale: 'junior_scale',
      seniorScale: 'senior_scale',
      presetImageCrops: 'preset_image_crops',
      navSettings: 'nav_global_settings',
    }

    for (const [field, dbKey] of Object.entries(allowedKeys)) {
      if (body[field] !== undefined) {
        await prisma.systemSetting.upsert({
          where: { key: dbKey },
          update: { value: String(body[field]) },
          create: { key: dbKey, value: String(body[field]) },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
