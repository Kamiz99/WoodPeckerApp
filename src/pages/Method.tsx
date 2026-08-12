import { cycleSchedule } from '../lib/woodpecker'

const SOURCES: { label: string; url: string }[] = [
  { label: 'Quality Chess — The Woodpecker Method (Smith & Tikkanen, 2018)', url: 'https://www.qualitychess.co.uk/products/1/294/the_woodpecker_method_by_axel_smith_and_hans_tikkanen/' },
  { label: 'Forward Chess — What is the Woodpecker Method?', url: 'https://forwardchess.com/blog/what-is-the-woodpecker-method/' },
  { label: 'Nate Solon (Zwischenzug) — The Woodpecker Method', url: 'https://www.zwischenzug.gg/p/the-woodpecker-method' },
  { label: 'Nate Solon — The Woodpecker Method, Revisited', url: 'https://www.zwischenzug.gg/p/the-woodpecker-method-revisited' },
  { label: 'Chessable — Cyclical review: la idea del Woodpecker aplicada a cualquier curso', url: 'https://www.chessable.com/blog/cyclical-review-the-woodpecker-method-feature-you-can-use-on-any-tactics-course-custom-reps/' },
  { label: 'Lichess — foro: dudas sobre el libro y el método', url: 'https://lichess.org/forum/general-chess-discussion/the-woodpecker-method--questions-regarding-the-book-and-the-method' },
  { label: 'Base de puzzles de Lichess (CC0)', url: 'https://database.lichess.org/#puzzles' },
]

