/**
 * Empaqueta la app entera en un único fichero HTML autocontenido: sin peticiones
 * de red, sin ficheros sueltos. Sirve para publicarla en cualquier sitio que
 * acepte una sola página (o para guardarla en el móvil y usarla sin conexión).
 *
 *   npm run build:single
 *
 * Salida: dist-single/woodpecker.html
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const OUT_DIR = 'dist-single'
const OUT_FILE = join(OUT_DIR, 'woodpecker.html')

console.log('Compilando en modo fichero único…')
execFileSync('npx', ['vite', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, SINGLE_FILE: '1', VITE_SINGLE_FILE: '1' },
})

const html = readFileSync(join(OUT_DIR, 'index.html'), 'utf8')

const scriptSrc = html.match(/<script[^>]+src="([^"]+)"/)?.[1]
const styleHref = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/)?.[1]
if (!scriptSrc || !styleHref) {
  console.error('No se encontraron el script o los estilos en el HTML generado.')
  process.exit(1)
}

const asset = (url) => readFileSync(join(OUT_DIR, url.replace(/^\.?\//, '')), 'utf8')
const js = asset(scriptSrc)
const css = asset(styleHref)

// Un "</script>" dentro de una cadena cerraría la etiqueta antes de tiempo.
const safeJs = js.replace(/<\/script>/gi, '<\\/script>')

// El charset va lo primero: si quien sirve el fichero no declara UTF-8, el
// navegador lo deduce de aquí y los acentos no se rompen.
const page = `<meta charset="utf-8" />
<title>Woodpecker</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`

writeFileSync(OUT_FILE, page)
const kb = Math.round(statSync(OUT_FILE).size / 1024)
console.log(`\n${OUT_FILE} · ${kb} KB (todo incluido: puzzles, piezas y estilos)`)
