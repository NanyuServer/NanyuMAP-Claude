// src/store/mapStore.ts
import { create } from 'zustand'
import type { Location, SearchResult, RoadNode } from '@/types'

interface NavigationState {
  isNavigating: boolean
  start: string | null          // category name e.g. '北门'
  destination: SearchResult | null
  path: RoadNode[]
  totalDistance: number
}

interface MapStore {
  // Locations displayed on map
  locations: Location[]
  setLocations: (locations: Location[]) => void

  // Search
  searchQuery: string
  searchResults: SearchResult[]
  setSearchQuery: (q: string) => void
  setSearchResults: (results: SearchResult[]) => void
  clearSearch: () => void

  // Selected location
  selectedLocation: SearchResult | null
  setSelectedLocation: (loc: SearchResult | null) => void

  // Navigation
  navigation: NavigationState
  startNavigation: (start: string, destination: SearchResult, path: RoadNode[], distance: number) => void
  clearNavigation: () => void

  // Map transform
  mapScale: number
  mapOffset: { x: number; y: number }
  setMapTransform: (scale: number, offset: { x: number; y: number }) => void

  // UI
  showStartModal: boolean
  setShowStartModal: (show: boolean) => void
}

export const useMapStore = create<MapStore>((set) => ({
  locations: [],
  setLocations: (locations) => set({ locations }),

  searchQuery: '',
  searchResults: [],
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchResults: (searchResults) => set({ searchResults }),
  clearSearch: () => set({ searchQuery: '', searchResults: [], selectedLocation: null }),

  selectedLocation: null,
  setSelectedLocation: (selectedLocation) => set({ selectedLocation }),

  navigation: {
    isNavigating: false,
    start: null,
    destination: null,
    path: [],
    totalDistance: 0,
  },
  startNavigation: (start, destination, path, totalDistance) =>
    set({
      navigation: { isNavigating: true, start, destination, path, totalDistance },
      showStartModal: false,
      searchResults: [],
      searchQuery: '',
    }),
  clearNavigation: () =>
    set({
      navigation: { isNavigating: false, start: null, destination: null, path: [], totalDistance: 0 },
    }),

  mapScale: 1,
  mapOffset: { x: 0, y: 0 },
  setMapTransform: (mapScale, mapOffset) => set({ mapScale, mapOffset }),

  showStartModal: false,
  setShowStartModal: (showStartModal) => set({ showStartModal }),
}))
