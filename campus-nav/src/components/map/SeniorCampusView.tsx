'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMapStore } from '@/store/mapStore'
import NavigationOverlay from './NavigationOverlay'
import FloorPlanPin from './FloorPlanPin'
import ZoomableFloorPlan from './ZoomableFloorPlan'
import type { NavigationNode } from '@/types/navigation'

interface FloorMarker {
  id: number
  campus: string
  floor: number
  x: number
  y: number
  w: number
  h: number
}

interface SeniorCampusViewProps {
  isMobile: boolean
  isNavigating: boolean
  startFloor?: number | null
  endFloor?: number | null
}
const ELEVATION_MAP_SRC = '/assets/map2-0.webp?v=4'

const floorPlanSrc = (floor: number) => `/assets/floor/map2-${floor}.webp?v=4`

export default function SeniorCampusView({
  isMobile,
  isNavigating,
  startFloor,
  endFloor,
}: SeniorCampusViewProps) {
  const [markers, setMarkers] = useState<FloorMarker[]>([])
  const [markersLoading, setMarkersLoading] = useState(true)
  const [selectedFloor, setSelectedFloor] = useState<number | null>(1)
  const [locations, setLocations] = useState<any[]>([])
  const [floorPlanLoaded, setFloorPlanLoaded] = useState(false)
  const floorPlanRef = useRef<HTMLDivElement | null>(null)
  const navigation = useMapStore(s => s.navigation)

  useEffect(() => {
    let cancelled = false
    const fetchMarkers = async () => {
      setMarkersLoading(true)
      try {
        const res = await fetch('/api/floor-markers?campus=senior')
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) setMarkers(data)
      } catch {
        if (!cancelled) setMarkers([])
      } finally {
        if (!cancelled) setMarkersLoading(false)
      }
    }
    fetchMarkers()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/locations?campus=senior')
      .then(r => r.json())
      .then(data => { if (!cancelled && Array.isArray(data)) setLocations(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const handleFloorClick = useCallback((floor: number) => {
    setSelectedFloor(prev => prev === floor ? null : floor)
    setFloorPlanLoaded(false)
  }, [])

  useEffect(() => {
    if (!isMobile && selectedFloor != null && floorPlanLoaded && floorPlanRef.current) {
      setTimeout(() => {
        floorPlanRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
  }, [selectedFloor, isMobile, floorPlanLoaded])

  const pathByFloor = useMemo(() => {
    if (!navigation.path || navigation.path.length < 2) return {}
    const events = navigation.staircaseEvents || []
    const sFloor = startFloor ?? 1

    const eventMap = new Map<number, { fromFloor: number; toFloor: number }>()
    for (const evt of events) {
      eventMap.set(evt.nodeId, { fromFloor: evt.fromFloor, toFloor: evt.toFloor })
    }

    const map: Record<number, NavigationNode[]> = {}
    let currentFloor = sFloor

    for (const node of navigation.path) {
      const evt = eventMap.get(node.id)

      if (!map[currentFloor]) map[currentFloor] = []
      map[currentFloor].push(node)

      if (evt) {
        currentFloor = evt.toFloor
        if (!map[currentFloor]) map[currentFloor] = []
        map[currentFloor].push(node)
      }
    }

    return map
  }, [navigation.path, navigation.staircaseEvents, startFloor])

  const effectiveStart = startFloor ?? 1
  const effectiveEnd = endFloor

  if (isNavigating && effectiveEnd != null) {
    return (
      <NavigatingLayout
        isMobile={isMobile}
        startFloor={effectiveStart}
        endFloor={effectiveEnd}
        pathByFloor={pathByFloor}
        navigation={navigation}
      />
    )
  }

  return (
    <div className="w-full">
      {isMobile ? (
        <div className="flex flex-col gap-3 w-full">
          <ElevationMap
            src={ELEVATION_MAP_SRC}
            markers={markers}
            markersLoading={markersLoading}
            selectedFloor={selectedFloor}
            onFloorClick={handleFloorClick}
            isMobile={isMobile}
          />
          <AnimatePresence mode="wait">
            {selectedFloor != null && (
              <motion.div
                key={`floor-plan-${selectedFloor}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
              >
                <FloorPlanCard floor={selectedFloor} locations={locations} isMobile={isMobile} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full">
          <ElevationMap
            src={ELEVATION_MAP_SRC}
            markers={markers}
            markersLoading={markersLoading}
            selectedFloor={selectedFloor}
            onFloorClick={handleFloorClick}
            isMobile={isMobile}
          />
          <AnimatePresence mode="wait">
            {selectedFloor != null && (
              <motion.div
                key={`floor-plan-${selectedFloor}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
                ref={floorPlanRef}
              >
                <FloorPlanCard floor={selectedFloor} locations={locations} onLoad={() => setFloorPlanLoaded(true)} isMobile={isMobile} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function ElevationMap({
  src,
  markers,
  markersLoading,
  selectedFloor,
  onFloorClick,
  isMobile,
}: {
  src: string
  markers: FloorMarker[]
  markersLoading: boolean
  selectedFloor: number | null
  onFloorClick: (floor: number) => void
  isMobile: boolean
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04), 0 16px 48px rgba(0,0,0,0.06)',
        border: '1px solid rgba(0,0,0,0.08)',
        backgroundColor: '#f5f5f7',
        overflow: 'visible',
        position: 'relative',
      }}
    >
      <div className="relative w-full">
        <img
          src={src}
          alt="高中部立面图"
          className="block w-full h-auto"
          draggable={false}
          style={{ borderRadius: 16 }}
        />
        {!markersLoading && markers.map(marker => (
          <FloorLabel
            key={marker.floor}
            marker={marker}
            isSelected={selectedFloor === marker.floor}
            onClick={() => onFloorClick(marker.floor)}
            isMobile={isMobile}
          />
        ))}
        {markersLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              style={{
                width: 24,
                height: 24,
                border: '2.5px solid rgba(95,82,110,0.12)',
                borderTopColor: '#5F526E',
                borderRadius: '50%',
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function FloorLabel({
  marker,
  isSelected,
  onClick,
  isMobile,
}: {
  marker: FloorMarker
  isSelected: boolean
  onClick: () => void
  isMobile: boolean
}) {
  const centerX = marker.x + marker.w / 2
  const centerY = marker.y + marker.h / 2

  return (
    <button
      className="absolute cursor-pointer"
      style={{
        left: `${centerX}%`,
        top: `${centerY}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isSelected ? 20 : 10,
        background: 'none',
        border: 'none',
        padding: 0,
        outline: 'none',
        lineHeight: 1,
      }}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      <div
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: isMobile ? 5 : 10,
          padding: isMobile ? '1.5px 5px' : '4px 12px',
          fontSize: isMobile ? 8 : 12,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          letterSpacing: '0.02em',
          transition: 'all 0.15s ease',
          background: isSelected ? 'rgba(179,148,191,0.95)' : 'rgba(255,255,255,0.85)',
          color: isSelected ? '#ffffff' : '#5F526E',
          border: isSelected
            ? '1.5px solid rgba(179,148,191,0.6)'
            : '1.5px solid rgba(95,82,110,0.16)',
          boxShadow: isSelected
            ? '0 4px 16px rgba(179,148,191,0.3)'
            : '0 2px 8px rgba(95,82,110,0.08)',
        }}
      >
        {marker.floor}楼
      </div>
    </button>
  )
}

const SENIOR_START_POINTS = ['大门', '一楼', '二楼', '三楼', '四楼', '五楼']

function FloorPlanCard({ floor, locations, onLoad, isMobile = false }: { floor: number; locations?: any[]; onLoad?: () => void; isMobile?: boolean }) {
  const floorLocations = locations
    ? locations.filter(l => l.floor === floor && !SENIOR_START_POINTS.includes(l.category))
    : []
  const [tappedId, setTappedId] = useState<number | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  return (
    <div>
      <div
        className="relative"
        style={{
          borderRadius: 16,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04), 0 16px 48px rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.08)',
          backgroundColor: '#f5f5f7',
          overflow: 'visible',
        }}
      >
        <ZoomableFloorPlan
          src={floorPlanSrc(floor)}
          alt={`${floor}楼平面图`}
          onLoaded={() => { setImgLoaded(true); onLoad?.() }}
        >
          {(scale) => (
            imgLoaded && floor !== 5 ? (
              <div className="absolute inset-0 pointer-events-none" data-floor-plan>
                {floorLocations.map((loc: any) => (
                  <FloorPlanPin key={loc.id} loc={loc} isMobile={isMobile} isTapped={tappedId === loc.id} onTapToggle={() => setTappedId(prev => prev === loc.id ? null : loc.id)} mapScale={scale} />
                ))}
              </div>
            ) : null
          )}
        </ZoomableFloorPlan>
        {floor === 5 && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(59,51,86,0.45)', borderRadius: 16, zIndex: 20 }}>
            <div style={{
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 12,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 700,
              color: '#5F526E',
              boxShadow: '0 2px 12px rgba(95,82,110,0.18)',
            }}>
              高中部五楼暂未开放
            </div>
          </div>
        )}
      </div>
      <div
        className="text-center py-2 mt-[-1px]"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '0 0 16px 16px',
          border: '1px solid rgba(0,0,0,0.06)',
          borderTop: 'none',
        }}
      >
        <span className="text-sm font-semibold" style={{ color: '#5F526E' }}>
          {floor}楼平面图
        </span>
      </div>
    </div>
  )
}

function NavigatingLayout({
  isMobile,
  startFloor,
  endFloor,
  pathByFloor,
  navigation,
}: {
  isMobile: boolean
  startFloor: number
  endFloor: number
  pathByFloor: Record<number, NavigationNode[]>
  navigation: {
    isNavigating: boolean
    path: NavigationNode[]
    start: any
    destination: any
    staircaseEvents: { nodeId: number; x: number; y: number; fromFloor: number; toFloor: number }[]
  }
}) {
  const startName = navigation.start?.type === 'category' ? navigation.start.value : undefined
  const destName = navigation.destination?.detailInfo || navigation.destination?.category || undefined

  const events = navigation.staircaseEvents || []

  // 显示所有经过的楼层（含中间楼层），跨多层导航才完整
  const floorsToShow = Object.keys(pathByFloor).map(Number).sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-3 w-full">
      {floorsToShow.map(floor => {
        const path = pathByFloor[floor] || []
        let label
        if (floor === startFloor) label = '出发楼层'
        else if (floor === endFloor) label = '目的楼层'
        else label = `${floor}楼（途经）`

        // 该楼层相关的楼梯事件（出口“上/下X楼” + 入口“出楼梯”）
        const stairEvents: { label: string; x: number; y: number }[] = []
        const exitEvt = events.find(e => e.fromFloor === floor)
        if (exitEvt) {
          stairEvents.push({
            label: exitEvt.toFloor > exitEvt.fromFloor ? `上${exitEvt.toFloor}楼` : `下${exitEvt.toFloor}楼`,
            x: exitEvt.x,
            y: exitEvt.y,
          })
        }
        const entryEvt = events.find(e => e.toFloor === floor && e.fromFloor !== floor)
        if (entryEvt) {
          stairEvents.push({ label: '出楼梯', x: entryEvt.x, y: entryEvt.y })
        }

        const showStart = floor === startFloor ? startName : null
        const showDest = floor === endFloor ? destName : null

        return (
          <NavigatingFloorPlan
            key={floor}
            floor={floor}
            path={path.length >= 2 ? path : undefined}
            label={label}
            isMobile={isMobile}
            startName={showStart}
            destName={showDest}
            stairEvents={stairEvents}
          />
        )
      })}
    </div>
  )
}

function NavigatingFloorPlan({
  floor,
  path,
  label,
  isMobile = false,
  startName,
  destName,
  stairEvents,
}: {
  floor: number
  path?: NavigationNode[]
  label: string
  isMobile?: boolean
  startName?: string | null
  destName?: string | null
  stairEvents?: { label: string; x: number; y: number }[]
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      className="relative"
      style={{
        borderRadius: 16,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04), 0 16px 48px rgba(0,0,0,0.06)',
        border: '1px solid rgba(0,0,0,0.08)',
        backgroundColor: '#f5f5f7',
        overflow: 'visible',
      }}
    >
      <ZoomableFloorPlan
        src={floorPlanSrc(floor)}
        alt={`${floor}楼 - ${label}`}
        onLoaded={() => setLoaded(true)}
      >
        {(scale) => (
          loaded && path && path.length >= 2 ? (
            <div className="absolute inset-0 pointer-events-none">
              <NavigationOverlay path={path} isMobile={isMobile} mapScale={scale} hideStaircaseLabels staircaseEventsOverride={[]} />
              <NavigationEndpoints
                path={path}
                startName={startName}
                destName={destName}
                stairEvents={stairEvents}
                mapScale={scale}
              />
            </div>
          ) : null
        )}
      </ZoomableFloorPlan>
      <div
        className="flex items-center justify-center gap-2 py-2"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#B394BF',
          }}
        />
        <span className="text-sm font-semibold" style={{ color: '#5F526E' }}>
          {floor}楼 - {label}
        </span>
      </div>
    </div>
  )
}

function NavigationEndpoints({ path, startName, destName, stairEvents = [], mapScale = 1 }: { path: NavigationNode[]; startName?: string | null; destName?: string | null; stairEvents?: { label: string; x: number; y: number }[]; mapScale?: number }) {
  if (path.length < 2) return null
  const first = path[0]
  const last = path[path.length - 1]
  const cs = mapScale > 1 ? 1 / mapScale : 1

  const showStart = startName !== null
  const showDest = destName !== null

  const startAtStair = stairEvents.some(s => Math.abs(first.x - s.x) < 1 && Math.abs(first.y - s.y) < 1)
  const destAtStair = stairEvents.some(s => Math.abs(last.x - s.x) < 1 && Math.abs(last.y - s.y) < 1)

  const glassStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: 10,
    padding: '4px 10px',
    whiteSpace: 'nowrap',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.01em',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    pointerEvents: 'none',
  }

  return (
    <>
      {showStart && !startAtStair && (
        <div
          className="absolute pointer-events-none"
          style={{ left: `${first.x}%`, top: `${first.y}%`, transform: `translate(-50%, -130%) scale(${cs})`, transformOrigin: 'center bottom', zIndex: 12, ...glassStyle, color: '#16A34A' }}
        >
          <div className="flex items-center gap-1.5">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', border: '1.5px solid rgba(255,255,255,0.9)' }} />
            {startName || '出发'}
          </div>
        </div>
      )}
      {showDest && !destAtStair && (
        <div
          className="absolute pointer-events-none"
          style={{ left: `${last.x}%`, top: `${last.y}%`, transform: `translate(-50%, -130%) scale(${cs})`, transformOrigin: 'center bottom', zIndex: 12, ...glassStyle, color: '#B394BF' }}
        >
          <div className="flex items-center gap-1.5">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#B394BF', border: '1.5px solid rgba(255,255,255,0.9)' }} />
            {destName || '目的地'}
          </div>
        </div>
      )}
      {stairEvents.map((s, i) => (
        <div
          key={`stair-${i}`}
          className="absolute pointer-events-none"
          style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%, 30%) scale(${cs})`, transformOrigin: 'center top', zIndex: 13, ...glassStyle, color: '#E65100', background: 'rgba(255,237,213,0.9)', border: '1px solid rgba(251,146,60,0.3)' }}
        >
          {s.label}
        </div>
      ))}
    </>
  )
}
