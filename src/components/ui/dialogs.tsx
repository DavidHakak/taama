'use client'

import React from 'react'
import { AlertCircle, CheckCircle, Info, HelpCircle, X } from 'lucide-react'

interface AlertModalProps {
  isOpen: boolean
  title: string
  message: string
  type?: 'info' | 'success' | 'error'
  onClose: () => void
}

export function AlertModal({ isOpen, title, message, type = 'info', onClose }: AlertModalProps) {
  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-emerald-500" />
      case 'error':
        return <AlertCircle className="h-6 w-6 text-rose-500" />
      default:
        return <Info className="h-6 w-6 text-amber-500" />
    }
  }

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-emerald-500/20'
      case 'error':
        return 'border-rose-500/20'
      default:
        return 'border-amber-500/20'
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs transition-all duration-200" dir="rtl">
      <div className={`w-full max-w-md bg-zinc-950 border ${getBorderColor()} rounded-2xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200`}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute left-4 top-4 p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8 text-right flex gap-4 items-start">
          <div className="p-2 bg-zinc-900/60 border border-zinc-800 rounded-xl shrink-0">
            {getIcon()}
          </div>
          <div className="space-y-2 flex-1">
            <h3 className="text-base font-bold text-white leading-tight">{title}</h3>
            <p className="text-zinc-400 text-xs font-medium leading-relaxed whitespace-pre-wrap">{message}</p>
          </div>
        </div>

        {/* Action button */}
        <div className="bg-zinc-950/40 border-t border-zinc-900 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-[0.98]"
          >
            אישור
          </button>
        </div>
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({ isOpen, title, message, onConfirm, onClose }: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs transition-all duration-200" dir="rtl">
      <div className="w-full max-w-md bg-zinc-950 border border-amber-500/10 rounded-2xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute left-4 top-4 p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-all"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8 text-right flex gap-4 items-start">
          <div className="p-2 bg-zinc-900/60 border border-zinc-800 rounded-xl shrink-0">
            <HelpCircle className="h-6 w-6 text-amber-500" />
          </div>
          <div className="space-y-2 flex-1">
            <h3 className="text-base font-bold text-white leading-tight">{title}</h3>
            <p className="text-zinc-400 text-xs font-medium leading-relaxed whitespace-pre-wrap">{message}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="bg-zinc-950/40 border-t border-zinc-900 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl text-xs transition-all"
          >
            ביטול
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-[0.98]"
          >
            אישור
          </button>
        </div>
      </div>
    </div>
  )
}
