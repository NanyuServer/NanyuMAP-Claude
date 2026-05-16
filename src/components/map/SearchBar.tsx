'use client'
// src/components/map/SearchBar.tsx
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, MapPin, ChevronRight } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'
import type { SearchResult } from '@/types'

export default function SearchBar() {
  const { searchQuery, setSearchQuery, searchResults, setSearchResults, clearSearch, setSelectedLocation, setShowStartModal } = useMapStore()
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } catch {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchQuery, setSearchResults])

  const handleSelect = (loc: SearchResult) => {
    setSelectedLocation(loc)
    setShowStartModal(true)
    setIsFocused(false)
    inputRef.current?.blur()
  }

  const showDropdown = isFocused && searchQuery.trim().length > 0

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4" data-no-drag>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Search input */}
        <div
          className="relative flex items-center"
          style={{
            background: isFocused ? 'rgba(20,20,24,0.92)' : 'rgba(15,15,18,0.85)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: isFocused ? '1px solid rgba(0,122,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: showDropdown ? '16px 16px 0 0' : '16px',
            boxShadow: isFocused
              ? '0 0 0 3px rgba(0,122,255,0.15), 0 8px 32px rgba(0,0,0,0.5)'
              : '0 4px 24px rgba(0,0,0,0.4)',
            transition: 'all 0.25s ease',
          }}
        >
          <Search size={16} className="absolute left-4 text-white/40" />
          <input
            ref={inputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            placeholder="搜索地点、教室、功能区..."
            className="w-full bg-transparent text-white/90 placeholder-white/30 text-sm py-3.5 pl-10 pr-10 font-medium"
            style={{ outline: 'none', letterSpacing: '0.01em' }}
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => { clearSearch(); setIsFocused(false) }}
                className="absolute right-3 w-6 h-6 flex items-center justify-center rounded-full"
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >
                <X size={12} className="text-white/60" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Dropdown results */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              style={{
                background: 'rgba(16,16,20,0.96)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(0,122,255,0.3)',
                borderTop: 'none',
                borderRadius: '0 0 16px 16px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
                maxHeight: '320px',
                overflowY: 'auto',
              }}
            >
              {searchResults.length === 0 ? (
                <div className="py-6 text-center text-white/30 text-sm">
                  未找到相关地点
                </div>
              ) : (
                searchResults.map((loc, i) => (
                  <motion.button
                    key={loc.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => handleSelect(loc)}
                    className="w-full flex items-start gap-3 px-4 py-3.5 text-left group transition-colors"
                    style={{ borderBottom: i < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(0,122,255,0.15)' }}>
                      <MapPin size={13} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white/90 text-sm font-medium truncate">{loc.detailInfo}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-blue-400/70 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,122,255,0.1)' }}>{loc.category}</span>
                        {loc.extraInfo && (
                          <span className="text-white/35 text-xs truncate">{loc.extraInfo}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-white/20 group-hover:text-blue-400 flex-shrink-0 mt-1 transition-colors" />
                  </motion.button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
