// src/store/mapStore.ts
import { create } from 'zustand'
import type { Location } from '@prisma/client'
import type { SearchResult, NavigationStart, NavGlobalSettings } from '@/types'
import { DEFAULT_NAV_SETTINGS } from '@/types'
import type { NavigationNode, StaircaseEvent } from '@/types/navigation'

export interface NavigationState {
  isNavigating: boolean
  start: NavigationStart
  destination: SearchResult | null
  path: NavigationNode[]
  totalDistance: number
  staircaseEvents: StaircaseEvent[]
  visitWaypoints: { id: number; detailInfo: string; category: string; x?: number; y?: number }[]
  startFloor: number | null
  endFloor: number | null
}

export interface MapStore {
  locations: Location[]
  setLocations: (locations: Location[]) => void

  searchQuery: string
  searchResults: SearchResult[]
  setSearchQuery: (q: string) => void
  setSearchResults: (results: SearchResult[]) => void
  clearSearch: () => void

  selectedLocation: SearchResult | null
  setSelectedLocation: (loc: SearchResult | null) => void

  navigation: NavigationState
  startNavigation: (start: NavigationStart, destination: SearchResult, path: NavigationNode[], distance: number, staircaseEvents?: StaircaseEvent[], visitWaypoints?: { id: number; detailInfo: string; category: string }[], startFloor?: number | null, endFloor?: number | null) => void
  clearNavigation: () => void

  selectingStart: boolean
  setSelectingStart: (v: boolean) => void

  pickDestination: SearchResult | null
  setPickDestination: (loc: SearchResult | null) => void

  campus: string
  setCampus: (c: string) => void

  showStartModal: boolean
  setShowStartModal: (show: boolean) => void

  routeMode: 'shortest' | 'trunk'
  setRouteMode: (m: 'shortest' | 'trunk') => void

  showPresetRoutes: boolean
  setShowPresetRoutes: (show: boolean) => void

  presetImageCrops: Record<string, { x?: number; y?: number; scale?: number }>
  setPresetImageCrops: (crops: Record<string, { x?: number; y?: number; scale?: number }>) => void

  navSettings: NavGlobalSettings
  setNavSettings: (s: NavGlobalSettings) => void
}

export const useMapStore = create<MapStore>((set) => ({
  locations: [],
  setLocations: (locations: Location[]) => set({ locations }),

  searchQuery: '',
  searchResults: [],
  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  setSearchResults: (searchResults: SearchResult[]) => set({ searchResults }),
  clearSearch: () => set({ searchQuery: '', searchResults: [], selectedLocation: null }),

  selectedLocation: null,
  setSelectedLocation: (selectedLocation: SearchResult | null) => set({ selectedLocation }),

  navigation: {
    isNavigating: false,
    start: null,
    destination: null,
    path: [],
    totalDistance: 0,
    staircaseEvents: [],
    visitWaypoints: [],
    startFloor: null,
    endFloor: null,
  },
  startNavigation: (start: NavigationStart, destination: SearchResult, path: NavigationNode[], totalDistance: number, staircaseEvents: StaircaseEvent[] = [], visitWaypoints: { id: number; detailInfo: string; category: string }[] = [], startFloor: number | null = null, endFloor: number | null = null) =>
    set({
      navigation: { isNavigating: true, start, destination, path, totalDistance, staircaseEvents, visitWaypoints, startFloor, endFloor },
      showStartModal: false,
      searchResults: [],
      searchQuery: '',
    }),
  clearNavigation: () =>
    set({
      navigation: { isNavigating: false, start: null, destination: null, path: [], totalDistance: 0, staircaseEvents: [], visitWaypoints: [], startFloor: null, endFloor: null },
    }),

  showStartModal: false,
  setShowStartModal: (showStartModal: boolean) => set({ showStartModal }),
  selectingStart: false,
  setSelectingStart: (selectingStart: boolean) => set({ selectingStart }),

  pickDestination: null,
  setPickDestination: (pickDestination: SearchResult | null) => set({ pickDestination }),

  campus: 'junior',
  setCampus: (campus: string) => set({ campus }),

  routeMode: 'trunk',
  setRouteMode: (routeMode: 'shortest' | 'trunk') => set({ routeMode }),

  showPresetRoutes: false,
  setShowPresetRoutes: (showPresetRoutes: boolean) => set({ showPresetRoutes }),

  presetImageCrops: {},
  setPresetImageCrops: (presetImageCrops) => set({ presetImageCrops }),

  navSettings: DEFAULT_NAV_SETTINGS,
  setNavSettings: (navSettings) => set({ navSettings }),
}))
