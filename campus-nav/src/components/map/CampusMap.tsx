'use client'
// src/components/map/CampusMap.tsx

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, GraduationCap, Plus, Minus, Building2, Route, Info } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'
import { translations } from '@/lib/i18n'
import SearchBar from './SearchBar'
import LocationPin from './LocationPin'
import Navbar from './Navbar'
import Footer from './Footer'
import dynamic from 'next/dynamic'
import type { Location } from '@prisma/client'
import type { NavigationNode } from '@/types/navigation'
import type { NavigationStart, SearchResult } from '@/types'
import { normalizeNavSettings } from '@/lib/navSettings'

// 非首屏组件按需加载，减小首屏 JS 体积，加快首屏渲染
const NavigationOverlay = dynamic(() => import('./NavigationOverlay'), { ssr: false })
const StartModal = dynamic(() => import('./StartModal'), { ssr: false })
const DestinationCard = dynamic(() => import('./DestinationCard'), { ssr: false })
const PresetRoutes = dynamic(() => import('./PresetRoutes'), { ssr: false })
const FeedbackModal = dynamic(() => import('./FeedbackModal'), { ssr: false })

interface Props {
  initialLocations: Location[]
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

const MAP_ASPECT: Record<string, number> = {
  junior: 1560 / 1008,
  senior: 1536 / 1024,
}

// 高中部视图仅在校区切换时才需要，按需加载以减小首屏 JS 体积
const SeniorCampusView = dynamic(
  () => import('./SeniorCampusView').then(m => m.default),
  { ssr: false, loading: () => null },
)

export default function CampusMap({ initialLocations }: Props): JSX.Element {
  const isMobile = useIsMobile()
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const campus = useMapStore(state => state.campus)

  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  // refs mirror scale/offset so touch handlers always read the latest value
  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const commitTransform = useCallback((s: number, o: { x: number; y: number }) => {
    scaleRef.current = s
    offsetRef.current = o
    setScale(s)
    setOffset(o)
  }, [])
  const isPanningRef = useRef(false)
  const panStartRef = useRef<{ x: number; y: number } | null>(null)
  const panOffsetStartRef = useRef({ x: 0, y: 0 })
  const lastTouchDistRef = useRef<number | null>(null)
  const [minScale, setMinScale] = useState(1)
  const maxScale = 4

  const [tappedPinId, setTappedPinId] = useState<number | null>(null)
  const [pickLoading, setPickLoading] = useState(false)
  const [showAbout, setShowAbout] = useState(false)

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

  const computeMinScale = useCallback(() => {
    // Mobile: fill the screen — map height equals the container height
    const el = mapContainerRef.current
    if (!el) return 1
    const containerW = el.clientWidth
    const containerH = el.clientHeight
    const aspect = MAP_ASPECT[campus] ?? 1.55
    const mapHAtScale1 = containerW / aspect
    if (mapHAtScale1 <= 0) return 1
    return Math.max(1, containerH / mapHAtScale1)
  }, [campus])

  useLayoutEffect(() => {
    if (!isMobile) return
    const fit = () => {
      const ms = computeMinScale()
      const el = mapContainerRef.current
      setMinScale(ms)
      if (el) {
        const aspect = MAP_ASPECT[campus] ?? 1.55
        const mapW = el.clientWidth * ms
        const mapH = (el.clientWidth / aspect) * ms
        commitTransform(ms, { x: (el.clientWidth - mapW) / 2, y: (el.clientHeight - mapH) / 2 })
      } else {
        commitTransform(ms, { x: 0, y: 0 })
      }
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [isMobile, computeMinScale, campus])

  const clampOffset = useCallback((ox: number, oy: number, s: number) => {
    const el = mapContainerRef.current
    if (!el) return { x: ox, y: oy }
    const containerW = el.clientWidth
    const containerH = el.clientHeight
    const aspect = MAP_ASPECT[campus] ?? 1.55
    const mapW = containerW * s
    const mapH = (containerW / aspect) * s
    // 移动端地图上下各留出白色可移动区域（相当于图片上下加白边），
    // 使被顶部搜索栏/底部导航栏遮挡的地图部分可以移入可视区。
    const extraY = isMobile ? Math.round(containerH * 0.09) : 0
    return {
      x: mapW <= containerW ? (containerW - mapW) / 2 : clamp(ox, containerW - mapW, 0),
      y: mapH <= containerH ? (containerH - mapH) / 2 : clamp(oy, containerH - mapH - extraY, extraY),
    }
  }, [campus, isMobile])

  type TouchPoint = { clientX: number; clientY: number }

  const getTouchDist = (a: TouchPoint, b: TouchPoint) => {
    const dx = a.clientX - b.clientX
    const dy = a.clientY - b.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return
    if (e.touches.length === 1) {
      isPanningRef.current = true
      panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      panOffsetStartRef.current = { ...offset }
    } else if (e.touches.length === 2) {
      lastTouchDistRef.current = getTouchDist(e.touches[0], e.touches[1])
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return
    if (e.touches.length === 1 && isPanningRef.current && panStartRef.current) {
      const dx = e.touches[0].clientX - panStartRef.current.x
      const dy = e.touches[0].clientY - panStartRef.current.y
      const no = clampOffset(panOffsetStartRef.current.x + dx, panOffsetStartRef.current.y + dy, scaleRef.current)
      offsetRef.current = no
      setOffset(no)
    } else if (e.touches.length === 2 && lastTouchDistRef.current != null && mapContainerRef.current) {
      const dist = getTouchDist(e.touches[0], e.touches[1])
      const rect = mapContainerRef.current.getBoundingClientRect()
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
      const ratio = dist / lastTouchDistRef.current
      const curScale = scaleRef.current
      const curOffset = offsetRef.current
      const newScale = clamp(curScale * ratio, minScale, maxScale)
      const newOffsetX = curOffset.x - cx * (newScale / curScale - 1)
      const newOffsetY = curOffset.y - cy * (newScale / curScale - 1)
      commitTransform(newScale, clampOffset(newOffsetX, newOffsetY, newScale))
      lastTouchDistRef.current = dist
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length < 2) lastTouchDistRef.current = null
    if (!e.touches || e.touches.length === 0) {
      isPanningRef.current = false
      panStartRef.current = null
    }
  }

  // Zoom around the container center so the view stays stable (no drift)
  const applyZoom = useCallback((factor: number) => {
    const el = mapContainerRef.current
    if (!el) return
    const curScale = scaleRef.current
    const curOffset = offsetRef.current
    const next = clamp(curScale * factor, minScale, maxScale)
    const ratio = next / curScale
    const cw = el.clientWidth / 2
    const ch = el.clientHeight / 2
    const nx = cw - (cw - curOffset.x) * ratio
    const ny = ch - (ch - curOffset.y) * ratio
    commitTransform(next, clampOffset(nx, ny, next))
  }, [minScale, maxScale, clampOffset, commitTransform])

  const handleZoomIn = useCallback(() => applyZoom(1.15), [applyZoom])
  const handleZoomOut = useCallback(() => applyZoom(1 / 1.15), [applyZoom])

  const [isLoading, setIsLoading] = useState(false)
  const [locations, setLocations] = useState<Location[]>(initialLocations)

  const {
    navigation,
    showStartModal,
    selectingStart,
    setSelectingStart,
    startNavigation,
    setCampus,
    clearNavigation,
    pickDestination,
    setPickDestination,
    routeMode,
    showPresetRoutes,
    setShowPresetRoutes,
    setPresetImageCrops,
    setNavSettings,
  } = useMapStore()
  const t = translations['zh']

  const storeSetLocations = useMapStore(state => state.setLocations)
  useEffect(() => { storeSetLocations(locations) }, [locations, storeSetLocations])

  useEffect(() => {
    fetch('/api/system/settings')
      .then(r => r.json())
      .then(data => {
        try { setPresetImageCrops(JSON.parse(data.presetImageCrops || '{}')) } catch {}
        try { setNavSettings(normalizeNavSettings(data.navSettings)) } catch {}
      })
      .catch(() => {})
  }, [setPresetImageCrops, setNavSettings])

  // 首屏初中部数据已由服务端注入（initialLocations），无需重复请求，
  // 仅在切换校区或首次无数据时才拉取，减少一次网络往返加快首屏渲染。
  const loadedCampusRef = useRef<string | null>(campus === 'junior' && initialLocations.length > 0 ? 'junior' : null)
  useEffect(() => {
    if (loadedCampusRef.current === campus) return
    let cancelled = false
    setIsLoading(true)
    fetch(`/api/locations?campus=${campus}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled && Array.isArray(data)) {
          setLocations(data)
          loadedCampusRef.current = campus
        }
      })
      .catch(() => { if (!cancelled) setLocations([]) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [campus, initialLocations.length])

  const mapSrc = (campus === 'senior' ? '/assets/map2-0.webp' : '/assets/map.webp') + '?v=4'

  useLayoutEffect(() => {
    const presetImages = ['/assets/Default/Freshman.webp', '/assets/Default/Access.webp', '/assets/Default/Visit.webp']
    const titleImg = '/assets/title.webp'
    const allImages = [mapSrc, titleImg, ...presetImages]
    const loaded: HTMLImageElement[] = []
    for (const src of allImages) {
      const img = new window.Image()
      img.src = src
      loaded.push(img)
    }
    return () => { loaded.length = 0 }
  }, [mapSrc])

  const SENIOR_START_POINTS = ['大门', '一楼', '二楼', '三楼', '四楼', '五楼']

  const primaryLocations = locations.filter(
    loc => loc.detailInfo === loc.category && (!loc.extraInfo || loc.extraInfo.trim() === '') && !(campus === 'senior' && SENIOR_START_POINTS.includes(loc.category))
  )

  // Auto-zoom when navigation starts to fit route area (both mobile and desktop)
  useEffect(() => {
    if (!navigation.isNavigating || navigation.path.length < 2) return
    const path = navigation.path
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of path) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    const padding = 10
    minX = Math.max(0, minX - padding)
    maxX = Math.min(100, maxX + padding)
    minY = Math.max(0, minY - padding)
    maxY = Math.min(100, maxY + padding)
    const rangeX = maxX - minX
    const rangeY = maxY - minY
    if (rangeX < 1 || rangeY < 1) return

    // 用 requestAnimationFrame 确保容器已完成布局后再计算
    let raf = 0
    let retries = 0
    const apply = () => {
      const el = mapContainerRef.current
      if (!el) return
      const containerW = el.clientWidth
      const containerH = el.clientHeight
      if ((containerW === 0 || containerH === 0) && retries < 5) {
        retries++
        raf = requestAnimationFrame(apply)
        return
      }
      if (containerW === 0 || containerH === 0) return
      const mapAspect = MAP_ASPECT[campus] ?? 1.55
      const mapHpx = containerW / mapAspect
      const scaleX = 100 / rangeX
      const scaleY = (containerH / mapHpx) * (100 / rangeY)
      const fitScale = Math.min(scaleX, scaleY, maxScale)
      const ms = computeMinScale()
      const newScale = Math.max(fitScale, ms)
      const centerPxX = (minX + maxX) / 2 / 100 * containerW
      const centerPxY = (minY + maxY) / 2 / 100 * mapHpx
      const newOffsetX = containerW / 2 - centerPxX * newScale
      const newOffsetY = containerH / 2 - centerPxY * newScale
      commitTransform(newScale, clampOffset(newOffsetX, newOffsetY, newScale))
    }
    raf = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(raf)
  }, [navigation.isNavigating, navigation.path, campus, computeMinScale, clampOffset, maxScale])

  const handlePickStart = useCallback(async (percentX: number, percentY: number) => {
    if (!selectingStart || !pickDestination) return
    setSelectingStart(false)
    setPickLoading(true)
    try {
      const res = await fetch('/api/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: { x: percentX, y: percentY }, destinationId: pickDestination.id, campus, routeMode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t.navFailed)
      startNavigation({ type: 'coords', x: percentX, y: percentY }, pickDestination, data.path, data.totalDistance, data.staircaseEvents || [], [], data.startFloor ?? null, data.endFloor ?? null)
    } catch { /* retry */ }
    finally {
      setPickLoading(false)
      setPickDestination(null)
    }
  }, [selectingStart, pickDestination, campus, routeMode, setSelectingStart, startNavigation, setPickDestination, t])

  const handleDesktopPick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectingStart) return
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * 100
    const py = ((e.clientY - rect.top) / rect.height) * 100
    handlePickStart(px, py)
  }, [selectingStart, handlePickStart])

  const handleMobileMapClick = useCallback((e: React.MouseEvent) => {
    setTappedPinId(null)
    if (!selectingStart || !mapContainerRef.current) return
    let clientX: number, clientY: number
    if ('changedTouches' in e && (e as any).changedTouches.length > 0) {
      clientX = (e as any).changedTouches[0].clientX
      clientY = (e as any).changedTouches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    const rect = mapContainerRef.current.getBoundingClientRect()
    const localX = (clientX - rect.left - offset.x) / scale
    const localY = (clientY - rect.top - offset.y) / scale
    const mapW = rect.width
    const aspect = MAP_ASPECT[campus] ?? 1.55
    const mapH = mapW / aspect
    const px = (localX / mapW) * 100
    const py = (localY / mapH) * 100
    if (px >= 0 && px <= 100 && py >= 0 && py <= 100) {
      handlePickStart(px, py)
    }
  }, [selectingStart, handlePickStart, offset, scale, campus])

  const handleCampusSwitch = useCallback((target: string) => {
    clearNavigation()
    setCampus(target)
  }, [clearNavigation, setCampus])

  const aspect = MAP_ASPECT[campus] ?? 1.55

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden overscroll-none" style={{ background: '#F3EEF9' }}>
      {/* Desktop Navbar */}
      {!isMobile && <Navbar />}

      {/* Mobile floating search overlay (hidden on About) */}
      {isMobile && !showAbout && <MobileTopBar />}

      {/* Full-screen content layer; overlays (search / nav) float above it */}
      <div
        className={`overflow-hidden flex flex-col items-center ${isMobile ? 'absolute inset-0' : 'relative flex-1 md:justify-center md:p-6'}`}
        style={{ background: isMobile ? '#F3EEF9' : 'linear-gradient(180deg, #F3EEF9 0%, #E9E1F5 100%)' }}
      >
        {isMobile && showAbout ? (
          <AboutScreen />
        ) : campus === 'senior' && !isLoading ? (
          /* Senior campus: dedicated view, no junior map structure */
          <div className="w-full h-full flex flex-col relative">
            <div className="flex-1 w-full overflow-y-auto px-4 py-4 md:px-6" style={{ scrollbarWidth: 'thin', paddingTop: isMobile ? 72 : 24 }}>
              <div className="w-full max-w-7xl mx-auto">
                <SeniorCampusView
                  isMobile={isMobile}
                  isNavigating={navigation.isNavigating}
                  startFloor={navigation.startFloor}
                  endFloor={navigation.endFloor}
                />
              </div>
            </div>
            {navigation.isNavigating && navigation.destination && (
              <div className={isMobile ? "absolute left-3 right-3 z-40" : "absolute bottom-4 right-4 md:bottom-6 md:right-6 z-40 w-80"} style={isMobile ? { bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' } : undefined}>
                <DestinationCard destination={navigation.destination} inline={isMobile} />
              </div>
            )}
          </div>
        ) : (
          /* Junior campus: normal map */
          <>
            <div
              ref={mapContainerRef}
              className="relative overflow-hidden w-full flex-1"
            >
              {/* Desktop */}
              {!isMobile ? (
                <div className="w-full h-full overflow-y-auto" style={{ scrollbarWidth: 'thin', cursor: selectingStart ? 'crosshair' : undefined }}>
                  <div className="flex flex-col w-full" style={{ minHeight: '100%' }}>
                    <div className="relative w-full flex-shrink-0" onClick={handleDesktopPick} style={{ aspectRatio: `${aspect}`, margin: 'auto', cursor: selectingStart ? 'crosshair' : undefined }}>
                    <div className="absolute inset-0 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04), 0 16px 48px rgba(0,0,0,0.06)', backgroundColor: '#f5f5f7' }}>
                      <img src={mapSrc} alt="Campus Map" className="w-full h-full" style={{ objectFit: 'fill' }} draggable={false} onContextMenu={e => e.preventDefault()} />
                      <div className="absolute inset-0">
                        <AnimatePresence>
                          {!isLoading && !navigation.isNavigating && primaryLocations.map(loc => (
                            <LocationPin key={loc.id} location={loc} />
                          ))}
                        </AnimatePresence>
                        {navigation.isNavigating && navigation.path.length > 0 && <NavigationOverlay path={navigation.path} isMobile={false} mapScale={1} />}
                        {navigation.isNavigating && navigation.path.length > 0 && (
                          <NavigationEndpointLabels
                            path={navigation.path}
                            start={navigation.start}
                            destination={navigation.destination}
                            locations={locations}
                            mapScale={1}
                          />
                        )}
                      </div>
                    </div>
                      {navigation.isNavigating && navigation.destination && <DestinationCard destination={navigation.destination} />}
                    </div>
                  </div>
                </div>
              ) : (
                /* Mobile: full-screen map touch area */
                <div
                  className="absolute inset-0"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onClick={handleMobileMapClick}
                  style={{ touchAction: 'none', overflow: 'hidden', cursor: selectingStart ? 'crosshair' : undefined }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: 0,
                      paddingBottom: `${100 / aspect}%`,
                      transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                      transformOrigin: '0 0',
                      // 白色背景：上下多移动时露出白色区域，避免地图被顶部/底部遮挡
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <img
                      src={mapSrc}
                      alt="Campus Map"
                      className="absolute inset-0 w-full h-full"
                      style={{ objectFit: 'fill', display: 'block' }}
                      draggable={false}
                      onContextMenu={e => e.preventDefault()}
                    />
                    <div className="absolute inset-0">
                      <AnimatePresence>
                        {!isLoading && !navigation.isNavigating && primaryLocations.map(loc => (
                          <LocationPin
                            key={loc.id}
                            location={loc}
                            showLabel
                            isTapped={tappedPinId === loc.id}
                            onTapToggle={() => setTappedPinId(prev => prev === loc.id ? null : loc.id)}
                            mapScale={scale}
                          />
                        ))}
                      </AnimatePresence>
                      {navigation.isNavigating && navigation.path.length > 0 && <NavigationOverlay path={navigation.path} isMobile={true} mapScale={scale} />}
                      {navigation.isNavigating && navigation.path.length > 0 && (
                        <NavigationEndpointLabels
                          path={navigation.path}
                          start={navigation.start}
                          destination={navigation.destination}
                          locations={locations}
                          mapScale={scale}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile zoom buttons - only for junior campus */}
              {isMobile && !isLoading && campus === 'junior' && !navigation.isNavigating && !showAbout && (
                <div className="absolute z-40 flex flex-col gap-2" style={{ right: 16, bottom: 'calc(140px + env(safe-area-inset-bottom, 0px))' }}>
                  <button onClick={handleZoomIn} disabled={scale >= maxScale} style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: 20, border: '1px solid rgba(95,82,110,0.08)', boxShadow: '0 2px 8px rgba(95,82,110,0.08), inset 0 1px 0 rgba(255,255,255,0.7)', width: 40, height: 40 }} className="flex items-center justify-center text-[#5F526E] disabled:opacity-30 active:scale-90 transition-transform">
                    <Plus size={17} strokeWidth={2.5} />
                  </button>
                  <button onClick={handleZoomOut} disabled={scale <= minScale + 0.01} style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: 20, border: '1px solid rgba(95,82,110,0.08)', boxShadow: '0 2px 8px rgba(95,82,110,0.08), inset 0 1px 0 rgba(255,255,255,0.7)', width: 40, height: 40 }} className="flex items-center justify-center text-[#5F526E] disabled:opacity-30 active:scale-90 transition-transform">
                    <Minus size={17} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>

            {/* Mobile: floating destination card during navigation */}
            {isMobile && navigation.isNavigating && navigation.destination && (
              <div className="absolute left-3 right-3 z-40" style={{ bottom: 'calc(104px + env(safe-area-inset-bottom, 0px))' }}>
                <DestinationCard destination={navigation.destination} inline />
              </div>
            )}

            {/* Pick-on-map hint */}
            <AnimatePresence>
              {selectingStart && (
                <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="absolute left-1/2 -translate-x-1/2 z-40 pointer-events-none" style={{ top: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
                  <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', borderRadius: 16, padding: '10px 18px', boxShadow: '0 4px 20px rgba(59,51,86,0.12), inset 0 1px 0 rgba(255,255,255,0.6)' }} className="flex items-center gap-2">
                    <MapPin size={14} className="text-ink/70" />
                    <span className="text-ink text-sm font-medium">点击地图选择出发位置</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pick-on-map loading indicator */}
            <AnimatePresence>
              {pickLoading && (
                <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="absolute right-4 z-40 pointer-events-none" style={{ top: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
                  <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', borderRadius: 14, padding: '8px 14px', boxShadow: '0 4px 16px rgba(59,51,86,0.1), inset 0 1px 0 rgba(255,255,255,0.6)' }} className="flex items-center gap-2">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }} style={{ width: 14, height: 14, border: '2px solid rgba(95,82,110,0.15)', borderTopColor: '#5F526E', borderRadius: '50%' }} />
                    <span className="text-ink/70 text-xs font-medium">正在加载</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Campus switch overlay */}
            <AnimatePresence>
              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: 'rgba(246,243,251,0.6)', backdropFilter: 'blur(20px)' }}>
                  <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col items-center gap-3">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} style={{ width: 28, height: 28, border: '2.5px solid rgba(95,82,110,0.12)', borderTopColor: '#5F526E', borderRadius: '50%' }} />
                    <span className="text-sm font-medium text-ink/70 tracking-wide">{campus === 'senior' ? t.senior : t.junior}</span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Desktop SearchBar */}
      {!isMobile && <SearchBar />}

      {/* Footer (desktop only; mobile shows info in About) */}
      {!isMobile && <Footer />}

      {/* Mobile bottom nav: 初中部 / 高中部 / 关于本项目 */}
      {isMobile && (
        <MobileBottomNav
          campus={campus}
          showAbout={showAbout}
          onSelect={(target) => {
            if (target === 'about') {
              setShowAbout(true)
              clearNavigation()
            } else {
              setShowAbout(false)
              if (campus !== target) handleCampusSwitch(target)
            }
          }}
        />
      )}

      <AnimatePresence>
        {showStartModal && <StartModal />}
      </AnimatePresence>

      <AnimatePresence>
        {showPresetRoutes && <PresetRoutes />}
      </AnimatePresence>
    </div>
  )
}

// ── Navigation Endpoint Labels ──────────────────────────────────────────────
function NavigationEndpointLabels({
  path,
  start,
  destination,
  locations,
  mapScale = 1,
}: {
  path: NavigationNode[]
  start: NavigationStart
  destination: SearchResult | null
  locations: Location[]
  mapScale?: number
}) {
  const staircaseEvents = useMapStore(s => s.navigation.staircaseEvents)
  const first = path[0]
  const last = path[path.length - 1]
  const cs = mapScale > 1 ? 1 / mapScale : 1

  const startLabel = (() => {
    if (!start) return '出发地'
    if (start.type === 'category') return start.value
    if (start.type === 'current') return '当前位置'
    if (start.type === 'coords') {
      let best = `(${start.x.toFixed(0)}, ${start.y.toFixed(0)})`
      let bestDist = Infinity
      for (const loc of locations) {
        const d = Math.hypot(loc.x - start.x, loc.y - start.y)
        if (d < bestDist) { bestDist = d; best = loc.category }
      }
      return best
    }
    return '出发地'
  })()

  const endLabel = destination?.detailInfo || destination?.category || '目的地'

  const glassStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: 10,
    padding: '5px 11px',
    whiteSpace: 'nowrap',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.01em',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    pointerEvents: 'none',
    zIndex: 12,
  }

  // 计算路线在端点处的法线方向，用于偏移标签避免遮挡路线
  const getNormal = (idx: number): { nx: number; ny: number } => {
    const prev = path[Math.max(0, idx - 1)]
    const next = path[Math.min(path.length - 1, idx + 1)]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    return { nx: -dy / len, ny: dx / len }
  }

  // 检测标签是否与路线重叠（距离路线太近）
  const overlapsRoute = (px: number, py: number): boolean => {
    const THRESHOLD = 3
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1]
      const abx = b.x - a.x, aby = b.y - a.y
      const apx = px - a.x, apy = py - a.y
      const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby)))
      const cx = a.x + t * abx, cy = a.y + t * aby
      if (Math.hypot(px - cx, py - cy) < THRESHOLD) return true
    }
    return false
  }

  // 检测标签是否与楼梯事件标签重叠
  const overlapsStair = (px: number, py: number): boolean => {
    return staircaseEvents.some(evt => Math.hypot(evt.x - px, evt.y - py) < 6)
  }

  // 端点标签：Pin + 虚线 + 标签，根据路线/楼梯重叠动态调整偏移方向
  const renderEndpoint = (x: number, y: number, label: string, dotColor: string, pathIdx: number) => {
    const normal = getNormal(pathIdx)
    // 检测原始位置是否与路线重叠
    const routeOverlap = overlapsRoute(x, y)
    const stairOverlap = overlapsStair(x, y)
    const needOffset = routeOverlap || stairOverlap

    // 偏移距离：重叠时加大偏移
    const offsetPx = needOffset ? 48 : 36
    // 偏移方向：沿法线方向，根据索引交替上下
    const side = pathIdx % 2 === 0 ? 1 : -1
    const dx = normal.nx * side * offsetPx
    const dy = normal.ny * side * offsetPx

    return (
      <div
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          transform: `translate(-50%, -50%) scale(${cs})`,
          zIndex: 12,
          pointerEvents: 'none',
        }}
      >
        {/* Pin 圆点 */}
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: dotColor, border: '3px solid rgba(255,255,255,0.95)', boxShadow: `0 2px 12px ${dotColor}80, 0 0 0 4px ${dotColor}20`, position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
        {/* 虚线连接线 */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: offsetPx, height: 0, borderTop: '1px dashed rgba(59,130,246,0.4)', transformOrigin: 'left center', transform: `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)` }} />
        {/* 标签 */}
        <div style={{ ...glassStyle, color: '#2563EB', position: 'absolute', left: `calc(50% + ${dx}px)`, top: `calc(50% + ${dy}px)`, transform: 'translate(-50%, -50%)' }}>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, border: '1.5px solid rgba(255,255,255,0.9)', flexShrink: 0 }} />
            {label}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {renderEndpoint(first.x, first.y, startLabel, '#3B82F6', 0)}
      {renderEndpoint(last.x, last.y, endLabel, '#3B82F6', path.length - 1)}
    </>
  )
}

// ── Mobile Top Bar (frosted glass: search + preset routes) ──────────────────
function MobileTopBar() {
  const setShowPresetRoutes = useMapStore(state => state.setShowPresetRoutes)
  return (
    <div
      className="absolute top-0 left-0 right-0 z-50 pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2.5 pointer-events-auto">
        <div className="flex-1 min-w-0">
          <SearchBar inline />
        </div>
        <button
          onClick={() => setShowPresetRoutes(true)}
          className="flex items-center gap-1 px-3 py-2 rounded-2xl text-[13px] font-medium transition-all cursor-pointer flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(50px) saturate(200%)',
            WebkitBackdropFilter: 'blur(50px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.45)',
            color: '#5F526E',
            boxShadow: '0 4px 20px rgba(95,82,110,0.08), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35)',
          }}
          onMouseDown={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)' }}
          onMouseUp={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.72)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.72)' }}
        >
          <Route size={14} className="text-[#B394BF]" />
          <span>预设路线</span>
        </button>
      </div>
    </div>
  )
}

// ── Mobile Bottom Nav (floating frosted glass: 初中部 / 高中部 / 关于本项目) ───
function MobileBottomNav({
  campus,
  showAbout,
  onSelect,
}: {
  campus: string
  showAbout: boolean
  onSelect: (target: 'junior' | 'senior' | 'about') => void
}) {
  const tabs = [
    { key: 'junior', label: '初中部', icon: Building2 },
    { key: 'senior', label: '高中部', icon: GraduationCap },
    { key: 'about', label: '关于本项目', icon: Info },
  ] as const
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [bottomInset, setBottomInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const layoutBottom = window.innerHeight
      const visualBottom = (vv.offsetTop || 0) + vv.height
      const diff = layoutBottom - visualBottom
      if (diff > 120) {
        setKeyboardOpen(true)
        setBottomInset(0)
      } else {
        setKeyboardOpen(false)
        setBottomInset(Math.max(0, diff))
      }
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  // When the on-screen keyboard is open, hide the nav so it never floats above it.
  if (keyboardOpen) return null

  return (
    <nav
      className="fixed z-50"
      style={{
        left: 12,
        right: 12,
        bottom: `calc(${bottomInset}px + 12px + env(safe-area-inset-bottom, 0px))`,
        background: 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(50px) saturate(200%)',
        WebkitBackdropFilter: 'blur(50px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.45)',
        borderRadius: 26,
        padding: '6px',
        boxShadow: '0 8px 32px rgba(95,82,110,0.1), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35)',
      }}
    >
      <div className="flex">
        {tabs.map(tab => {
          const active = tab.key === 'about' ? showAbout : (!showAbout && campus === tab.key)
          return (
            <button
              key={tab.key}
              onClick={() => onSelect(tab.key as 'junior' | 'senior' | 'about')}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-all cursor-pointer"
              style={{
                color: active ? '#5F526E' : '#9B96A6',
                background: active ? 'rgba(179,148,191,0.18)' : 'transparent',
                borderRadius: 20,
                margin: '0 2px',
              }}
            >
              <tab.icon size={19} strokeWidth={active ? 2.2 : 1.7} />
              <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// ── About screen ─────────────────────────────────────────────────────────────
const ABOUT_ROW_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.62)',
  backdropFilter: 'blur(50px) saturate(200%)',
  WebkitBackdropFilter: 'blur(50px) saturate(200%)',
  border: '1px solid rgba(255,255,255,0.45)',
  boxShadow: '0 8px 32px rgba(95,82,110,0.08), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35)',
}

function AboutScreen() {
  const [versions, setVersions] = useState<{ systemVersion: string; databaseVersion: string } | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)

  useEffect(() => {
    fetch('/api/system/settings')
      .then(r => r.json())
      .then(d => setVersions(d))
      .catch(() => setVersions({ systemVersion: '—', databaseVersion: '—' }))
  }, [])

  const rows: Array<{ label: string; value: string }> = [
    { label: '系统版本', value: versions ? versions.systemVersion : '加载中…' },
    { label: '数据库', value: versions ? versions.databaseVersion : '加载中…' },
    { label: '软件著作权所有人', value: '熊柯宇' },
    { label: '授权对象', value: '重庆市南渝中学校' },
  ]

  return (
    <div className="w-full h-full overflow-hidden">
      <div className="h-full flex flex-col items-center justify-start px-8 pt-14 pb-6">
        <div className="flex flex-col items-center text-center max-w-sm w-full">
          <img src="/assets/title.webp" alt="南渝中学校园导览系统" className="h-16 w-auto object-contain mb-5" draggable={false} />
          <div className="font-seal text-[13px] tracking-[0.32em] mb-6" style={{ color: '#B394BF' }}>允公允能 · 日新月异</div>

          <p className="text-ink/60 text-[13px] leading-relaxed mb-6">
            南渝中学校园导览系统，为到访的师生和家长提供校园地图、地点检索与路径导航服务。支持初中部与高中部地图，可按需选择最快或主干道路优先的导航策略。
          </p>

          <div className="w-full space-y-2 mb-6">
            {rows.map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3 rounded-2xl" style={ABOUT_ROW_STYLE}>
                <span className="text-ink/60 text-xs">{row.label}</span>
                <span className="text-ink text-xs font-medium">{row.value}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowFeedback(true)}
            className="w-full py-3 rounded-2xl text-ink text-sm font-semibold mb-7 flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(50px) saturate(200%)', WebkitBackdropFilter: 'blur(50px) saturate(200%)', border: '1px solid rgba(255,255,255,0.45)', boxShadow: '0 8px 24px rgba(143,111,168,0.2), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35)' }}
          >
            意见反馈
          </button>

          <p className="text-neutral-400 text-[11px] leading-relaxed">
            Copyright © 2026 xkeyu. All Rights Reserved. 熊柯宇 版权所有
          </p>
        </div>
      </div>
      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />
    </div>
  )
}
