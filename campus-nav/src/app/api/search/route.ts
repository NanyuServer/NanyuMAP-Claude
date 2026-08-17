// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function campusNorm(v: unknown): string { return v === 'senior' ? 'senior' : 'junior' }

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const campus = campusNorm(searchParams.get('campus'))
    if (!q || q.length === 0) return NextResponse.json([])

    const rawAll = await prisma.location.findMany({ where: { campus }, orderBy: { createdAt: 'desc' } })
    const all = rawAll
      .filter(l => l.isNavigable !== false)
      .map(l => ({
        id: l.id, category: l.category, detailInfo: l.detailInfo ?? l.category, extraInfo: l.extraInfo ?? null,
        x: l.x, y: l.y, campus: l.campus, floor: l.floor ?? null,
      }))

    const normalize = (s: string) => s.toLowerCase().replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/g, ' ').trim()
    const levenshtein = (a: string, b: string) => {
      const m = a.length; const n = b.length; if (m === 0) return n; if (n === 0) return m
      const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
      for (let i = 0; i <= m; i++) dp[i][0] = i
      for (let j = 0; j <= n; j++) dp[0][j] = j
      for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) { const cost = a[i - 1] === b[j - 1] ? 0 : 1; dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost) }
      return dp[m][n]
    }

    const scoreMatch = (query: string, target?: string | null): number => {
      if (!target) return -1
      const nq = normalize(query)
      const nt = normalize(target)
      if (!nq || !nt) return -1

      if (nt === nq) return 100
      if (nt.startsWith(nq)) return 90
      if (nt.includes(nq)) return 80
      if (nq.includes(nt)) return 60

      const dist = levenshtein(nq, nt)
      const maxLen = Math.max(nq.length, nt.length)
      const similarity = 1 - dist / maxLen
      if (similarity >= 0.6) return Math.round(similarity * 50)

      for (const word of nt.split(' ')) {
        if (word.startsWith(nq)) return 55
        if (word.includes(nq)) return 45
      }

      return -1
    }

    type ScoredItem = typeof all[number] & { _score: number }
    const scored: ScoredItem[] = []

    for (const loc of all) {
      const s1 = scoreMatch(q, loc.detailInfo)
      const s2 = scoreMatch(q, loc.extraInfo)
      const best = Math.max(s1, s2)
      if (best > 0) {
        const catBonus = normalize(loc.category).includes(normalize(q)) ? 5 : 0
        scored.push({ ...loc, _score: best + catBonus })
      }
    }

    scored.sort((a, b) => b._score - a._score)

    const results = scored.slice(0, 20).map(({ _score, ...rest }) => rest)
    return NextResponse.json(results)
  } catch (error) {
    console.error('GET /api/search error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
