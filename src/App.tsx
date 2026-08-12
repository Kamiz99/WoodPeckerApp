import type { ComponentType } from 'react'
import iconUrl from './assets/icon.svg'
import { navigate, useRoute, type Route } from './lib/router'
import { useStore } from './state/store'
import { IconBook, IconChart, IconGear, IconHome, IconStack, IconTarget } from './components/Icons'
import { Dashboard } from './pages/Dashboard'
import { Trainer } from './pages/Trainer'
import { Sets } from './pages/Sets'
import { Stats } from './pages/Stats'
import { Method } from './pages/Method'
import { SettingsPage } from './pages/Settings'

const NAV: { route: Route; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { route: '/', label: 'Inicio', Icon: IconHome },
  { route: '/entrenar', label: 'Entrenar', Icon: IconTarget },
  { route: '/sets', label: 'Sets', Icon: IconStack },
  { route: '/estadisticas', label: 'Progreso', Icon: IconChart },
  { route: '/metodo', label: 'Método', Icon: IconBook },
  { route: '/ajustes', label: 'Ajustes', Icon: IconGear },
]

export function App() {
  const route = useRoute()
  const { state } = useStore()

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src={iconUrl} alt="" />
          <div>
            <strong>Woodpecker</strong>
            <span>Entrenamiento táctico</span>
          </div>
        </div>
        <nav className="nav">
          {NAV.map(({ route: r, label, Icon }) => (
            <button
              key={r}
              className={route === r ? 'active' : ''}
              onClick={() => navigate(r)}
              aria-current={route === r ? 'page' : undefined}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          Método de Axel Smith y Hans Tikkanen.
          <br />
          Tus datos se quedan en este dispositivo.
        </div>
      </aside>

      <main className="main">
        {!state.ready ? (
          <div className="empty">Cargando tu entrenamiento…</div>
        ) : (
          <>
            {route === '/' && <Dashboard />}
            {route === '/entrenar' && <Trainer />}
            {route === '/sets' && <Sets />}
            {route === '/estadisticas' && <Stats />}
            {route === '/metodo' && <Method />}
            {route === '/ajustes' && <SettingsPage />}
          </>
        )}
      </main>

      {state.toast && <div className={`toast ${state.toast.kind}`}>{state.toast.text}</div>}
    </div>
  )
}
