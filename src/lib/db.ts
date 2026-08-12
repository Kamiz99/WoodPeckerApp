/**
 * Persistencia local en IndexedDB (sin dependencias).
 *
 * Todo vive en el navegador: no hay servidor, no hay cuenta, no se sube nada.
 * Un set de 1000 puzzles ocupa ~400 KB, así que localStorage se quedaría corto
 * en cuanto haya varios sets e historial de intentos.
 */

import type { Attempt, Plan, PuzzleSet, Settings } from '../types'

const DB_NAME = 'woodpecker'
const DB_VERSION = 1

export const STORE = {
  sets: 'sets',
  plans: 'plans',
  attempts: 'attempts',
  kv: 'kv',
} as const

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE.sets)) db.createObjectStore(STORE.sets, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE.plans)) db.createObjectStore(STORE.plans, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE.attempts)) {
        const s = db.createObjectStore(STORE.attempts, { keyPath: 'id' })
        s.createIndex('byPlan', 'planId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE.kv)) db.createObjectStore(STORE.kv)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const db = {
  async getAllSets(): Promise<PuzzleSet[]> {
    return tx<PuzzleSet[]>(STORE.sets, 'readonly', (s) => s.getAll())
  },
  async getSet(id: string): Promise<PuzzleSet | undefined> {
    return tx<PuzzleSet | undefined>(STORE.sets, 'readonly', (s) => s.get(id))
  },
  async putSet(set: PuzzleSet): Promise<void> {
    await tx(STORE.sets, 'readwrite', (s) => s.put(set))
  },
  async deleteSet(id: string): Promise<void> {
    await tx(STORE.sets, 'readwrite', (s) => s.delete(id))
  },

  async getAllPlans(): Promise<Plan[]> {
    return tx<Plan[]>(STORE.plans, 'readonly', (s) => s.getAll())
  },
  async putPlan(plan: Plan): Promise<void> {
    await tx(STORE.plans, 'readwrite', (s) => s.put(plan))
  },
  async deletePlan(id: string): Promise<void> {
    await tx(STORE.plans, 'readwrite', (s) => s.delete(id))
  },

  async getAttempts(): Promise<Attempt[]> {
    return tx<Attempt[]>(STORE.attempts, 'readonly', (s) => s.getAll())
  },
  async addAttempts(attempts: Attempt[]): Promise<void> {
    const database = await openDb()
    await new Promise<void>((resolve, reject) => {
      const t = database.transaction(STORE.attempts, 'readwrite')
      const store = t.objectStore(STORE.attempts)
      for (const a of attempts) store.put(a)
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error)
    })
  },
  async deleteAttemptsOfPlan(planId: string): Promise<void> {
    const database = await openDb()
    await new Promise<void>((resolve, reject) => {
      const t = database.transaction(STORE.attempts, 'readwrite')
      const idx = t.objectStore(STORE.attempts).index('byPlan')
      const req = idx.openCursor(IDBKeyRange.only(planId))
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error)
    })
  },

  async getSettings(): Promise<Settings | undefined> {
    return tx<Settings | undefined>(STORE.kv, 'readonly', (s) => s.get('settings'))
  },
  async putSettings(settings: Settings): Promise<void> {
    await tx(STORE.kv, 'readwrite', (s) => s.put(settings, 'settings'))
  },
  async getKv<T>(key: string): Promise<T | undefined> {
    return tx<T | undefined>(STORE.kv, 'readonly', (s) => s.get(key))
  },
  async setKv(key: string, value: unknown): Promise<void> {
    await tx(STORE.kv, 'readwrite', (s) => s.put(value, key))
  },

  /** Copia de seguridad completa. */
  async exportAll() {
    const [sets, plans, attempts, settings] = await Promise.all([
      db.getAllSets(),
      db.getAllPlans(),
      db.getAttempts(),
      db.getSettings(),
    ])
    return { version: 1, exportedAt: Date.now(), sets, plans, attempts, settings }
  },

  async importAll(data: {
    sets?: PuzzleSet[]
    plans?: Plan[]
    attempts?: Attempt[]
    settings?: Settings
  }): Promise<void> {
    for (const s of data.sets ?? []) await db.putSet(s)
    for (const p of data.plans ?? []) await db.putPlan(p)
    if (data.attempts?.length) await db.addAttempts(data.attempts)
    if (data.settings) await db.putSettings(data.settings)
  },

  async wipe(): Promise<void> {
    const database = await openDb()
    await new Promise<void>((resolve, reject) => {
      const t = database.transaction([STORE.sets, STORE.plans, STORE.attempts, STORE.kv], 'readwrite')
      t.objectStore(STORE.sets).clear()
      t.objectStore(STORE.plans).clear()
      t.objectStore(STORE.attempts).clear()
      t.objectStore(STORE.kv).clear()
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error)
    })
  },
}
