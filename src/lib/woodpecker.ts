/**
 * El método en código.
 *
 * Reglas que implementamos (Smith & Tikkanen, "The Woodpecker Method"):
 *  1. Se elige un set FIJO de puzzles (100–1000+) y no se cambia nunca.
 *  2. Ciclo 1: resolver el set entero en ~4 semanas, cronometrando el tiempo total.
 *  3. Cada ciclo siguiente dispone de la MITAD de días que el anterior
 *     (redondeando hacia arriba): 28 → 14 → 7 → 4 → 2 → 1 → 1.
 *  4. Se repiten los MISMOS puzzles, en el mismo orden, hasta 7 ciclos.
 *  5. El método termina cuando se completa el set entero en un solo día
 *     (o al acabar el 7.º ciclo).
 */

import type { Attempt, Cycle, Plan, PuzzleSet } from '../types'
import { uid } from './id'

export const MAX_CYCLES = 7
export const DAY_MS = 86_400_000

/** Longitudes de ciclo por defecto (en días), derivadas por mitades. */
export function cycleSchedule(firstCycleDays = 28, cycles = MAX_CYCLES): number[] {
  const out: number[] = []
  let days = Math.max(1, Math.round(firstCycleDays))
  for (let i = 0; i < cycles; i++) {
    out.push(days)
    days = Math.max(1, Math.ceil(days / 2))
  }
  return out
}

export function todayISO(d: Date = new Date()): string {
  const tzOffset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10)
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(iso: string, days: number): string {
  const d = isoToDate(iso)
  d.setDate(d.getDate() + days)
  return todayISO(d)
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((isoToDate(toISO).getTime() - isoToDate(fromISO).getTime()) / DAY_MS)
}

function shuffled<T>(items: T[]): T[] {
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function makeCycle(index: number, plannedDays: number, order: string[]): Cycle {
  return {
    index,
    plannedDays,
    status: index === 0 ? 'active' : 'pending',
    startedAt: index === 0 ? Date.now() : undefined,
    order,
    cursor: 0,
    totalMs: 0,
    correct: 0,
    solved: 0,
    activeDays: [],
  }
}

export interface CreatePlanOptions {
  name: string
  set: PuzzleSet
  firstCycleDays?: number
  shuffleEachCycle?: boolean
  /** Mezclar ya el primer ciclo (por defecto se respeta el orden del set). */
  shuffleFirst?: boolean
  startDate?: string
}

export function createPlan(opts: CreatePlanOptions): Plan {
  const cycleDays = cycleSchedule(opts.firstCycleDays ?? 28)
  const ids = opts.set.puzzles.map((p) => p.id)
  const order = opts.shuffleFirst ? shuffled(ids) : ids
  return {
    id: uid('plan'),
    name: opts.name,
    setId: opts.set.id,
    createdAt: Date.now(),
    startDate: opts.startDate ?? todayISO(),
    cycleDays,
    cycles: [makeCycle(0, cycleDays[0], order)],
    currentCycle: 0,
    status: 'active',
    shuffleEachCycle: opts.shuffleEachCycle ?? false,
  }
}

export function currentCycle(plan: Plan): Cycle {
  return plan.cycles[plan.currentCycle]
}

export function cycleRemaining(cycle: Cycle): number {
  return Math.max(0, cycle.order.length - cycle.cursor)
}

/** Fecha límite planificada del ciclo (inicio real + días asignados). */
export function cycleDeadline(cycle: Cycle): string {
  const start = cycle.startedAt ? todayISO(new Date(cycle.startedAt)) : todayISO()
  return addDays(start, cycle.plannedDays)
}

/** Días que quedan hasta la fecha límite (mínimo 1: hoy). */
export function daysLeft(cycle: Cycle, today = todayISO()): number {
  return Math.max(1, daysBetween(today, cycleDeadline(cycle)))
}

/**
 * Cuota diaria: lo que queda repartido entre los días que quedan.
 * Es la cifra que mantiene el ciclo dentro de plazo.
 */
export function dailyQuota(cycle: Cycle, today = todayISO()): number {
  const remaining = cycleRemaining(cycle)
  if (remaining === 0) return 0
  return Math.ceil(remaining / daysLeft(cycle, today))
}

/** Puzzles ya resueltos hoy dentro del ciclo. */
export function solvedToday(attempts: Attempt[], planId: string, cycle: number, today = todayISO()): number {
  return attempts.filter(
    (a) => a.planId === planId && a.cycle === cycle && todayISO(new Date(a.ts)) === today,
  ).length
}

/** ¿Se ha completado el ciclo entero en un único día? Criterio de fin del método. */
export function finishedInOneDay(cycle: Cycle): boolean {
  return cycle.status === 'done' && cycle.activeDays.length === 1 && cycle.order.length > 0
}

export interface CycleStats {
  index: number
  plannedDays: number
  status: Cycle['status']
  total: number
  solved: number
  correct: number
  accuracy: number
  totalMs: number
  avgMs: number
  days: number
  /** Cuántas veces más rápido que el ciclo 1 (0 si no aplica). */
  speedup: number
}

export function cycleStats(plan: Plan): CycleStats[] {
  const base = plan.cycles[0]?.totalMs ?? 0
  return plan.cycles.map((c) => ({
    index: c.index,
    plannedDays: c.plannedDays,
    status: c.status,
    total: c.order.length,
    solved: c.solved,
    correct: c.correct,
    accuracy: c.solved ? c.correct / c.solved : 0,
    totalMs: c.totalMs,
    avgMs: c.solved ? c.totalMs / c.solved : 0,
    days: c.activeDays.length,
    speedup: c.index > 0 && c.totalMs > 0 && base > 0 ? base / c.totalMs : 0,
  }))
}

/**
 * Cierra el ciclo actual y prepara el siguiente.
 * Devuelve el plan actualizado (inmutable) y si el método ha terminado.
 */
export function advanceCycle(plan: Plan): { plan: Plan; finished: boolean } {
  const cycles = plan.cycles.slice()
  const done = { ...cycles[plan.currentCycle], status: 'done' as const, finishedAt: Date.now() }
  cycles[plan.currentCycle] = done

  const oneDay = finishedInOneDay(done)
  const isLast = plan.currentCycle >= MAX_CYCLES - 1
  if (oneDay || isLast) {
    return { plan: { ...plan, cycles, status: 'finished', finishedAt: Date.now() }, finished: true }
  }

  const nextIndex = plan.currentCycle + 1
  const order = plan.shuffleEachCycle ? shuffled(done.order) : done.order.slice()
  const next: Cycle = {
    ...makeCycle(nextIndex, plan.cycleDays[nextIndex] ?? 1, order),
    status: 'active',
    startedAt: Date.now(),
  }
  cycles.push(next)
  return { plan: { ...plan, cycles, currentCycle: nextIndex }, finished: false }
}

/** Puzzles que se han fallado más veces a lo largo del plan. */
export function troubleSpots(attempts: Attempt[], planId: string): { puzzleId: string; fails: number; tries: number }[] {
  const map = new Map<string, { fails: number; tries: number }>()
  for (const a of attempts) {
    if (a.planId !== planId) continue
    const entry = map.get(a.puzzleId) ?? { fails: 0, tries: 0 }
    entry.tries++
    if (!a.correct) entry.fails++
    map.set(a.puzzleId, entry)
  }
  return [...map.entries()]
    .map(([puzzleId, v]) => ({ puzzleId, ...v }))
    .filter((x) => x.fails > 0)
    .sort((a, b) => b.fails - a.fails || b.tries - a.tries)
}
