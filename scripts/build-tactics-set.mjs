/**
 * Construye el set de tácticas que se incluye con la app a partir de la base
 * de puzzles de Lichess (CC0).
 *
 *   node scripts/build-tactics-set.mjs <lichess_db_puzzle.csv> [salida.json]
 *
 * El reparto por dificultad imita al del libro (1128 ejercicios: 222 fáciles,
 * 762 intermedios y 144 avanzados) y cada puzzle se comprueba con chess.js:
 * posición legal y variante entera jugable. La FEN que se guarda ya es la que
 * ve quien resuelve (se aplica la jugada del rival, como hace la app).
 *
 * Descarga del fichero original: https://database.lichess.org/#puzzles
 */

import { createReadStream, writeFileSync, mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { Chess } from 'chess.js'

const [csvPath, outPath = 'public/sets/tactics-1128.json'] = process.argv.slice(2)
if (!csvPath) {
  console.error('Uso: node scripts/build-tactics-set.mjs <lichess_db_puzzle.csv> [salida.json]')
  process.exit(1)
}

/** Tramos de dificultad y cuántos puzzles coger de cada uno. */
const BUCKETS = [
  { name: 'fáciles', min: 900, max: 1399, take: 222 },
  { name: 'intermedios', min: 1400, max: 1999, take: 762 },
  { name: 'avanzados', min: 2000, max: 2399, take: 144 },
]

// Solo puzzles bien valorados y muy jugados: son los mejor revisados.
const MIN_POPULARITY = 90
const MIN_PLAYS = 1000
const MAX_RATING_DEVIATION = 85
/** Jugadas máximas del que resuelve (2 plies por jugada suya + respuesta). */
const MAX_SOLVER_MOVES = 5

/** Muestreo por depósito: reparte la selección por todo el fichero. */
class Reservoir {
  constructor(size) {
    this.size = size
    this.items = []
    this.seen = 0
  }
  add(item) {
    this.seen++
    if (this.items.length < this.size) {
      this.items.push(item)
      return
    }
    const j = Math.floor(Math.random() * this.seen)
    if (j < this.size) this.items[j] = item
  }
}

function legalPosition(fen) {
  try {
    const parts = fen.split(' ')
    parts[1] = parts[1] === 'w' ? 'b' : 'w'
    return !new Chess(parts.join(' ')).inCheck()
  } catch {
    return false
  }
}

function applyUci(fen, uci) {
  try {
    const game = new Chess(fen)
    game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    return game.fen()
  } catch {
    return null
  }
}

/** Convierte una fila de Lichess al formato de la app, o null si no es válida. */
function rowToPuzzle(row) {
  const [id, fen, movesRaw, rating, , popularity, plays, themes, url] = row
  const moves = movesRaw.trim().split(' ').filter(Boolean)
  if (moves.length < 2) return null
  const start = applyUci(fen, moves[0])
  if (!start || !legalPosition(start)) return null

  // La línea entera tiene que poder jugarse desde la posición inicial.
  let cur = start
  for (const m of moves.slice(1)) {
    cur = applyUci(cur, m)
    if (!cur) return null
  }
  return {
    id,
    fen: start,
    preFen: fen,
    preMove: moves[0],
    moves: moves.slice(1),
    rating: Number(rating),
    themes: (themes ?? '').trim().split(' ').filter(Boolean),
    url: url || `https://lichess.org/training/${id}`,
    source: 'lichess',
    popularity: Number(popularity),
    plays: Number(plays),
  }
}

const reservoirs = BUCKETS.map((b) => ({ ...b, reservoir: new Reservoir(b.take * 3) }))
let scanned = 0
let candidates = 0

const rl = createInterface({ input: createReadStream(csvPath), crlfDelay: Infinity })

for await (const line of rl) {
  if (!line || line.startsWith('PuzzleId')) continue
  scanned++
  const f = line.split(',')
  if (f.length < 8) continue

  const rating = Number(f[3])
  const deviation = Number(f[4])
  const popularity = Number(f[5])
  const plays = Number(f[6])
  if (popularity < MIN_POPULARITY || plays < MIN_PLAYS || deviation > MAX_RATING_DEVIATION) continue
  // Nº de jugadas del que resuelve = (total - la del rival + 1) / 2
  const plies = f[2].trim().split(' ').length - 1
  if (Math.ceil(plies / 2) > MAX_SOLVER_MOVES) continue

  const bucket = reservoirs.find((b) => rating >= b.min && rating <= b.max)
  if (!bucket) continue
  candidates++
  bucket.reservoir.add(f)

  if (scanned % 500_000 === 0) {
    process.stdout.write(`\r  ${scanned.toLocaleString('es-ES')} filas leídas, ${candidates.toLocaleString('es-ES')} candidatas`)
  }
}
process.stdout.write('\n')

const puzzles = []
const seenFens = new Set()
let rejected = 0

for (const bucket of reservoirs) {
  let taken = 0
  for (const row of bucket.reservoir.items) {
    if (taken >= bucket.take) break
    const puzzle = rowToPuzzle(row)
    if (!puzzle) {
      rejected++
      continue
    }
    if (seenFens.has(puzzle.fen)) continue
    seenFens.add(puzzle.fen)
    const { popularity, plays, ...clean } = puzzle
    void popularity
    void plays
    puzzles.push(clean)
    taken++
  }
  console.log(`  ${bucket.name}: ${taken}/${bucket.take} (${bucket.min}–${bucket.max})`)
}

// De fácil a difícil, como el libro.
puzzles.sort((a, b) => a.rating - b.rating)

mkdirSync(new URL('.', new URL(outPath, `file://${process.cwd()}/`)), { recursive: true })
writeFileSync(
  outPath,
  JSON.stringify({
    name: `Tácticas Lichess · ${puzzles.length}`,
    notes: `Selección de la base de Lichess (CC0) con el reparto del libro: ${BUCKETS.map((b) => `${b.take} ${b.name}`).join(', ')}`,
    generatedAt: new Date().toISOString().slice(0, 10),
    puzzles,
  }),
)

console.log(
  `\n${puzzles.length} puzzles (${scanned.toLocaleString('es-ES')} filas leídas, ` +
    `${rejected} descartados por validación) → ${outPath}`,
)
