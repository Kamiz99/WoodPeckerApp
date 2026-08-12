# Woodpecker · entrenamiento táctico

Aplicación web para hacer el **Woodpecker Method** de Axel Smith y Hans Tikkanen: resolver un set fijo de tácticas
(200, 500, 1000… los que elijas) y repetirlo entero en 7 ciclos, cada uno con **la mitad de días** que el anterior,
hasta que los patrones dejan de calcularse y se reconocen.

**Pruébala aquí:** <https://claude.ai/code/artifact/2d616aeb-8e6c-4b47-ba44-931843002f78> (la app entera en un único
fichero HTML, generado con `npm run build:single`).

Funciona en el navegador, sin cuenta y sin servidor: los puzzles, el historial y las estadísticas se quedan en tu
dispositivo (IndexedDB). Se puede instalar como app y usar sin conexión.

## El método en 20 segundos

| Ciclo | 1  | 2  | 3 | 4 | 5 | 6 | 7 |
| ----- | -- | -- | - | - | - | - | - |
| Días  | 28 | 14 | 7 | 4 | 2 | 1 | 1 |

1. Eliges un set fijo de puzzles y **no lo cambias nunca**.
2. Ciclo 1: lo resuelves entero en cuatro semanas, cronometrando.
3. Cada ciclo siguiente tiene la mitad de días (redondeando hacia arriba). Mismos puzzles, mismo orden.
4. Termina cuando completas el set en **un solo día**, o al acabar el séptimo ciclo.

La medida real del progreso no es el porcentaje de aciertos: es el **tiempo total por ciclo**, que debería caer casi a
la mitad cada vez. La app lo mide y lo dibuja.

La explicación larga (origen, cómo resolver, cuántos puzzles elegir, críticas y fuentes) está dentro de la app, en la
sección **Método**.

## Qué hace la app

- **1128 tácticas incluidas**: un set de puzzles reales de [Lichess](https://database.lichess.org/#puzzles) (CC0) ya
  preparado, con el mismo reparto de dificultad que el libro (222 fáciles, 762 intermedios, 144 avanzados). Se carga
  desde **Sets → Paquetes incluidos**, sin descargar nada.
- **Constructor de sets**: importa la base de puzzles de [Lichess](https://database.lichess.org/#puzzles) (CC0)
  filtrando por rating, temas, popularidad y número de partidas. Lee el `.csv` o directamente el `.csv.zst`
  comprimido en streaming dentro del navegador, así que el fichero de 1 GB no se carga en memoria ni sale de tu
  ordenador.
- **Planes de 7 ciclos** con calendario automático y **cuota diaria** («hoy te tocan 36»).
- **Entrenador** con tablero real: arrastrar o pulsar, promoción, variantes completas, aceptación de mates
  alternativos, cronómetro por posición y atajos de teclado.
- **Modo libro**: el tablero se queda bloqueado mientras calculas; pulsas «Ya lo tengo», se para el reloj y solo
  entonces juegas la variante. Es lo más parecido a resolver del libro sin mover las piezas.
- **Estadísticas por ciclo**: tiempo total, media por puzzle, acierto, aceleración frente al ciclo 1 y la lista de tus
  «puntos negros» (los puzzles que fallas una y otra vez).
- **Paquete de mates** con 156 mates en 1 y en 2 verificados por búsqueda exhaustiva (solución única), para calentar
  o para hacer un ciclo corto.
- Copia de seguridad en JSON, funcionamiento sin conexión e interfaz en español.

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
npm test           # tests de la lógica del método y del importador
npm run gen:puzzles  # regenera el paquete de mates verificados
npm run build:single # empaqueta la app entera en un solo HTML autocontenido
```

Para regenerar el set de 1128 tácticas desde la base oficial:

```bash
# descarga y descomprime lichess_db_puzzle.csv de https://database.lichess.org/#puzzles
node scripts/build-tactics-set.mjs lichess_db_puzzle.csv public/sets/tactics-1128.json
```

### Usar tu propio set (rating y temas a medida)

El set incluido cubre un rango amplio (900–2400). Si prefieres ajustarlo a tu nivel:

1. Descarga `lichess_db_puzzle.csv.zst` de <https://database.lichess.org/#puzzles>.
2. En la app: **Sets → Importar de Lichess**, suelta el fichero (comprimido vale).
3. Elige rango de rating, temas y cuántos quieres. Un buen punto de partida: tu rating de táctica **+100/+300** y
   entre 200 y 1000 puzzles.
4. **Crear plan** y a entrenar.

> Consejo de calibración: si aciertas más del 90 % en el ciclo 1, el set es demasiado fácil; por debajo del 50 %,
> demasiado difícil.

## Cómo está hecho

- React 19 + TypeScript + Vite, sin framework de estado ni librerías de UI.
- [`chess.js`](https://github.com/jhlywa/chess.js) para las reglas y [`cm-chessboard`](https://github.com/shaack/cm-chessboard)
  (MIT) para el tablero; piezas de Colin M. L. Burnett (CC BY-SA 3.0).
- [`fzstd`](https://github.com/101arrowz/fzstd) para descomprimir Zstandard en el navegador.
- La importación corre en un **Web Worker** con muestreo por depósito (*reservoir sampling*), para elegir N puzzles
  repartidos por todo el fichero sin cargarlo entero.
- Persistencia en IndexedDB, con reserva en memoria si el navegador la bloquea (navegación privada, iframes).
- Piezas del tablero, worker de importación y paquetes de puzzles van dentro del paquete: cero peticiones de red en
  marcha, y por eso la app cabe en un único HTML de 810 KB.
- Gráficos en SVG escritos a mano.

```
src/
  lib/woodpecker.ts   el método: calendario de ciclos, cuotas, cierre de ciclo, estadísticas
  lib/importer.ts     conversión y filtrado de la base de Lichess
  lib/chess.ts        UCI ⇄ SAN (en español), validación de jugadas y de posiciones
  workers/            importación en streaming
  pages/              Inicio · Entrenar · Sets · Progreso · Método · Ajustes
scripts/              generador de los paquetes incluidos (mates verificados y set de 1128 tácticas)
tests/                lógica del método, importador y validación de puzzles
```

## Aviso

Esta app **no está afiliada** a Quality Chess ni a los autores del libro, y **no incluye** los 1128 ejercicios de
*The Woodpecker Method*: implementa el método con puzzles de dominio público. Si el sistema te funciona, el libro
merece la pena: sus ejercicios están escogidos y comprobados uno a uno.

## Licencia

MIT para el código de la aplicación. Las piezas del tablero son CC BY-SA 3.0 y los puzzles de Lichess, CC0.
