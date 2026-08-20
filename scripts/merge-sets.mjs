/**
 * Une varios paquetes JSON en uno solo, quitando duplicados y volviendo a
 * verificar cada línea (mate forzado y posición legal).
 *
 * Se usa junto con el generador para repartir el trabajo en varios procesos:
 *
 *   for i in 1 2 3 4; do
 *     node scripts/generate-starter-set.mjs 40 $((20180418 + i * 7919)) /tmp/s$i.json &
 *   done; wait
 *   node scripts/merge-sets.mjs public/sets/starter-mates.json /tmp/s*.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { Chess } from 'chess.js'

const [out, ...inputs] = process.argv.slice(2)
if (!out || inputs.length === 0) {
  console.error('Uso: node scripts/merge-sets.mjs <salida.json> <entrada1.json> [entrada2.json ...]')
  process.exit(1)
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

function endsInMate(p) {
  if (!legalPosition(p.fen)) return false
  const game = new Chess(p.fen)
  for (const move of p.moves) {
    try {
      game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })
    } catch {
      return false
    }
  }
  return game.isCheckmate()
}

const seen = new Set()
const merged = []
let discarded = 0

for (const file of inputs) {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  for (const p of data.puzzles ?? []) {
    if (seen.has(p.fen)) continue
    seen.add(p.fen)
    if (!endsInMate(p)) {
      discarded++
      continue
    }
    merged.push(p)
  }
}

// Primero los mates en 1 (más fáciles), luego los mates en 2.
merged.sort((a, b) => a.moves.length - b.moves.length)
merged.forEach((p, i) => {
  p.id = `starter-${String(i + 1).padStart(3, '0')}`
})

mkdirSync(new URL('.', new URL(out, `file://${process.cwd()}/`)), { recursive: true })
writeFileSync(
  out,
  JSON.stringify(
    {
      name: 'Paquete inicial · mates verificados',
      notes: 'Mates en 1 y en 2 con solución única, generados y comprobados por búsqueda exhaustiva',
      generatedAt: new Date().toISOString().slice(0, 10),
      puzzles: merged,
    },
    null,
    1,
  ),
)

const mate1 = merged.filter((p) => p.moves.length === 1).length
console.log(
  `${merged.length} puzzles (${mate1} mate en 1, ${merged.length - mate1} mate en 2), ` +
    `${discarded} descartados → ${out}`,
)
