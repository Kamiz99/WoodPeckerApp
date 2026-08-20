/** Gráficos en SVG, sin librerías. */

export interface BarDatum {
  label: string
  value: number
  /** Texto que se pinta encima de la barra. */
  caption?: string
  muted?: boolean
}

export function BarChart({
  data,
  height = 190,
  targetLine,
  formatValue,
}: {
  data: BarDatum[]
  height?: number
  /** Línea de referencia horizontal (por ejemplo, el objetivo de tiempo). */
  targetLine?: { value: number; label: string }
  formatValue?: (v: number) => string
}) {
  const width = 560
  const padLeft = 8
  const padBottom = 26
  const padTop = 22
  const max = Math.max(1, ...data.map((d) => d.value), targetLine?.value ?? 0)
  const innerH = height - padBottom - padTop
  const slot = (width - padLeft * 2) / Math.max(1, data.length)
  const barW = Math.min(56, slot * 0.62)

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <line className="axis" x1={padLeft} y1={height - padBottom} x2={width - padLeft} y2={height - padBottom} />
      {targetLine && targetLine.value > 0 && (
        <>
          <line
            className="target"
            x1={padLeft}
            x2={width - padLeft}
            y1={height - padBottom - (targetLine.value / max) * innerH}
            y2={height - padBottom - (targetLine.value / max) * innerH}
          />
          <text x={width - padLeft} y={height - padBottom - (targetLine.value / max) * innerH - 5} textAnchor="end">
            {targetLine.label}
          </text>
        </>
      )}
      {data.map((d, i) => {
        // Los ciclos aún sin datos se dibujan como una barra apagada mínima:
        // así se ve de un vistazo cuánto queda del método.
        const h = d.value > 0 ? Math.max(2, (d.value / max) * innerH) : 3
        const x = padLeft + slot * i + (slot - barW) / 2
        const y = height - padBottom - h
        return (
          <g key={`${d.label}-${i}`}>
            <rect className={`bar${d.muted || d.value === 0 ? ' pending' : ''}`} x={x} y={y} width={barW} height={h} rx={4} />
            {d.caption !== undefined && (
              <text x={x + barW / 2} y={Math.max(12, y - 6)} textAnchor="middle">
                {d.caption ?? (formatValue ? formatValue(d.value) : d.value)}
              </text>
            )}
            <text x={x + barW / 2} y={height - padBottom + 15} textAnchor="middle">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Anillo de progreso. */
export function Ring({
  value,
  size = 108,
  stroke = 10,
  label,
  sub,
}: {
  value: number
  size?: number
  stroke?: number
  label: string
  sub?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${sub ?? ''}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * clamped} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        style={{ fill: 'var(--text)', fontSize: 20, fontWeight: 680, fontVariantNumeric: 'tabular-nums' }}
      >
        {label}
      </text>
      {sub && (
        <text x="50%" y="65%" textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 11 }}>
          {sub}
        </text>
      )}
    </svg>
  )
}
