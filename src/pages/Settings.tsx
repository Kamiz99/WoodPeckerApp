import { useRef } from 'react'
import { useStore } from '../state/store'
import { db } from '../lib/db'
import { nf } from '../lib/format'
import type { Settings } from '../types'

function Toggle({
  title,
  hint,
  value,
  onChange,
}: {
  title: string
  hint: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="switch">
      <div className="txt">
        <strong>{title}</strong>
        <span>{hint}</span>
      </div>
      <button
        className="toggle"
        role="switch"
        aria-checked={value}
        aria-label={title}
        onClick={() => onChange(!value)}
      />
    </div>
  )
}

export function SettingsPage() {
  const { state, updateSettings, deletePlan, notify, reload } = useStore()
  const s = state.settings
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<Settings>) => void updateSettings(patch)

  const exportBackup = async () => {
    const data = await db.exportAll()
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `woodpecker-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    notify('Copia de seguridad descargada')
  }

  const importBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      await db.importAll(data)
      await reload()
      notify('Copia restaurada')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Fichero no válido', 'warn')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ajustes</h1>
          <p>Cómo se comporta el entrenador y qué hacer con tus datos.</p>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">
            <h2>Entrenamiento</h2>
          </div>

          <label className="field">
            <span>Modo de resolución</span>
            <select value={s.inputMode} onChange={(e) => set({ inputMode: e.target.value as Settings['inputMode'] })}>
              <option value="direct">Directo · el reloj corre hasta completar la variante</option>
              <option value="declare">Modo libro · calculas, paras el reloj y luego juegas</option>
            </select>
          </label>

          <Toggle
            title="Exigir la variante completa"
            hint="Si se desactiva, basta con acertar la primera jugada."
            value={s.requireFullLine}
            onChange={(v) => set({ requireFullLine: v })}
          />
          <Toggle
            title="Animar la jugada del rival"
            hint="Muestra la jugada que da lugar a la posición antes de empezar el reloj."
            value={s.animateOpponentMove}
            onChange={(v) => set({ animateOpponentMove: v })}
          />
          <Toggle
            title="Pasar solo al siguiente"
            hint="Tras acertar, avanza automáticamente al puzzle siguiente."
            value={s.autoAdvance}
            onChange={(v) => set({ autoAdvance: v })}
          />
          <Toggle
            title="Sonido"
            hint="Pitidos cortos al acertar, fallar y mover."
            value={s.sound}
            onChange={(v) => set({ sound: v })}
          />
          <Toggle
            title="Mostrar el rating del puzzle"
            hint="Ojo: saber que es un 2200 cambia cómo lo miras."
            value={s.showRating}
            onChange={(v) => set({ showRating: v })}
          />
          <Toggle
            title="Mostrar los temas"
            hint="Spoiler considerable: revela el motivo táctico."
            value={s.showThemes}
            onChange={(v) => set({ showThemes: v })}
          />
        </div>

        <div className="card">
          <div className="card-title">
            <h2>Sesiones y tablero</h2>
          </div>

          <label className="field">
            <span>
              Puzzles por sesión: {s.sessionSize === 0 ? 'la cuota diaria del plan' : nf(s.sessionSize)}
            </span>
            <input
              type="range"
              min={0}
              max={200}
              step={5}
              value={s.sessionSize}
              onChange={(e) => set({ sessionSize: Number(e.target.value) })}
            />
          </label>

          <label className="field">
            <span>
              Aviso de tiempo por puzzle:{' '}
              {s.softTimeLimit === 0 ? 'sin aviso' : `${s.softTimeLimit} s (el reloj se pone rojo)`}
            </span>
            <input
              type="range"
              min={0}
              max={600}
              step={15}
              value={s.softTimeLimit}
              onChange={(e) => set({ softTimeLimit: Number(e.target.value) })}
            />
          </label>

          <label className="field">
            <span>Tema del tablero</span>
            <select
              value={s.boardTheme}
              onChange={(e) => set({ boardTheme: e.target.value as Settings['boardTheme'] })}
            >
              <option value="wood">Madera</option>
              <option value="green">Verde</option>
              <option value="blue">Azul</option>
              <option value="gray">Gris</option>
            </select>
          </label>

          <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: 0 }}>
            Atajos de teclado: <code>↵</code> siguiente puzzle · <code>S</code> ver solución.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Tus planes</h2>
        </div>
        {state.plans.length === 0 ? (
          <p style={{ color: 'var(--muted)', margin: 0 }}>Todavía no has creado ningún plan.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th className="num">Ciclo</th>
                <th className="num">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.plans.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="num">{p.currentCycle + 1}/7</td>
                  <td className="num">{p.status === 'finished' ? 'Terminado' : 'En curso'}</td>
                  <td className="num">
                    <button
                      className="btn sm danger"
                      onClick={() => {
                        if (confirm(`¿Borrar el plan "${p.name}" y todo su historial?`)) void deletePlan(p.id)
                      }}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Datos</h2>
        </div>
        <p style={{ color: 'var(--muted)' }}>
          Todo se guarda en este navegador (IndexedDB). Si borras los datos del sitio o cambias de dispositivo, se
          pierde: descarga una copia de vez en cuando.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={exportBackup}>
            Descargar copia
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Restaurar copia
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importBackup(f)
              e.target.value = ''
            }}
          />
          <button
            className="btn danger"
            onClick={async () => {
              if (!confirm('Esto borra sets, planes e historial de este navegador. ¿Seguro?')) return
              await db.wipe()
              await reload()
              notify('Todo borrado', 'warn')
            }}
          >
            Borrar todo
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Créditos</h2>
        </div>
        <ul style={{ color: 'var(--muted)', fontSize: '0.86rem', paddingLeft: 18, margin: 0 }}>
          <li>
            Método: <em>The Woodpecker Method</em>, Axel Smith y Hans Tikkanen (Quality Chess, 2018).
          </li>
          <li>
            Puzzles: base de datos de{' '}
            <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noreferrer noopener">
              Lichess
            </a>{' '}
            (CC0).
          </li>
          <li>
            Tablero:{' '}
            <a href="https://github.com/shaack/cm-chessboard" target="_blank" rel="noreferrer noopener">
              cm-chessboard
            </a>{' '}
            (MIT). Piezas de Colin M. L. Burnett (CC BY-SA 3.0). Reglas:{' '}
            <a href="https://github.com/jhlywa/chess.js" target="_blank" rel="noreferrer noopener">
              chess.js
            </a>
            .
          </li>
        </ul>
      </div>
    </>
  )
}
