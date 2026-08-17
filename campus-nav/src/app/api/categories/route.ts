import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth'

function campusNorm(v: unknown): string {
  return v === 'senior' ? 'senior' : 'junior'
}

const DEFAULT_JUNIOR = ['北门', '东南门', '教学楼A栋', '教学楼B栋', '教学楼C栋', '学术报告厅', '大操场', '风雨操场', '图书馆', '礼堂', '行政办公楼', '食堂', '女生公寓', '男生公寓', '网球场', '耕读园', '羽毛球场', '篮球场', '乒乓球场', '匹克球场', '公能广场', '器材室和健身中心']
const DEFAULT_SENIOR = ['大门', '教学楼', '行政楼', '食堂', '宿舍', '操场', '报告厅', '图书馆']

async function ensureDefaults(campus: string) {
  const defaults = campus === 'senior' ? DEFAULT_SENIOR : DEFAULT_JUNIOR
  const existing = await prisma.category.findMany({ where: { campus }, select: { name: true } })
  const existingNames = new Set(existing.map(c => c.name))
  for (const name of defaults) {
    if (!existingNames.has(name)) {
      await prisma.category.create({ data: { name, campus } }).catch(() => {})
    }
  }
  // Remove categories in DB that are not in defaults (cleanup removed defaults)
  for (const c of existing) {
    if (!defaults.includes(c.name)) {
      // Keep user-added categories, don't delete
    }
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const campus = campusNorm(url.searchParams.get('campus'))
    await ensureDefaults(campus)
    const cats = await prisma.category.findMany({ where: { campus }, orderBy: { id: 'asc' }, select: { name: true } })
    const names = cats.map(c => c.name)
    // If DB is empty for this campus, use hardcoded defaults
    if (names.length === 0) {
      return NextResponse.json(campus === 'senior' ? [...DEFAULT_SENIOR] : [...DEFAULT_JUNIOR])
    }
    return NextResponse.json(names)
  } catch (err) {
    console.error('GET /api/categories error:', err)
    return NextResponse.json(campusNorm(new URL(req.url).searchParams.get('campus')) === 'senior' ? [...DEFAULT_SENIOR] : [...DEFAULT_JUNIOR])
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const campus = campusNorm(body.campus)
    const cats = Array.isArray(body.categories) ? body.categories.map(String) : null
    if (!cats) return NextResponse.json({ error: 'Invalid categories' }, { status: 400 })

    // Remove all existing categories for this campus, then recreate
    await prisma.category.deleteMany({ where: { campus } })
    for (const name of cats) {
      if (name.trim()) {
        await prisma.category.create({ data: { name: name.trim(), campus } })
      }
    }

    return NextResponse.json({ success: true, categories: cats })
  } catch (err) {
    console.error('POST /api/categories error:', err)
    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 })
  }
}
