// src/lib/navSettings.ts
import { DEFAULT_NAV_SETTINGS, type NavGlobalSettings } from '@/types'

export function normalizeNavSettings(raw: unknown): NavGlobalSettings {
  const out: NavGlobalSettings = JSON.parse(JSON.stringify(DEFAULT_NAV_SETTINGS))
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    for (const c of ['junior', 'senior'] as const) {
      const rc = r[c]
      if (!rc || typeof rc !== 'object') continue
      const rcObj = rc as Record<string, unknown>
      if (rcObj.startPoints && typeof rcObj.startPoints === 'object') {
        const sp = rcObj.startPoints as Record<string, unknown>
        for (const k of Object.keys(out[c].startPoints)) {
          if (typeof sp[k] === 'boolean') out[c].startPoints[k] = sp[k] as boolean
        }
      }
      if (typeof rcObj.useCurrentLocation === 'boolean') {
        out[c].useCurrentLocation = rcObj.useCurrentLocation as boolean
      }
      if (typeof rcObj.allowClickStart === 'boolean') {
        out[c].allowClickStart = rcObj.allowClickStart as boolean
      }
      if (rcObj.geo && typeof rcObj.geo === 'object') {
        const g = rcObj.geo as Record<string, unknown>
        const originLat = Number(g.originLat)
        const originLng = Number(g.originLng)
        const metersPerWidth = Number(g.metersPerWidth)
        out[c].geo = (originLat || originLng) && metersPerWidth > 0
          ? { originLat, originLng, metersPerWidth }
          : null
      }
    }
  }
  return out
}