export function Method() {
  const schedule = cycleSchedule(28)

  return (
    <div className="prose">
      <div className="page-head">
        <div>
          <h1>El Woodpecker Method</h1>
          <p>Qué es, por qué funciona, cómo se hace bien y qué hace exactamente esta app por ti.</p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>La idea en una frase</h2>
        <blockquote>
          Resuelve un montón de tácticas seguidas; luego vuelve a resolver <strong>las mismas</strong> una y otra vez,
          cada vez más rápido.
        </blockquote>
        <p>
          El nombre viene del pájaro carpintero: picar la misma madera, en el mismo sitio, muchas veces. Lo popularizó
          el GM sueco <strong>Hans Tikkanen</strong>, que en 2010 lo usó durante unas semanas y ese mismo verano firmó
          sus tres normas de GM en siete semanas. Su compañero de entrenamiento, el GM{' '}
          <strong>Axel Smith</strong>, lo convirtió en libro junto a él: <em>The Woodpecker Method</em> (Quality Chess,
          2018), con <strong>1128 ejercicios</strong> repartidos en tres niveles: 222 fáciles, 762 intermedios y 144
          avanzados.
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Por qué repetir, si ya sé la solución</h2>
        <p>
          Ésa es justo la objeción y también la respuesta. Resolver un puzzle nuevo entrena el <em>cálculo</em>;
          repetir el mismo material entrena el <em>reconocimiento</em>. La primera vez que ves un mate de la coz lo
          calculas; a la quinta, lo ves. En una partida real casi nunca tienes tiempo de calcular todas las tácticas
          posibles: necesitas que el patrón te salte a la vista para saber dónde mirar.
        </p>
        <p>
          Los beneficios que reivindican los autores: visión táctica más afilada, menos errores de bulto, mejor juego en
          apuros de tiempo e intuición más fiable.
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>El protocolo, paso a paso</h2>
        <ol className="steps">
          <li>
            <strong>Elige un set fijo y no lo cambies.</strong> Entre 100 y 1000+ puzzles según tu ambición y tu tiempo.
            Deben ser difíciles pero abordables: si aciertas el 95 %, son demasiado fáciles; si aciertas el 40 %, son
            demasiado difíciles.
          </li>
          <li>
            <strong>Ciclo 1: resuélvelo entero en ~4 semanas</strong>, cronometrando. Aquí importa entender, no correr.
          </li>
          <li>
            <strong>Cada ciclo siguiente tiene la mitad de días</strong> que el anterior (redondeando hacia arriba):
            28 → 14 → 7 → 4 → 2 → 1 → 1. Los mismos puzzles, en el mismo orden.
          </li>
          <li>
            <strong>Termina cuando resuelvas el set entero en un solo día</strong>, o al acabar el séptimo ciclo si no
            llegas.
          </li>
        </ol>

        <h3>Cómo resolver cada posición</h3>
        <ul>
          <li>
            <strong>Sin mover las piezas.</strong> Calcula en la cabeza hasta el final de la variante, como en una
            partida.
          </li>
          <li>
            <strong>Sin pistas.</strong> No mires cuántas jugadas dura ni el tema táctico antes de resolver.
          </li>
          <li>
            <strong>Decide y comprueba.</strong> Si la variante principal falla, es un fallo aunque "ibas por ahí".
          </li>
          <li>
            <strong>No te atasques.</strong> Si una posición se te atraganta, mira la solución, entiéndela y sigue: ya
            volverá en el próximo ciclo.
          </li>
        </ul>

        <h3>Calendario tipo (primer ciclo de 28 días)</h3>
        <table>
          <thead>
            <tr>
              <th>Ciclo</th>
              <th className="num">Días</th>
              <th className="num">300 puzzles</th>
              <th className="num">1000 puzzles</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((days, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td className="num">{days}</td>
                <td className="num">{Math.ceil(300 / days)}/día</td>
                <td className="num">{Math.ceil(1000 / days)}/día</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>¿Cuántos puzzles elijo?</h2>
        <ul>
          <li>
            <strong>200–300</strong> si entrenas 20–30 minutos al día o es tu primera vez. Es el tamaño que la mayoría
            termina de verdad.
          </li>
          <li>
            <strong>500</strong> como término medio ambicioso.
          </li>
          <li>
            <strong>1000+</strong> es el formato del libro: exige un compromiso casi profesional en los últimos ciclos
            (mil puzzles en un día son muchas horas seguidas).
          </li>
        </ul>
        <p>
          Regla práctica: elige un tamaño que puedas completar en una sola sentada de 60–90 minutos hacia el ciclo 4 o
          5. Es habitual acabar 4–8 veces más rápido que en el primer ciclo.
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Las críticas (que conviene conocer)</h2>
        <ul>
          <li>
            <strong>Memorización.</strong> Repetir tanto puede llevar a recordar la solución en vez de reconocer el
            patrón. Mitigación: sets grandes, y en la app puedes barajar el orden en cada ciclo.
          </li>
          <li>
            <strong>Consume mucho tiempo.</strong> En los ciclos finales el método se come casi todo tu entrenamiento.
          </li>
          <li>
            <strong>Frustración.</strong> Fallar por tercera vez el mismo puzzle escuece.
          </li>
          <li>
            <strong>Transferencia.</strong> Resolver posiciones "con solución garantizada" no es lo mismo que jugar,
            donde primero hay que sospechar que hay algo.
          </li>
        </ul>
        <p>
          Aun así, el consenso entre quienes lo han hecho es claro: si buscas transferencia rápida a la partida, la
          repetición gana a resolver puzzles nuevos sin parar.
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Qué hace esta app</h2>
        <ul>
          <li>Construye el set fijo (importando la base de Lichess con los filtros que elijas) y lo congela.</li>
          <li>Genera el calendario de 7 ciclos con la regla de las mitades y te dice tu cuota de hoy.</li>
          <li>
            Cronometra cada posición, guarda cada intento y compara ciclo contra ciclo: el gráfico de tiempo total es la
            medida real del progreso.
          </li>
          <li>
            Tiene <strong>modo libro</strong>: el tablero queda bloqueado mientras calculas y solo se desbloquea cuando
            pulsas "Ya lo tengo" (que además para el reloj).
          </li>
          <li>Marca tus puntos negros: los puzzles que fallas ciclo tras ciclo.</li>
          <li>Funciona sin conexión y no envía nada a ningún servidor.</li>
        </ul>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Fuentes</h2>
        <ul>
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer noopener">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <p style={{ color: 'var(--muted)', fontSize: '0.84rem', marginBottom: 0 }}>
          Esta app no está afiliada a Quality Chess ni a los autores del libro: implementa el método, no reproduce sus
          ejercicios. Si el método te sirve, compra el libro: los 1128 ejercicios están escogidos y verificados uno a
          uno.
        </p>
      </div>
    </div>
  )
}
