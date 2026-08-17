"use client"
import { useRef, useEffect, useCallback, useMemo } from 'react'
import type { NavigationNode } from '@/types/navigation'
import { useMapStore } from '@/store/mapStore'
import { translations } from '@/lib/i18n'

type NavigationOverlayProps = {
  path: NavigationNode[]
  isMobile?: boolean
  mapScale?: number
  hideStaircaseLabels?: boolean
  staircaseEventsOverride?: { nodeId: number; x: number; y: number; fromFloor: number; toFloor: number }[]
}

function labelOffset(
  path: NavigationNode[],
  evtX: number,
  evtY: number,
  index: number,
): { normalX: number; normalY: number } {
  let dx = 0
  let dy = 0
  if (path.length > 1) {
    const idx = index >= 0 && index < path.length ? index : path.length - 1
    const prevIdx = Math.max(0, idx - 1)
    const nextIdx = Math.min(path.length - 1, idx + 1)
    dx = path[nextIdx].x - path[prevIdx].x
    dy = path[nextIdx].y - path[prevIdx].y
  }
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const side = index % 2 === 0 ? 1 : -1
  return { normalX: nx * side, normalY: ny * side }
}

export default function NavigationOverlay({ path, isMobile = false, mapScale = 1, hideStaircaseLabels = false, staircaseEventsOverride }: NavigationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number>(0)
  const storeStaircaseEvents = useMapStore(s => s.navigation.staircaseEvents)
  const staircaseEvents = staircaseEventsOverride ?? storeStaircaseEvents
  const visitWaypoints = useMapStore(s => s.navigation.visitWaypoints)
  const locations = useMapStore(s => s.locations)
  const campus = useMapStore(s => s.campus)
  const t = translations['zh']
  const isSenior = campus === 'senior'
  const cs = isMobile && mapScale > 1 ? 1 / mapScale : 1

  // 路线绘制动画进度（0 → 1），用于从起点到终点的描边动画
  const progressRef = useRef(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !path || path.length < 2) return

    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth
    const h = container.clientHeight
    if (w === 0 || h === 0) return
    canvas.width = w * dpr || 1
    canvas.height = h * dpr || 1
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const allPts = path.map(p => ({ x: (p.x / 100) * w, y: (p.y / 100) * h }))
    const isNarrow = w < 500

    const lw = isNarrow ? 2.5 : 8
    const lwI = isNarrow ? 1.5 : 5

    ctx.clearRect(0, 0, w, h)

    // 按动画进度截取路径（含插值），路线从起点向终点逐步绘制
    const progress = progressRef.current
    const total = allPts.length
    const drawLen = Math.max(0, (total - 1) * progress)
    const fullSegs = Math.min(total - 1, Math.floor(drawLen))
    const frac = drawLen - fullSegs
    const pts = allPts.slice(0, fullSegs + 1)
    if (fullSegs + 1 < total && frac > 0) {
      const a = allPts[fullSegs]
      const b = allPts[fullSegs + 1]
      pts.push({ x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac })
    }
    if (pts.length < 2) return

    // ── Draw smooth road path with bezier corners ──
    const drawPath = (color: string, lineWidth: number) => {
      const n = pts.length; if (n < 2) return
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
      if (n === 2) {
        ctx.lineTo(pts[1].x, pts[1].y)
      } else {
        const f = 0.05
        ctx.lineTo(pts[0].x + (pts[1].x - pts[0].x) * f, pts[0].y + (pts[1].y - pts[0].y) * f)
        for (let i = 1; i < n - 1; i++) {
          const ex = pts[i].x + (pts[i + 1].x - pts[i].x) * f
          const ey = pts[i].y + (pts[i + 1].y - pts[i].y) * f
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, ex, ey)
        }
        ctx.lineTo(pts[n - 1].x, pts[n - 1].y)
      }
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke()
    }

    drawPath('rgba(255, 255, 255, 0.55)', lw)
    drawPath('#3B82F6', lwI)
  }, [path])

  // 路线绘制动画：路径变化时从起点到终点逐步描绘
  useEffect(() => {
    progressRef.current = 0
    const duration = 1000
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      progressRef.current = t
      draw()
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [path, draw])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    })
    observer.observe(container)
    return () => { observer.disconnect(); cancelAnimationFrame(rafRef.current) }
  }, [draw])

  const labelPositions = useMemo(() => {
    const out: { normalX: number; normalY: number }[] = []
    const used: { x: number; y: number }[] = []
    staircaseEvents.forEach((evt, i) => {
      const pathIdx = path.findIndex(n => n.id === evt.nodeId)
      let off = labelOffset(path, evt.x, evt.y, pathIdx >= 0 ? pathIdx : i)
      // If a previous label sits too close, flip to the other side so labels never overlap
      for (let j = 0; j < used.length; j++) {
        if (Math.hypot(evt.x - used[j].x, evt.y - used[j].y) < 4) {
          off = { normalX: -off.normalX, normalY: -off.normalY }
          break
        }
      }
      used.push({ x: evt.x, y: evt.y })
      out.push(off)
    })
    return out
  }, [staircaseEvents, path])

  // Waypoint labels placed along the path normal so they never cover the route line
  const waypointOffsets = useMemo(() => {
    return visitWaypoints.map((wp) => {
      const wx = wp.x ?? locations.find(l => l.id === wp.id)?.x
      const wy = wp.y ?? locations.find(l => l.id === wp.id)?.y
      if (wx == null || wy == null) return null
      let bestIdx = 0
      let bestD = Infinity
      path.forEach((p, idx) => {
        const d = Math.hypot(p.x - wx, p.y - wy)
        if (d < bestD) { bestD = d; bestIdx = idx }
      })
      return labelOffset(path, wx, wy, bestIdx)
    })
  }, [visitWaypoints, locations, path])

  if (!path || path.length < 2) return null

  const sx = path[0].x
  const sy = path[0].y
  const ex = path[path.length - 1].x
  const ey = path[path.length - 1].y

  const getFloorLabel = (evt: { fromFloor: number; toFloor: number }) => {
    if (evt.toFloor > evt.fromFloor) {
      return evt.toFloor === 1 && !isSenior ? t.goUpstairs : isSenior ? t.upToFloorSenior(evt.toFloor) : t.upToFloor(evt.toFloor)
    }
    return t.downToFloor(evt.toFloor)
  }

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>

      {/* 起点/终点均显示蓝色圆点，无脉冲动画 */}
      <div className="absolute pointer-events-none" style={{ left: `${sx}%`, top: `${sy}%`, transform: `translate(-50%, -50%) scale(${cs})`, zIndex: 10 }}>
        <div style={{ width: 13, height: 13, borderRadius: '50%', background: '#3B82F6', border: '2.5px solid white', boxShadow: '0 2px 8px rgba(59,130,246,0.45), 0 0 0 3px rgba(59,130,246,0.15)' }} />
      </div>

      <div className="absolute pointer-events-none" style={{ left: `${ex}%`, top: `${ey}%`, transform: `translate(-50%, -50%) scale(${cs})`, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 15, height: 15, borderRadius: '50%', background: '#3B82F6', border: '2.5px solid white', boxShadow: '0 2px 10px rgba(59,130,246,0.5), 0 0 0 3px rgba(59,130,246,0.12)' }} />
      </div>

      {/* Staircase event markers — hidden when NavigationEndpoints handles them */}
      {!hideStaircaseLabels && staircaseEvents.map((evt, i) => {
        const offset = labelPositions[i]
        // 标签沿路线法线拉开更远，并用虚线连接，避免遮挡路线
        const offsetPx = isMobile ? 40 : 46
        const angle = Math.atan2(offset.normalY, offset.normalX) * 180 / Math.PI
        const label = getFloorLabel(evt)

        return (
          <div
            key={`stair-${i}`}
            className="absolute pointer-events-none"
            style={{ left: `${evt.x}%`, top: `${evt.y}%`, transform: `translate(-50%, -50%) scale(${cs})`, zIndex: 8 }}
          >
            {/* 楼梯点 */}
            <div style={{ width: isMobile ? 9 : 11, height: isMobile ? 9 : 11, borderRadius: '50%', background: '#EAB308', border: '2px solid rgba(255,255,255,0.95)', boxShadow: '0 1px 4px rgba(234,179,8,0.4)', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
            {/* 虚线连接线：点 → 标签 */}
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: offsetPx, height: 0, borderTop: '1px dashed rgba(234,179,8,0.55)', transformOrigin: 'left center', transform: `rotate(${angle}deg)` }} />
            {/* 标签 */}
            <div
              style={{
                position: 'absolute',
                left: `calc(50% + ${offset.normalX * offsetPx}px)`,
                top: `calc(50% + ${offset.normalY * offsetPx}px)`,
                transform: 'translate(-50%, -50%)',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(234,179,8,0.3)',
                color: '#92400E',
                fontSize: isMobile ? 9 : 10,
                fontWeight: 700,
                padding: isMobile ? '2px 6px' : '3px 8px',
                borderRadius: isMobile ? 6 : 8,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(234,179,8,0.12)',
                pointerEvents: 'none',
              }}
            >
              {label}
            </div>
          </div>
        )
      })}

      {/* Visit route checkpoint markers */}
      {visitWaypoints.map((wp, i) => {
        const loc = locations.find(l => l.id === wp.id)
        const wx = wp.x ?? loc?.x
        const wy = wp.y ?? loc?.y
        if (wx == null || wy == null) return null
        const off = waypointOffsets[i]
        const labelDX = off ? off.normalX * 30 : 0
        const labelDY = off ? off.normalY * 30 : -18
        const dLen = Math.hypot(labelDX, labelDY) || 1
        const angle = Math.atan2(labelDY, labelDX) * 180 / Math.PI
        return (
          <div key={`wp-${wp.id}-${i}`} className="absolute pointer-events-none" style={{ left: `${wx}%`, top: `${wy}%`, transform: `translate(-50%, -50%) scale(${cs})`, zIndex: 15 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3B82F6', border: '2px solid rgba(255,255,255,0.95)', boxShadow: '0 1px 4px rgba(59,130,246,0.5)' }} />
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: dLen, height: 0, borderTop: '1px dashed rgba(59,130,246,0.5)', transformOrigin: 'left center', transform: `rotate(${angle}deg)` }} />
            <div style={{ position: 'absolute', left: `calc(50% + ${labelDX}px)`, top: `calc(50% + ${labelDY}px)`, transform: 'translate(-50%, -50%)', fontSize: 9, color: '#3B82F6', fontWeight: 700, whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.9)', borderRadius: 5, padding: '2px 6px', boxShadow: '0 1px 6px rgba(59,130,246,0.15)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
              {i + 1}. {wp.detailInfo}
            </div>
          </div>
        )
      })}
    </>
  )
}
