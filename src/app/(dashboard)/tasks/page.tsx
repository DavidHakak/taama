'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  ListTodo,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  FolderPlus,
  CircleDot,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Flag,
  Inbox,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { PushToggle } from '@/components/PushToggle'
import { useCustomDialogs } from '@/hooks/useCustomDialogs'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

type TaskStatus = 'open' | 'in_progress' | 'waiting' | 'done'
type TaskPriority = 'low' | 'normal' | 'high'

interface TaskCategory {
  id: string
  name: string
  color: string
  position: number
  created_at: string
}

interface Task {
  id: string
  category_id: string
  title: string
  details: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

/* -------------------------------------------------------------------------- */
/*                              Presentation maps                             */
/* -------------------------------------------------------------------------- */

const STATUS_ORDER: TaskStatus[] = ['open', 'in_progress', 'waiting', 'done']

const STATUS_META: Record<
  TaskStatus,
  { label: string; pill: string; dot: string; icon: typeof CircleDot }
> = {
  open: {
    label: 'פתוח',
    pill: 'bg-[#eef1ee] text-[#5f6f60] border-[#dbe1da]',
    dot: 'bg-[#5f6f60]',
    icon: CircleDot,
  },
  in_progress: {
    label: 'בביצוע',
    pill: 'bg-[#f7f0dd] text-[#7a5f1c] border-[#e6d5a8]',
    dot: 'bg-[#8a6a20]',
    icon: PlayCircle,
  },
  waiting: {
    label: 'ממתין לצד ג׳',
    pill: 'bg-[#fbeee4] text-[#9a4f1c] border-[#f0d5bd]',
    dot: 'bg-[#9a4f1c]',
    icon: PauseCircle,
  },
  done: {
    label: 'בוצע',
    pill: 'bg-[#e9f2e7] text-[#3f6b3f] border-[#cfe1cb]',
    dot: 'bg-[#3f6b3f]',
    icon: CheckCircle2,
  },
}

const PRIORITY_META: Record<TaskPriority, { label: string; pill: string }> = {
  high: { label: 'עדיפות גבוהה', pill: 'bg-[#fbeaea] text-[#a3282f] border-[#f0cccc]' },
  normal: { label: 'עדיפות רגילה', pill: 'bg-[#eef1ee] text-[#5f6f60] border-[#dbe1da]' },
  low: { label: 'עדיפות נמוכה', pill: 'bg-[#f3f5f2] text-[#7f8f80] border-[#e3e8e2]' },
}

/** Higher rank sorts first. */
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 3, normal: 2, low: 1 }

const PRIORITY_ORDER: TaskPriority[] = ['high', 'normal', 'low']

type SortMode = 'priority' | 'due' | 'created'
type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'none'

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'due', label: 'לפי תאריך יעד' },
  { value: 'priority', label: 'לפי עדיפות' },
  { value: 'created', label: 'לפי תאריך פתיחה' },
]

const DUE_FILTERS: { value: DueFilter; label: string }[] = [
  { value: 'all', label: 'הכל' },
  { value: 'overdue', label: 'באיחור' },
  { value: 'today', label: 'להיום' },
  { value: 'week', label: 'השבוע' },
  { value: 'none', label: 'ללא תאריך' },
]

const CATEGORY_COLORS = [
  { value: 'gold', label: 'זהב', hex: '#8a6a20' },
  { value: 'olive', label: 'ירוק זית', hex: '#3f6b3f' },
  { value: 'clay', label: 'טרקוטה', hex: '#9a4f1c' },
  { value: 'teal', label: 'טורקיז עמוק', hex: '#1f6b63' },
  { value: 'plum', label: 'שזיף', hex: '#5c3a63' },
  { value: 'slate', label: 'אפור כחלחל', hex: '#4c5b6b' },
]

const colorHex = (key: string) =>
  CATEGORY_COLORS.find((c) => c.value === key)?.hex ?? '#8a6a20'

/* -------------------------------------------------------------------------- */
/*                                Date helpers                                */
/* -------------------------------------------------------------------------- */

