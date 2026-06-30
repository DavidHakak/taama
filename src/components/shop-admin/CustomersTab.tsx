'use client'

import React from 'react'
import { Lock, Unlock } from 'lucide-react'
import { toggleUserBlock } from '@/app/(dashboard)/shop-admin/actions'
import { Customer } from './types'

interface CustomersTabProps {
  customers: Customer[]
  setGlobalLoading: (loading: boolean) => void
}

export default function CustomersTab({
  customers,
  setGlobalLoading,
}: CustomersTabProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-white">ניהול לקוחות וחסימות</h2>

      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-x-auto shadow-xl">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <th className="py-4 px-6">שם מלא</th>
              <th className="py-4 px-6">טלפון</th>
              <th className="py-4 px-6">אימייל</th>
              <th className="py-4 px-6">הרשאות</th>
              <th className="py-4 px-6 text-left">חסימה מצ'קאאוט</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-900/10 transition-colors">
                <td className="py-4 px-6 font-bold text-zinc-100">{c.full_name || 'לקוח ללא שם'}</td>
                <td className="py-4 px-6 font-mono font-medium">{c.phone || '-'}</td>
                <td className="py-4 px-6 font-medium text-zinc-400">{c.email}</td>
                <td className="py-4 px-6">
                  <div className="flex gap-1.5">
                    {c.is_admin && <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-450 border border-yellow-500/20 text-xxs font-bold rounded-md">אדמין</span>}
                    {c.is_approved && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 text-xxs font-bold rounded-md">מנהל קייטרינג</span>}
                    {!c.is_admin && !c.is_approved && <span className="px-2 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-800 text-xxs font-bold rounded-md">לקוח B2C</span>}
                  </div>
                </td>
                <td className="py-4 px-6 text-left">
                  <button
                    onClick={async () => {
                      setGlobalLoading(true)
                      await toggleUserBlock(c.id, !c.is_blocked)
                      setGlobalLoading(false)
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${c.is_blocked
                      ? 'bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/20 text-rose-400'
                      : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                  >
                    {c.is_blocked ? (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span>חסום</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="h-3.5 w-3.5" />
                        <span>פעיל</span>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
