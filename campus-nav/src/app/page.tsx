// src/app/page.tsx
import { prisma } from '@/lib/prisma'
import CampusMapClient from '@/components/map/CampusMapClient'
import type { Location } from '@prisma/client'

export default async function HomePage() {
  let initialLocations: Location[] = []
  try {
    initialLocations = await prisma.location.findMany({
      where: { campus: 'junior' },
      orderBy: { id: 'asc' },
    })
  } catch {
    initialLocations = []
  }

  return (
    <CampusMapClient
      initialLocations={initialLocations}
    />
  )
}
