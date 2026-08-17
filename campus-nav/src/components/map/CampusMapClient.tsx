'use client'

import dynamic from 'next/dynamic'
import type { Location } from '@prisma/client'

type Props = {
  initialLocations: Location[]
}

const CampusMap = dynamic(
  () => import('./CampusMap'),
  {
    ssr: false,
    loading: () => (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #F3EEF9 0%, #E9E1F5 100%)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <img
            src="/assets/title.webp"
            alt="南渝中学校园导览系统"
            className="h-12 w-auto object-contain opacity-80"
            draggable={false}
          />
          <div className="flex flex-col items-center gap-3">
            <div
              style={{
                width: 28,
                height: 28,
                border: '2.5px solid rgba(59,51,86,0.12)',
                borderTopColor: '#3B3356',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span
              className="text-sm font-medium tracking-wide"
              style={{ color: 'rgba(59,51,86,0.6)' }}
            >
              正在准备地图…
            </span>
          </div>
        </div>
      </div>
    ),
  }
)

export default function CampusMapClient({ initialLocations }: Props) {
  return <CampusMap initialLocations={initialLocations} />
}
