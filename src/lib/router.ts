import { useEffect, useState } from 'react'

/** Router mínimo basado en hash: funciona en GitHub Pages sin configuración. */

export type Route = '/' | '/entrenar' | '/sets' | '/estadisticas' | '/metodo' | '/ajustes'

const ROUTES: Route[] = ['/', '/entrenar', '/sets', '/estadisticas', '/metodo', '/ajustes']

function currentRoute(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  return (ROUTES.find((r) => r === hash) ?? '/') as Route
}

export function navigate(route: Route): void {
  if (currentRoute() === route) return
  window.location.hash = route
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(currentRoute)
  useEffect(() => {
    const onChange = () => {
      setRoute(currentRoute())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
