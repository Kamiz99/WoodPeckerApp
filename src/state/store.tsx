import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { Attempt, Plan, Puzzle, PuzzleSet, Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { db } from '../lib/db'
import { uid } from '../lib/id'
import { advanceCycle as advance, todayISO } from '../lib/woodpecker'

interface State {
  ready: boolean
  sets: PuzzleSet[]
  plans: Plan[]
  attempts: Attempt[]
  settings: Settings
  activePlanId: string | null
  /** Aviso efímero para la interfaz. */
  toast: { text: string; kind: 'ok' | 'info' | 'warn' } | null
}

type Action =
  | { type: 'loaded'; payload: Omit<State, 'ready' | 'toast'> }
  | { type: 'sets'; payload: PuzzleSet[] }
  | { type: 'plans'; payload: Plan[] }
  | { type: 'attempts'; payload: Attempt[] }
  | { type: 'settings'; payload: Settings }
  | { type: 'activePlan'; payload: string | null }
  | { type: 'toast'; payload: State['toast'] }

const initialState: State = {
  ready: false,
  sets: [],
  plans: [],
  attempts: [],
  settings: DEFAULT_SETTINGS,
  activePlanId: null,
  toast: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded':
      return { ...state, ...action.payload, ready: true }
    case 'sets':
      return { ...state, sets: action.payload }
    case 'plans':
      return { ...state, plans: action.payload }
    case 'attempts':
      return { ...state, attempts: action.payload }
    case 'settings':
      return { ...state, settings: action.payload }
    case 'activePlan':
      return { ...state, activePlanId: action.payload }
    case 'toast':
      return { ...state, toast: action.payload }
    default:
      return state
  }
}

export interface FinishPuzzleInput {
  planId: string
  puzzleId: string
  ms: number
  correct: boolean
  gaveUp: boolean
  depth: number
}

interface Store {
  state: State
  activePlan: Plan | null
  activeSet: PuzzleSet | null
  puzzleIndex: Map<string, Puzzle>
  saveSet: (set: PuzzleSet) => Promise<void>
  deleteSet: (id: string) => Promise<void>
  savePlan: (plan: Plan) => Promise<void>
  deletePlan: (id: string) => Promise<void>
  setActivePlan: (id: string | null) => Promise<void>
  finishPuzzle: (input: FinishPuzzleInput) => Promise<{ cycleCompleted: boolean; methodFinished: boolean }>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  notify: (text: string, kind?: 'ok' | 'info' | 'warn') => void
  reload: () => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const reload = useCallback(async () => {
    const [sets, plans, attempts, settings, activePlanId, memoryOnly] = await Promise.all([
      db.getAllSets(),
      db.getAllPlans(),
      db.getAttempts(),
      db.getSettings(),
      db.getKv<string>('activePlanId'),
      db.isMemoryOnly(),
    ])
    if (memoryOnly) {
      window.setTimeout(
        () =>
          dispatch({
            type: 'toast',
            payload: {
              text: 'Este navegador no deja guardar datos: podrás entrenar, pero se perderá al cerrar.',
              kind: 'warn',
            },
          }),
        800,
      )
    }
    dispatch({
      type: 'loaded',
      payload: {
        sets,
        plans,
        attempts,
        settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) },
        activePlanId: activePlanId ?? plans.find((p) => p.status === 'active')?.id ?? null,
      },
    })
  }, [])

  useEffect(() => {
    reload().catch((e) => console.error('No se pudo cargar la base local', e))
  }, [reload])

  const notify = useCallback((text: string, kind: 'ok' | 'info' | 'warn' = 'ok') => {
    dispatch({ type: 'toast', payload: { text, kind } })
    window.setTimeout(() => dispatch({ type: 'toast', payload: null }), 3200)
  }, [])

  const saveSet = useCallback(
    async (set: PuzzleSet) => {
      await db.putSet(set)
      dispatch({ type: 'sets', payload: await db.getAllSets() })
    },
    [],
  )

  const deleteSet = useCallback(async (id: string) => {
    await db.deleteSet(id)
    dispatch({ type: 'sets', payload: await db.getAllSets() })
  }, [])

  const savePlan = useCallback(async (plan: Plan) => {
    await db.putPlan(plan)
    dispatch({ type: 'plans', payload: await db.getAllPlans() })
  }, [])

  const deletePlan = useCallback(async (id: string) => {
    await db.deletePlan(id)
    await db.deleteAttemptsOfPlan(id)
    const [plans, attempts] = await Promise.all([db.getAllPlans(), db.getAttempts()])
    dispatch({ type: 'plans', payload: plans })
    dispatch({ type: 'attempts', payload: attempts })
  }, [])

  const setActivePlan = useCallback(async (id: string | null) => {
    await db.setKv('activePlanId', id)
    dispatch({ type: 'activePlan', payload: id })
  }, [])

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...state.settings, ...patch }
      await db.putSettings(next)
      dispatch({ type: 'settings', payload: next })
    },
    [state.settings],
  )

  /**
   * Registra el resultado de un puzzle: guarda el intento, mueve el cursor del
   * ciclo y, si se ha terminado el set, cierra el ciclo y abre el siguiente.
   */
  const finishPuzzle = useCallback(
    async (input: FinishPuzzleInput) => {
      const plan = state.plans.find((p) => p.id === input.planId)
      if (!plan) return { cycleCompleted: false, methodFinished: false }

      const attempt: Attempt = {
        id: uid('att'),
        planId: plan.id,
        cycle: plan.currentCycle,
        puzzleId: input.puzzleId,
        ts: Date.now(),
        ms: input.ms,
        correct: input.correct,
        gaveUp: input.gaveUp,
        depth: input.depth,
      }

      const cycles = plan.cycles.slice()
      const cycle = { ...cycles[plan.currentCycle] }
      const today = todayISO()
      cycle.cursor = Math.min(cycle.order.length, cycle.cursor + 1)
      cycle.solved += 1
      cycle.correct += input.correct ? 1 : 0
      cycle.totalMs += input.ms
      if (!cycle.activeDays.includes(today)) cycle.activeDays = [...cycle.activeDays, today]
      cycles[plan.currentCycle] = cycle

      let nextPlan: Plan = { ...plan, cycles }
      let cycleCompleted = false
      let methodFinished = false

      if (cycle.cursor >= cycle.order.length) {
        cycleCompleted = true
        const result = advance(nextPlan)
        nextPlan = result.plan
        methodFinished = result.finished
      }

      await Promise.all([db.addAttempts([attempt]), db.putPlan(nextPlan)])
      const [plans, attempts] = await Promise.all([db.getAllPlans(), db.getAttempts()])
      dispatch({ type: 'plans', payload: plans })
      dispatch({ type: 'attempts', payload: attempts })
      return { cycleCompleted, methodFinished }
    },
    [state.plans],
  )

  const activePlan = useMemo(
    () => state.plans.find((p) => p.id === state.activePlanId) ?? null,
    [state.plans, state.activePlanId],
  )

  const activeSet = useMemo(
    () => (activePlan ? (state.sets.find((s) => s.id === activePlan.setId) ?? null) : null),
    [state.sets, activePlan],
  )

  const puzzleIndex = useMemo(() => {
    const map = new Map<string, Puzzle>()
    for (const p of activeSet?.puzzles ?? []) map.set(p.id, p)
    return map
  }, [activeSet])

  const value: Store = {
    state,
    activePlan,
    activeSet,
    puzzleIndex,
    saveSet,
    deleteSet,
    savePlan,
    deletePlan,
    setActivePlan,
    finishPuzzle,
    updateSettings,
    notify,
    reload,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>')
  return ctx
}
