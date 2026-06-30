'use client'

import React, { useState, useEffect } from 'react'
import {
  getOrdersInRange,
  calculateUnifiedShoppingList,
  saveShoppingList,
  getSavedShoppingLists,
  toggleSavedItemPurchased,
  deleteSavedShoppingList,
  updateSavedListNotes
} from './actions'
import {
  ClipboardList,
  Loader2,
  CheckSquare,
  Square,
  AlertCircle,
  Trash2,
  Save,
  Plus,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckCircle,
  Clock,
  CheckSquare2
} from 'lucide-react'
import { useCustomDialogs } from '@/hooks/useCustomDialogs'

interface UnifiedIngredient {
  id: string
  name: string
  unit: string
  category: string
  cateringQty: number
  shopQty: number
  totalQty: number
}

interface SavedItem {
  id: string
  listId: string
  ingredientId: string | null
  name: string
  unit: string
  category: string
  cateringQty: number
  shopQty: number
  totalQty: number
  isPurchased: boolean
}

interface SavedList {
  id: string
  name: string
  notes: string | null
  created_at: Date
  items: SavedItem[]
}

export default function ShoppingListPage() {
  const { showAlert, showConfirm, CustomDialogs } = useCustomDialogs()
  
  // Navigation Tabs
  const [activeSubTab, setActiveSubTab] = useState<'calc' | 'saved'>('calc')
  
  // Date calculation states
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<UnifiedIngredient[]>([])

  // Orders in range selection states
  const [cateringOrders, setCateringOrders] = useState<any[]>([])
  const [shopOrders, setShopOrders] = useState<any[]>([])
  const [selectedCateringIds, setSelectedCateringIds] = useState<{ [id: string]: boolean }>({})
  const [selectedShopIds, setSelectedShopIds] = useState<{ [id: string]: boolean }>({})
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  
  // Persisted lists states
  const [savedLists, setSavedLists] = useState<SavedList[]>([])
  const [savedListsLoading, setSavedListsLoading] = useState(false)
  const [expandedListId, setExpandedListId] = useState<string | null>(null)
  
  // Save modal states
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListNotes, setNewListNotes] = useState('')
  
  // Checked items state for calculation checklist
  const [checkedIds, setCheckedIds] = useState<{ [id: string]: boolean }>({})

  // Fetch saved checklists on load
  const loadSavedLists = async () => {
    setSavedListsLoading(true)
    const res = await getSavedShoppingLists()
    if (res.success && res.lists) {
      setSavedLists(res.lists as any[])
    }
    setSavedListsLoading(false)
  }

  useEffect(() => {
    loadSavedLists()
    
    // Load local calculations checklist state
    const stored = localStorage.getItem('taama-checked-ingredients')
    if (stored) {
      try {
        setCheckedIds(JSON.parse(stored))
      } catch (e) {
        console.error(e)
      }
    }
  }, [])

  const handleToggleCheck = (id: string) => {
    const updated = { ...checkedIds, [id]: !checkedIds[id] }
    setCheckedIds(updated)
    localStorage.setItem('taama-checked-ingredients', JSON.stringify(updated))
  }

  const handleFetchOrders = async () => {
    if (!startDate || !endDate) return
    setLoading(true)
    const result = await getOrdersInRange(startDate, endDate)
    if (result.success && result.cateringOrders && result.shopOrders) {
      setCateringOrders(result.cateringOrders)
      setShopOrders(result.shopOrders)
      
      // Select all by default
      const catIds: { [id: string]: boolean } = {}
      result.cateringOrders.forEach((o: any) => { catIds[o.id] = true })
      setSelectedCateringIds(catIds)
      
      const shpIds: { [id: string]: boolean } = {}
      result.shopOrders.forEach((o: any) => { shpIds[o.id] = true })
      setSelectedShopIds(shpIds)
      
      setOrdersLoaded(true)
      setItems([]) // Clear previous calculation results if any
    } else {
      showAlert(result.error || 'שגיאה במשיכת ההזמנות', 'שגיאה', 'error')
    }
    setLoading(false)
  }

  const handleCalculate = async () => {
    const activeCateringIds = Object.keys(selectedCateringIds).filter(id => selectedCateringIds[id])
    const activeShopIds = Object.keys(selectedShopIds).filter(id => selectedShopIds[id])
    
    if (activeCateringIds.length === 0 && activeShopIds.length === 0) {
      showAlert('אנא בחר לפחות הזמנה אחת לחישוב', 'שגיאה', 'error')
      return
    }
    
    setLoading(true)
    const result = await calculateUnifiedShoppingList(activeCateringIds, activeShopIds)
    if (result.success && result.items) {
      setItems(result.items)
      
      // Auto populate list name for save proposal
      const startFormatted = new Date(startDate).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
      const endFormatted = new Date(endDate).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
      setNewListName(`רשימת קניות מ-${startFormatted} עד ${endFormatted}`)
    } else {
      showAlert(result.error || 'שגיאה בחישוב הכמויות', 'שגיאה', 'error')
    }
    setLoading(false)
  }

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case 'kg': return 'ק"ג'
      case 'g': return 'גרם'
      case 'liter': return 'ליטר'
      case 'ml': return 'מ"ל'
      case 'unit': return 'יח\''
      default: return unit
    }
  }

  // Handle saving the calculated list to database
  const handleSaveToSide = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListName.trim()) return
    setLoading(true)
    
    const res = await saveShoppingList(newListName.trim(), newListNotes.trim(), items)
    setLoading(false)
    
    if (res.success) {
      showAlert('הרשימה נשמרה בהצלחה בטבלה הצידית!', 'הצלחה', 'success')
      setIsSaveModalOpen(false)
      setNewListNotes('')
      loadSavedLists()
      setActiveSubTab('saved') // Switch to show saved lists
      setExpandedListId(res.listId || null) // Auto expand the newly created list
    } else {
      showAlert(res.error || 'שגיאה בשמירת הרשימה', 'שגיאה', 'error')
    }
  }

  // Toggle purchased state for saved checklist items
  const handleTogglePurchased = async (itemId: string, currentStatus: boolean, listId: string) => {
    // Optimistic UI update
    setSavedLists(prev => prev.map(list => {
      if (list.id !== listId) return list
      return {
        ...list,
        items: list.items.map(item => item.id === itemId ? { ...item, isPurchased: !currentStatus } : item)
      }
    }))

    const res = await toggleSavedItemPurchased(itemId, !currentStatus)
    if (!res.success) {
      showAlert(res.error || 'שגיאה בעדכון הפריט', 'שגיאה', 'error')
      // Rollback
      loadSavedLists()
    }
  }

  // Delete saved checklist
  const handleDeleteList = async (listId: string, name: string) => {
    if (confirm(`האם אתה בטוח שברצונך למחוק לחלוטין את הרשימה "${name}"?`)) {
      setLoading(true)
      const res = await deleteSavedShoppingList(listId)
      setLoading(false)
      if (res.success) {
        setSavedLists(prev => prev.filter(l => l.id !== listId))
        if (expandedListId === listId) setExpandedListId(null)
      } else {
        showAlert(res.error || 'שגיאה במחיקת הרשימה', 'שגיאה', 'error')
      }
    }
  }

  // Update notes of saved list
  const handleUpdateNotes = async (listId: string, notes: string) => {
    const res = await updateSavedListNotes(listId, notes)
    if (!res.success) {
      showAlert(res.error || 'שגיאה בעדכון ההערות', 'שגיאה', 'error')
    }
  }

  // Group items by category for nice visual display (Calculation view)
  const categoriesMap: { [cat: string]: UnifiedIngredient[] } = {}
  items.forEach((item) => {
    const cat = item.category || 'אחר'
    if (!categoriesMap[cat]) {
      categoriesMap[cat] = []
    }
    categoriesMap[cat].push(item)
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-right" dir="rtl">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 justify-start">
            <ClipboardList className="h-8 w-8 text-amber-500" />
            ריכוז קניות מאוחד
          </h1>
          <p className="text-zinc-400 text-sm mt-1">אחד דוחות קייטרינג וחנות שבת לפי טווח תאריכים, שמור רשימות מעקב לעובדים ועדכן רכישות בנייד.</p>
        </div>

        {/* Tab Selector Buttons */}
        <div className="flex bg-zinc-900/60 p-1 rounded-xl border border-zinc-800 self-start sm:self-center">
          <button
            onClick={() => setActiveSubTab('calc')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'calc'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            מחשב כמויות רכש
          </button>
          <button
            onClick={() => setActiveSubTab('saved')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'saved'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            רשימות ממתינות
            {savedLists.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                activeSubTab === 'saved' ? 'bg-black text-amber-500' : 'bg-amber-500/10 text-amber-500'
              }`}>
                {savedLists.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Main Content Tabs */}
      <div className="w-full space-y-6">
        
        {/* Tab 1: Calculator */}
        {activeSubTab === 'calc' && (
          <div className="space-y-6">
            {/* Date Picker Form */}
            {!ordersLoaded && (
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl flex flex-col sm:flex-row items-end gap-4">
                <div className="w-full">
                  <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">מתאריך איסוף/אירוע</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono animate-in fade-in"
                  />
                </div>
                <div className="w-full">
                  <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">עד תאריך איסוף/אירוע</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono animate-in fade-in"
                  />
                </div>
                <button
                  onClick={handleFetchOrders}
                  disabled={loading || !startDate || !endDate}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                >
                  {loading ? 'טוען הזמנות...' : 'הצג הזמנות בטווח'}
                </button>
              </div>
            )}

            {/* Orders Selection checklist */}
            {ordersLoaded && items.length === 0 && (
              <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl space-y-6 animate-in slide-in-from-top-2 duration-250">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-900 pb-4">
                  <div className="text-right">
                    <h3 className="text-base font-bold text-white">בחר הזמנות לשילוב בחישוב</h3>
                    <p className="text-[11px] text-zinc-500 mt-1">נמצאו {cateringOrders.length} אירועי קייטרינג ו-{shopOrders.length} הזמנות חנות מעדניה בטווח התאריכים.</p>
                  </div>
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => setOrdersLoaded(false)}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 rounded-xl text-zinc-300 font-bold text-xs cursor-pointer transition-all"
                    >
                      שנה תאריכים
                    </button>
                    <button
                      onClick={handleCalculate}
                      disabled={loading || (Object.keys(selectedCateringIds).filter(id => selectedCateringIds[id]).length === 0 && Object.keys(selectedShopIds).filter(id => selectedShopIds[id]).length === 0)}
                      className="px-5 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? 'מחשב...' : 'חשב כמויות נבחרות'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Catering Orders Checklist */}
                  <div className="space-y-3 text-right">
                    <div className="flex justify-between items-center pr-2 border-r-2 border-amber-500">
                      <h4 className="text-sm font-bold text-white">אירועי קייטרינג ({cateringOrders.length})</h4>
                      {cateringOrders.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const allSelected = cateringOrders.every(o => selectedCateringIds[o.id])
                            const next: any = {}
                            cateringOrders.forEach(o => { next[o.id] = !allSelected })
                            setSelectedCateringIds(next)
                          }}
                          className="text-xxs font-bold text-amber-500 hover:underline cursor-pointer"
                        >
                          {cateringOrders.every(o => selectedCateringIds[o.id]) ? 'בטל בחירת הכל' : 'בחר הכל'}
                        </button>
                      )}
                    </div>
                    {cateringOrders.length === 0 ? (
                      <p className="text-zinc-500 text-xs py-8 text-center border border-zinc-900 rounded-xl bg-zinc-950/20">אין אירועי קייטרינג מאושרים בטווח זה.</p>
                    ) : (
                      <div className="max-h-[300px] overflow-y-auto border border-zinc-900 rounded-xl divide-y divide-zinc-900 bg-black/10">
                        {cateringOrders.map(o => (
                          <div
                            key={o.id}
                            onClick={() => setSelectedCateringIds(prev => ({ ...prev, [o.id]: !prev[o.id] }))}
                            className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-zinc-900/30 transition-all text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={!!selectedCateringIds[o.id]}
                                readOnly
                                className="h-4 w-4 rounded border-zinc-800 text-amber-500 focus:ring-amber-500 bg-black cursor-pointer"
                              />
                              <div className="text-right">
                                <p className="font-bold text-zinc-200">{o.clientName}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{new Date(o.eventDate).toLocaleDateString('he-IL')}</p>
                              </div>
                            </div>
                            <div className="text-left font-mono font-bold text-amber-500">
                              {o.portions} מנות
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Shop Orders Checklist */}
                  <div className="space-y-3 text-right">
                    <div className="flex justify-between items-center pr-2 border-r-2 border-amber-500">
                      <h4 className="text-sm font-bold text-white">הזמנות מעדניה ({shopOrders.length})</h4>
                      {shopOrders.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const allSelected = shopOrders.every(o => selectedShopIds[o.id])
                            const next: any = {}
                            shopOrders.forEach(o => { next[o.id] = !allSelected })
                            setSelectedShopIds(next)
                          }}
                          className="text-xxs font-bold text-amber-500 hover:underline cursor-pointer"
                        >
                          {shopOrders.every(o => selectedShopIds[o.id]) ? 'בטל בחירת הכל' : 'בחר הכל'}
                        </button>
                      )}
                    </div>
                    {shopOrders.length === 0 ? (
                      <p className="text-zinc-500 text-xs py-8 text-center border border-zinc-900 rounded-xl bg-zinc-950/20">אין הזמנות חנות פעילות בטווח זה.</p>
                    ) : (
                      <div className="max-h-[300px] overflow-y-auto border border-zinc-900 rounded-xl divide-y divide-zinc-900 bg-black/10">
                        {shopOrders.map(o => (
                          <div
                            key={o.id}
                            onClick={() => setSelectedShopIds(prev => ({ ...prev, [o.id]: !prev[o.id] }))}
                            className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-zinc-900/30 transition-all text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={!!selectedShopIds[o.id]}
                                readOnly
                                className="h-4 w-4 rounded border-zinc-800 text-amber-500 focus:ring-amber-500 bg-black cursor-pointer"
                              />
                              <div className="text-right">
                                <p className="font-bold text-zinc-200">{o.userFullName || 'לקוח מזדמן'}</p>
                                <p className="text-[10px] text-zinc-550 mt-0.5">{o.eventName} • {new Date(o.pickupDate).toLocaleDateString('he-IL')}</p>
                              </div>
                            </div>
                            <div className="text-left font-mono font-bold text-zinc-400">
                              ₪{o.totalPrice.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Unified List Display */}
            {!ordersLoaded && items.length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 animate-in fade-in">
                <AlertCircle className="h-10 w-10 text-zinc-700" />
                <p className="text-zinc-400 text-sm font-medium">לא נבחרו תאריכים או שלא נמצאו הזמנות פעילות בטווח זה.</p>
                <p className="text-xxs text-zinc-650">הזן טווח תאריכים ולחץ "הצג הזמנות בטווח" כדי להפיק רשימת קניות מרוכזת.</p>
              </div>
            ) : ordersLoaded && items.length > 0 ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-900 pb-3">
                  <div className="space-y-1 text-right">
                    <h2 className="text-lg font-bold text-white">רכיבים נדרשים לרכישה</h2>
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800/40 block w-fit">
                      סך הכל {items.length} חומרי גלם מרוכזים
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setItems([])}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
                    >
                      שנה בחירת הזמנות
                    </button>
                    {/* Save to side list action */}
                    <button
                      onClick={() => setIsSaveModalOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 text-black hover:bg-amber-450 font-bold rounded-xl text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      שמור רשימה בצד (To-Do)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.keys(categoriesMap).map((categoryName) => {
                    const groupItems = categoriesMap[categoryName]
                    return (
                      <div
                        key={categoryName}
                        className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between"
                      >
                        <div>
                          <h3 className="text-xs font-black text-amber-500 bg-amber-500/5 border border-amber-500/10 px-3 py-1.5 rounded-lg inline-block mb-3">
                            {categoryName}
                          </h3>

                          <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                              <thead>
                                <tr className="border-b border-zinc-900 text-zinc-500 font-bold">
                                  <th className="pb-2 w-8">נרכש</th>
                                  <th className="pb-2">שם הרכיב</th>
                                  <th className="pb-2 text-left font-mono">חנות שבת</th>
                                  <th className="pb-2 text-left font-mono">קייטרינג</th>
                                  <th className="pb-2 text-left font-mono">סה"כ לקנייה</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-900/60 text-zinc-300">
                                {groupItems.map((item) => {
                                  const isChecked = checkedIds[item.id] || false
                                  return (
                                    <tr
                                      key={item.id}
                                      onClick={() => handleToggleCheck(item.id)}
                                      className={`hover:bg-zinc-900/10 transition-colors cursor-pointer ${
                                        isChecked ? 'opacity-35 line-through decoration-zinc-600' : ''
                                      }`}
                                    >
                                      <td className="py-2.5">
                                        {isChecked ? (
                                          <CheckSquare className="h-4 w-4 text-emerald-500" />
                                        ) : (
                                          <Square className="h-4 w-4 text-zinc-700" />
                                        )}
                                      </td>
                                      <td className="py-2.5 font-bold text-zinc-200">{item.name}</td>
                                      <td className="py-2.5 text-left font-mono font-medium">
                                        {item.shopQty > 0
                                          ? `${item.shopQty.toFixed(2)} ${getUnitLabel(item.unit)}`
                                          : '-'}
                                      </td>
                                      <td className="py-2.5 text-left font-mono font-medium">
                                        {item.cateringQty > 0
                                          ? `${item.cateringQty.toFixed(2)} ${getUnitLabel(item.unit)}`
                                          : '-'}
                                      </td>
                                      <td className="py-2.5 text-left font-mono font-black text-amber-500">
                                        {item.totalQty.toFixed(2)} {getUnitLabel(item.unit)}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Tab 2: Saved Lists Manager */}
        {activeSubTab === 'saved' && (
          <div className="space-y-6">
            <div className="border-b border-zinc-900 pb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckSquare2 className="h-5 w-5 text-amber-500" />
                רשימות קניות פעילות בשטח
              </h2>
              <span className="text-xs font-bold text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800/40">
                {savedLists.length} רשימות שמורות
              </span>
            </div>

            {savedListsLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
                <p className="text-zinc-400 text-sm">טוען רשימות קניות...</p>
              </div>
            ) : savedLists.length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
                <FileText className="h-10 w-10 text-zinc-700" />
                <p className="text-zinc-400 text-sm font-medium">לא נמצאו רשימות קניות שמורות בצד.</p>
                <p className="text-xxs text-zinc-600">הפק רשימה חדשה בלשונית "מחשב כמויות" ושמור אותה בצד.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {savedLists.map((list) => {
                  const isExpanded = expandedListId === list.id
                  const totalItems = list.items.length
                  const purchasedItems = list.items.filter(i => i.isPurchased).length
                  const progressPct = totalItems > 0 ? Math.round((purchasedItems / totalItems) * 100) : 0
                  
                  // Group list items by category for view
                  const listCategories: { [cat: string]: SavedItem[] } = {}
                  list.items.forEach(item => {
                    const cat = item.category || 'אחר'
                    if (!listCategories[cat]) listCategories[cat] = []
                    listCategories[cat].push(item)
                  })

                  return (
                    <div
                      key={list.id}
                      className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl transition-all"
                    >
                      {/* List Summary Card Header - Large Clickable Mobile Area */}
                      <div
                        onClick={() => setExpandedListId(isExpanded ? null : list.id)}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-zinc-900/20 transition-all cursor-pointer select-none"
                      >
                        <div className="space-y-1.5 text-right w-full sm:w-auto">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm sm:text-base text-white">{list.name}</span>
                            <span className="text-[10px] text-zinc-550 font-bold bg-zinc-900 border border-zinc-800/40 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-zinc-400">
                              <Clock className="h-3 w-3" />
                              {new Date(list.created_at).toLocaleDateString('he-IL')}
                            </span>
                          </div>
                          
                          {/* Progress bar for mobile check-off progress */}
                          <div className="w-full sm:w-60 space-y-1">
                            <div className="flex justify-between text-[10px] text-zinc-500 font-bold">
                              <span>התקדמות קנייה</span>
                              <span>{purchasedItems} מתוך {totalItems} פריטים ({progressPct}%)</span>
                            </div>
                            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-850">
                              <div
                                className="h-full bg-gradient-to-r from-yellow-600 to-amber-500 transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* List Actions Block */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t border-zinc-900/60 sm:border-t-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteList(list.id, list.name)
                            }}
                            className="p-2 bg-zinc-900/80 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-450 border border-zinc-800/40 hover:border-rose-500/20 rounded-xl transition-all cursor-pointer"
                            title="מחק רשימה"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                          
                          <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400">
                            {isExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Checklist details (Mobile Optimized padding and text) */}
                      {isExpanded && (
                        <div className="border-t border-zinc-900 p-4 sm:p-6 bg-zinc-950/40 space-y-5 animate-in slide-in-from-top-2 duration-200">
                          {/* Inline Notes Editor */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">הערות לרשימה (העובדים יכולים לרשום כאן עדכונים)</label>
                            <textarea
                              defaultValue={list.notes || ''}
                              onBlur={(e) => handleUpdateNotes(list.id, e.target.value)}
                              placeholder="אין הערות מיוחדות. לחץ כאן כדי להוסיף הערה או בקשות רכש..."
                              rows={2}
                              className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-xl text-zinc-300 placeholder-zinc-700 text-xs focus:border-amber-500 transition-all outline-none resize-none"
                            />
                          </div>

                          {/* Checklist Category Groups */}
                          <div className="space-y-6">
                            {Object.keys(listCategories).map((categoryName) => {
                              const groupItems = listCategories[categoryName]
                              return (
                                <div key={categoryName} className="space-y-2">
                                  <h4 className="text-xs font-bold text-amber-500 pr-2 border-r-2 border-amber-500 inline-block">
                                    {categoryName}
                                  </h4>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {groupItems.map((item) => (
                                      <div
                                        key={item.id}
                                        onClick={() => handleTogglePurchased(item.id, item.isPurchased, list.id)}
                                        className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition-all select-none min-h-[48px] active:scale-[0.99] ${
                                          item.isPurchased
                                            ? 'bg-emerald-500/5 border-emerald-500/20 opacity-50'
                                            : 'bg-black border-zinc-900 hover:border-zinc-800'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          {item.isPurchased ? (
                                            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                                          ) : (
                                            <div className="h-5 w-5 rounded-full border-2 border-zinc-700 shrink-0" />
                                          )}
                                          <span className={`text-xs font-bold ${
                                            item.isPurchased ? 'text-zinc-500 line-through' : 'text-zinc-200'
                                          }`}>
                                            {item.name}
                                          </span>
                                        </div>

                                        <span className={`text-xs font-mono font-bold ${
                                          item.isPurchased ? 'text-zinc-500' : 'text-amber-500'
                                        }`}>
                                          {item.totalQty.toFixed(2)} {getUnitLabel(item.unit)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Export to Saved List Dialog Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
            <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/20">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckSquare2 className="h-5 w-5 text-amber-500" />
                שמור רשימת קניות בצד
              </h3>
            </div>
            
            <form onSubmit={handleSaveToSide} className="p-6 space-y-4 text-right">
              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                  שם הרשימה
                </label>
                <input
                  type="text"
                  required
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="רשימת קניות..."
                  className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xxs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                  הערות מיוחדות / דגשים לעובדים
                </label>
                <textarea
                  value={newListNotes}
                  onChange={(e) => setNewListNotes(e.target.value)}
                  placeholder="למשל: לקנות ירקות רק בשוק, לבדוק תוקף של הבשרים וכו'..."
                  rows={3}
                  className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-xl text-white placeholder-zinc-700 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none resize-none"
                />
              </div>

              <div className="pt-4 border-t border-zinc-900 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-pure-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
                >
                  שמור רשימה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomDialogs />
      
      {loading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-zinc-950/85 border border-zinc-900 rounded-2xl p-6 flex flex-col items-center shadow-2xl">
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
            <p className="text-zinc-200 text-sm font-bold">מעבד נתונים, אנא המתן...</p>
          </div>
        </div>
      )}
    </div>
  )
}
