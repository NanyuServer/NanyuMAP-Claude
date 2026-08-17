'use client'
// src/components/map/ZoomableFloorPlan.tsx
// 可缩放/平移的楼层平面图容器：双指捏合缩放、单指拖动、缩放按钮
import { useState, useRef, useCallback } from 'react'
import { Plus, Minus } from 'lucide-react'

type Props = {
  src: string
  alt: string
  /** render prop：传入当前缩放比例，便于子内容（如地点标签）做反向缩放保持屏幕大小 */
  children?: (scale: number) => React.ReactNode
  onLoaded?: () => void
}

const MIN_SCALE = 1
// 图片最大放大倍数（不宜过大）
const MAX_SCALE = 2

export default function ZoomableFloorPlan({ src, alt, children, onLoaded }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  // 用 Pointer Events 统一处理鼠标与触摸：单指/鼠标拖动平移、双指捏合缩放
  const pointerCache = useRef(new Map<number, { x: number; y: number }>())
  const panStartRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const pinchDistRef = useRef<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

  // 限制 offset：放大后图片始终覆盖显示区域，不能拖出边界露出空白
  const clampOffset = useCallback((s: number, o: { x: number; y: number }) => {
    const el = wrapRef.current
    if (!el) return o
    const cw = el.clientWidth
    const ch = el.clientHeight
    const scaledW = cw * s
    const scaledH = ch * s
    return {
      x: scaledW <= cw ? (cw - scaledW) / 2 : clamp(o.x, cw - scaledW, 0),
      y: scaledH <= ch ? (ch - scaledH) / 2 : clamp(o.y, ch - scaledH, 0),
    }
  }, [])

  const commit = useCallback((s: number, o: { x: number; y: number }) => {
    const clamped = clampOffset(s, o)
    scaleRef.current = s
    offsetRef.current = clamped
    setScale(s)
    setOffset(clamped)
  }, [clampOffset])

  // 围绕容器中心缩放
  const zoomAt = useCallback((factor: number) => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    const cur = scaleRef.current
    const next = clamp(cur * factor, MIN_SCALE, MAX_SCALE)
    const ratio = next / cur
    const o = offsetRef.current
    commit(next, { x: cx - (cx - o.x) * ratio, y: cy - (cy - o.y) * ratio })
  }, [commit])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointerCache.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const count = pointerCache.current.size
    if (count === 1) {
      pinchDistRef.current = null
      panStartRef.current = { sx: e.clientX, sy: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
    } else if (count === 2) {
      panStartRef.current = null
      const [a, b] = [...pointerCache.current.values()]
      pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y)
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerCache.current.has(e.pointerId)) return
    pointerCache.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const count = pointerCache.current.size
    if (count === 1 && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.sx
      const dy = e.clientY - panStartRef.current.sy
      commit(scaleRef.current, { x: panStartRef.current.ox + dx, y: panStartRef.current.oy + dy })
    } else if (count === 2 && pinchDistRef.current) {
      const [a, b] = [...pointerCache.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d > 0 && pinchDistRef.current > 0) zoomAt(d / pinchDistRef.current)
      pinchDistRef.current = d
    }
  }

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerCache.current.delete(e.pointerId)
    const count = pointerCache.current.size
    if (count < 2) pinchDistRef.current = null
    if (count === 0) {
      panStartRef.current = null
    } else if (count === 1) {
      const [a] = [...pointerCache.current.values()]
      panStartRef.current = { sx: a.x, sy: a.y, ox: offsetRef.current.x, oy: offsetRef.current.y }
    }
  }

  return (
    <div
      ref={wrapRef}
      className="relative"
      style={{ touchAction: 'none', cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none', overflow: 'visible' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <div
        style={{
          width: '100%',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        <img
          src={src}
          alt={alt}
          className="block"
          style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none', touchAction: 'none', WebkitTouchCallout: 'none', borderRadius: 16 }}
          draggable={false}
          onLoad={() => { setLoaded(true); onLoaded?.() }}
        />
        {loaded && typeof children === 'function' && children(scale)}
      </div>

      {/* 缩放按钮（右上角） */}
      <div className="absolute right-2.5 top-2.5 z-20 flex flex-col gap-1.5" style={{ pointerEvents: 'auto' }}>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => zoomAt(1.35)}
          aria-label="放大"
          className="w-8 h-8 flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: 12, border: '1px solid rgba(95,82,110,0.1)', boxShadow: '0 2px 8px rgba(95,82,110,0.1), inset 0 1px 0 rgba(255,255,255,0.8)', color: '#5F526E' }}
        >
          <Plus size={15} strokeWidth={2.5} />
        </button>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => zoomAt(1 / 1.35)}
          disabled={scale <= MIN_SCALE + 0.01}
          aria-label="缩小"
          className="w-8 h-8 flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
          style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: 12, border: '1px solid rgba(95,82,110,0.1)', boxShadow: '0 2px 8px rgba(95,82,110,0.1), inset 0 1px 0 rgba(255,255,255,0.8)', color: '#5F526E' }}
        >
          <Minus size={15} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
