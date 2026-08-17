'use client'
// src/components/map/SearchBar.tsx
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, MapPin, Loader2 } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'
import type { SearchResult } from '@/types'

type SearchBarProps = {
  inline?: boolean
}

export default function SearchBar({ inline = false }: SearchBarProps): JSX.Element {
  const { searchQuery, setSearchQuery, searchResults, setSearchResults, clearSearch, setSelectedLocation, setShowStartModal, campus } = useMapStore()
  const [isFocused, setIsFocused] = useState(false)
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cacheRef = useRef<Map<string, SearchResult[]>>(new Map())

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!searchQuery.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const cacheKey = `${campus}:${searchQuery}`
        if (cacheRef.current.has(cacheKey)) {
          setSearchResults(cacheRef.current.get(cacheKey) || [])
          setSearching(false)
          return
        }
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&campus=${campus}`)
        const data = await res.json()
        const results = Array.isArray(data) ? data : []
        cacheRef.current.set(cacheKey, results)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery, campus, setSearchResults])

  useEffect(() => {
    cacheRef.current.clear()
  }, [campus])

  const handleSelect = (loc: SearchResult) => {
    setSelectedLocation(loc)
    setShowStartModal(true)
    setIsFocused(false)
    inputRef.current?.blur()
  }

  const showDropdown = isFocused && searchQuery.trim().length > 0

  const containerClass = inline
    ? 'relative w-full'
    : 'fixed left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-8 top-[68px]'

  const containerStyle = inline ? { zIndex: 70, position: 'relative' as const } : undefined

  return (
    <div className={containerClass} data-no-drag style={containerStyle}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div
          className="relative flex items-center"
          style={{
            background: isFocused ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.72)',
            backdropFilter: 'blur(50px) saturate(200%)',
            WebkitBackdropFilter: 'blur(50px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.45)',
            borderRadius: showDropdown ? '20px 20px 0 0' : '20px',
            boxShadow: isFocused
              ? '0 0 0 2px rgba(179,148,191,0.35), 0 8px 32px rgba(95,82,110,0.12), inset 0 1px 0 rgba(255,255,255,0.85)'
              : '0 4px 20px rgba(95,82,110,0.08), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35)',
            transition: 'all 0.2s ease',
          }}
        >
          <Search size={inline ? 15 : 16} className={inline ? "absolute left-3 text-[#B394BF]" : "absolute left-3.5 md:left-4 text-[#B394BF]"} />
          <input
            ref={inputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            placeholder="输入目的地，开启校园导览"
            className={inline
              ? "w-full bg-transparent text-[#5F526E] placeholder-[#B394BF] text-[13px] py-2 pl-9 pr-9 font-medium"
              : "w-full bg-transparent text-[#5F526E] placeholder-[#B394BF] text-sm md:text-base py-2.5 md:py-3 pl-11 md:pl-12 pr-10 font-500"}
            style={{ outline: 'none', letterSpacing: '0.01em' }}
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => { clearSearch(); setIsFocused(false) }}
                className="absolute right-3 w-6 h-6 flex items-center justify-center rounded-full hover:bg-neutral-200 transition-colors"
              >
                <X size={14} className="text-neutral-500" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showDropdown && !inline && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              style={{
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(50px) saturate(200%)',
                WebkitBackdropFilter: 'blur(50px) saturate(200%)',
                border: '1px solid rgba(255,255,255,0.45)',
                borderRadius: '0 0 20px 20px',
                boxShadow: '0 16px 40px rgba(95,82,110,0.12), inset 0 1px 0 rgba(255,255,255,0.85)',
                maxHeight: '360px',
                overflowY: 'auto',
              }}
            >
              {searching ? (
                <div className="py-8 flex items-center justify-center gap-2 text-neutral-400 text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  搜索中…
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-neutral-400 text-sm">
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
                    className="w-full flex items-start gap-3 px-5 py-4 text-left group transition-colors hover:bg-neutral-100"
                    style={{ borderBottom: i < searchResults.length - 1 ? '1px solid rgb(240, 240, 245)' : 'none' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-neutral-100 group-hover:bg-blue-100 transition-colors">
                      <MapPin size={16} className="text-neutral-600 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-neutral-900 text-base font-500 truncate">{loc.detailInfo}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-neutral-500 text-xs px-2 py-1 rounded-md bg-neutral-100">{loc.category}</span>
                        {campus === 'senior' && loc.floor != null && loc.floor > 0 && (
                          <span className="text-purple-600 text-xs px-2 py-1 rounded-md bg-purple-50 font-medium">{loc.floor}楼</span>
                        )}
                        {loc.extraInfo && (
                          <span className="text-neutral-400 text-sm truncate">{loc.extraInfo}</span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showDropdown && inline && !searching && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="overflow-y-auto"
              style={{
                // 绝对定位脱离文档流：展开搜索结果时不挤动“预设路线”按钮
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 80,
                maxHeight: '260px',
                background: 'rgba(255, 255, 255, 0.82)',
                backdropFilter: 'blur(50px) saturate(200%)',
                WebkitBackdropFilter: 'blur(50px) saturate(200%)',
                border: '1px solid rgba(255,255,255,0.45)',
                borderRadius: '0 0 20px 20px',
                boxShadow: '0 12px 32px rgba(95,82,110,0.12), inset 0 1px 0 rgba(255,255,255,0.85)',
              }}
            >
              {searchResults.map((loc, i) => (
                <button
                  key={loc.id}
                  onClick={() => handleSelect(loc)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-neutral-100 transition-colors"
                  style={{ borderBottom: i < searchResults.length - 1 ? '1px solid rgba(95,82,110,0.08)' : 'none' }}
                >
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#F1E3F0]">
                    <MapPin size={14} className="text-[#B394BF]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#5F526E] text-sm font-semibold truncate">{loc.detailInfo}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[#B394BF] text-xs truncate">{loc.category}</span>
                      {campus === 'senior' && loc.floor != null && loc.floor > 0 && (
                        <span className="text-[#B394BF] text-[10px] px-1.5 py-0.5 rounded bg-[#F1E3F0] font-medium">{loc.floor}楼</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showDropdown && inline && (searching || searchResults.length === 0) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-2 text-center text-neutral-400 text-xs"
              style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 80, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', borderRadius: '0 0 20px 20px', boxShadow: '0 12px 32px rgba(95,82,110,0.12)', borderTop: '1px solid rgba(95,82,110,0.08)' }}
            >
              {searching ? '搜索中…' : '未找到相关地点'}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
