'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#000] text-[#D7B25D] font-bold text-xs rounded-xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
    >
      <Printer className="h-4 w-4" />
      הדפס / שמור כ-PDF
    </button>
  )
}
