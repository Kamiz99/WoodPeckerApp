import { useMemo, useState } from 'react'
import { navigate } from '../lib/router'
import { Modal } from './Modal'
import { useStore } from '../state/store'
import { createPlan, cycleSchedule } from '../lib/woodpecker'
import { nf } from '../lib/format'
import type { PuzzleSet } from '../types'

export function PlanWizard({ onClose, preselectSetId }: { onClose: () => void; preselectSetId?: string }) {
  const { state, savePlan, setActivePlan, notify } = useStore()
  const sets = state.sets
  const [setId, setSetId] = useState(preselectSetId ?? sets[0]?.id ?? '')
  const [name, setName] = useState('')
  const [firstCycleDays, setFirstCycleDays] = useState(28)
  const [shuffleEachCycle, setShuffleEachCycle] = useState(false)

  const set: PuzzleSet | undefined = sets.find((s) => s.id === setId)
  const schedule = useMemo(() => cycleSchedule(firstCycleDays), [firstCycleDays])
  const size = set?.puzzles.length ?? 0

  const create = async () => {
    if (!set) return
    const plan = createPlan({
      name: name.trim() || `Woodpecker · ${set.name}`,
      set,
      firstCycleDays,
      shuffleEachCycle,
    })
    await savePlan(plan)
    await setActivePlan(plan.id)
    notify('Plan creado. ¡A picar madera!')
    onClose()
    navigate('/')
  }

  return (
    <Modal
      title="Nuevo plan Woodpecker"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={create} disabled={!set}>
            Crear plan
          </button>
        </>
      }
    >
      {sets.length === 0 ? (
        <p className="muted">
          Todavía no tienes ningún set de puzzles. Ve a <strong>Sets</strong> y crea uno primero.
        </p>
      ) : (
        <>
          <label className="field">
            <span>Set de puzzles (no se podrá cambiar: esa es la gracia del método)</span>
            <select value={setId} onChange={(e) => setSetId(e.target.value)}>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {nf(s.puzzles.length)} puzzles
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Nombre del plan</span>
            <input
              type="text"
              value={name}
              placeholder={set ? `Woodpecker · ${set.name}` : 'Mi plan'}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Duración del primer ciclo</span>
            <select value={firstCycleDays} onChange={(e) => setFirstCycleDays(Number(e.target.value))}>
              <option value={28}>28 días · 4 semanas (el del libro)</option>
              <option value={21}>21 días · 3 semanas</option>
              <option value={14}>14 días · 2 semanas (sets pequeños)</option>
              <option value={35}>35 días · 5 semanas (sets grandes o poco tiempo)</option>
            </select>
          </label>

          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <h3 style={{ marginBottom: 8 }}>Calendario de los 7 ciclos</h3>
            <table>
              <thead>
                <tr>
                  <th>Ciclo</th>
                  <th className="num">Días</th>
                  <th className="num">Puzzles/día</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((days, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="num">{days}</td>
                    <td className="num">{size ? nf(Math.ceil(size / days)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ color: 'var(--muted)', fontSize: '0.8rem', margin: '10px 0 0' }}>
              Cada ciclo dispone de la mitad de días que el anterior. El método termina cuando completas el set en un
              solo día (o al acabar el ciclo 7).
            </p>
          </div>

          <div className="switch" style={{ marginTop: 14 }}>
            <div className="txt">
              <strong>Barajar en cada ciclo</strong>
              <span>El libro mantiene el orden. Barajar evita memorizar la secuencia, pero pierdes la referencia.</span>
            </div>
            <button
              className="toggle"
              role="switch"
              aria-checked={shuffleEachCycle}
              aria-label="Barajar en cada ciclo"
              onClick={() => setShuffleEachCycle((v) => !v)}
            />
          </div>
        </>
      )}
    </Modal>
  )
}
