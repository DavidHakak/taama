import { Users } from 'lucide-react'
import CustomersBook from '@/components/customers/CustomersBook'

export default function CateringCustomersPage() {
  return (
    <div className="space-y-8" dir="rtl">
      <div className="text-right">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 justify-start">
          <Users className="h-8 w-8 text-amber-500" />
          לקוחות קייטרינג
        </h1>
        <p className="text-zinc-400 text-sm mt-1">פרטי הלקוחות הפרטיים והחברות שמזמינים קייטרינג, וההזמנות של כל אחד מהם.</p>
      </div>
      <CustomersBook segment="catering" />
    </div>
  )
}
