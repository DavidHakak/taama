'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  User,
  Check,
  X,
  Loader2,
  AlertCircle,
  Mail,
  ShieldCheck,
  ShieldAlert,
  Calendar,
} from 'lucide-react'
import { useCustomDialogs } from '@/hooks/useCustomDialogs'

interface UserProfile {
  id: string
  email: string
  is_approved: boolean
  is_admin: boolean
  created_at: string
}

export default function UsersPage() {
  const router = useRouter()
  const supabase = createClient()
  const { showAlert, showConfirm, CustomDialogs } = useCustomDialogs()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)

  // Load and verify permissions
  const fetchProfiles = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUserEmail(user.email ?? null)

      // Query current user's profile to double check admin role
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!currentProfile || !currentProfile.is_admin) {
        // Not admin, send back
        router.push('/dashboard')
        return
      }

      // Query all profiles
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setProfiles(data || [])
    } catch (err: unknown) {
      console.error('Error fetching profiles:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת משתמשים')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfiles()
  }, [supabase, router])

  // Toggle user approval status
  const handleToggleApproval = async (profileId: string, currentStatus: boolean) => {
    try {
      const targetProfile = profiles.find((p) => p.id === profileId)
      if (targetProfile?.email === 'davidhakak19@gmail.com') {
        showAlert('לא ניתן לבטל את אישור חשבון המנהל הראשי', 'שגיאה', 'error')
        return
      }

      setLoading(true)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_approved: !currentStatus })
        .eq('id', profileId)

      if (updateError) throw updateError

      // Refresh list
      fetchProfiles()
    } catch (err: unknown) {
      console.error('Error updating approval status:', err)
      showAlert(err instanceof Error ? err.message : 'שגיאה בעדכון הרשאות המשתמש', 'שגיאה', 'error')
      setLoading(false)
    }
  }

  // Toggle admin status
  const handleToggleAdmin = async (profileId: string, currentStatus: boolean) => {
    try {
      const targetProfile = profiles.find((p) => p.id === profileId)
      if (targetProfile?.email === 'davidhakak19@gmail.com') {
        showAlert('לא ניתן לבטל את תפקיד המנהל הראשי של המערכת', 'שגיאה', 'error')
        return
      }

      setLoading(true)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_admin: !currentStatus })
        .eq('id', profileId)

      if (updateError) throw updateError

      // Refresh list
      fetchProfiles()
    } catch (err: unknown) {
      console.error('Error updating admin status:', err)
      showAlert(err instanceof Error ? err.message : 'שגיאה בעדכון הרשאות המנהל', 'שגיאה', 'error')
      setLoading(false)
    }
  }

  if (loading && profiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]" dir="rtl">
        <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
        <p className="text-zinc-400 text-sm">טוען רשימת משתמשים...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8" dir="rtl">
      {/* Page Header */}
      <div className="text-right">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 justify-start">
          <User className="h-8 w-8 text-amber-500" />
          ניהול משתמשים ואישורים
        </h1>
        <p className="text-zinc-400 text-sm mt-1">אשר משתמשים חדשים, נהל הרשאות גישה והגדר מנהלי מערכת נוספים.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 text-right">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      )}

      {/* Users List Table Container */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl text-right">
        {profiles.length === 0 ? (
          <div className="text-center py-16">
            <User className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-550 text-zinc-500 text-sm font-medium">לא נמצאו משתמשים במערכת.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-black/40 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                  <th className="py-4.5 px-6">אימייל / שם משתמש</th>
                  <th className="py-4.5 px-6">תאריך הרשמה</th>
                  <th className="py-4.5 px-6">תפקיד מנהל (Admin)</th>
                  <th className="py-4.5 px-6">סטטוס אישור גישה</th>
                  <th className="py-4.5 px-6 text-left">פעולות שינוי סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300 text-sm">
                {profiles.map((profile) => {
                  const isMainAdmin = profile.email === 'davidhakak19@gmail.com'
                  return (
                    <tr key={profile.id} className="hover:bg-zinc-900/20 transition-colors">
                      {/* Email */}
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-2.5 justify-start">
                          <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
                          <div>
                            <span className="font-bold text-zinc-100">{profile.email}</span>
                            {isMainAdmin && (
                              <span className="mr-2 inline-block px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-xxs font-black">
                                מנהל ראשי
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="py-5 px-6 text-zinc-400">
                        <span className="flex items-center gap-1.5 justify-start text-xs font-semibold">
                          <Calendar className="h-4 w-4 text-zinc-500" />
                          {new Date(profile.created_at).toLocaleDateString('he-IL', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </td>

                      {/* Admin role checkbox/badge */}
                      <td className="py-5 px-6">
                        {isMainAdmin ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold">
                            <ShieldCheck className="h-4 w-4" />
                            מנהל
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleAdmin(profile.id, profile.is_admin)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                              profile.is_admin
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-black/40 text-zinc-400 border-zinc-900 hover:text-zinc-200'
                            }`}
                          >
                            {profile.is_admin ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                            {profile.is_admin ? 'מנהל מערכת' : 'משתמש רגיל'}
                          </button>
                        )}
                      </td>

                      {/* Approved Status Badge */}
                      <td className="py-5 px-6">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xxs font-extrabold uppercase tracking-wide border ${
                            profile.is_approved
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}
                        >
                          {profile.is_approved ? 'מאושר גישה' : 'חסום / ממתין'}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="py-5 px-6 text-left">
                        {isMainAdmin ? (
                          <span className="text-xxs text-zinc-500">ללא פעולות</span>
                        ) : (
                          <button
                            onClick={() => handleToggleApproval(profile.id, profile.is_approved)}
                            className={`inline-flex items-center gap-1.5 px-4.5 py-2 text-xs font-extrabold rounded-xl border transition-all cursor-pointer ${
                              profile.is_approved
                                ? 'bg-red-500/5 hover:bg-red-500/10 text-red-400 border-red-500/10 hover:border-red-500/20'
                                : 'bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 border-emerald-500/10 hover:border-emerald-500/20'
                            }`}
                          >
                            {profile.is_approved ? (
                              <>
                                <X className="h-3.5 w-3.5" />
                                <span>בטל אישור גישה</span>
                              </>
                            ) : (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>אשר משתמש</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <CustomDialogs />
      {loading && profiles.length > 0 && (
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
