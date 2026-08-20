/**
 * Los sprites del tablero van dentro del paquete, no como ficheros sueltos.
 *
 * cm-chessboard descarga su sprite por XHR salvo que ya exista un div con el id
 * esperado: si lo inyectamos nosotros, se lo salta y las piezas se referencian
 * con `href="#wk"` contra este documento. Así la app funciona sin red desde el
 * primer momento y se puede publicar como un único fichero HTML.
 */

import piecesSprite from '../assets/pieces-standard.svg?raw'
import markersSprite from '../assets/markers.svg?raw'

function inject(id: string, svg: string): void {
  if (document.getElementById(id)) return
  const wrapper = document.createElement('div')
  wrapper.id = id
  wrapper.style.transform = 'scale(0)'
  wrapper.style.position = 'absolute'
  wrapper.setAttribute('aria-hidden', 'true')
  wrapper.insertAdjacentHTML('afterbegin', svg.replace(/<\?xml[^>]*\?>/, ''))
  document.body.appendChild(wrapper)
}

export function injectBoardSprites(): void {
  inject('cm-chessboard-sprite', piecesSprite)
  inject('cm-chessboard-markers', markersSprite)
}
