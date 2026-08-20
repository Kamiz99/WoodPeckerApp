import { describe, expect, it } from 'vitest'
import {
  addDays,
  advanceCycle,
  createPlan,
  cycleSchedule,
  dailyQuota,
  daysBetween,
  finishedInOneDay,
  makeCycle,
  troubleSpots,
} from '../src/lib/woodpecker'
import type { Attempt, Cycle, PuzzleSet } from '../src/types'

const fakeSet = (n: number): PuzzleSet => ({
  id: 'set1',
  name: 'test',
  createdAt: 0,
  source: 'custom',
  puzzles: Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
    moves: ['a1a2'],
    source: 'custom' as const,
  })),
})

describe('calendario de ciclos', () => {
  it('divide los días a la mitad redondeando hacia arriba', () => {
    expect(cycleSchedule(28)).toEqual([28, 14, 7, 4, 2, 1, 1])
  })

  it('nunca baja de un día', () => {
    expect(cycleSchedule(1)).toEqual([1, 1, 1, 1, 1, 1, 1])
  })

  it('respeta otras duraciones de primer ciclo', () => {
    expect(cycleSchedule(21)).toEqual([21, 11, 6, 3, 2, 1, 1])
  })
})

describe('cuota diaria', () => {
  const cycleWith = (total: number, cursor: number, plannedDays: number, startedAt: number): Cycle => ({
    ...makeCycle(0, plannedDays, Array.from({ length: total }, (_, i) => `p${i}`)),
    cursor,
    startedAt,
  })

  it('reparte lo que queda entre los días restantes', () => {
    const cycle = cycleWith(1000, 0, 10, Date.now())
    expect(dailyQuota(cycle)).toBe(100)
  })

  it('sube el ritmo si vas retrasado', () => {
    const started = new Date()
    started.setDate(started.getDate() - 8)
    const cycle = cycleWith(1000, 100, 10, started.getTime())
    // Quedan 900 puzzles y 2 días.
    expect(dailyQuota(cycle)).toBe(450)
  })

  it('es cero cuando no queda nada', () => {
    expect(dailyQuota(cycleWith(50, 50, 5, Date.now()))).toBe(0)
  })
})

describe('avance de ciclo', () => {
  it('abre el siguiente ciclo con la mitad de días y los mismos puzzles', () => {
    const plan = createPlan({ name: 'p', set: fakeSet(10), firstCycleDays: 28 })
    plan.cycles[0].cursor = 10
    plan.cycles[0].activeDays = ['2026-01-01', '2026-01-02']
    const { plan: next, finished } = advanceCycle(plan)
    expect(finished).toBe(false)
    expect(next.currentCycle).toBe(1)
    expect(next.cycles[0].status).toBe('done')
    expect(next.cycles[1].plannedDays).toBe(14)
    expect(next.cycles[1].order).toEqual(next.cycles[0].order)
    expect(next.cycles[1].cursor).toBe(0)
  })

  it('termina el método si se completa el set en un solo día', () => {
    const plan = createPlan({ name: 'p', set: fakeSet(10) })
    plan.cycles[0].cursor = 10
    plan.cycles[0].activeDays = ['2026-01-01']
    const { plan: next, finished } = advanceCycle(plan)
    expect(finished).toBe(true)
    expect(next.status).toBe('finished')
    expect(finishedInOneDay(next.cycles[0])).toBe(true)
  })

  it('termina tras el séptimo ciclo aunque haga falta más de un día', () => {
    let plan = createPlan({ name: 'p', set: fakeSet(4) })
    for (let i = 0; i < 6; i++) {
      plan.cycles[plan.currentCycle].cursor = 4
      plan.cycles[plan.currentCycle].activeDays = ['2026-01-01', '2026-01-02']
      plan = advanceCycle(plan).plan
    }
    plan.cycles[6].cursor = 4
    plan.cycles[6].activeDays = ['2026-01-01', '2026-01-02']
    const { finished, plan: end } = advanceCycle(plan)
    expect(finished).toBe(true)
    expect(end.cycles).toHaveLength(7)
  })
})

describe('fechas', () => {
  it('suma y resta días', () => {
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(daysBetween('2026-01-01', '2026-01-29')).toBe(28)
  })
})

describe('puntos negros', () => {
  it('ordena por número de fallos', () => {
    const attempts: Attempt[] = [
      { id: '1', planId: 'x', cycle: 0, puzzleId: 'a', ts: 0, ms: 1, correct: false, gaveUp: false, depth: 0 },
      { id: '2', planId: 'x', cycle: 1, puzzleId: 'a', ts: 0, ms: 1, correct: false, gaveUp: false, depth: 0 },
      { id: '3', planId: 'x', cycle: 0, puzzleId: 'b', ts: 0, ms: 1, correct: false, gaveUp: false, depth: 0 },
      { id: '4', planId: 'x', cycle: 0, puzzleId: 'c', ts: 0, ms: 1, correct: true, gaveUp: false, depth: 0 },
      { id: '5', planId: 'otro', cycle: 0, puzzleId: 'd', ts: 0, ms: 1, correct: false, gaveUp: false, depth: 0 },
    ]
    const result = troubleSpots(attempts, 'x')
    expect(result.map((r) => r.puzzleId)).toEqual(['a', 'b'])
    expect(result[0].fails).toBe(2)
  })
})
