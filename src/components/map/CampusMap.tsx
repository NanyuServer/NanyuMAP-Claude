'use client'
// src/components/map/CampusMap.tsx

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMapStore } from '@/store/mapStore'
import SearchBar from './SearchBar'
import LocationPin from './LocationPin'
import NavigationOverlay from './NavigationOverlay'
import StartModal from './StartModal'
import DestinationCard from './DestinationCard'
import type { Location } from '@/types'

const MAP_WIDTH = 2400
const MAP_HEIGHT = 1600
const MIN_SCALE = 0.3
const MAX_SCALE = 3

export default function CampusMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })

  const {
    locations,
    setLocations,
    navigation,
    mapScale,
    mapOffset,
    setMapTransform,
    showStartModal,
  } = useMapStore()

  // Load locations
  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then((data: Location[]) => setLocations(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [setLocations])

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerSize({
          w: containerRef.current.clientWidth,
          h: containerRef.current.clientHeight,
        })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Center map initially
  useEffect(() => {
    if (containerSize.w && containerSize.h) {
      const scale = Math.max(containerSize.w / MAP_WIDTH, containerSize.h / MAP_HEIGHT) * 0.95
      const clampedScale = Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE)
      setMapTransform(clampedScale, {
        x: (containerSize.w - MAP_WIDTH * clampedScale) / 2,
        y: (containerSize.h - MAP_HEIGHT * clampedScale) / 2,
      })
    }
  }, [containerSize, setMapTransform])

  // When navigation starts, animate to fit path
  useEffect(() => {
    if (navigation.isNavigating && navigation.path.length > 0 && containerSize.w) {
      const xs = navigation.path.map(n => n.x)
      const ys = navigation.path.map(n => n.y)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const pathW = maxX - minX || 200
      const pathH = maxY - minY || 200

      const padding = 120
      const scaleX = (containerSize.w - padding * 2) / pathW
      const scaleY = (containerSize.h - padding * 2) / pathH
      const newScale = Math.min(scaleX, scaleY, MAX_SCALE)
      const clampedScale = Math.max(newScale, MIN_SCALE)

      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      setMapTransform(clampedScale, {
        x: containerSize.w / 2 - cx * clampedScale,
        y: containerSize.h / 2 - cy * clampedScale,
      })
    }
  }, [navigation.isNavigating, navigation.path, containerSize, setMapTransform])

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, ox: mapOffset.x, oy: mapOffset.y }
  }, [mapOffset])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setMapTransform(mapScale, {
      x: dragStart.current.ox + e.clientX - dragStart.current.x,
      y: dragStart.current.oy + e.clientY - dragStart.current.y,
    })
  }, [isDragging, mapScale, setMapTransform])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  // Touch pan
  const touchStart = useRef({ x: 0, y: 0, ox: 0, oy: 0, dist: 0, scale: 1 })
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        ox: mapOffset.x,
        oy: mapOffset.y,
        dist: 0,
        scale: mapScale,
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      touchStart.current.dist = Math.sqrt(dx * dx + dy * dy)
      touchStart.current.scale = mapScale
    }
  }, [mapOffset, mapScale])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      setMapTransform(mapScale, {
        x: touchStart.current.ox + e.touches[0].clientX - touchStart.current.x,
        y: touchStart.current.oy + e.touches[0].clientY - touchStart.current.y,
      })
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const newScale = Math.min(Math.max(touchStart.current.scale * (dist / touchStart.current.dist), MIN_SCALE), MAX_SCALE)
      setMapTransform(newScale, mapOffset)
    }
  }, [mapScale, mapOffset, setMapTransform])

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.min(Math.max(mapScale * factor, MIN_SCALE), MAX_SCALE)
    const rect = containerRef.current!.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    setMapTransform(newScale, {
      x: mouseX - (mouseX - mapOffset.x) * (newScale / mapScale),
      y: mouseY - (mouseY - mapOffset.y) * (newScale / mapScale),
    })
  }, [mapScale, mapOffset, setMapTransform])

  return (
    <div
      ref={containerRef}
      className="map-container select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onWheel={handleWheel}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Map image + overlays */}
      <div
        style={{
          position: 'absolute',
          left: mapOffset.x,
          top: mapOffset.y,
          width: MAP_WIDTH * mapScale,
          height: MAP_HEIGHT * mapScale,
          transition: isDragging ? 'none' : 'left 0.4s cubic-bezier(0.25,0.46,0.45,0.94), top 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}
      >
        {/* Map background */}
        <img
          src="/assets/map.png"
          alt="校园地图"
          style={{ width: MAP_WIDTH, height: MAP_HEIGHT, transform: `scale(${mapScale})`, transformOrigin: '0 0', display: 'block', userSelect: 'none' }}
          draggable={false}
        />

        {/* Navigation path SVG */}
        {navigation.isNavigating && navigation.path.length > 1 && (
          <NavigationPath path={navigation.path} scale={mapScale} />
        )}

        {/* Location pins */}
        {locations.map(loc => (
          <LocationPin key={loc.id} location={loc} scale={mapScale} />
        ))}
      </div>

      {/* UI Overlays - fixed position */}
      <div data-no-drag>
        {/* Search bar */}
        <SearchBar />

        {/* Start point selection modal */}
        <AnimatePresence>
          {showStartModal && <StartModal />}
        </AnimatePresence>

        {/* Destination card during navigation */}
        <AnimatePresence>
          {navigation.isNavigating && navigation.destination && (
            <DestinationCard />
          )}
        </AnimatePresence>

        {/* Navigation controls */}
        <AnimatePresence>
          {navigation.isNavigating && <NavigationOverlay />}
        </AnimatePresence>

        {/* Compass / zoom */}
        <MapControls />
      </div>
    </div>
  )
}

function NavigationPath({ path, scale }: { path: { x: number; y: number }[]; scale: number }) {
  const points = path.map(n => `${n.x * scale},${n.y * scale}`).join(' ')
  const totalLen = path.reduce((acc, p, i) => {
    if (i === 0) return 0
    const prev = path[i - 1]
    return acc + Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2) * scale
  }, 0)

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Glow under-layer */}
      <polyline
        points={points}
        fill="none"
        stroke="rgba(0,122,255,0.3)"
        strokeWidth={12 * scale}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow)"
      />
      {/* Main path */}
      <polyline
        points={points}
        fill="none"
        stroke="#007AFF"
        strokeWidth={4 * scale}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${totalLen}`}
        strokeDashoffset={`${totalLen}`}
        style={{
          animation: `path-draw 1.2s cubic-bezier(0.4,0,0.2,1) forwards`,
        }}
      />
      {/* Animated dots along path */}
      {path.map((n, i) => (
        i % 3 === 0 && (
          <circle
            key={i}
            cx={n.x * scale}
            cy={n.y * scale}
            r={3 * scale}
            fill="#007AFF"
            opacity={0.6}
            style={{ animationDelay: `${i * 0.05}s` }}
          />
        )
      ))}
      {/* Start dot */}
      <circle cx={path[0].x * scale} cy={path[0].y * scale} r={8 * scale} fill="#30D158" />
      <circle cx={path[0].x * scale} cy={path[0].y * scale} r={4 * scale} fill="white" />
      {/* End dot */}
      <circle cx={path[path.length - 1].x * scale} cy={path[path.length - 1].y * scale} r={10 * scale} fill="#007AFF" style={{ animation: 'dot-pulse 2s ease-in-out infinite' }} />
      <circle cx={path[path.length - 1].x * scale} cy={path[path.length - 1].y * scale} r={5 * scale} fill="white" />
    </svg>
  )
}

function MapControls() {
  const { mapScale, mapOffset, setMapTransform, clearNavigation, navigation } = useMapStore()

  const zoom = (factor: number) => {
    const newScale = Math.min(Math.max(mapScale * factor, MIN_SCALE), MAX_SCALE)
    setMapTransform(newScale, mapOffset)
  }

  return (
    <div className="fixed bottom-8 right-6 flex flex-col gap-2" data-no-drag>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => zoom(1.2)}
        className="w-10 h-10 glass rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        style={{ fontSize: 20, fontWeight: 300 }}
      >
        +
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => zoom(0.85)}
        className="w-10 h-10 glass rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        style={{ fontSize: 20, fontWeight: 300 }}
      >
        −
      </motion.button>
      {navigation.isNavigating && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.95 }}
          onClick={clearNavigation}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-colors mt-2"
          style={{ background: 'rgba(255,69,58,0.8)', backdropFilter: 'blur(12px)' }}
          title="结束导航"
        >
          ✕
        </motion.button>
      )}
    </div>
  )
}
