import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Board } from '../components/Board'
import { useStore } from '../state/store'
import { navigate } from '../lib/router'
import { applyUci, isGameOver, lineToText, sideToMove, verifyMove } from '../lib/chess'
import { ms2clock, ms2human, nf, pct, seconds1 } from '../lib/format'
import { sound } from '../lib/sound'
import { THEME_LABELS } from '../lib/importer'
import { currentCycle, dailyQuota, solvedToday, todayISO } from '../lib/woodpecker'
import { IconCheck, IconClock, IconPlay, IconX } from '../components/Icons'
import type { Puzzle } from '../types'

type Phase = 'intro' | 'calculating' | 'solving' | 'done-ok' | 'done-bad' | 'session-end'

const DEFAULT_EXTRA_BLOCK = 20

export function Trainer() {
  const { state, activePlan, activeSet, puzzleIndex, finishPuzzle } = useStore()
  const settings = state.settings

  const [queue, setQueue] = useState<string[] | null>(null)
  const [qIndex, setQIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('intro')
  const [pos, setPos] = useState('')
  const [moveIdx, setMoveIdx] = useState(0)
  const [version, setVersion] = useState(0)
  const [lastMove, setLastMove] = useState<string | null>(null)
  const [errorSquare, setErrorSquare] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [results, setResults] = useState<{ id: string; ok: boolean; ms: number }[]>([])
  const [cycleDone, setCycleDone] = useState<{ completed: boolean; finished: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const startRef = useRef(0)
  const accRef = useRef(0)
  const runningRef = useRef(false)
  const timeoutsRef = useRef<number[]>([])

  const cycle = activePlan ? currentCycle(activePlan) : null

  // ---- Construcción de la sesión ----------------------------------------

  /** Lo que toca hoy: cuota del día menos lo ya resuelto (o el tamaño fijo elegido). */
  const plannedSession = (() => {
    if (!activePlan || !cycle) return 0
    const today = todayISO()
    const quota = dailyQuota(cycle, today)
    const already = solvedToday(state.attempts, activePlan.id, activePlan.currentCycle, today)
    const target = settings.sessionSize > 0 ? settings.sessionSize : Math.max(0, quota - already)
    const remaining = cycle.order.length - cycle.cursor
    return Math.max(0, Math.min(remaining, target))
  })()

  const startSession = useCallback(
    (size: number) => {
      if (!cycle) return
      const batch = cycle.order.slice(cycle.cursor, cycle.cursor + Math.max(1, size))
      setQueue(batch)
      setQIndex(0)
      setResults([])
      setCycleDone(null)
    },
    [cycle],
  )

  const puzzle: Puzzle | null = useMemo(() => {
    if (!queue || qIndex >= queue.length) return null
    return puzzleIndex.get(queue[qIndex]) ?? null
  }, [queue, qIndex, puzzleIndex])

  // ---- Cronómetro --------------------------------------------------------

  const startClock = useCallback(() => {
    startRef.current = Date.now()
    runningRef.current = true
  }, [])

  const stopClock = useCallback(() => {
    if (runningRef.current) {
      accRef.current += Date.now() - startRef.current
      runningRef.current = false
    }
    return accRef.current
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (runningRef.current) setElapsed(accRef.current + (Date.now() - startRef.current))
    }, 100)
    return () => window.clearInterval(id)
  }, [])

  const clearTimers = () => {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t))
    timeoutsRef.current = []
  }
  const later = (fn: () => void, ms: number) => {
    timeoutsRef.current.push(window.setTimeout(fn, ms))
  }

  useEffect(() => clearTimers, [])

  // ---- Carga del puzzle actual -------------------------------------------

  useEffect(() => {
    if (!puzzle) return
    clearTimers()
    accRef.current = 0
    setElapsed(0)
    setMoveIdx(0)
    setErrorSquare(null)

    const showPre = settings.animateOpponentMove && puzzle.preFen && puzzle.preMove
    setPos(showPre ? puzzle.preFen! : puzzle.fen)
    setLastMove(showPre ? null : (puzzle.preMove ?? null))
    setVersion((v) => v + 1)

    const begin = () => {
      setPos(puzzle.fen)
      setLastMove(puzzle.preMove ?? null)
      setVersion((v) => v + 1)
      setPhase(settings.inputMode === 'declare' ? 'calculating' : 'solving')
      startClock()
    }

    if (showPre) later(begin, 600)
    else begin()
  }, [puzzle, settings.animateOpponentMove, settings.inputMode, startClock])

  // ---- Resolución --------------------------------------------------------

  const record = useCallback(
    async (ok: boolean, gaveUp: boolean, depth: number) => {
      if (!activePlan || !puzzle) return
      const ms = stopClock()
      setElapsed(ms) // el reloj de pantalla solo se refresca cada 100 ms
      setBusy(true)
      setResults((r) => [...r, { id: puzzle.id, ok, ms }])
      const res = await finishPuzzle({
        planId: activePlan.id,
        puzzleId: puzzle.id,
        ms,
        correct: ok,
        gaveUp,
        depth,
      })
      setBusy(false)
      if (res.cycleCompleted) setCycleDone({ completed: true, finished: res.methodFinished })
    },
    [activePlan, puzzle, finishPuzzle, stopClock],
  )

  const succeed = useCallback(
    (finalPos: string, played: string) => {
      setPos(finalPos)
      setLastMove(played)
      setVersion((v) => v + 1)
      setPhase('done-ok')
      if (settings.sound) sound.correct()
      void record(true, false, moveIdx + 1)
      if (settings.autoAdvance) later(() => next(), 1100)
    },
    // `next` se define abajo; la referencia es estable por useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.sound, settings.autoAdvance, moveIdx, record],
  )

  const fail = useCallback(
    (square: string | null, depth: number, gaveUp = false) => {
      setPhase('done-bad')
      setErrorSquare(square)
      setVersion((v) => v + 1)
      if (settings.sound) sound.wrong()
      void record(false, gaveUp, depth)
    },
    [settings.sound, record],
  )

  const onMove = useCallback(
    (uci: string) => {
      if (!puzzle || phase !== 'solving' || busy) return
      const expected = puzzle.moves[moveIdx]
      if (!expected) return
      const verdict = verifyMove(pos, uci, expected)

      if (verdict === 'wrong') {
        fail(uci.slice(2, 4), moveIdx)
        return
      }

      const afterUser = applyUci(pos, uci)
      if (!afterUser) return
      if (settings.sound) sound.move()

      const reply = puzzle.moves[moveIdx + 1]
      const endsGame = isGameOver(afterUser) || verdict === 'alternative-mate'

      if (!settings.requireFullLine || !reply || endsGame) {
        succeed(afterUser, uci)
        return
      }

      setPos(afterUser)
      setLastMove(uci)
      setVersion((v) => v + 1)
      later(() => {
        const afterReply = applyUci(afterUser, reply)
        if (!afterReply) return
        setPos(afterReply)
        setLastMove(reply)
        setMoveIdx((i) => i + 2)
        setVersion((v) => v + 1)
        if (settings.sound) sound.move()
      }, 420)
    },
    [puzzle, phase, busy, moveIdx, pos, settings.requireFullLine, settings.sound, fail, succeed],
  )

  const showSolution = useCallback(() => {
    if (!puzzle || (phase !== 'solving' && phase !== 'calculating')) return
    fail(null, moveIdx, true)
  }, [puzzle, phase, moveIdx, fail])

  const next = useCallback(() => {
    clearTimers()
    if (!queue) return
    if (qIndex + 1 >= queue.length) {
      setPhase('session-end')
      if (settings.sound) sound.finish()
      return
    }
    setQIndex((i) => i + 1)
  }, [queue, qIndex, settings.sound])

  // Al completar el ciclo, la sesión termina aquí.
  useEffect(() => {
    if (cycleDone?.completed) {
      clearTimers()
      setPhase('session-end')
    }
  }, [cycleDone])

  // ---- Teclado -----------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (phase === 'done-ok' || phase === 'done-bad') next()
        else if (phase === 'calculating') {
          stopClock()
          setPhase('solving')
        }
      }
      if (e.key.toLowerCase() === 's' && (phase === 'solving' || phase === 'calculating')) showSolution()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, next, showSolution, stopClock])

  // ---- Render ------------------------------------------------------------

  if (!activePlan || !activeSet || !cycle) {
    return (
      <div className="empty">
        <h2>No hay ningún plan activo</h2>
        <p>Crea un set de puzzles y un plan para empezar a entrenar.</p>
        <button className="btn primary" onClick={() => navigate('/')}>
          Ir al inicio
        </button>
      </div>
    )
  }

  if (!queue) {
    const remaining = cycle.order.length - cycle.cursor
    const size = plannedSession || Math.min(remaining, DEFAULT_EXTRA_BLOCK)
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Sesión de hoy</h1>
            <p>
              Ciclo {cycle.index + 1} · quedan {nf(remaining)} puzzles del set · cuota de hoy:{' '}
              {nf(dailyQuota(cycle))}.
            </p>
          </div>
        </div>
        <div className="card">
          {remaining === 0 ? (
            <p>Has terminado el ciclo. Vuelve al inicio para ver el resumen.</p>
          ) : (
            <>
              <h2>{plannedSession > 0 ? `${nf(size)} puzzles` : 'Cuota diaria cumplida'}</h2>
              <p style={{ color: 'var(--muted)' }}>
                {plannedSession > 0
                  ? 'Sin pistas y sin mover piezas para tantear: calcula hasta el final y solo entonces juega.'
                  : `Ya has hecho la cuota de hoy. Si quieres seguir, la app te preparará ${nf(size)} puzzles más.`}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button className="btn primary lg" onClick={() => startSession(size)}>
                  <IconPlay /> Empezar {nf(size)} puzzles
                </button>
                {[10, 25, 50, 100].map((n) => (
                  <button key={n} className="btn" onClick={() => startSession(Math.min(remaining, n))}>
                    {n}
                  </button>
                ))}
                <button className="btn ghost" onClick={() => startSession(remaining)}>
                  Todo el ciclo ({nf(remaining)})
                </button>
              </div>
            </>
          )}
        </div>
      </>
    )
  }

  if (phase === 'session-end' || !puzzle) {
    const ok = results.filter((r) => r.ok).length
    const totalMs = results.reduce((s, r) => s + r.ms, 0)
    return (
      <>
        <div className="page-head">
          <div>
            <h1>{cycleDone?.finished ? '¡Método completado!' : cycleDone?.completed ? '¡Ciclo completado!' : 'Sesión terminada'}</h1>
            <p>
              {cycleDone?.finished
                ? 'Has llegado al final de los 7 ciclos (o has resuelto el set entero en un día).'
                : cycleDone?.completed
                  ? `El ciclo ${cycle.index + 1} está cerrado. El siguiente tiene la mitad de días: toca ir más rápido.`
                  : 'Buen trabajo. Vuelve mañana para la siguiente tanda.'}
            </p>
          </div>
        </div>
        <div className="grid cols-3" style={{ marginBottom: 14 }}>
          <div className="stat">
            <div className="label">Resueltos</div>
            <div className="value">{results.length}</div>
          </div>
          <div className="stat">
            <div className="label">Acierto</div>
            <div className="value">{results.length ? pct(ok / results.length) : '—'}</div>
            <div className="hint">
              {ok} correctos · {results.length - ok} fallados
            </div>
          </div>
          <div className="stat">
            <div className="label">Tiempo</div>
            <div className="value">{ms2human(totalMs)}</div>
            <div className="hint">{results.length ? seconds1(totalMs / results.length) : '—'} por puzzle</div>
          </div>
        </div>
        <div className="card">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn primary"
              onClick={() => {
                setQueue(null)
                setPhase('intro')
              }}
            >
              Otra tanda
            </button>
            <button className="btn" onClick={() => navigate('/')}>
              Ir al inicio
            </button>
            <button className="btn ghost" onClick={() => navigate('/estadisticas')}>
              Ver progreso
            </button>
          </div>
        </div>
      </>
    )
  }

  const solverColor = sideToMove(puzzle.fen)
  const interactive = phase === 'solving'
  const overLimit = settings.softTimeLimit > 0 && elapsed > settings.softTimeLimit * 1000
  const solutionText = lineToText(puzzle.fen, puzzle.moves)
  const doneCount = results.length
  const okCount = results.filter((r) => r.ok).length

  return (
    <div className="trainer">
      <div>
        <div className="turn-banner">
          <span>
            <span className={`turn-dot ${solverColor}`} />
            Juegan {solverColor === 'w' ? 'blancas' : 'negras'}
            {phase === 'calculating' && ' · calcula sin tocar el tablero'}
          </span>
          <span className={`clock ${overLimit ? 'over' : ''}`} style={{ fontSize: '1.1rem' }}>
            {ms2clock(elapsed)}
          </span>
        </div>

        <div className="board-wrap">
          <Board
            fen={pos}
            orientation={solverColor}
            interactive={interactive}
            version={version}
            lastMove={lastMove}
            errorSquare={errorSquare}
            theme={settings.boardTheme}
            onMove={onMove}
          />
        </div>

        <div className={`feedback ${phase === 'done-ok' ? 'ok' : phase === 'done-bad' ? 'bad' : ''}`}>
          {phase === 'calculating' && (
            <>
              <strong>Modo libro</strong>
              <span style={{ color: 'var(--muted)' }}>
                Calcula la variante entera en tu cabeza. Cuando la tengas, para el reloj y juégala.
              </span>
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn primary"
                  onClick={() => {
                    stopClock()
                    setPhase('solving')
                  }}
                >
                  <IconClock /> Ya lo tengo (parar reloj)
                </button>
              </div>
            </>
          )}
          {phase === 'solving' && (
            <>
              <strong>
                {moveIdx === 0 ? 'Encuentra la mejor jugada' : `Sigue la variante (jugada ${moveIdx / 2 + 1})`}
              </strong>
              <span style={{ color: 'var(--muted)' }}>
                Arrastra o pulsa las casillas. Pulsa <code>S</code> para rendirte y ver la solución.
              </span>
            </>
          )}
          {phase === 'done-ok' && (
            <>
              <strong style={{ color: 'var(--ok)' }}>
                <IconCheck className="inline" /> ¡Correcto! · {seconds1(elapsed)}
              </strong>
              <span className="solution">{solutionText}</span>
            </>
          )}
          {phase === 'done-bad' && (
            <>
              <strong style={{ color: 'var(--bad)' }}>
                <IconX className="inline" /> Fallado · {seconds1(elapsed)}
              </strong>
              <span className="solution">{solutionText}</span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {(phase === 'done-ok' || phase === 'done-bad') && (
            <button className="btn primary" onClick={next} autoFocus>
              Siguiente <span style={{ opacity: 0.6 }}>↵</span>
            </button>
          )}
          {(phase === 'solving' || phase === 'calculating') && (
            <button className="btn danger" onClick={showSolution}>
              Ver solución (S)
            </button>
          )}
          {puzzle.url && (phase === 'done-ok' || phase === 'done-bad') && (
            <a className="btn ghost" href={puzzle.url} target="_blank" rel="noreferrer noopener">
              Analizar en Lichess
            </a>
          )}
          <button
            className="btn ghost"
            onClick={() => {
              clearTimers()
              setPhase('session-end')
            }}
          >
            Terminar sesión
          </button>
        </div>
      </div>

      <aside>
        <div className="card">
          <div className="card-title">
            <h2>Sesión</h2>
            <span className="pill accent">
              {doneCount} / {queue.length}
            </span>
          </div>
          <div className="progress">
            <div style={{ width: `${(doneCount / queue.length) * 100}%` }} />
          </div>
          <div className="session-rail">
            {queue.map((id, i) => (
              <i
                key={id + i}
                className={i < results.length ? (results[i].ok ? 'ok' : 'bad') : i === qIndex ? 'now' : ''}
              />
            ))}
          </div>
          <div className="grid cols-2" style={{ marginTop: 14 }}>
            <div>
              <div className="label" style={{ color: 'var(--muted)', fontSize: '0.74rem' }}>
                ACIERTO
              </div>
              <strong>{doneCount ? pct(okCount / doneCount) : '—'}</strong>
            </div>
            <div>
              <div className="label" style={{ color: 'var(--muted)', fontSize: '0.74rem' }}>
                MEDIA
              </div>
              <strong>
                {doneCount ? seconds1(results.reduce((s, r) => s + r.ms, 0) / doneCount) : '—'}
              </strong>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <h2>Ciclo {cycle.index + 1}</h2>
            <span className="pill">{cycle.plannedDays} días</span>
          </div>
          <div className="progress">
            <div style={{ width: `${(cycle.cursor / Math.max(1, cycle.order.length)) * 100}%` }} />
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '8px 0 0' }}>
            {nf(cycle.cursor)} de {nf(cycle.order.length)} · {ms2human(cycle.totalMs)} acumulados
          </p>
          {activePlan.cycles[cycle.index - 1]?.totalMs ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '4px 0 0' }}>
              Objetivo: bajar de {ms2human(activePlan.cycles[cycle.index - 1].totalMs / 2)}.
            </p>
          ) : null}
        </div>

        {(settings.showRating || settings.showThemes) && (
          <div className="card">
            <div className="card-title">
              <h2>Este puzzle</h2>
            </div>
            {settings.showRating && puzzle.rating ? (
              <p style={{ margin: 0 }}>
                Rating <strong>{puzzle.rating}</strong>
              </p>
            ) : null}
            {settings.showThemes && puzzle.themes?.length ? (
              <div className="chips" style={{ marginTop: 8 }}>
                {puzzle.themes.slice(0, 6).map((t) => (
                  <span className="chip" key={t}>
                    {THEME_LABELS[t] ?? t}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  )
}
