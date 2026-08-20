/**
 * Construcción de sets a partir de la base de puzzles de Lichess (CC0)
 * y de formatos propios (JSON / lista de FEN+solución).
 *
 * Formato del CSV de Lichess (https://database.lichess.org/#puzzles):
 *   PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
 * La FEN es la posición ANTERIOR a la jugada del rival: la primera jugada de
 * `Moves` la hace el rival y la solución empieza en la segunda.
 */

import type { Puzzle } from '../types'
import { applyUci, isLegalPosition, isValidFen } from './chess'

export interface ImportFilters {
  ratingMin: number
  ratingMax: number
  /** Se acepta el puzzle si tiene ALGUNO de estos temas (vacío = todos valen). */
  themes: string[]
  /** Se descarta si tiene alguno de estos temas. */
  excludeThemes: string[]
  minPopularity: number
  minPlays: number
  /** Nº de puzzles del set final. */
  count: number
  /** `rating`: de fácil a difícil · `random`: aleatorio · `mixed`: reparto uniforme por rating. */
  order: 'rating' | 'random' | 'mixed'
}

export const DEFAULT_FILTERS: ImportFilters = {
  ratingMin: 1200,
  ratingMax: 1800,
  themes: [],
  excludeThemes: [],
  minPopularity: 80,
  minPlays: 200,
  count: 1000,
  order: 'rating',
}

/** Temas más útiles de Lichess, con etiqueta en español. */
export const THEME_LABELS: Record<string, string> = {
  mate: 'Mate',
  mateIn1: 'Mate en 1',
  mateIn2: 'Mate en 2',
  mateIn3: 'Mate en 3',
  fork: 'Horquilla',
  pin: 'Clavada',
  skewer: 'Rayos X / brocheta',
  discoveredAttack: 'Ataque a la descubierta',
  doubleCheck: 'Jaque doble',
  deflection: 'Desviación',
  attraction: 'Atracción',
  clearance: 'Despeje',
  interference: 'Intercepción',
  sacrifice: 'Sacrificio',
  hangingPiece: 'Pieza colgada',
  trappedPiece: 'Pieza atrapada',
  backRankMate: 'Mate del pasillo',
  smotheredMate: 'Mate de la coz',
  promotion: 'Promoción',
  advancedPawn: 'Peón avanzado',
  zugzwang: 'Zugzwang',
  quietMove: 'Jugada tranquila',
  defensiveMove: 'Jugada defensiva',
  intermezzo: 'Intermedia (zwischenzug)',
  endgame: 'Final',
  middlegame: 'Medio juego',
  opening: 'Apertura',
  short: 'Corto (2 jugadas)',
  long: 'Largo (4+ jugadas)',
  veryLong: 'Muy largo',
  crushing: 'Ventaja decisiva',
  advantage: 'Ventaja',
  equality: 'Igualar',
}

export interface RawRow {
  id: string
  fen: string
  moves: string[]
  rating: number
  popularity: number
  plays: number
  themes: string[]
  url: string
}

const HEADER_HINT = 'PuzzleId'

export function isHeaderLine(line: string): boolean {
  return line.startsWith(HEADER_HINT)
}

export function parseCsvLine(line: string): RawRow | null {
  // El CSV de Lichess no lleva comillas ni comas dentro de los campos.
  const f = line.split(',')
  if (f.length < 8) return null
  const moves = f[2].trim().split(' ').filter(Boolean)
  if (moves.length < 2) return null
  return {
    id: f[0],
    fen: f[1],
    moves,
    rating: Number(f[3]) || 0,
    popularity: Number(f[5]) || 0,
    plays: Number(f[6]) || 0,
    themes: (f[7] ?? '').trim().split(' ').filter(Boolean),
    url: f[8] ?? '',
  }
}

export function matchesFilters(row: RawRow, f: ImportFilters): boolean {
  if (row.rating < f.ratingMin || row.rating > f.ratingMax) return false
  if (row.popularity < f.minPopularity) return false
  if (row.plays < f.minPlays) return false
  if (f.themes.length && !row.themes.some((t) => f.themes.includes(t))) return false
  if (f.excludeThemes.length && row.themes.some((t) => f.excludeThemes.includes(t))) return false
  return true
}

