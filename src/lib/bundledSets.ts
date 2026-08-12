/**
 * Paquetes de puzzles que se distribuyen con la app.
 *
 * Se cargan con `import()` dinámico: no pesan en el arranque y, al ir dentro
 * del paquete, no hacen falta peticiones de red (ni al abrir la app desde un
 * único fichero HTML).
 */

import type { Puzzle } from '../types'

export interface BundledPack {
  key: 'tactics' | 'mates'
  title: string
  description: string
  primary: boolean
  source: 'lichess' | 'starter'
}

export const BUNDLED_PACKS: BundledPack[] = [
  {
    key: 'tactics',
    title: 'Tácticas Lichess · 1128',
    description:
      'El set completo para hacer el método: 222 fáciles, 762 intermedias y 144 avanzadas, con el mismo reparto que el libro.',
    primary: true,
    source: 'lichess',
  },
  {
    key: 'mates',
    title: 'Mates verificados · 156',
    description: 'Mates en 1 y en 2 con solución única. Para calentar o para hacer un ciclo corto.',
    primary: false,
    source: 'starter',
  },
]

interface PackFile {
  name: string
  notes?: string
  puzzles: Puzzle[]
}

export async function loadBundledPack(key: BundledPack['key']): Promise<PackFile> {
  const data =
    key === 'tactics'
      ? await import('../../public/sets/tactics-1128.json')
      : await import('../../public/sets/starter-mates.json')
  return (data.default ?? data) as unknown as PackFile
}
