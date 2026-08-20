/** Tipos mínimos para cm-chessboard (la librería es JavaScript puro). */

declare module 'cm-chessboard/src/Chessboard.js' {
  export const COLOR: { white: 'w'; black: 'b' }
  export const BORDER_TYPE: { none: 'none'; thin: 'thin'; frame: 'frame' }
  export const INPUT_EVENT_TYPE: {
    moveInputStarted: 'moveInputStarted'
    movingOverSquare: 'movingOverSquare'
    validateMoveInput: 'validateMoveInput'
    moveInputCanceled: 'moveInputCanceled'
    moveInputFinished: 'moveInputFinished'
  }
  export const FEN: { start: string; empty: string }

  export interface MoveInputEvent {
    type: string
    chessboard: Chessboard
    squareFrom: string
    squareTo: string
    piece?: string
    legalMove?: boolean
  }

  export interface ChessboardProps {
    position?: string
    orientation?: 'w' | 'b'
    responsive?: boolean
    assetsUrl?: string
    assetsCache?: boolean
    style?: {
      cssClass?: string
      showCoordinates?: boolean
      borderType?: string
      aspectRatio?: number
      pieces?: { type?: string; file?: string; tileSize?: number }
      animationDuration?: number
    }
    extensions?: { class: unknown; props?: Record<string, unknown> }[]
  }

  export class Chessboard {
    constructor(context: HTMLElement, props?: ChessboardProps)
    setPosition(fen: string, animated?: boolean): Promise<void>
    getPosition(): string
    setOrientation(color: 'w' | 'b', animated?: boolean): Promise<void>
    getOrientation(): 'w' | 'b'
    setPiece(square: string, piece: string, animated?: boolean): Promise<void>
    movePiece(from: string, to: string, animated?: boolean): Promise<void>
    enableMoveInput(handler: (event: MoveInputEvent) => boolean | void, color?: 'w' | 'b'): void
    disableMoveInput(): void
    destroy(): void
    // Extensiones
    addMarker(type: unknown, square: string): void
    removeMarkers(type?: unknown, square?: string): void
    addArrow(type: unknown, from: string, to: string): void
    removeArrows(type?: unknown): void
    showPromotionDialog(
      square: string,
      color: 'w' | 'b',
      callback: (result: { type: string; square?: string; piece?: string }) => void,
    ): void
  }
}

declare module 'cm-chessboard/src/extensions/markers/Markers.js' {
  export const MARKER_TYPE: Record<string, { class: string; slice: string }>
  export class Markers {}
}

declare module 'cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js' {
  export const PROMOTION_DIALOG_RESULT_TYPE: { pieceSelected: string; canceled: string }
  export class PromotionDialog {}
}

declare module 'cm-chessboard/src/extensions/arrows/Arrows.js' {
  export const ARROW_TYPE: Record<string, { class: string; slice: string; headSize: number }>
  export class Arrows {}
}

declare module 'cm-chessboard/assets/chessboard.css'
declare module 'cm-chessboard/assets/extensions/markers/markers.css'
declare module 'cm-chessboard/assets/extensions/promotion-dialog/promotion-dialog.css'
declare module 'cm-chessboard/assets/extensions/arrows/arrows.css'