/** Pasa de la convención de Lichess a la nuestra (posición ya lista para resolver). */
export function rowToPuzzle(row: RawRow): Puzzle | null {
  const preMove = row.moves[0]
  const fen = applyUci(row.fen, preMove)
  if (!fen) return null
  return {
    id: row.id,
    fen,
    preFen: row.fen,
    preMove,
    moves: row.moves.slice(1),
    rating: row.rating,
    themes: row.themes,
    url: row.url || `https://lichess.org/training/${row.id}`,
    source: 'lichess',
  }
}

/**
 * Muestreo por depósito (reservoir sampling): permite quedarse con N puzzles
 * repartidos por todo el fichero sin cargarlo entero en memoria.
 */
export class Reservoir<T> {
  private items: T[] = []
  private seen = 0
  constructor(private readonly size: number) {}

  add(item: T): void {
    this.seen++
    if (this.items.length < this.size) {
      this.items.push(item)
      return
    }
    const j = Math.floor(Math.random() * this.seen)
    if (j < this.size) this.items[j] = item
  }

  get count(): number {
    return this.seen
  }

  values(): T[] {
    return this.items
  }
}

export function orderPuzzles(puzzles: Puzzle[], order: ImportFilters['order']): Puzzle[] {
  const arr = puzzles.slice()
  if (order === 'rating') return arr.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))
  if (order === 'random') {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
  // "mixed": ordena por rating y luego intercala para que la dificultad suba en
  // dientes de sierra; evita 300 mates seguidos y luego 300 finales.
  const byRating = arr.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))
  const buckets: Puzzle[][] = [[], [], [], [], []]
  byRating.forEach((p, i) => buckets[i % buckets.length].push(p))
  const out: Puzzle[] = []
  let idx = 0
  while (out.length < byRating.length) {
    for (const b of buckets) {
      if (b[idx]) out.push(b[idx])
    }
    idx++
  }
  return out
}

/** Importa un JSON propio (o exportado por la app). */
export function parsePuzzleJson(text: string): Puzzle[] {
  const data = JSON.parse(text)
  const list: unknown[] = Array.isArray(data) ? data : (data.puzzles ?? [])
  const out: Puzzle[] = []
  for (const item of list) {
    const p = item as Partial<Puzzle> & { solution?: string[] }
    const moves = p.moves ?? p.solution
    if (!p.fen || !moves?.length || !isValidFen(p.fen)) continue
    out.push({
      id: p.id ?? `custom-${out.length + 1}`,
      fen: p.fen,
      preFen: p.preFen,
      preMove: p.preMove,
      moves,
      rating: p.rating,
      themes: p.themes,
      url: p.url,
      source: p.source ?? 'custom',
    })
  }
  return out
}

/**
 * Importa un texto plano sencillo, una línea por puzzle:
 *   `FEN ; e2e4 e7e5 g1f3 ; opcional-etiquetas`
 * Acepta `,` o `;` como separador y jugadas en UCI.
 */
export function parsePlainText(text: string): Puzzle[] {
  const out: Puzzle[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/[;,]/).map((s) => s.trim())
    const fen = parts[0]
    const moves = (parts[1] ?? '').split(/\s+/).filter(Boolean)
    if (!fen || !moves.length || !isValidFen(fen)) continue
    out.push({
      id: `custom-${out.length + 1}`,
      fen,
      moves,
      themes: parts[2] ? parts[2].split(/\s+/) : undefined,
      source: 'custom',
    })
  }
  return out
}

/** Comprueba que la posición sea legal y que la línea de solución se pueda jugar. */
export function validatePuzzle(p: Puzzle): boolean {
  if (!isLegalPosition(p.fen)) return false
  if (!p.moves.length) return false
  let fen: string | null = p.fen
  for (const m of p.moves) {
    fen = applyUci(fen, m)
    if (!fen) return false
  }
  return true
}
