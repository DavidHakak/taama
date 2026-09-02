'use client'

import React, { useState } from 'react'
import {
  Tag,
  Calendar,
  ShoppingBag,
  Users,
  Percent,
  Gift,
  Settings,
  Loader2,
} from 'lucide-react'
import { useCustomDialogs } from '@/hooks/useCustomDialogs'
import { ShopAdminClientProps } from './shop-admin/types'

import ProductsTab from './shop-admin/ProductsTab'
import PromotionsTab from './shop-admin/PromotionsTab'
import CouponsTab from './shop-admin/CouponsTab'
import EventsTab from './shop-admin/EventsTab'
import OrdersTab from './shop-admin/OrdersTab'
import CustomersTab from './shop-admin/CustomersTab'
import SettingsTab from './shop-admin/SettingsTab'

export default function ShopAdminClient({
  brandSlug,
  ingredientsList,
  products,
  events,
  orders,
  customers,
  promotions,
  coupons,
  settings,
}: ShopAdminClientProps) {
  const { CustomDialogs } = useCustomDialogs()
  const [activeTab, setActiveTab] = useState<'products' | 'promotions' | 'coupons' | 'events' | 'orders' | 'customers' | 'settings'>('products')
  const [loading, setLoading] = useState(false)

  // Parse available sizes for size dropdown configs in tabs & modals
  const availableSizesInput = settings?.find((s) => s.key === 'available_sizes')?.value || '250ml, 500ml, ליטר, קופסה, פס, יחידה, תבנית אינגליש קייק, מארז 8 יחידות, תבנית עגולה 22 ס"מ, תבנית טארט אישית גדולה, 250ml קופסה, 500ml קופסה'
  const dynamicSizeTypes = availableSizesInput
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return (
    <div className="space-y-8 text-right" dir="rtl">
      {/* 1. Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 justify-start">
          <ShoppingBag className="h-8 w-8 text-amber-500" />
          ניהול חנות שבת וחגים
        </h1>
        <p className="text-zinc-400 text-sm mt-1">נהל מוצרים למכירה, מתכונים עצמאיים לחנות, אירועי חלוקה, מבצעים, קופונים והזמנות B2C.</p>
      </div>

      {/* 2. Tabs Navigation */}
      <div className="flex border-b border-zinc-900 overflow-x-auto gap-4">
        {[
          { id: 'products', name: 'ניהול מוצרים', icon: Tag },
          { id: 'promotions', name: 'ניהול מבצעים', icon: Percent },
          { id: 'coupons', name: 'קודי קופון', icon: Gift },
          { id: 'events', name: 'אירועי מכירה', icon: Calendar },
          { id: 'orders', name: 'הזמנות חנות', icon: ShoppingBag },
          { id: 'customers', name: 'ניהול לקוחות', icon: Users },
          { id: 'settings', name: 'הגדרות חנות', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon
          const isSelected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-4 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${isSelected
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
            >
              <Icon className="h-4.5 w-4.5" />
              <span>{tab.name}</span>
            </button>
          )
        })}
      </div>

      {/* 3. Tab Content */}
      {activeTab === 'products' && (
        <ProductsTab
          brandSlug={brandSlug}
          products={products}
          ingredientsList={ingredientsList}
          dynamicSizeTypes={dynamicSizeTypes}
          setGlobalLoading={setLoading}
        />
      )}

      {activeTab === 'promotions' && (
        <PromotionsTab
          brandSlug={brandSlug}
          promotions={promotions}
          dynamicSizeTypes={dynamicSizeTypes}
          setGlobalLoading={setLoading}
        />
      )}

      {activeTab === 'coupons' && (
        <CouponsTab
          brandSlug={brandSlug}
          coupons={coupons}
          setGlobalLoading={setLoading}
        />
      )}

      {activeTab === 'events' && (
        <EventsTab
          events={events}
          brandSlug={brandSlug}
          setGlobalLoading={setLoading}
        />
      )}

      {activeTab === 'orders' && (
        <OrdersTab
          orders={orders}
          events={events}
          products={products}
          promotions={promotions}
          coupons={coupons}
          dynamicSizeTypes={dynamicSizeTypes}
          setGlobalLoading={setLoading}
        />
      )}

      {activeTab === 'customers' && (
        <CustomersTab
          customers={customers}
          setGlobalLoading={setLoading}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab
          brandSlug={brandSlug}
          settings={settings}
          setGlobalLoading={setLoading}
        />
      )}

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
  )
}
