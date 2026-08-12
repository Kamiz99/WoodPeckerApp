/** Modelo de datos de la aplicación. */

/**
 * Un puzzle normalizado.
 *
 * Convención interna: `fen` es SIEMPRE la posición que ve quien resuelve, con el
 * bando que debe encontrar la táctica a mover. La base de datos de Lichess usa
 * otra convención (la FEN es una jugada anterior), así que en la importación
 * aplicamos esa jugada y la guardamos en `preMove` para poder animarla.
 */
export interface Puzzle {
  id: string
  /** Posición a resolver (le toca mover a quien entrena). */
  fen: string
  /** Posición previa a la jugada del rival, si existe (solo para la animación). */
  preFen?: string
  /** Jugada del rival que da lugar a `fen`, en formato UCI (ej. "e2e4", "e7e8q"). */
  preMove?: string
  /** Solución en UCI, alternando: [tuya, rival, tuya, rival, ...]. */
  moves: string[]
  rating?: number
  themes?: string[]
  url?: string
  source: 'lichess' | 'custom' | 'starter'
}

/** Un set fijo de puzzles: la materia prima del método. */
export interface PuzzleSet {
  id: string
  name: string
  createdAt: number
  source: string
  puzzles: Puzzle[]
  /** Descripción de los filtros usados al construirlo. */
  notes?: string
}

export type CycleStatus = 'pending' | 'active' | 'done'

export interface Cycle {
  index: number
  /** Días planificados para el ciclo (28, 14, 7, 4, 2, 1, 1...). */
  plannedDays: number
  status: CycleStatus
  startedAt?: number
  finishedAt?: number
  /** Orden de los puzzles en este ciclo (ids). */
  order: string[]
  /** Índice del próximo puzzle a resolver. */
  cursor: number
  /** Tiempo total de resolución acumulado en ms (solo tiempo de reloj activo). */
  totalMs: number
  correct: number
  /** Resueltos (intentados) en el ciclo. */
  solved: number
  /** Días en los que hubo actividad, en formato YYYY-MM-DD. */
  activeDays: string[]
}

export interface Plan {
  id: string
  name: string
  setId: string
  createdAt: number
  startDate: string
  /** Días planificados por ciclo, derivados por mitades. */
  cycleDays: number[]
  cycles: Cycle[]
  currentCycle: number
  status: 'active' | 'finished'
  /** Se mezcla el orden en cada ciclo o se respeta el original. */
  shuffleEachCycle: boolean
  finishedAt?: number
}

export interface Attempt {
  id: string
  planId: string
  cycle: number
  puzzleId: string
  ts: number
  ms: number
  correct: boolean
  /** Se rindió / miró la solución. */
  gaveUp: boolean
  /** Jugadas correctas encadenadas antes de fallar. */
  depth: number
}

export type InputMode = 'direct' | 'declare'

export interface Settings {
  /**
   * `direct`: el reloj corre hasta completar la línea.
   * `declare`: modo libro — calculas sin tocar nada, pulsas "Ya lo tengo" (para
   * el reloj) y solo entonces introduces la solución.
   */
  inputMode: InputMode
  /** Requiere jugar toda la línea o solo la primera jugada. */
  requireFullLine: boolean
  /** Segundos máximos por puzzle antes de avisar (0 = sin límite). */
  softTimeLimit: number
  /** Pasar al siguiente automáticamente tras acertar. */
  autoAdvance: boolean
  /** Muestra los temas del puzzle (spoiler) durante la resolución. */
  showThemes: boolean
  /** Muestra la valoración del puzzle durante la resolución. */
  showRating: boolean
  sound: boolean
  boardTheme: 'wood' | 'green' | 'blue' | 'gray'
  /** Puzzles por sesión; 0 = usar la cuota diaria calculada. */
  sessionSize: number
  animateOpponentMove: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  inputMode: 'direct',
  requireFullLine: true,
  softTimeLimit: 0,
  autoAdvance: true,
  showThemes: false,
  showRating: false,
  sound: true,
  boardTheme: 'wood',
  sessionSize: 0,
  animateOpponentMove: true,
}

/** Estado efímero de una sesión de entrenamiento en curso. */
export interface SessionState {
  planId: string
  cycle: number
  /** Puzzles de la sesión (posiciones dentro de `cycle.order`). */
  queue: string[]
  index: number
  startedAt: number
  results: { puzzleId: string; ms: number; correct: boolean }[]
}
