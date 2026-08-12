import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_FILTERS,
  Reservoir,
  matchesFilters,
  orderPuzzles,
  parseCsvLine,
  parsePlainText,
  rowToPuzzle,
  validatePuzzle,
} from '../src/lib/importer'
import { applyUci, isLegalPosition, lineToText, sanToSpanish, sideToMove, verifyMove } from '../src/lib/chess'
import type { Puzzle } from '../src/types'

const CSV_LINE =
  '00sHx,r5k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1,e1e8 a8e8,1500,75,95,850,hangingPiece short,https://lichess.org/xyzxyzxy/black#40,'

describe('importación del CSV de Lichess', () => {
  it('lee una línea real', () => {
    const row = parseCsvLine(CSV_LINE)
    expect(row).not.toBeNull()
    expect(row!.id).toBe('00sHx')
    expect(row!.rating).toBe(1500)
    expect(row!.themes).toContain('hangingPiece')
    expect(row!.moves[0]).toBe('e1e8')
  })

  it('descarta líneas incompletas', () => {
    expect(parseCsvLine('id,fen,move')).toBeNull()
  })

  it('aplica la primera jugada: la posición guardada es la que ve quien resuelve', () => {
    const row = parseCsvLine(CSV_LINE)!
    const puzzle = rowToPuzzle(row)!
    expect(puzzle.preMove).toBe('e1e8')
    expect(puzzle.preFen).toBe(row.fen)
    // Tras la jugada del rival mueven las negras y la solución empieza por ellas.
    expect(sideToMove(puzzle.fen)).toBe('b')
    expect(puzzle.moves[0]).toBe('a8e8')
    expect(puzzle.fen).toBe(applyUci(row.fen, 'e1e8'))
    expect(validatePuzzle(puzzle)).toBe(true)
  })

  it('filtra por rating, popularidad y temas', () => {
    const row = parseCsvLine(CSV_LINE)!
    expect(matchesFilters(row, { ...DEFAULT_FILTERS, ratingMin: 1200, ratingMax: 1800 })).toBe(true)
    expect(matchesFilters(row, { ...DEFAULT_FILTERS, ratingMax: 1400 })).toBe(false)
    expect(matchesFilters(row, { ...DEFAULT_FILTERS, minPopularity: 99 })).toBe(false)
    expect(matchesFilters(row, { ...DEFAULT_FILTERS, minPlays: 1000 })).toBe(false)
    expect(matchesFilters(row, { ...DEFAULT_FILTERS, themes: ['fork'] })).toBe(false)
    expect(matchesFilters(row, { ...DEFAULT_FILTERS, themes: ['hangingPiece'] })).toBe(true)
    expect(matchesFilters(row, { ...DEFAULT_FILTERS, excludeThemes: ['short'] })).toBe(false)
  })
})

describe('muestreo y orden', () => {
  it('el depósito se queda con el tamaño pedido y cuenta todo lo visto', () => {
    const r = new Reservoir<number>(10)
    for (let i = 0; i < 1000; i++) r.add(i)
    expect(r.values()).toHaveLength(10)
    expect(r.count).toBe(1000)
    expect(new Set(r.values()).size).toBe(10)
  })

  it('ordena de fácil a difícil', () => {
    const puzzles = [1500, 1100, 1900].map(
      (rating, i): Puzzle => ({ id: `p${i}`, fen: '8/8/8/8/8/8/8/K6k w - - 0 1', moves: [], rating, source: 'custom' }),
    )
    expect(orderPuzzles(puzzles, 'rating').map((p) => p.rating)).toEqual([1100, 1500, 1900])
    expect(orderPuzzles(puzzles, 'mixed')).toHaveLength(3)
  })
})

describe('texto plano', () => {
  it('acepta FEN ; jugadas ; temas', () => {
    const puzzles = parsePlainText('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1 ; a1a8 ; backRankMate\n# comentario\n')
    expect(puzzles).toHaveLength(1)
    expect(puzzles[0].moves).toEqual(['a1a8'])
    expect(validatePuzzle(puzzles[0])).toBe(true)
  })

  it('descarta FEN inválidas', () => {
    expect(parsePlainText('esto no es una fen ; a1a8')).toHaveLength(0)
  })
})

describe('validación de jugadas', () => {
  const backRank = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'

  it('acepta la jugada esperada', () => {
    expect(verifyMove(backRank, 'a1a8', 'a1a8')).toBe('correct')
  })

  it('rechaza otra jugada legal', () => {
    expect(verifyMove(backRank, 'a1a7', 'a1a8')).toBe('wrong')
  })

  it('acepta un mate alternativo', () => {
    // Dos torres: cualquiera de las dos da mate en la octava.
    const twoRooks = '6k1/5ppp/8/8/8/8/8/RR4K1 w - - 0 1'
    expect(verifyMove(twoRooks, 'b1b8', 'a1a8')).toBe('alternative-mate')
  })

  it('trata "e7e8" como promoción a dama cuando se espera "e7e8q"', () => {
    const promo = '8/4P3/8/8/8/8/8/K6k w - - 0 1'
    expect(verifyMove(promo, 'e7e8', 'e7e8q')).toBe('correct')
  })

  it('escribe la variante en notación algebraica española', () => {
    expect(lineToText(backRank, ['a1a8'])).toBe('1. Ta8#')
    expect(sanToSpanish('Nf3')).toBe('Cf3')
    expect(sanToSpanish('Qxh7#')).toBe('Dxh7#')
    expect(sanToSpanish('exd5')).toBe('exd5')
    expect(sanToSpanish('e8=Q+')).toBe('e8=D+')
    expect(sanToSpanish('O-O-O')).toBe('0-0-0')
  })
})

describe('paquete inicial', () => {
  const data = JSON.parse(readFileSync(new URL('../public/sets/starter-mates.json', import.meta.url), 'utf8'))

  it('trae puzzles y todos son legales', () => {
    expect(data.puzzles.length).toBeGreaterThan(50)
    for (const p of data.puzzles as Puzzle[]) expect(validatePuzzle(p)).toBe(true)
  })

  it('todas las líneas acaban en mate', () => {
    for (const p of data.puzzles as Puzzle[]) {
      expect(lineToText(p.fen, p.moves).endsWith('#')).toBe(true)
    }
  })

  it('ninguna posición deja al rival en jaque con el turno cambiado', () => {
    for (const p of data.puzzles as Puzzle[]) expect(isLegalPosition(p.fen)).toBe(true)
  })
})
