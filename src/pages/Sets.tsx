import { useRef, useState } from 'react'
import { useStore } from '../state/store'
import { Modal } from '../components/Modal'
import { PlanWizard } from '../components/PlanWizard'
import { IconBolt, IconStack, IconUpload } from '../components/Icons'
import { nf } from '../lib/format'
import { uid } from '../lib/id'
import {
  DEFAULT_FILTERS,
  THEME_LABELS,
  orderPuzzles,
  parsePlainText,
  parsePuzzleJson,
  validatePuzzle,
  type ImportFilters,
} from '../lib/importer'
import type { ImportResponse } from '../workers/importWorker'
import type { Puzzle, PuzzleSet } from '../types'

const THEME_CHOICES = [
  'mate',
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'deflection',
  'attraction',
  'sacrifice',
  'hangingPiece',
  'trappedPiece',
  'backRankMate',
  'promotion',
  'endgame',
  'middlegame',
  'quietMove',
  'defensiveMove',
  'intermezzo',
]

export function Sets() {
  const { state, saveSet, deleteSet, notify } = useStore()
  const [importing, setImporting] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [planFor, setPlanFor] = useState<string | null>(null)
  const [detail, setDetail] = useState<PuzzleSet | null>(null)

  const loadStarter = async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sets/starter-mates.json`)
      if (!res.ok) throw new Error('No se encontró el paquete inicial')
      const data = await res.json()
      const puzzles: Puzzle[] = (data.puzzles as Puzzle[]).filter(validatePuzzle)
      const set: PuzzleSet = {
        id: uid('set'),
        name: data.name ?? 'Paquete inicial',
        createdAt: Date.now(),
        source: 'starter',
        puzzles,
        notes: data.notes,
      }
      await saveSet(set)
      notify(`Paquete inicial cargado: ${nf(puzzles.length)} puzzles`)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Error cargando el paquete', 'warn')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sets de puzzles</h1>
          <p>
            Un set es la materia prima del método: se elige una vez y no se toca más. Lo normal es entre 200 y 1000
            puzzles algo por encima de tu nivel.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => setImporting(true)}>
            <IconUpload /> Importar de Lichess
          </button>
          <button className="btn" onClick={() => setPasting(true)}>
            Pegar puzzles
          </button>
          <button className="btn ghost" onClick={loadStarter}>
            Paquete inicial
          </button>
        </div>
      </div>

      {state.sets.length === 0 ? (
        <div className="card empty">
          <IconStack />
          <h2>Aún no tienes ningún set</h2>
          <p>
            La forma rápida: descarga la base de puzzles de Lichess (CC0) desde{' '}
            <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noreferrer noopener">
              database.lichess.org
            </a>{' '}
            e impórtala aquí. La app filtra por rating y temas y se queda solo con los puzzles que pidas.
          </p>
          <button className="btn primary" onClick={() => setImporting(true)}>
            <IconUpload /> Importar ahora
          </button>
        </div>
      ) : (
        <div className="grid cols-2">
          {state.sets.map((set) => {
            const ratings = set.puzzles.map((p) => p.rating ?? 0).filter(Boolean)
            const min = ratings.length ? Math.min(...ratings) : 0
            const max = ratings.length ? Math.max(...ratings) : 0
            const plans = state.plans.filter((p) => p.setId === set.id)
            return (
              <div className="card" key={set.id}>
                <div className="card-title">
                  <h2>{set.name}</h2>
                  <span className="pill accent">{nf(set.puzzles.length)}</span>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>
                  {ratings.length ? `Rating ${min}–${max}` : 'Sin rating'} · {set.source}
                  {set.notes ? ` · ${set.notes}` : ''}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <button className="btn primary sm" onClick={() => setPlanFor(set.id)}>
                    <IconBolt /> Crear plan
                  </button>
                  <button className="btn sm" onClick={() => setDetail(set)}>
                    Detalles
                  </button>
                  <button
                    className="btn sm danger"
                    onClick={() => {
                      if (plans.length) {
                        notify('Hay planes que usan este set. Bórralos antes.', 'warn')
                        return
                      }
                      if (confirm(`¿Borrar el set "${set.name}"?`)) void deleteSet(set.id)
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {importing && <ImportModal onClose={() => setImporting(false)} />}
      {pasting && <PasteModal onClose={() => setPasting(false)} />}
      {planFor && <PlanWizard preselectSetId={planFor} onClose={() => setPlanFor(null)} />}
      {detail && <DetailModal set={detail} onClose={() => setDetail(null)} />}
    </>
  )
}

// ---------------------------------------------------------------------------

function ImportModal({ onClose }: { onClose: () => void }) {
  const { saveSet, notify } = useStore()
  const [filters, setFilters] = useState<ImportFilters>(DEFAULT_FILTERS)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<{ pct: number; scanned: number; matched: number } | null>(null)
  const [name, setName] = useState('')
  const workerRef = useRef<Worker | null>(null)

  const patch = (p: Partial<ImportFilters>) => setFilters((f) => ({ ...f, ...p }))

  const toggleTheme = (t: string) =>
    patch({ themes: filters.themes.includes(t) ? filters.themes.filter((x) => x !== t) : [...filters.themes, t] })

  const run = () => {
    if (!file) return
    const worker = new Worker(new URL('../workers/importWorker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    setProgress({ pct: 0, scanned: 0, matched: 0 })
    worker.onmessage = async (e: MessageEvent<ImportResponse>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setProgress({
          pct: msg.total ? msg.bytes / msg.total : 0,
          scanned: msg.scanned,
          matched: msg.matched,
        })
      } else if (msg.type === 'done') {
        worker.terminate()
        const puzzles = msg.puzzles.filter(validatePuzzle)
        if (!puzzles.length) {
          setProgress(null)
          notify('Ningún puzzle cumple los filtros. Prueba a ampliar el rango.', 'warn')
          return
        }
        await saveSet({
          id: uid('set'),
          name: name.trim() || `Lichess ${filters.ratingMin}–${filters.ratingMax}`,
          createdAt: Date.now(),
          source: 'lichess',
          puzzles,
          notes: `${filters.themes.length ? filters.themes.map((t) => THEME_LABELS[t] ?? t).join(', ') : 'todos los temas'} · ${nf(msg.matched)} candidatos`,
        })
        notify(`Set creado con ${nf(puzzles.length)} puzzles`)
        onClose()
      } else {
        worker.terminate()
        setProgress(null)
        notify(`Error al importar: ${msg.message}`, 'warn')
      }
    }
    worker.postMessage({ file, filters })
  }

  return (
    <Modal
      title="Importar puzzles de Lichess"
      onClose={() => {
        workerRef.current?.terminate()
        onClose()
      }}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={run} disabled={!file || !!progress}>
            {progress ? 'Importando…' : 'Crear set'}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>
        Descarga <code>lichess_db_puzzle.csv.zst</code> de{' '}
        <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noreferrer noopener">
          database.lichess.org
        </a>{' '}
        y suéltalo aquí. No hace falta descomprimirlo y el fichero no sale de tu ordenador: se lee en streaming dentro
        del navegador.
      </p>

      <label className="field">
        <span>Fichero (.csv, .csv.zst, .json o .txt)</span>
        <input
          type="file"
          accept=".csv,.zst,.json,.txt,.epd"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="grid cols-2">
        <label className="field">
          <span>Rating mínimo</span>
          <input
            type="number"
            value={filters.ratingMin}
            step={50}
            onChange={(e) => patch({ ratingMin: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Rating máximo</span>
          <input
            type="number"
            value={filters.ratingMax}
            step={50}
            onChange={(e) => patch({ ratingMax: Number(e.target.value) })}
          />
        </label>
      </div>

      <label className="field">
        <span>Nº de puzzles del set: {nf(filters.count)}</span>
        <input
          type="range"
          min={50}
          max={2000}
          step={50}
          value={filters.count}
          onChange={(e) => patch({ count: Number(e.target.value) })}
        />
        <div className="chips" style={{ marginTop: 6 }}>
          {[200, 300, 500, 1000, 1128].map((n) => (
            <button key={n} className="chip" aria-pressed={filters.count === n} onClick={() => patch({ count: n })}>
              {nf(n)}
            </button>
          ))}
        </div>
      </label>

      <label className="field">
        <span>Temas (opcional: si eliges alguno, solo entran puzzles con ese tema)</span>
        <div className="chips">
          {THEME_CHOICES.map((t) => (
            <button key={t} className="chip" aria-pressed={filters.themes.includes(t)} onClick={() => toggleTheme(t)}>
              {THEME_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      </label>

      <div className="grid cols-2">
        <label className="field">
          <span>Orden dentro del set</span>
          <select value={filters.order} onChange={(e) => patch({ order: e.target.value as ImportFilters['order'] })}>
            <option value="rating">De fácil a difícil</option>
            <option value="mixed">Dificultad alterna</option>
            <option value="random">Aleatorio</option>
          </select>
        </label>
        <label className="field">
          <span>Popularidad mínima ({filters.minPopularity})</span>
          <input
            type="range"
            min={-100}
            max={100}
            step={10}
            value={filters.minPopularity}
            onChange={(e) => patch({ minPopularity: Number(e.target.value) })}
          />
        </label>
      </div>

      <label className="field">
        <span>Nombre del set</span>
        <input
          type="text"
          value={name}
          placeholder={`Lichess ${filters.ratingMin}–${filters.ratingMax}`}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      {progress && (
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div className="progress">
            <div style={{ width: `${Math.round(progress.pct * 100)}%` }} />
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '8px 0 0' }}>
            {nf(progress.scanned)} puzzles leídos · {nf(progress.matched)} cumplen los filtros
          </p>
        </div>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------

function PasteModal({ onClose }: { onClose: () => void }) {
  const { saveSet, notify } = useStore()
  const [text, setText] = useState('')
  const [name, setName] = useState('')

  const create = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    let puzzles: Puzzle[] = []
    try {
      puzzles = trimmed.startsWith('{') || trimmed.startsWith('[') ? parsePuzzleJson(trimmed) : parsePlainText(trimmed)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Formato no reconocido', 'warn')
      return
    }
    const valid = puzzles.filter(validatePuzzle)
    if (!valid.length) {
      notify('No se ha podido leer ningún puzzle válido', 'warn')
      return
    }
    await saveSet({
      id: uid('set'),
      name: name.trim() || 'Set propio',
      createdAt: Date.now(),
      source: 'custom',
      puzzles: orderPuzzles(valid, 'rating'),
    })
    notify(`Set creado con ${nf(valid.length)} puzzles`)
    onClose()
  }

  return (
    <Modal
      title="Pegar puzzles"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={create}>
            Crear set
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>
        Una línea por puzzle: <code>FEN ; jugadas en UCI ; temas</code>. La FEN es la posición a resolver y la primera
        jugada es la tuya. También acepta JSON exportado por esta app.
      </p>
      <label className="field">
        <span>Nombre</span>
        <input type="text" value={name} placeholder="Set propio" onChange={(e) => setName(e.target.value)} />
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1 ; a1a8 ; backRankMate mateIn1'}
      />
    </Modal>
  )
}

// ---------------------------------------------------------------------------

function DetailModal({ set, onClose }: { set: PuzzleSet; onClose: () => void }) {
  const buckets = new Map<number, number>()
  const themes = new Map<string, number>()
  for (const p of set.puzzles) {
    const b = Math.floor((p.rating ?? 0) / 200) * 200
    buckets.set(b, (buckets.get(b) ?? 0) + 1)
    for (const t of p.themes ?? []) themes.set(t, (themes.get(t) ?? 0) + 1)
  }
  const topThemes = [...themes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  const rows = [...buckets.entries()].sort((a, b) => a[0] - b[0])
  const max = Math.max(1, ...rows.map(([, v]) => v))

  const download = () => {
    const blob = new Blob([JSON.stringify({ name: set.name, puzzles: set.puzzles }, null, 1)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${set.name.replace(/\W+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      title={set.name}
      onClose={onClose}
      footer={
        <button className="btn" onClick={download}>
          Descargar JSON
        </button>
      }
    >
      <p style={{ color: 'var(--muted)' }}>
        {nf(set.puzzles.length)} puzzles · origen: {set.source}
        {set.notes ? ` · ${set.notes}` : ''}
      </p>
      {rows.length > 0 && (
        <>
          <h3 style={{ margin: '14px 0 6px' }}>Reparto por rating</h3>
          <table>
            <tbody>
              {rows.map(([bucket, n]) => (
                <tr key={bucket}>
                  <td style={{ width: 90 }}>
                    {bucket}–{bucket + 199}
                  </td>
                  <td>
                    <div className="progress">
                      <div style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                  </td>
                  <td className="num" style={{ width: 60 }}>
                    {nf(n)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {topThemes.length > 0 && (
        <>
          <h3 style={{ margin: '18px 0 6px' }}>Temas más frecuentes</h3>
          <div className="chips">
            {topThemes.map(([t, n]) => (
              <span className="chip" key={t}>
                {THEME_LABELS[t] ?? t} · {nf(n)}
              </span>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
