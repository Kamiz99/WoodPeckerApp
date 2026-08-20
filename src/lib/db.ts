/**
 * Persistencia local en IndexedDB (sin dependencias).
 *
 * Todo vive en el navegador: no hay servidor, no hay cuenta, no se sube nada.
 * Un set de 1128 puzzles ocupa ~400 KB, así que localStorage se quedaría corto
 * en cuanto haya varios sets e historial de intentos.
 *
 * Si el navegador no deja usar IndexedDB (navegación privada, iframe con el
 * almacenamiento bloqueado), se trabaja en memoria: la app sigue funcionando
 * durante la sesión, pero no se guarda nada al cerrar.
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

type StoreName = (typeof STORE)[keyof typeof STORE]

let dbPromise: Promise<IDBDatabase | null> | null = null
const memory: Record<StoreName, Map<IDBValidKey, unknown>> = {
  sets: new Map(),
  plans: new Map(),
  attempts: new Map(),
  kv: new Map(),
}

/** ¿Se está trabajando solo en memoria? (lo usa la interfaz para avisar). */
export let memoryOnly = false

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      memoryOnly = true
      resolve(null)
      return
    }
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      memoryOnly = true
      resolve(null)
      return
    }
    req.onupgradeneeded = () => {
      const database = req.result
      if (!database.objectStoreNames.contains(STORE.sets)) database.createObjectStore(STORE.sets, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(STORE.plans)) database.createObjectStore(STORE.plans, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(STORE.attempts)) {
        const s = database.createObjectStore(STORE.attempts, { keyPath: 'id' })
        s.createIndex('byPlan', 'planId', { unique: false })
      }
      if (!database.objectStoreNames.contains(STORE.kv)) database.createObjectStore(STORE.kv)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      memoryOnly = true
      resolve(null)
    }
    // Si otra pestaña bloquea la actualización, no dejamos la app colgada.
    req.onblocked = () => {
      memoryOnly = true
      resolve(null)
    }
  })
  return dbPromise
}

/** Almacén clave-valor uniforme: IndexedDB si se puede, memoria si no. */
const kv = {
  async getAll<T>(store: StoreName): Promise<T[]> {
    const database = await openDb()
    if (!database) return [...memory[store].values()] as T[]
    return new Promise((resolve, reject) => {
      const req = database.transaction(store, 'readonly').objectStore(store).getAll()
      req.onsuccess = () => resolve(req.result as T[])
      req.onerror = () => reject(req.error)
    })
  },

  async get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    const database = await openDb()
    if (!database) return memory[store].get(key) as T | undefined
    return new Promise((resolve, reject) => {
      const req = database.transaction(store, 'readonly').objectStore(store).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
  },

  /** `key` solo para almacenes sin keyPath (kv). */
  async putMany(store: StoreName, items: { value: unknown; key?: IDBValidKey }[]): Promise<void> {
    const database = await openDb()
    if (!database) {
      for (const item of items) {
        const key = item.key ?? (item.value as { id: IDBValidKey }).id
        memory[store].set(key, item.value)
      }
      return
    }
    await new Promise<void>((resolve, reject) => {
      const t = database.transaction(store, 'readwrite')
      const objectStore = t.objectStore(store)
      for (const item of items) {
        if (item.key !== undefined) objectStore.put(item.value, item.key)
        else objectStore.put(item.value)
      }
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error)
    })
  },

  async delete(store: StoreName, key: IDBValidKey): Promise<void> {
    const database = await openDb()
    if (!database) {
      memory[store].delete(key)
      return
    }
    await new Promise<void>((resolve, reject) => {
      const t = database.transaction(store, 'readwrite')
      t.objectStore(store).delete(key)
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error)
    })
  },

  async clearAll(): Promise<void> {
    const database = await openDb()
    if (!database) {
      for (const store of Object.values(STORE)) memory[store].clear()
      return
    }
    await new Promise<void>((resolve, reject) => {
      const stores = Object.values(STORE)
      const t = database.transaction(stores, 'readwrite')
      for (const store of stores) t.objectStore(store).clear()
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error)
    })
  },
}

export const db = {
  getAllSets: () => kv.getAll<PuzzleSet>(STORE.sets),
  getSet: (id: string) => kv.get<PuzzleSet>(STORE.sets, id),
  putSet: (set: PuzzleSet) => kv.putMany(STORE.sets, [{ value: set }]),
  deleteSet: (id: string) => kv.delete(STORE.sets, id),

  getAllPlans: () => kv.getAll<Plan>(STORE.plans),
  putPlan: (plan: Plan) => kv.putMany(STORE.plans, [{ value: plan }]),
  deletePlan: (id: string) => kv.delete(STORE.plans, id),

  getAttempts: () => kv.getAll<Attempt>(STORE.attempts),
  addAttempts: (attempts: Attempt[]) => kv.putMany(STORE.attempts, attempts.map((value) => ({ value }))),

  async deleteAttemptsOfPlan(planId: string): Promise<void> {
    const attempts = await db.getAttempts()
    for (const a of attempts) {
      if (a.planId === planId) await kv.delete(STORE.attempts, a.id)
    }
  },

  getSettings: () => kv.get<Settings>(STORE.kv, 'settings'),
  putSettings: (settings: Settings) => kv.putMany(STORE.kv, [{ value: settings, key: 'settings' }]),
  getKv: <T,>(key: string) => kv.get<T>(STORE.kv, key),
  setKv: (key: string, value: unknown) => kv.putMany(STORE.kv, [{ value, key }]),

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
    if (data.sets?.length) await kv.putMany(STORE.sets, data.sets.map((value) => ({ value })))
    if (data.plans?.length) await kv.putMany(STORE.plans, data.plans.map((value) => ({ value })))
    if (data.attempts?.length) await db.addAttempts(data.attempts)
    if (data.settings) await db.putSettings(data.settings)
  },

  wipe: () => kv.clearAll(),

  /** true si el navegador no permite guardar nada de forma permanente. */
  async isMemoryOnly(): Promise<boolean> {
    await openDb()
    return memoryOnly
  },
}
