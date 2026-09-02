'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface TopicPreference {
  topic: string
  label: string
  description: string
  enabled: boolean
}

/**
 * Per-user control over *which* notifications reach them. The audience rule of
 * each topic still applies on the server; this only ever narrows it further.
 */
export function NotificationPreferences({
  onError,
  onInfo,
}: {
  onError: (message: string) => void
  onInfo: (message: string) => void
}) {
  const router = useRouter()
  const [topics, setTopics] = useState<TopicPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [savingTopic, setSavingTopic] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/push/preferences')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'טעינת ההגדרות נכשלה')
        if (!cancelled) setTopics(data.topics ?? [])
      } catch (err) {
        console.error('Load notification preferences failed:', err)
        if (!cancelled) onError(err instanceof Error ? err.message : 'טעינת ההגדרות נכשלה')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // Loading once on mount is the point; onError changing must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = async (topic: TopicPreference) => {
    const next = !topic.enabled
    try {
      setSavingTopic(topic.topic)
      const res = await fetch('/api/push/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.topic, enabled: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'שמירת ההגדרה נכשלה')

      setTopics((prev) =>
        prev.map((t) => (t.topic === topic.topic ? { ...t, enabled: next } : t))
      )
      onInfo(next ? `הופעלו התראות: ${topic.label}` : `כובו התראות: ${topic.label}`)
      router.refresh()
    } catch (err) {
      console.error('Save notification preference failed:', err)
      onError(err instanceof Error ? err.message : 'שמירת ההגדרה נכשלה')
    } finally {
      setSavingTopic(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs font-bold">טוען הגדרות התראות...</span>
      </div>
    )
  }

  if (topics.length === 0) return null

  const busy = savingTopic !== null

  return (
    <div className="space-y-2" dir="rtl">
      {topics.map((topic) => {
        const saving = savingTopic === topic.topic
        return (
          <div
            key={topic.topic}
            className="flex items-start justify-between gap-3 p-3 rounded-xl border border-zinc-900 bg-zinc-950"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-white">{topic.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{topic.description}</p>
            </div>
            <button
              type="button"
              onClick={() => toggle(topic)}
              disabled={busy}
              aria-pressed={topic.enabled}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xxs font-bold border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                topic.enabled
                  ? 'text-amber-500 bg-amber-500/5 border-amber-500/25 hover:bg-amber-500/10'
                  : 'text-zinc-500 bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900'
              }`}
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              {topic.enabled ? 'מקבל' : 'כבוי'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
