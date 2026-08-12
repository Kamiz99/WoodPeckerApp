/** Utilidades de ajedrez sobre chess.js: UCI ⇄ SAN, validación y aplicación de jugadas. */

import { Chess } from 'chess.js'

export type UciMove = { from: string; to: string; promotion?: string }

export function parseUci(uci: string): UciMove {
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.length > 4 ? uci[4].toLowerCase() : undefined
  return promotion ? { from, to, promotion } : { from, to }
}

export function sideToMove(fen: string): 'w' | 'b' {
  return (fen.split(' ')[1] as 'w' | 'b') ?? 'w'
}

export function isValidFen(fen: string): boolean {
  try {
    new Chess(fen)
    return true
  } catch {
    return false
  }
}

/**
 * chess.js acepta FEN imposibles, como aquellas en las que el bando que NO
 * mueve está en jaque (y entonces permite "capturar el rey"). Esto lo descarta.
 */
export function isLegalPosition(fen: string): boolean {
  if (!isValidFen(fen)) return false
  const parts = fen.split(' ')
  const swapped = [parts[0], parts[1] === 'w' ? 'b' : 'w', ...parts.slice(2)].join(' ')
  try {
    return !new Chess(swapped).inCheck()
  } catch {
    return false
  }
}

/** Aplica una jugada UCI y devuelve la FEN resultante, o null si es ilegal. */
export function applyUci(fen: string, uci: string): string | null {
  try {
    const game = new Chess(fen)
    game.move(parseUci(uci))
    return game.fen()
  } catch {
    return null
  }
}

const PIECE_ES: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' }

/** Pasa la notación algebraica inglesa de chess.js a la española (Nf3 → Cf3). */
export function sanToSpanish(san: string): string {
  if (san.startsWith('O-O')) return san.replace(/O/g, '0')
  return san.replace(/^([KQRBN])/, (_, p: string) => PIECE_ES[p]).replace(/=([QRBN])/, (_, p: string) => `=${PIECE_ES[p]}`)
}

/** Convierte una línea UCI en SAN numerado: ["1... Dxh2+", "2. Rxh2", ...]. */
export function lineToNotation(fen: string, moves: string[]): { san: string; number: string }[] {
  const game = new Chess(fen)
  const out: { san: string; number: string }[] = []
  for (const uci of moves) {
    const turn = game.turn()
    const moveNumber = game.moveNumber()
    let san: string
    try {
      san = sanToSpanish(game.move(parseUci(uci)).san)
    } catch {
      break
    }
    out.push({ san, number: turn === 'w' ? `${moveNumber}.` : `${moveNumber}...` })
  }
  return out
}

export function lineToText(fen: string, moves: string[]): string {
  const parts = lineToNotation(fen, moves)
  return parts
    .map((p, i) => (i === 0 || p.number.endsWith('.') ? `${p.number} ${p.san}` : p.san))
    .join(' ')
}

export function isCheckmateAfter(fen: string, uci: string): boolean {
  try {
    const game = new Chess(fen)
    game.move(parseUci(uci))
    return game.isCheckmate()
  } catch {
    return false
  }
}

export function isLegalUci(fen: string, uci: string): boolean {
  return applyUci(fen, uci) !== null
}

/** ¿La jugada requiere elegir pieza de promoción? */
export function needsPromotion(fen: string, from: string, to: string): boolean {
  try {
    const game = new Chess(fen)
    return game
      .moves({ square: from as never, verbose: true })
      .some((m) => m.to === to && m.piece === 'p' && (to[1] === '8' || to[1] === '1'))
  } catch {
    return false
  }
}

export type MoveVerdict = 'correct' | 'alternative-mate' | 'wrong'

/**
 * Valida la jugada del usuario contra la solución.
 *
 * Igual que en Lichess: si la jugada esperada da mate, cualquier otro mate
 * también se acepta (no hay una única forma de rematar).
 */
export function verifyMove(fen: string, played: string, expected: string): MoveVerdict {
  if (played === expected) return 'correct'
  // Promoción implícita a dama: "e7e8" ≡ "e7e8q".
  if (expected.length === 5 && played.length === 4 && expected.startsWith(played) && expected[4] === 'q') {
    return 'correct'
  }
  if (isCheckmateAfter(fen, played) && isCheckmateAfter(fen, expected)) return 'alternative-mate'
  return 'wrong'
}

/** Casillas de la última jugada, para resaltarlas en el tablero. */
export function moveSquares(uci: string): [string, string] {
  return [uci.slice(0, 2), uci.slice(2, 4)]
}

export function isGameOver(fen: string): boolean {
  try {
    return new Chess(fen).isGameOver()
  } catch {
    return false
  }
}
