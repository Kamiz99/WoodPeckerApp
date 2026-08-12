import { useMemo } from 'react'
import { useStore } from '../state/store'
import { BarChart } from '../components/Charts'
import { cycleStats, todayISO, troubleSpots, addDays } from '../lib/woodpecker'
import { ms2human, nf, pct, seconds1 } from '../lib/format'
import { THEME_LABELS } from '../lib/importer'

export function Stats() {
  const { state, activePlan, puzzleIndex } = useStore()

  const stats = useMemo(() => (activePlan ? cycleStats(activePlan) : []), [activePlan])

  const daily = useMemo(() => {
    if (!activePlan) return []
    const days: { label: string; value: number }[] = []
    const today = todayISO()
    for (let i = 13; i >= 0; i--) {
      const iso = addDays(today, -i)
      const count = state.attempts.filter(
        (a) => a.planId === activePlan.id && todayISO(new Date(a.ts)) === iso,
      ).length
      days.push({ label: iso.slice(8), value: count })
    }
    return days
  }, [activePlan, state.attempts])

  const trouble = useMemo(
    () => (activePlan ? troubleSpots(state.attempts, activePlan.id).slice(0, 15) : []),
    [activePlan, state.attempts],
  )

  if (!activePlan) {
    return (
      <div className="empty">
        <h2>Sin plan activo</h2>
        <p>Cuando crees un plan y empieces a resolver, aquí verás la curva de tiempos ciclo a ciclo.</p>
      </div>
    )
  }

  const done = stats.filter((s) => s.totalMs > 0)
  const first = stats[0]
  const target = first?.totalMs ? first.totalMs / 2 : 0
  const totalTime = stats.reduce((s, c) => s + c.totalMs, 0)
  const totalSolved = stats.reduce((s, c) => s + c.solved, 0)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Progreso</h1>
          <p>
            La señal que importa no es el porcentaje de aciertos, sino el tiempo total por ciclo: debería caer casi a la
            mitad cada vez.
          </p>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="label">Puzzles resueltos</div>
          <div className="value">{nf(totalSolved)}</div>
          <div className="hint">en todos los ciclos</div>
        </div>
        <div className="stat">
          <div className="label">Tiempo invertido</div>
          <div className="value">{ms2human(totalTime)}</div>
        </div>
        <div className="stat">
          <div className="label">Ciclos cerrados</div>
          <div className="value">{stats.filter((s) => s.status === 'done').length} / 7</div>
        </div>
        <div className="stat">
          <div className="label">Mejor aceleración</div>
          <div className="value">
            {done.some((d) => d.speedup > 0)
              ? `${Math.max(...done.map((d) => d.speedup)).toFixed(1)}×`
              : '—'}
          </div>
          <div className="hint">frente al ciclo 1</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Tiempo total por ciclo</h2>
          <span className="pill">objetivo: la mitad cada vez</span>
        </div>
        <BarChart
          data={stats.map((s) => ({
            label: `C${s.index + 1}`,
            value: s.totalMs,
            caption: s.totalMs ? ms2human(s.totalMs) : '',
            muted: s.totalMs === 0,
          }))}
          targetLine={target ? { value: target, label: `½ del ciclo 1 · ${ms2human(target)}` } : undefined}
        />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">
            <h2>Detalle por ciclo</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ciclo</th>
                <th className="num">Hechos</th>
                <th className="num">Acierto</th>
                <th className="num">Media</th>
                <th className="num">Total</th>
                <th className="num">×</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.index} className={s.index === activePlan.currentCycle ? 'current' : undefined}>
                  <td>{s.index + 1}</td>
                  <td className="num">
                    {nf(s.solved)}/{nf(s.total)}
                  </td>
                  <td className="num">{s.solved ? pct(s.accuracy) : '—'}</td>
                  <td className="num">{s.solved ? seconds1(s.avgMs) : '—'}</td>
                  <td className="num">{s.totalMs ? ms2human(s.totalMs) : '—'}</td>
                  <td className="num">{s.speedup ? `${s.speedup.toFixed(1)}×` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">
            <h2>Actividad (14 días)</h2>
          </div>
          <BarChart data={daily} height={170} />
          <div className="card-title" style={{ marginTop: 18 }}>
            <h2>Acierto por ciclo</h2>
          </div>
          <BarChart
            data={stats.map((s) => ({
              label: `C${s.index + 1}`,
              value: Math.round(s.accuracy * 100),
              caption: s.solved ? pct(s.accuracy) : '',
              muted: s.solved === 0,
            }))}
            height={170}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Tus puntos negros</h2>
          <span className="pill">
            {trouble.length} {trouble.length === 1 ? 'puzzle' : 'puzzles'}
          </span>
        </div>
        {trouble.length === 0 ? (
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            Todavía no hay fallos registrados. Aquí aparecerán los puzzles que se te resisten ciclo tras ciclo: son
            justo los que hay que mirar con calma.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Puzzle</th>
                <th>Temas</th>
                <th className="num">Rating</th>
                <th className="num">Fallos</th>
                <th className="num">Intentos</th>
              </tr>
            </thead>
            <tbody>
              {trouble.map((t) => {
                const p = puzzleIndex.get(t.puzzleId)
                return (
                  <tr key={t.puzzleId}>
                    <td>
                      {p?.url ? (
                        <a href={p.url} target="_blank" rel="noreferrer noopener">
                          {t.puzzleId}
                        </a>
                      ) : (
                        t.puzzleId
                      )}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                      {(p?.themes ?? [])
                        .slice(0, 3)
                        .map((x) => THEME_LABELS[x] ?? x)
                        .join(', ') || '—'}
                    </td>
                    <td className="num">{p?.rating ?? '—'}</td>
                    <td className="num">{t.fails}</td>
                    <td className="num">{t.tries}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
