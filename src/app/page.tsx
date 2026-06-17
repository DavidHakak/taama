import { Loader2 } from 'lucide-react'

export default function RootPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-black text-zinc-400">
      <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
      <p className="text-sm font-medium">Redirecting you to dashboard...</p>
    </div>
  )
}
