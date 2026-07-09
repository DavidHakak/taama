export interface Ingredient {
  id: string
  name: string
  unit: string
  category: string
}

export interface ProductIngredient {
  ingredientId: string
  quantity: number
  name?: string
  unit?: string
}

export interface Variant {
  id?: string
  sizeType: string
  price: number
  stockLimit: number | null
  ingredients: ProductIngredient[]
}

export interface Product {
  id: string
  name: string
  category: string
  isVisible: boolean
  announcementText: string | null
  imageUrl?: string | null
  image_url?: string | null
  variants: Variant[]
}

export interface Event {
  id: string
  name: string
  pickup_date: string
  is_active: boolean
  is_special: boolean
  announced_at?: string | Date | null
}

export interface OrderItem {
  id: string
  productId: string
  quantity: number
  price: number
  name: string
  category: string
  sizeType: string
}

export interface Order {
  id: string
  eventId: string
  totalPrice: number
  status: string
  createdAt: Date
  userEmail: string
  userFullName: string | null
  userPhone: string | null
  eventName: string
  couponId: string | null
  couponDiscount: number
  couponCode: string | null
  items: OrderItem[]
}

export interface Customer {
  id: string
  email: string
  is_approved: boolean
  is_admin: boolean
  is_blocked: boolean
  full_name: string | null
  phone: string | null
}

export interface Promotion {
  id: string
  name: string
  category: string
  package_qty: number
  packagePrice: number
  is_active: boolean
  size_type?: string | null
}

export interface Coupon {
  id: string
  code: string
  discount_type: string
  discountValue: number
  minOrderValue: number
  max_uses: number | null
  used_count: number
  expiration_date: Date | null
  is_active: boolean
}

export interface ShopAdminClientProps {
  ingredientsList: Ingredient[]
  products: Product[]
  events: Event[]
  orders: Order[]
  customers: Customer[]
  promotions: Promotion[]
  coupons: Coupon[]
  settings?: { key: string; value: string }[]
}

export const CATEGORIES = ['סלטים', 'הרינגים', 'עיקריות', 'קינוחים', 'עוגות פרווה', 'עוגות חלביות', 'אחר']

export const DEFAULT_SIZE_TYPES = [
  '250ml',
  '500ml',
  'ליטר',
  'קופסה',
  'פס',
  'יחידה',
  'תבנית אינגליש קייק',
  'מארז 8 יחידות',
  'תבנית עגולה 22 ס"מ',
  'תבנית טארט אישית גדולה',
  '250ml קופסה',
  '500ml קופסה'
]

export const INGREDIENT_CATEGORIES = [
  "ירקות ופירות",
  "בשרים ודגים",
  "תבלינים",
  "מוצרים יבשים/מזווה",
  "מוצרי חלב",
  "קפואים",
  "אחר"
]

export const getUnitLabel = (unit?: string) => {
  if (!unit) return ''
  switch (unit) {
    case 'kg': return 'ק"ג'
    case 'g': return 'גרם'
    case 'liter': return 'ליטר'
    case 'ml': return 'מ"ל'
    case 'unit': return 'יח\''
    default: return unit
  }
}
