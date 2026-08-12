import { useEffect, useRef } from 'react'
import { Chessboard, BORDER_TYPE, FEN, INPUT_EVENT_TYPE, type MoveInputEvent } from 'cm-chessboard/src/Chessboard.js'
import { MARKER_TYPE, Markers } from 'cm-chessboard/src/extensions/markers/Markers.js'
import { PromotionDialog } from 'cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js'
import { isLegalUci, moveSquares, needsPromotion } from '../lib/chess'

const THEME_CLASS: Record<string, string> = {
  wood: 'chess-club',
  green: 'green',
  blue: 'blue',
  gray: 'default',
}

export interface BoardProps {
  fen: string
  orientation: 'w' | 'b'
  interactive?: boolean
  /** Se incrementa para forzar la resincronización del tablero con `fen`. */
  version?: number
  /** Jugada a resaltar (UCI). */
  lastMove?: string | null
  /** Casilla marcada en rojo (error). */
  errorSquare?: string | null
  animated?: boolean
  theme?: string
  onMove?: (uci: string) => void
}

/** cm-chessboard revienta con una FEN vacía o incompleta: mejor filtrarla aquí. */
function safeFen(fen: string): string {
  return fen && fen.split(/\/|\s/).length >= 8 ? fen : FEN.empty
}

export function Board({
  fen: rawFen,
  orientation,
  interactive = false,
  version = 0,
  lastMove = null,
  errorSquare = null,
  animated = true,
  theme = 'wood',
  onMove,
}: BoardProps) {
  const fen = safeFen(rawFen)
  const hostRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<Chessboard | null>(null)
  const fenRef = useRef(fen)
  const onMoveRef = useRef(onMove)
  const orientationRef = useRef(orientation)

  fenRef.current = fen
  onMoveRef.current = onMove
  orientationRef.current = orientation

  // Creación del tablero (solo el cambio de tema obliga a recrearlo).
  useEffect(() => {
    if (!hostRef.current) return
    const board = new Chessboard(hostRef.current, {
      position: fenRef.current,
      orientation: orientationRef.current,
      assetsUrl: `${import.meta.env.BASE_URL}assets/`,
      style: {
        cssClass: THEME_CLASS[theme] ?? 'chess-club',
        borderType: BORDER_TYPE.none,
        showCoordinates: true,
        animationDuration: 220,
      },
      extensions: [{ class: Markers }, { class: PromotionDialog }],
    })
    boardRef.current = board
    return () => {
      board.destroy()
      boardRef.current = null
    }
  }, [theme])

  // Giro del tablero: siempre se ve desde el bando que debe resolver.
  useEffect(() => {
    const board = boardRef.current
    if (!board || board.getOrientation() === orientation) return
    void board.setOrientation(orientation, false)
  }, [orientation])

  // Sincronización de la posición.
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    void board.setPosition(fen, animated)
  }, [fen, version, animated])

  // Marcadores: última jugada y casilla errónea.
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    board.removeMarkers()
    if (lastMove && lastMove.length >= 4) {
      const [from, to] = moveSquares(lastMove)
      board.addMarker(MARKER_TYPE.square, from)
      board.addMarker(MARKER_TYPE.square, to)
    }
    if (errorSquare) board.addMarker(MARKER_TYPE.frameDanger, errorSquare)
  }, [lastMove, errorSquare, fen, version])

  // Entrada de jugadas.
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    if (!interactive) {
      board.disableMoveInput()
      return
    }
    const color = (fenRef.current.split(' ')[1] as 'w' | 'b') ?? 'w'
    board.enableMoveInput((event: MoveInputEvent) => {
      if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
        const { squareFrom, squareTo } = event
        if (needsPromotion(fenRef.current, squareFrom, squareTo)) {
          const pieceColor = (event.piece?.charAt(0) as 'w' | 'b') ?? color
          board.showPromotionDialog(squareTo, pieceColor, (result) => {
            if (result?.piece) {
              onMoveRef.current?.(`${squareFrom}${squareTo}${result.piece.charAt(1)}`)
            } else {
              void board.setPosition(fenRef.current, true)
            }
          })
          return true
        }
        return isLegalUci(fenRef.current, `${squareFrom}${squareTo}`)
      }
      if (event.type === INPUT_EVENT_TYPE.moveInputFinished) {
        const { squareFrom, squareTo, legalMove } = event
        if (legalMove && squareFrom && squareTo && !needsPromotion(fenRef.current, squareFrom, squareTo)) {
          onMoveRef.current?.(`${squareFrom}${squareTo}`)
        }
      }
      return true
    }, color)
    // Al desmontar, el tablero puede haberse destruido ya (la limpieza del
    // efecto de creación va antes): solo lo desactivamos si sigue vivo.
    return () => {
      if (boardRef.current === board) board.disableMoveInput()
    }
  }, [interactive, fen, version])

  return <div className="board" ref={hostRef} aria-label="Tablero de ajedrez" />
}
