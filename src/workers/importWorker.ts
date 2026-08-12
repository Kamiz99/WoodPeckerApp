/// <reference lib="webworker" />
/**
 * Lee el fichero de puzzles en streaming (soporta .csv y .csv.zst) sin bloquear
 * la interfaz. La base completa de Lichess pesa >1 GB descomprimida, así que
 * nunca se carga entera: se filtra al vuelo y solo se conservan N puzzles.
 */

import { Decompress } from 'fzstd'
import {
  Reservoir,
  isHeaderLine,
  matchesFilters,
  orderPuzzles,
  parseCsvLine,
  parsePlainText,
  parsePuzzleJson,
  rowToPuzzle,
  type ImportFilters,
  type RawRow,
} from '../lib/importer'
import type { Puzzle } from '../types'

export type ImportRequest = { file: File; filters: ImportFilters }
export type ImportResponse =
  | { type: 'progress'; bytes: number; total: number; scanned: number; matched: number }
  | { type: 'done'; puzzles: Puzzle[]; scanned: number; matched: number }
  | { type: 'error'; message: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = async (e: MessageEvent<ImportRequest>) => {
  const { file, filters } = e.data
  try {
    const name = file.name.toLowerCase()
    if (name.endsWith('.json')) {
      const puzzles = parsePuzzleJson(await file.text()).slice(0, filters.count)
      post({ type: 'done', puzzles, scanned: puzzles.length, matched: puzzles.length })
      return
    }
    if (name.endsWith('.txt') || name.endsWith('.epd')) {
      const puzzles = parsePlainText(await file.text()).slice(0, filters.count)
      post({ type: 'done', puzzles, scanned: puzzles.length, matched: puzzles.length })
      return
    }
    await streamCsv(file, filters, name.endsWith('.zst'))
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

function post(msg: ImportResponse) {
  ctx.postMessage(msg)
}

async function streamCsv(file: File, filters: ImportFilters, compressed: boolean) {
  const reservoir = new Reservoir<RawRow>(Math.max(1, filters.count))
  const decoder = new TextDecoder()
  let tail = ''
  let scanned = 0
  let matched = 0
  let bytes = 0
  let lastPost = 0

  const handleText = (text: string) => {
    tail += text
    let nl = tail.indexOf('\n')
    while (nl !== -1) {
      const line = tail.slice(0, nl).trim()
      tail = tail.slice(nl + 1)
      nl = tail.indexOf('\n')
      if (!line || isHeaderLine(line)) continue
      scanned++
      const row = parseCsvLine(line)
      if (row && matchesFilters(row, filters)) {
        matched++
        reservoir.add(row)
      }
    }
  }

  const handleChunk = (chunk: Uint8Array) => handleText(decoder.decode(chunk, { stream: true }))

  const reader = file.stream().getReader()
  const decompressor = compressed ? new Decompress((chunk) => handleChunk(chunk)) : null

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (decompressor) decompressor.push(value)
    else handleChunk(value)

    const now = Date.now()
    if (now - lastPost > 120) {
      lastPost = now
      post({ type: 'progress', bytes, total: file.size, scanned, matched })
    }
  }
  if (decompressor) decompressor.push(new Uint8Array(0), true)
  handleText(decoder.decode())
  if (tail.trim()) handleText('\n')

  const puzzles: Puzzle[] = []
  for (const row of reservoir.values()) {
    const p = rowToPuzzle(row)
    if (p) puzzles.push(p)
  }
  post({ type: 'done', puzzles: orderPuzzles(puzzles, filters.order), scanned, matched })
}
