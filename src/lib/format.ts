/** Formateo de tiempos y números para la interfaz (es-ES). */

export function ms2clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Duración larga y legible: "3 h 12 min", "48 s". */
export function ms2human(ms: number): string {
  if (ms <= 0) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} h ${rest} min` : `${h} h`
}

export function seconds1(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

export function nf(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n)
}

export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(y, (m ?? 1) - 1, d ?? 1),
  )
}
