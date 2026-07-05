'use client'

import React, { useState, createContext, useContext } from 'react'
import { Loader2 } from 'lucide-react'
import { useCustomDialogs } from '@/hooks/useCustomDialogs'

interface AdminPageContextType {
  setGlobalLoading: (loading: boolean) => void
  showAlert: (message: string, title?: string, type?: 'info' | 'success' | 'error') => void
  showConfirm: (message: string, onConfirm: () => void, title?: string) => void
}

const AdminPageContext = createContext<AdminPageContextType | undefined>(undefined)

export function useAdminPage() {
  const context = useContext(AdminPageContext)
  if (!context) {
    return {
      setGlobalLoading: () => {},
      showAlert: (message: string) => alert(message),
      showConfirm: (message: string, onConfirm: () => void) => {
        if (confirm(message)) onConfirm()
      },
    }
  }
  return context
}

interface AdminPageClientProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
}

export default function AdminPageClient({ title, subtitle, icon, children }: AdminPageClientProps) {
  const [loading, setLoading] = useState(false)
  const { showAlert, showConfirm, CustomDialogs } = useCustomDialogs()

  return (
    <AdminPageContext.Provider value={{ setGlobalLoading: setLoading, showAlert, showConfirm }}>
      <div className="space-y-6 text-right animate-in fade-in duration-300" dir="rtl">
        <div className="border-b border-zinc-900 pb-5">
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5 justify-start">
            {icon}
            {title}
          </h1>
          {subtitle && <p className="text-zinc-400 text-xs mt-1.5">{subtitle}</p>}
        </div>

        {children}

        <CustomDialogs />

        {loading && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-zinc-950/85 border border-zinc-900 rounded-2xl p-6 flex flex-col items-center shadow-2xl">
              <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
              <p className="text-zinc-200 text-sm font-bold">מעבד בקשה, אנא המתן...</p>
            </div>
          </div>
        )}
      </div>
    </AdminPageContext.Provider>
  )
}