/** Local-midnight parse for a `YYYY-MM-DD` column, avoiding UTC drift. */
function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfToday(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

/** Whole days from today to `iso`. Negative = overdue. */
function daysUntil(iso: string): number {
  const ms = parseDateOnly(iso).getTime() - startOfToday().getTime()
  return Math.round(ms / 86_400_000)
}

function formatDateOnly(iso: string): string {
  return parseDateOnly(iso).toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function todayInputValue(): string {
  const n = new Date()
  const p = (v: number) => String(v).padStart(2, '0')
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`
}

/** Human-readable deadline state, used for both label and color. */
function deadlineInfo(task: Task): { text: string; className: string } | null {
  if (!task.due_date) return null

  if (task.status === 'done') {
    return {
      text: `יעד: ${formatDateOnly(task.due_date)}`,
      className: 'text-zinc-500 border-zinc-800 bg-zinc-900',
    }
  }

  const diff = daysUntil(task.due_date)
  const overdue = 'text-[#a3282f] border-[#f0cccc] bg-[#fbeaea]'
  const soon = 'text-[#7a5f1c] border-[#e6d5a8] bg-[#f7f0dd]'
  const calm = 'text-zinc-400 border-zinc-800 bg-zinc-900'

  if (diff < 0) {
    const n = Math.abs(diff)
    return {
      text: n === 1 ? 'באיחור יום אחד' : `באיחור ${n} ימים`,
      className: overdue,
    }
  }
  if (diff === 0) return { text: 'היעד הוא היום', className: overdue }
  if (diff === 1) return { text: 'נותר יום אחד', className: soon }
  if (diff <= 3) return { text: `נותרו ${diff} ימים`, className: soon }
  return { text: `נותרו ${diff} ימים`, className: calm }
}

const isOverdue = (t: Task) =>
  !!t.due_date && t.status !== 'done' && daysUntil(t.due_date) < 0

/* -------------------------------------------------------------------------- */
/*                          Inline status change menu                         */
/* -------------------------------------------------------------------------- */

function StatusMenu({
  value,
  disabled,
  onChange,
}: {
  value: TaskStatus
  disabled: boolean
  onChange: (next: TaskStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const meta = STATUS_META[value]
  const Icon = meta.icon

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${meta.pill}`}
      >
        {disabled ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
        <span>{meta.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-44 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl z-30 p-1.5 space-y-0.5">
          {STATUS_ORDER.map((s) => {
            const m = STATUS_META[s]
            const SIcon = m.icon
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (s !== value) onChange(s)
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-right transition-colors cursor-pointer ${
                  s === value
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }`}
              >
                <SIcon className="h-3.5 w-3.5 shrink-0" />
                <span>{m.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

export default function TasksPage() {
  const supabase = createClient()
  const router = useRouter()
  const { showAlert, showConfirm, CustomDialogs } = useCustomDialogs()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all')
  const [dueFilter, setDueFilter] = useState<DueFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('due')

  /** Categories start collapsed; this holds the ids the user opened. */
  const [openCats, setOpenCats] = useState<Set<string>>(new Set())

  /** Completed tasks are folded away per category until the user opens them. */
  const [openDoneCats, setOpenDoneCats] = useState<Set<string>>(new Set())

  /** Native HTML5 drag state for category reordering. */
  const [dragCatId, setDragCatId] = useState<string | null>(null)
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null)
  const [dragHandleArmed, setDragHandleArmed] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  /** Per-row spinner so a single task's status toggle doesn't freeze the page. */
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null)

  // Category modal
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catMode, setCatMode] = useState<'create' | 'edit'>('create')
  const [catEditing, setCatEditing] = useState<TaskCategory | null>(null)
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState('gold')
  const [catSubmitting, setCatSubmitting] = useState(false)

  // Task modal
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskMode, setTaskMode] = useState<'create' | 'edit'>('create')
  const [taskEditing, setTaskEditing] = useState<Task | null>(null)
  const [taskCategoryId, setTaskCategoryId] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDetails, setTaskDetails] = useState('')
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('open')
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('normal')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskSubmitting, setTaskSubmitting] = useState(false)

  /* ----------------------------- Data loading ---------------------------- */

  /**
   * Deliberately does not raise the page-level spinner: `loading` starts true
   * for the first paint, and every later refetch is already covered by a
   * row-level or modal-level busy state.
   */
  const fetchAll = async () => {
    try {
      const [catRes, taskRes] = await Promise.all([
        supabase
          .from('task_categories')
          .select('*')
          .order('position', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      ])

      if (catRes.error) throw catRes.error
      if (taskRes.error) throw taskRes.error

      setCategories(catRes.data || [])
      setTasks(taskRes.data || [])
      setError(null)
    } catch (err: unknown) {
      console.error('Error loading tasks:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת המשימות')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  /* -------------------------------- Stats -------------------------------- */

  const stats = useMemo(() => {
    const by = (s: TaskStatus) => tasks.filter((t) => t.status === s).length
    return {
      total: tasks.length,
      open: by('open'),
      in_progress: by('in_progress'),
      waiting: by('waiting'),
      done: by('done'),
      overdue: tasks.filter(isOverdue).length,
    }
  }, [tasks])

  /* ------------------------------- Filtering ----------------------------- */

  const matchesDueFilter = (t: Task): boolean => {
    if (dueFilter === 'all') return true
    if (dueFilter === 'none') return !t.due_date
    if (!t.due_date) return false

    const diff = daysUntil(t.due_date)
    if (dueFilter === 'overdue') return t.status !== 'done' && diff < 0
    if (dueFilter === 'today') return diff === 0
    // 'week': anything already due or falling within the next 7 days.
    return diff <= 7
  }

  const filtersActive =
    searchTerm.trim() !== '' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    dueFilter !== 'all'

  const visibleTasks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      if (!matchesDueFilter(t)) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        (t.details ? t.details.toLowerCase().includes(q) : false)
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, searchTerm, statusFilter, priorityFilter, dueFilter])

  /** Undated tasks always sink below dated ones when sorting by deadline. */
  const byDueDate = (a: Task, b: Task) => {
    if (a.due_date && b.due_date) {
      return parseDateOnly(a.due_date).getTime() - parseDateOnly(b.due_date).getTime()
    }
    if (a.due_date) return -1
    if (b.due_date) return 1
    return 0
  }

  const byCreatedDesc = (a: Task, b: Task) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

  const byPriority = (a: Task, b: Task) =>
    PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]

  /**
   * Completed tasks live in their own bucket so every category can fold them
   * away, and both buckets share the active sort (deadline, then priority).
   */
  const tasksByCategory = useMemo(() => {
    const map = new Map<string, { active: Task[]; done: Task[] }>()
    for (const c of categories) map.set(c.id, { active: [], done: [] })

    for (const t of visibleTasks) {
      const bucket = map.get(t.category_id)
      if (!bucket) continue
      if (t.status === 'done') bucket.done.push(t)
      else bucket.active.push(t)
    }

    const comparators: Record<SortMode, ((a: Task, b: Task) => number)[]> = {
      due: [byDueDate, byPriority, byCreatedDesc],
      priority: [byPriority, byDueDate, byCreatedDesc],
      created: [byCreatedDesc, byPriority],
    }

    const sortTasks = (a: Task, b: Task) => {
      for (const cmp of comparators[sortMode]) {
        const r = cmp(a, b)
        if (r !== 0) return r
      }
      return 0
    }

    for (const bucket of map.values()) {
      bucket.active.sort(sortTasks)
      bucket.done.sort(sortTasks)
    }
    return map
  }, [categories, visibleTasks, sortMode])

  /* ---------------------------- Category actions ------------------------- */

  const toggleCat = (id: string) => {
    setOpenCats((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleDoneCat = (id: string) => {
    setOpenDoneCats((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allOpen = categories.length > 0 && categories.every((c) => openCats.has(c.id))
  const toggleAllCats = () =>
    setOpenCats(allOpen ? new Set() : new Set(categories.map((c) => c.id)))

  /**
   * Writes the new order to `position` for every category whose index moved.
   * Persisting to the DB is what makes the order shared across all users.
   */
  const persistOrder = async (ordered: TaskCategory[]) => {
    const changed = ordered
      .map((c, index) => ({ c, index }))
      .filter(({ c, index }) => c.position !== index)

    if (changed.length === 0) return

    // Optimistic: the list is already reordered locally, so paint it now.
    setCategories(ordered.map((c, index) => ({ ...c, position: index })))

    try {
      setReordering(true)
      const results = await Promise.all(
        changed.map(({ c, index }) =>
          supabase.from('task_categories').update({ position: index }).eq('id', c.id)
        )
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error

      await fetchAll()
      router.refresh()
    } catch (err: unknown) {
      console.error('Error reordering categories:', err)
      showAlert(
        err instanceof Error ? err.message : 'שגיאה בשמירת סדר הקטגוריות',
        'שגיאה',
        'error'
      )
      // Roll the optimistic paint back to whatever the server actually holds.
      await fetchAll()
    } finally {
      setReordering(false)
    }
  }

  const moveCategory = (id: string, direction: -1 | 1) => {
    const from = categories.findIndex((c) => c.id === id)
    const to = from + direction
    if (from === -1 || to < 0 || to >= categories.length) return

    const next = [...categories]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    persistOrder(next)
  }

  const handleDrop = (targetId: string) => {
    const sourceId = dragCatId
    setDragCatId(null)
    setDragOverCatId(null)
    setDragHandleArmed(null)
    if (!sourceId || sourceId === targetId) return

    const from = categories.findIndex((c) => c.id === sourceId)
    const to = categories.findIndex((c) => c.id === targetId)
    if (from === -1 || to === -1) return

    const next = [...categories]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    persistOrder(next)
  }

  const openCreateCategory = () => {
    setCatMode('create')
    setCatEditing(null)
    setCatName('')
    setCatColor('gold')
    setCatModalOpen(true)
  }

  const openEditCategory = (c: TaskCategory) => {
    setCatMode('edit')
    setCatEditing(c)
    setCatName(c.name)
    setCatColor(c.color)
    setCatModalOpen(true)
  }

  const submitCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = catName.trim()
    if (!name) {
      showAlert('יש להזין שם לקטגוריה', 'שדה חסר', 'error')
      return
    }

    try {
      setCatSubmitting(true)
      if (catMode === 'create') {
        const nextPosition =
          categories.reduce((max, c) => Math.max(max, c.position), -1) + 1
        const { error: insErr } = await supabase
          .from('task_categories')
          .insert({ name, color: catColor, position: nextPosition })
        if (insErr) throw insErr
      } else if (catEditing) {
        const { error: updErr } = await supabase
          .from('task_categories')
          .update({ name, color: catColor })
          .eq('id', catEditing.id)
        if (updErr) throw updErr
      }

      setCatModalOpen(false)
      await fetchAll()
      router.refresh()
    } catch (err: unknown) {
      console.error('Error saving category:', err)
      showAlert(
        err instanceof Error ? err.message : 'שגיאה בשמירת הקטגוריה',
        'שגיאה',
        'error'
      )
    } finally {
      setCatSubmitting(false)
    }
  }

  const deleteCategory = (c: TaskCategory) => {
    const count = tasks.filter((t) => t.category_id === c.id).length
    const message = count
      ? `מחיקת הקטגוריה "${c.name}" תמחק גם ${count} משימות שבתוכה. הפעולה אינה הפיכה.`
      : `למחוק את הקטגוריה "${c.name}"?`

    showConfirm(message, async () => {
      try {
        setBusyCategoryId(c.id)
        const { error: delErr } = await supabase
          .from('task_categories')
          .delete()
          .eq('id', c.id)
        if (delErr) throw delErr
        await fetchAll()
        router.refresh()
      } catch (err: unknown) {
        console.error('Error deleting category:', err)
        showAlert(
          err instanceof Error ? err.message : 'שגיאה במחיקת הקטגוריה',
          'שגיאה',
          'error'
        )
      } finally {
        setBusyCategoryId(null)
      }
    })
  }

  /* ------------------------------ Task actions --------------------------- */

  const openCreateTask = (categoryId?: string) => {
    setTaskMode('create')
    setTaskEditing(null)
    setTaskCategoryId(categoryId ?? categories[0]?.id ?? '')
    setTaskTitle('')
    setTaskDetails('')
    setTaskStatus('open')
    setTaskPriority('normal')
    setTaskDueDate('')
    setTaskModalOpen(true)
  }

  const openEditTask = (t: Task) => {
    setTaskMode('edit')
    setTaskEditing(t)
    setTaskCategoryId(t.category_id)
    setTaskTitle(t.title)
    setTaskDetails(t.details ?? '')
    setTaskStatus(t.status)
    setTaskPriority(t.priority)
    setTaskDueDate(t.due_date ?? '')
    setTaskModalOpen(true)
  }

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const title = taskTitle.trim()
    if (!title) {
      showAlert('יש להזין כותרת למשימה', 'שדה חסר', 'error')
      return
    }
    if (!taskCategoryId) {
      showAlert('יש לבחור קטגוריה למשימה', 'שדה חסר', 'error')
      return
    }

    const payload = {
      category_id: taskCategoryId,
      title,
      details: taskDetails.trim() || null,
      status: taskStatus,
      priority: taskPriority,
      due_date: taskDueDate || null,
      // Stamp the completion moment only on the transition into 'done'.
      completed_at:
        taskStatus === 'done'
          ? taskEditing?.completed_at ?? new Date().toISOString()
          : null,
    }

    try {
      setTaskSubmitting(true)
      if (taskMode === 'create') {
        const { error: insErr } = await supabase.from('tasks').insert(payload)
        if (insErr) throw insErr
      } else if (taskEditing) {
        const { error: updErr } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', taskEditing.id)
        if (updErr) throw updErr
      }

      setTaskModalOpen(false)
      await fetchAll()
      router.refresh()
    } catch (err: unknown) {
      console.error('Error saving task:', err)
      showAlert(
        err instanceof Error ? err.message : 'שגיאה בשמירת המשימה',
        'שגיאה',
        'error'
      )
    } finally {
      setTaskSubmitting(false)
    }
  }

  const changeStatus = async (task: Task, next: TaskStatus) => {
    try {
      setBusyTaskId(task.id)
      const { error: updErr } = await supabase
        .from('tasks')
        .update({
          status: next,
          completed_at:
            next === 'done' ? task.completed_at ?? new Date().toISOString() : null,
        })
        .eq('id', task.id)
      if (updErr) throw updErr
      await fetchAll()
      router.refresh()
    } catch (err: unknown) {
      console.error('Error updating status:', err)
      showAlert(
        err instanceof Error ? err.message : 'שגיאה בעדכון סטטוס המשימה',
        'שגיאה',
        'error'
      )
    } finally {
      setBusyTaskId(null)
    }
  }

  const deleteTask = (t: Task) => {
    showConfirm(`למחוק את המשימה "${t.title}"?`, async () => {
      try {
        setBusyTaskId(t.id)
        const { error: delErr } = await supabase.from('tasks').delete().eq('id', t.id)
        if (delErr) throw delErr
        await fetchAll()
        router.refresh()
      } catch (err: unknown) {
        console.error('Error deleting task:', err)
        showAlert(
          err instanceof Error ? err.message : 'שגיאה במחיקת המשימה',
          'שגיאה',
          'error'
        )
      } finally {
        setBusyTaskId(null)
      }
    })
  }

  const anyBusy =
    catSubmitting || taskSubmitting || reordering || !!busyTaskId || !!busyCategoryId

  /* -------------------------------- Render ------------------------------- */

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3" dir="rtl">
        <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
        <p className="text-xs font-bold text-zinc-500">טוען משימות...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <CustomDialogs />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <ListTodo className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-100 leading-tight">ניהול משימות</h1>
            <p className="text-xs text-zinc-500 font-semibold mt-0.5">
              קטגוריות, מעקב דד-ליין וסטטוס ביצוע
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <PushToggle
            onError={(m) => showAlert(m, 'התראות', 'error')}
            onInfo={(m) => showAlert(m, 'התראות', 'success')}
          />
          <button
            onClick={openCreateCategory}
            disabled={anyBusy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-amber-500 bg-amber-500/5 border border-amber-500/25 hover:bg-amber-500/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FolderPlus className="h-4 w-4" />
            קטגוריה חדשה
          </button>
          <button
            onClick={() => openCreateTask()}
            disabled={anyBusy || categories.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-pure-white hover:bg-amber-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Plus className="h-4 w-4" />
            משימה חדשה
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs font-bold">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="סה״כ משימות" value={stats.total} accent="#2f3e30" />
        <StatCard label="פתוח" value={stats.open} accent="#5f6f60" />
        <StatCard label="בביצוע" value={stats.in_progress} accent="#8a6a20" />
        <StatCard label="ממתין לצד ג׳" value={stats.waiting} accent="#9a4f1c" />
        <StatCard label="בוצע" value={stats.done} accent="#3f6b3f" />
        <StatCard label="באיחור" value={stats.overdue} accent="#a3282f" />
      </div>

      {/* Filters */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חיפוש לפי כותרת או פרטים..."
              disabled={anyBusy}
              className="w-full pr-10 pl-4 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-semibold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all disabled:opacity-50"
            />
          </div>
          <div className="w-full sm:w-52 shrink-0">
            <CustomSelect
              options={SORT_OPTIONS}
              value={sortMode}
              onChange={(v) => setSortMode(v as SortMode)}
              disabled={anyBusy}
              isSearchable={false}
            />
          </div>
        </div>

        <FilterRow label="סטטוס">
          <FilterChip
            label="הכל"
            active={statusFilter === 'all'}
            disabled={anyBusy}
            onClick={() => setStatusFilter('all')}
          />
          {STATUS_ORDER.map((s) => (
            <FilterChip
              key={s}
              label={STATUS_META[s].label}
              active={statusFilter === s}
              disabled={anyBusy}
              onClick={() => setStatusFilter(s)}
            />
          ))}
        </FilterRow>

        <FilterRow label="עדיפות">
          <FilterChip
            label="הכל"
            active={priorityFilter === 'all'}
            disabled={anyBusy}
            onClick={() => setPriorityFilter('all')}
          />
          {PRIORITY_ORDER.map((p) => (
            <FilterChip
              key={p}
              label={PRIORITY_META[p].label.replace('עדיפות ', '')}
              active={priorityFilter === p}
              disabled={anyBusy}
              onClick={() => setPriorityFilter(p)}
            />
          ))}
        </FilterRow>

        <FilterRow label="תאריך יעד">
          {DUE_FILTERS.map((d) => (
            <FilterChip
              key={d.value}
              label={d.label}
              active={dueFilter === d.value}
              disabled={anyBusy}
              onClick={() => setDueFilter(d.value)}
            />
          ))}
        </FilterRow>
      </div>

      {/* Empty: no categories at all */}
      {categories.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title="אין עדיין קטגוריות"
          body="כדי להתחיל לנהל משימות, צרו קטגוריה ראשונה — למשל ״ספקים״, ״שיווק״ או ״תפעול מטבח״."
          actionLabel="צור קטגוריה ראשונה"
          onAction={openCreateCategory}
          disabled={anyBusy}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-[11px] font-semibold text-zinc-500">
              גררו את הידית <GripVertical className="inline h-3 w-3 align-[-2px]" /> כדי לשנות
              את סדר הקטגוריות. הסדר נשמר ומשותף לכל המשתמשים.
            </p>
            <button
              onClick={toggleAllCats}
              disabled={anyBusy}
              className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 border border-zinc-900 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {allOpen ? 'סגור הכל' : 'פתח הכל'}
            </button>
          </div>

          {categories.map((cat, index) => {
            const bucket = tasksByCategory.get(cat.id) ?? { active: [], done: [] }
            const activeTasks = bucket.active
            const doneTasks = bucket.done
            const totalInCat = tasks.filter((t) => t.category_id === cat.id).length
            const doneInCat = tasks.filter(
              (t) => t.category_id === cat.id && t.status === 'done'
            ).length
            const busy = busyCategoryId === cat.id
            const hex = colorHex(cat.color)
            // An active filter force-opens every category, otherwise matching
            // tasks would stay hidden behind a collapsed header.
            const isOpen = filtersActive || openCats.has(cat.id)
            // Filtering to 'done' would otherwise land on an empty-looking card.
            const doneOpen = statusFilter === 'done' || openDoneCats.has(cat.id)
            const isDragging = dragCatId === cat.id
            const isDropTarget = dragOverCatId === cat.id && dragCatId !== cat.id

            return (
              <section
                key={cat.id}
                draggable={dragHandleArmed === cat.id}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  setDragCatId(cat.id)
                }}
                onDragEnd={() => {
                  setDragCatId(null)
                  setDragOverCatId(null)
                  setDragHandleArmed(null)
                }}
                onDragOver={(e) => {
                  if (!dragCatId) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragOverCatId !== cat.id) setDragOverCatId(cat.id)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(cat.id)
                }}
                className={`bg-zinc-950 border rounded-2xl overflow-hidden transition-all ${
                  isDragging ? 'opacity-40' : ''
                } ${
                  isDropTarget
                    ? 'border-amber-500 ring-2 ring-amber-500/30'
                    : 'border-zinc-900'
                }`}
              >
                {/* Category header */}
                <header
                  className={`flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4 py-3.5 ${
                    isOpen ? 'border-b border-zinc-900' : ''
                  }`}
                  style={{ borderRightWidth: 3, borderRightColor: hex }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {/* Arming the handle on pointer-down keeps the header's
                        buttons clickable while still allowing native drag. */}
                    <span
                      onMouseDown={() => !anyBusy && setDragHandleArmed(cat.id)}
                      onMouseUp={() => setDragHandleArmed(null)}
                      title="גרור לשינוי הסדר"
                      className={`p-1 -mr-1 rounded text-zinc-650 hover:text-zinc-400 shrink-0 ${
                        anyBusy ? 'opacity-40' : 'cursor-grab active:cursor-grabbing'
                      }`}
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>

                    {/* Touch fallback: dragging is unavailable on mobile. */}
                    <div className="flex flex-col shrink-0">
                      <button
                        onClick={() => moveCategory(cat.id, -1)}
                        disabled={anyBusy || index === 0}
                        title="הזז למעלה"
                        className="p-0.5 rounded text-zinc-650 hover:text-amber-500 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => moveCategory(cat.id, 1)}
                        disabled={anyBusy || index === categories.length - 1}
                        title="הזז למטה"
                        className="p-0.5 rounded text-zinc-650 hover:text-amber-500 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => toggleCat(cat.id)}
                      disabled={filtersActive}
                      title={filtersActive ? 'סינון פעיל — כל הקטגוריות פתוחות' : 'הצג/הסתר משימות'}
                      className="flex items-center gap-2.5 min-w-0 mr-1 rounded-lg px-1 py-0.5 hover:bg-zinc-900 transition-colors cursor-pointer disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
                          isOpen ? '' : 'rotate-90'
                        }`}
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                      <h2 className="text-sm font-black text-zinc-100 truncate">{cat.name}</h2>
                      <span className="text-[11px] font-bold text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-0.5 shrink-0">
                        {doneInCat}/{totalInCat}
                      </span>
                      {!isOpen && activeTasks.some(isOverdue) && (
                        <span className="text-[10px] font-black text-[#a3282f] bg-[#fbeaea] border border-[#f0cccc] rounded-md px-2 py-0.5 shrink-0">
                          באיחור
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openCreateTask(cat.id)}
                      disabled={anyBusy}
                      title="הוסף משימה לקטגוריה"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      משימה
                    </button>
                    <button
                      onClick={() => openEditCategory(cat)}
                      disabled={anyBusy}
                      title="ערוך קטגוריה"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteCategory(cat)}
                      disabled={anyBusy}
                      title="מחק קטגוריה"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </header>

                {/* Tasks — collapsed by default */}
                {!isOpen ? null : activeTasks.length === 0 && doneTasks.length === 0 ? (
                  <p className="px-5 py-8 text-center text-xs font-semibold text-zinc-500">
                    {totalInCat === 0
                      ? 'אין משימות בקטגוריה זו עדיין.'
                      : 'אין משימות התואמות את הסינון הנוכחי.'}
                  </p>
                ) : (
                  <>
                    {activeTasks.length > 0 && (
                      <ul className="divide-y divide-zinc-900">
                        {activeTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            rowBusy={busyTaskId === task.id}
                            anyBusy={anyBusy}
                            onStatusChange={(next) => changeStatus(task, next)}
                            onEdit={() => openEditTask(task)}
                            onDelete={() => deleteTask(task)}
                          />
                        ))}
                      </ul>
                    )}

                    {activeTasks.length === 0 && (
                      <p className="px-5 py-8 text-center text-xs font-semibold text-[#3f6b3f]">
                        כל המשימות בקטגוריה זו בוצעו.
                      </p>
                    )}

                    {/* Completed tasks — folded away until opened */}
                    {doneTasks.length > 0 && (
                      <div className={activeTasks.length > 0 ? 'border-t border-zinc-900' : ''}>
                        <button
                          type="button"
                          onClick={() => toggleDoneCat(cat.id)}
                          className="w-full flex items-center gap-2 px-4 sm:px-5 py-3 text-right hover:bg-zinc-900/40 transition-colors cursor-pointer"
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${
                              doneOpen ? '' : 'rotate-90'
                            }`}
                          />
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3f6b3f]" />
                          <span className="text-[11px] font-black text-zinc-400">
                            משימות שבוצעו ({doneTasks.length})
                          </span>
                          <span className="text-[10px] font-semibold text-zinc-600 mr-auto ml-0">
                            {doneOpen ? 'הסתר' : 'הצג'}
                          </span>
                        </button>

                        {doneOpen && (
                          <ul className="divide-y divide-zinc-900 border-t border-zinc-900">
                            {doneTasks.map((task) => (
                              <TaskRow
                                key={task.id}
                                task={task}
                                rowBusy={busyTaskId === task.id}
                                anyBusy={anyBusy}
                                onStatusChange={(next) => changeStatus(task, next)}
                                onEdit={() => openEditTask(task)}
                                onDelete={() => deleteTask(task)}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            )
          })}

          {/* Nothing matched the filter anywhere */}
          {visibleTasks.length === 0 && tasks.length > 0 && (
            <EmptyState
              icon={Inbox}
              title="לא נמצאו משימות"
              body="נסו לשנות את מונח החיפוש או את סינון הסטטוס."
            />
          )}
        </div>
      )}

      {/* ------------------------------ Category modal ----------------------- */}
      {catModalOpen && (
        <Modal
          title={catMode === 'create' ? 'קטגוריה חדשה' : 'עריכת קטגוריה'}
          onClose={() => !catSubmitting && setCatModalOpen(false)}
          closeDisabled={catSubmitting}
        >
          <form onSubmit={submitCategory} className="space-y-4">
            <Field label="שם הקטגוריה">
              <input
                type="text"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                disabled={catSubmitting}
                autoFocus
                placeholder="לדוגמה: ספקים, שיווק, תפעול"
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-semibold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all disabled:opacity-50"
              />
            </Field>

            <Field label="צבע מזהה">
              <div className="flex items-center gap-2 flex-wrap">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    disabled={catSubmitting}
                    onClick={() => setCatColor(c.value)}
                    title={c.label}
                    className={`h-8 w-8 rounded-lg border-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      catColor === c.value
                        ? 'border-zinc-100 scale-110'
                        : 'border-zinc-800 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </Field>

            <ModalActions
              submitting={catSubmitting}
              submitLabel={catMode === 'create' ? 'צור קטגוריה' : 'שמור שינויים'}
              onCancel={() => setCatModalOpen(false)}
            />
          </form>
        </Modal>
      )}

      {/* -------------------------------- Task modal ------------------------- */}
      {taskModalOpen && (
        <Modal
          title={taskMode === 'create' ? 'משימה חדשה' : 'עריכת משימה'}
          onClose={() => !taskSubmitting && setTaskModalOpen(false)}
          closeDisabled={taskSubmitting}
        >
          <form onSubmit={submitTask} className="space-y-4">
            <Field label="כותרת המשימה">
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                disabled={taskSubmitting}
                autoFocus
                placeholder="מה צריך לעשות?"
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-semibold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all disabled:opacity-50"
              />
            </Field>

            <Field label="פרטים (אופציונלי)">
              <textarea
                value={taskDetails}
                onChange={(e) => setTaskDetails(e.target.value)}
                disabled={taskSubmitting}
                rows={3}
                placeholder="הערות, אנשי קשר, קישורים..."
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-semibold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all resize-none disabled:opacity-50"
              />
            </Field>

            <Field label="קטגוריה">
              <CustomSelect
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                value={taskCategoryId}
                onChange={setTaskCategoryId}
                disabled={taskSubmitting}
                isSearchable={categories.length > 6}
                placeholder="בחר קטגוריה..."
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="סטטוס">
                <CustomSelect
                  options={STATUS_ORDER.map((s) => ({
                    value: s,
                    label: STATUS_META[s].label,
                  }))}
                  value={taskStatus}
                  onChange={(v) => setTaskStatus(v as TaskStatus)}
                  disabled={taskSubmitting}
                  isSearchable={false}
                />
              </Field>

              <Field label="עדיפות">
                <CustomSelect
                  options={[
                    { value: 'high', label: 'גבוהה' },
                    { value: 'normal', label: 'רגילה' },
                    { value: 'low', label: 'נמוכה' },
                  ]}
                  value={taskPriority}
                  onChange={(v) => setTaskPriority(v as TaskPriority)}
                  disabled={taskSubmitting}
                  isSearchable={false}
                />
              </Field>
            </div>

            <Field label="תאריך יעד (דד-ליין)">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={taskDueDate}
                  min={taskMode === 'create' ? todayInputValue() : undefined}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  disabled={taskSubmitting}
                  className="flex-1 px-4 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-semibold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all disabled:opacity-50"
                />
                {taskDueDate && (
                  <button
                    type="button"
                    onClick={() => setTaskDueDate('')}
                    disabled={taskSubmitting}
                    className="px-3 py-2.5 rounded-xl text-[11px] font-bold text-zinc-500 border border-zinc-900 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    נקה
                  </button>
                )}
              </div>
            </Field>

            <ModalActions
              submitting={taskSubmitting}
              submitLabel={taskMode === 'create' ? 'צור משימה' : 'שמור שינויים'}
              onCancel={() => setTaskModalOpen(false)}
            />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Small UI helpers                              */
/* -------------------------------------------------------------------------- */

/** One task line — shared by the active list and the folded 'done' list. */
function TaskRow({
  task,
  rowBusy,
  anyBusy,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  task: Task
  rowBusy: boolean
  anyBusy: boolean
  onStatusChange: (next: TaskStatus) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const deadline = deadlineInfo(task)
  const done = task.status === 'done'

  return (
    <li
      className={`px-4 sm:px-5 py-4 transition-colors hover:bg-zinc-900/40 ${
        rowBusy ? 'opacity-60' : ''
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-3">
        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className={`text-sm font-bold leading-snug ${
                done
                  ? 'text-zinc-500 line-through'
                  : 'text-zinc-100'
              }`}
            >
              {task.title}
            </h3>
            {task.priority !== 'normal' && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black ${
                  PRIORITY_META[task.priority].pill
                }`}
              >
                <Flag className="h-2.5 w-2.5" />
                {PRIORITY_META[task.priority].label}
              </span>
            )}
          </div>

          {task.details && (
            <p className="mt-1 text-xs text-zinc-400 font-medium leading-relaxed whitespace-pre-line">
              {task.details}
            </p>
          )}

          {/* Tracking line */}
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
              <CalendarPlus className="h-3 w-3" />
              נפתחה: {formatTimestamp(task.created_at)}
            </span>

            {deadline ? (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold ${deadline.className}`}
              >
                <CalendarClock className="h-3 w-3" />
                {task.due_date && !done
                  ? `${formatDateOnly(task.due_date)} · ${deadline.text}`
                  : deadline.text}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
                <CalendarClock className="h-3 w-3" />
                ללא דד-ליין
              </span>
            )}

            {done && task.completed_at && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#3f6b3f]">
                <CheckCircle2 className="h-3 w-3" />
                הושלמה: {formatTimestamp(task.completed_at)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusMenu
            value={task.status}
            disabled={anyBusy}
            onChange={onStatusChange}
          />
          <button
            onClick={onEdit}
            disabled={anyBusy}
            title="ערוך משימה"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            disabled={anyBusy}
            title="מחק משימה"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-3.5">
      <p className="text-[11px] font-bold text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-black leading-none" style={{ color: accent }}>
        {value}
      </p>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-black text-zinc-500 w-20 shrink-0">{label}</span>
      {children}
    </div>
  )
}

function FilterChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
          : 'bg-zinc-950 text-zinc-500 border-zinc-900 hover:text-zinc-100 hover:border-zinc-800'
      }`}
    >
      {label}
    </button>
  )
}

function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  disabled,
}: {
  icon: typeof Inbox
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
  disabled?: boolean
}) {
  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl px-6 py-14 flex flex-col items-center text-center">
      <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-amber-500" />
      </div>
      <h3 className="text-sm font-black text-zinc-100 mb-1.5">{title}</h3>
      <p className="text-xs text-zinc-400 font-medium max-w-md leading-relaxed">{body}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          disabled={disabled}
          className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-pure-white hover:bg-amber-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-black text-zinc-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Modal({
  title,
  onClose,
  closeDisabled,
  children,
}: {
  title: string
  onClose: () => void
  closeDisabled: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      dir="rtl"
    >
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 max-w-lg w-full relative shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-black text-zinc-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="p-1.5 rounded-full bg-zinc-900 text-zinc-500 hover:text-zinc-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalActions({
  submitting,
  submitLabel,
  onCancel,
}: {
  submitting: boolean
  submitLabel: string
  onCancel: () => void
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <button
        type="submit"
        disabled={submitting}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-pure-white hover:bg-amber-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? 'שומר...' : submitLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-400 border border-zinc-900 hover:bg-zinc-900 hover:text-zinc-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ביטול
      </button>
    </div>
  )
}
