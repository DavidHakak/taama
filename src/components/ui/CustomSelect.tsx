'use client'

import React, { useState, useRef, useMemo } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { AnchoredDropdown } from '@/components/ui/AnchoredDropdown'

export interface SelectOption {
  value: string
  label: string
  category?: string
  subText?: string
}

interface CustomSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  groupByCategory?: boolean
  isSearchable?: boolean
  disabled?: boolean
  className?: string
  categoriesOrder?: string[]
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'בחר אפשרות...',
  searchPlaceholder = 'חיפוש...',
  groupByCategory = false,
  isSearchable = true,
  disabled = false,
  className = '',
  categoriesOrder,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find((o) => o.value === value)
  }, [options, value])

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options
    const q = search.toLowerCase()
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.category && o.category.toLowerCase().includes(q)) ||
        (o.subText && o.subText.toLowerCase().includes(q))
    )
  }, [options, search])

  // Group options by category if requested
  const groupedOptions = useMemo(() => {
    if (!groupByCategory) return null

    const groups: { [key: string]: SelectOption[] } = {}
    filteredOptions.forEach((o) => {
      const cat = o.category || 'אחר'
      if (!groups[cat]) {
        groups[cat] = []
      }
      groups[cat].push(o)
    })

    // Sort group keys if categoriesOrder is provided
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      if (categoriesOrder) {
        const idxA = categoriesOrder.indexOf(a)
        const idxB = categoriesOrder.indexOf(b)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
      }
      return a.localeCompare(b, 'he')
    })

    return { groups, keys: sortedGroupKeys }
  }, [filteredOptions, groupByCategory, categoriesOrder])

  const closeDropdown = () => {
    setIsOpen(false)
    setSearch('')
  }

  const handleSelect = (val: string) => {
    onChange(val)
    closeDropdown()
  }

  return (
    <div className={`relative text-right ${className}`} dir="rtl">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? closeDropdown() : setIsOpen(true))}
        className={`w-full text-right px-4 py-2.5 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 rounded-xl text-zinc-200 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none flex items-center justify-between cursor-pointer transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <span className={selectedOption ? 'text-zinc-100 font-bold' : 'text-zinc-550 font-medium text-zinc-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-450 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Popover — portalled so modals/cards never clip it */}
      <AnchoredDropdown anchorRef={triggerRef} open={isOpen} onClose={closeDropdown} className="p-2 gap-2">
        {/* Search bar inside popover */}
        {isSearchable && (
          <div className="relative shrink-0">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-8 pl-4 py-1.5 bg-black border border-zinc-900 rounded-lg text-white text-xs placeholder-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-right font-medium"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-900 text-zinc-500 rounded"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Options list */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-0.5 pr-1">
          {filteredOptions.length === 0 ? (
            <p className="text-xxs text-zinc-600 py-4 text-center font-medium">לא נמצאו תוצאות</p>
          ) : groupByCategory && groupedOptions ? (
            // Grouped Options render
            groupedOptions.keys.map((catKey) => {
              const groupItems = groupedOptions.groups[catKey]
              return (
                <div key={catKey} className="space-y-0.5 mt-1 first:mt-0">
                  <span className="block text-[9px] font-black text-amber-500/80 px-2.5 py-0.5 bg-zinc-900/40 rounded border border-zinc-900/30">
                    {catKey}
                  </span>
                  {groupItems.map((opt) => {
                    const isSelected = opt.value === value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={`w-full text-right px-3 py-1.8 text-xxs rounded-lg transition-all cursor-pointer flex justify-between items-center ${
                          isSelected ? 'bg-amber-500/10 text-amber-400 font-extrabold' : 'text-zinc-300 hover:bg-zinc-900/60'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {opt.subText && (
                          <span className="text-[10px] text-zinc-500 shrink-0 font-mono pr-2">{opt.subText}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          ) : (
            // Flat options render
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-right px-3 py-2 text-xs rounded-lg transition-all cursor-pointer flex justify-between items-center ${
                    isSelected ? 'bg-amber-500/10 text-amber-400 font-extrabold' : 'text-zinc-300 hover:bg-zinc-900/60'
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.subText && <span className="text-xxs text-zinc-550 font-mono shrink-0 pr-2">{opt.subText}</span>}
                </button>
              )
            })
          )}
        </div>
      </AnchoredDropdown>
    </div>
  )
}
