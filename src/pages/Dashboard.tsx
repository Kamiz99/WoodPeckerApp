import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { navigate } from '../lib/router'
import { PlanWizard } from '../components/PlanWizard'
import { Ring } from '../components/Charts'
import { IconBolt, IconPlay, IconUpload } from '../components/Icons'
import { ms2human, nf, pct, dateLabel, seconds1 } from '../lib/format'
import {
  MAX_CYCLES,
  cycleDeadline,
  cycleRemaining,
  currentCycle,
  dailyQuota,
  daysLeft,
  solvedToday,
  todayISO,
} from '../lib/woodpecker'

export function Dashboard() {
  const { state, activePlan, activeSet, setActivePlan } = useStore()
  const [wizard, setWizard] = useState(false)

  const data = useMemo(() => {
    if (!activePlan) return null
    const cycle = currentCycle(activePlan)
    const today = todayISO()
    const done = solvedToday(state.attempts, activePlan.id, activePlan.currentCycle, today)
    const quota = dailyQuota(cycle, today)
    const total = cycle.order.length
    const attemptsCycle = state.attempts.filter(
      (a) => a.planId === activePlan.id && a.cycle === activePlan.currentCycle,
    )
    const correct = attemptsCycle.filter((a) => a.correct).length
    return {
      cycle,
      today,
      done,
      quota,
      total,
      remaining: cycleRemaining(cycle),
      accuracy: attemptsCycle.length ? correct / attemptsCycle.length : 0,
      avgMs: attemptsCycle.length ? cycle.totalMs / attemptsCycle.length : 0,
      daysLeft: daysLeft(cycle, today),
      deadline: cycleDeadline(cycle),
    }
  }, [activePlan, state.attempts])

  if (!activePlan || !activeSet || !data) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Hola 👋</h1>
            <p>
              El Woodpecker Method consiste en resolver un set fijo de tácticas una y otra vez, cada vez en menos
              tiempo. Monta tu set, crea el plan y la app se encarga del calendario, del cronómetro y de las
              estadísticas.
            </p>
          </div>
        </div>

        <div className="card">
          <h2>Empieza en dos pasos</h2>
          <ol className="steps" style={{ marginTop: 14 }}>
            <li>
              <strong>Elige tu set de puzzles</strong>
              <p style={{ color: 'var(--muted)', marginBottom: 8 }}>
                La app trae 1128 tácticas de Lichess listas para usar (mismo reparto de dificultad que el libro).
                También puedes importar la base entera y filtrar por rating y temas.
              </p>
              <button className="btn" onClick={() => navigate('/sets')}>
                <IconUpload /> Ir a Sets
              </button>
            </li>
            <li>
              <strong>Crea el plan de 7 ciclos</strong>
              <p style={{ color: 'var(--muted)', marginBottom: 8 }}>
                28 días el primero, luego 14, 7, 4, 2, 1, 1. La app calcula tu cuota diaria.
              </p>
              <button className="btn primary" onClick={() => setWizard(true)} disabled={state.sets.length === 0}>
                <IconBolt /> Crear plan
              </button>
            </li>
          </ol>
        </div>

        <div className="card">
          <h2>¿Y esto por qué funciona?</h2>
          <p style={{ color: 'var(--muted)', margin: '8px 0 12px' }}>
            Repetir el mismo material convierte el cálculo consciente en reconocimiento de patrones. Es la diferencia
            entre "calcular" un mate del pasillo y "verlo".
          </p>
          <button className="btn ghost" onClick={() => navigate('/metodo')}>
            Leer el método completo
          </button>
        </div>

        {wizard && <PlanWizard onClose={() => setWizard(false)} />}
      </>
    )
  }

  const { cycle, done, quota, total, remaining, accuracy, avgMs } = data
  const cycleProgress = total ? cycle.cursor / total : 0
  const dayProgress = quota ? Math.min(1, done / quota) : 1
  const previous = activePlan.cycles[activePlan.currentCycle - 1]

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{activePlan.name}</h1>
          <p>
            Ciclo {cycle.index + 1} de {MAX_CYCLES} · set de {nf(total)} puzzles · fecha límite{' '}
            {dateLabel(data.deadline)} ({data.daysLeft} {data.daysLeft === 1 ? 'día' : 'días'})
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {state.plans.length > 1 && (
            <select
              value={activePlan.id}
              onChange={(e) => void setActivePlan(e.target.value)}
              style={{ width: 'auto' }}
              aria-label="Cambiar de plan"
            >
              {state.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn primary lg" onClick={() => navigate('/entrenar')} disabled={remaining === 0}>
            <IconPlay /> {done > 0 ? 'Seguir sesión' : 'Empezar sesión'}
          </button>
        </div>
      </div>

      {activePlan.status === 'finished' && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <h2>🎉 Método completado</h2>
          <p style={{ color: 'var(--muted)', margin: '6px 0 0' }}>
            Has terminado los ciclos de este plan. Mira el progreso en Progreso, y cuando quieras empieza otro plan con
            un set nuevo (o el mismo, más difícil).
          </p>
        </div>
      )}

      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="label">Hoy</div>
          <div className="value">
            {done} / {quota}
          </div>
          <div className="hint">{done >= quota ? 'Cuota cumplida ✔' : `Faltan ${Math.max(0, quota - done)}`}</div>
          <div className="progress" style={{ marginTop: 8 }}>
            <div style={{ width: `${dayProgress * 100}%` }} />
          </div>
        </div>
        <div className="stat">
          <div className="label">Ciclo {cycle.index + 1}</div>
          <div className="value">
            {nf(cycle.cursor)} / {nf(total)}
          </div>
          <div className="hint">{nf(remaining)} pendientes</div>
          <div className="progress" style={{ marginTop: 8 }}>
            <div style={{ width: `${cycleProgress * 100}%` }} />
          </div>
        </div>
        <div className="stat">
          <div className="label">Acierto en el ciclo</div>
          <div className="value">{cycle.solved ? pct(accuracy) : '—'}</div>
          <div className="hint">{nf(cycle.correct)} correctos</div>
        </div>
        <div className="stat">
          <div className="label">Tiempo medio</div>
          <div className="value">{cycle.solved ? seconds1(avgMs) : '—'}</div>
          <div className="hint">{ms2human(cycle.totalMs)} en este ciclo</div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">
            <h2>Progreso del ciclo</h2>
            <span className="pill accent">{cycle.plannedDays} días asignados</span>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <Ring value={cycleProgress} label={pct(cycleProgress)} sub={`${nf(cycle.cursor)}/${nf(total)}`} />
            <div style={{ flex: 1 }}>
              <p style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>
                A ritmo de <strong style={{ color: 'var(--text)' }}>{nf(quota)} puzzles/día</strong> terminas el ciclo
                el {dateLabel(data.deadline)}.
              </p>
              {previous && previous.totalMs > 0 && (
                <p style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>
                  Objetivo de tiempo: por debajo de <strong style={{ color: 'var(--accent)' }}>{ms2human(previous.totalMs / 2)}</strong>{' '}
                  (la mitad del ciclo anterior: {ms2human(previous.totalMs)}).
                </p>
              )}
              <p style={{ color: 'var(--muted)', fontSize: '0.86rem', marginBottom: 0 }}>
                Días con actividad en este ciclo: {cycle.activeDays.length}.
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <h2>Los 7 ciclos</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ciclo</th>
                <th className="num">Días</th>
                <th className="num">Hechos</th>
                <th className="num">Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {activePlan.cycleDays.map((days, i) => {
                const c = activePlan.cycles[i]
                return (
                  <tr key={i} className={i === activePlan.currentCycle ? 'current' : undefined}>
                    <td>
                      {i + 1}
                      {c?.status === 'done' && ' ✔'}
                    </td>
                    <td className="num">{days}</td>
                    <td className="num">{c ? `${nf(c.solved)}/${nf(c.order.length)}` : '—'}</td>
                    <td className="num">{c?.totalMs ? ms2human(c.totalMs) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
