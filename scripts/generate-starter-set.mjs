/**
 * Genera el paquete inicial de puzzles: mates en 1 y en 2 VERIFICADOS.
 *
 * No inventamos soluciones: cada posición se somete a una búsqueda exhaustiva
 * de mate forzado y solo se conserva si existe exactamente UNA primera jugada
 * que fuerza el mate (si hubiera dos, el puzzle sería ambiguo). La línea que se
 * guarda es, por tanto, correcta por construcción.
 *
 *   node scripts/generate-starter-set.mjs [nº de puzzles]
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { Chess } from 'chess.js'

const TARGET = Number(process.argv[2] ?? 120)
const SEED = Number(process.argv[3] ?? 20180418)
const OUT = process.argv[4]
  ? new URL(process.argv[4], `file://${process.cwd()}/`)
  : new URL('../public/sets/starter-mates.json', import.meta.url)
const TIME_BUDGET_MS = Number(process.env.TIME_BUDGET_MS ?? 240_000)

// Generador congruencial: con la misma semilla, el mismo fichero.
let seed = SEED
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]

const FILES = 'abcdefgh'
const square = (f, r) => `${FILES[f]}${r + 1}`

/** Todas las jugadas que dan mate inmediato. */
function matesIn1(game) {
  const out = []
  for (const move of game.moves({ verbose: true })) {
    game.move(move)
    if (game.isCheckmate()) out.push(move)
    game.undo()
  }
  return out
}

/** Todas las primeras jugadas que fuerzan mate en 2 (mate a la segunda jugada). */
function matesIn2(game) {
  const out = []
  for (const first of game.moves({ verbose: true })) {
    game.move(first)
    if (game.isCheckmate() || game.isStalemate() || game.isDraw()) {
      game.undo()
      continue
    }
    const replies = game.moves({ verbose: true })
    let forced = replies.length > 0
    let sample = null
    for (const reply of replies) {
      game.move(reply)
      const mates = matesIn1(game)
      if (mates.length === 0) forced = false
      else if (!sample) sample = { reply, mate: mates[0] }
      game.undo()
      if (!forced) break
    }
    game.undo()
    if (forced && sample) out.push({ first, ...sample })
  }
  return out
}

const uci = (m) => `${m.from}${m.to}${m.promotion ?? ''}`

/**
 * chess.js no valida la legalidad global de una FEN: acepta posiciones en las
 * que el bando que NO mueve está en jaque (imposibles en una partida real) y
 * entonces permite "capturar el rey". Hay que descartarlas explícitamente.
 */
function opponentInCheck(fen) {
  try {
    return new Chess(fen.replace(' w ', ' b ')).inCheck()
  } catch {
    return true
  }
}

/** Posición aleatoria plausible: rey negro acorralado y material atacante blanco. */
function randomPosition() {
  const board = new Map()
  const used = new Set()
  const place = (piece, allowed) => {
    for (let tries = 0; tries < 60; tries++) {
      const sq = allowed ? allowed() : square(Math.floor(rnd() * 8), Math.floor(rnd() * 8))
      if (used.has(sq)) continue
      used.add(sq)
      board.set(sq, piece)
      return sq
    }
    return null
  }

  // Rey negro cerca del borde (donde de verdad ocurren los mates).
  const edge = () => {
    const onFile = rnd() < 0.5
    const f = onFile ? pick([0, 7]) : Math.floor(rnd() * 8)
    const r = onFile ? Math.floor(rnd() * 8) : pick([0, 7])
    return square(f, r)
  }
  const bk = place('k', edge)
  if (!bk) return null

  const wk = place('K')
  if (!wk) return null

  const attackers = pick([
    ['Q', 'R'],
    ['Q', 'N'],
    ['R', 'R'],
    ['R', 'B'],
    ['Q', 'B'],
    ['R', 'N'],
    ['Q'],
    ['R', 'B', 'N'],
  ])
  for (const p of attackers) place(p)

  // Defensores negros: dan realismo y evitan mates triviales.
  const defenders = pick([[], ['p'], ['p', 'p'], ['r'], ['n'], ['p', 'b'], ['q'], ['p', 'n']])
  for (const p of defenders) {
    place(p, () => {
      const f = Math.floor(rnd() * 8)
      const r = p === 'p' ? 1 + Math.floor(rnd() * 6) : Math.floor(rnd() * 8)
      return square(f, r)
    })
  }
  // Algún peón blanco suelto.
  if (rnd() < 0.5) place('P', () => square(Math.floor(rnd() * 8), 1 + Math.floor(rnd() * 5)))

  // Montaje de la FEN.
  const rows = []
  for (let r = 7; r >= 0; r--) {
    let row = ''
    let empty = 0
    for (let f = 0; f < 8; f++) {
      const piece = board.get(square(f, r))
      if (piece) {
        if (empty) row += empty
        empty = 0
        row += piece
      } else empty++
    }
    if (empty) row += empty
    rows.push(row)
  }
  return `${rows.join('/')} w - - 0 1`
}

function build() {
  const puzzles = []
  const seen = new Set()
  const started = Date.now()
  let attempts = 0

  while (puzzles.length < TARGET && attempts < 400_000 && Date.now() - started < TIME_BUDGET_MS) {
    attempts++
    const fen = randomPosition()
    if (!fen || seen.has(fen)) continue
    seen.add(fen)
    if (opponentInCheck(fen)) continue

    let game
    try {
      game = new Chess(fen)
    } catch {
      continue
    }
    if (game.isGameOver() || game.isCheck()) continue

    const m1 = matesIn1(game)
    if (m1.length === 1) {
      puzzles.push({
        id: `starter-${puzzles.length + 1}`,
        fen,
        moves: [uci(m1[0])],
        rating: 900,
        themes: ['mate', 'mateIn1'],
        source: 'starter',
      })
      continue
    }
    if (m1.length > 1) continue // ambiguo: hay más de un mate en 1

    const m2 = matesIn2(game)
    if (m2.length === 1) {
      const { first, reply, mate } = m2[0]
      puzzles.push({
        id: `starter-${puzzles.length + 1}`,
        fen,
        moves: [uci(first), uci(reply), uci(mate)],
        rating: 1300,
        themes: ['mate', 'mateIn2'],
        source: 'starter',
      })
    }
  }

  return { puzzles, attempts }
}

/** Última red de seguridad: reproducir la línea y exigir mate al final. */
function verify(p) {
  if (opponentInCheck(p.fen)) return false
  const game = new Chess(p.fen)
  for (const move of p.moves) {
    const from = move.slice(0, 2)
    const to = move.slice(2, 4)
    const promotion = move[4]
    try {
      game.move(promotion ? { from, to, promotion } : { from, to })
    } catch {
      return false
    }
  }
  return game.isCheckmate()
}

const { puzzles, attempts } = build()
const verified = puzzles.filter(verify)
verified.sort((a, b) => a.moves.length - b.moves.length)
verified.forEach((p, i) => {
  p.id = `starter-${String(i + 1).padStart(3, '0')}`
})

mkdirSync(new URL('.', OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify(
    {
      name: 'Paquete inicial · mates verificados',
      notes: 'Mates en 1 y en 2 con solución única, generados y comprobados por búsqueda exhaustiva',
      generatedAt: new Date().toISOString().slice(0, 10),
      puzzles: verified,
    },
    null,
    1,
  ),
)

const mate1 = verified.filter((p) => p.moves.length === 1).length
console.log(
  `${verified.length} puzzles verificados (${mate1} mate en 1, ${verified.length - mate1} mate en 2) ` +
    `de ${attempts} posiciones probadas → public/sets/starter-mates.json`,
)
