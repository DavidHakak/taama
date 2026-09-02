'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface AnchoredDropdownProps {
  /** The element the panel is positioned against (usually the trigger button). */
  anchorRef: React.RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  /** Stretch the panel to the anchor width (default). */
  matchAnchorWidth?: boolean
  /** Fixed width in px when matchAnchorWidth is false. */
  width?: number
  /** Preferred height cap; the panel shrinks further when the viewport is tight. */
  maxHeight?: number
  /** Which edge to line up with the anchor when the width does not match. */
  align?: 'start' | 'end'
}

interface Position {
  top: number
  left: number
  width: number
  maxHeight: number
  flipped: boolean
}

const GAP = 6
const VIEWPORT_MARGIN = 8
const MIN_HEIGHT = 140

/**
 * Renders a dropdown panel in a portal on document.body, anchored to a trigger
 * with fixed positioning. Living outside the DOM subtree keeps the list visible
 * inside modals and cards that clip with `overflow-hidden` / `overflow-y-auto`,
 * and the measured maxHeight guarantees the list itself stays scrollable.
 */
export function AnchoredDropdown({
  anchorRef,
  open,
  onClose,
  children,
  className = '',
  matchAnchorWidth = true,
  width,
  maxHeight = 288,
  align = 'end',
}: AnchoredDropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>(null)

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()

    const panelWidth = matchAnchorWidth ? rect.width : width ?? rect.width
    const spaceBelow = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN
    const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN
    const flipped = spaceBelow < Math.min(maxHeight, MIN_HEIGHT) && spaceAbove > spaceBelow
    const available = Math.max(MIN_HEIGHT, Math.min(maxHeight, flipped ? spaceAbove : spaceBelow))

    let left = matchAnchorWidth || align === 'start' ? rect.left : rect.right - panelWidth
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - panelWidth - VIEWPORT_MARGIN))

    setPosition({
      top: flipped ? Math.max(VIEWPORT_MARGIN, rect.top - GAP - available) : rect.bottom + GAP,
      left,
      width: panelWidth,
      maxHeight: available,
      flipped,
    })
  }, [anchorRef, matchAnchorWidth, width, maxHeight, align])

  useLayoutEffect(() => {
    if (!open) return
    // Measured before paint, so the panel never flashes at a stale position.
    updatePosition()

    // Capture-phase scroll catches scrolling inside modal bodies and cards too.
    const onScroll = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose, anchorRef])

  if (!open || !position || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      dir="rtl"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
        zIndex: 200,
      }}
      className={`flex flex-col overflow-hidden bg-zinc-950 border border-zinc-900 rounded-xl shadow-2xl animate-in fade-in duration-150 ${
        position.flipped ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'
      } ${className}`}
    >
      {children}
    </div>,
    document.body
  )
}
