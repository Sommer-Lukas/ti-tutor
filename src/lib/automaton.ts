import type { AutomatonType } from './automatonTypes'

export interface State {
  id: string
  label: string
  isStart: boolean
  isFinal: boolean
  position: { x: number; y: number }
}

export interface Transition {
  id: string
  from: string
  to: string
  symbol: string // Für NEA: kann "ε" sein, für DEA: muss reguläres Symbol sein

  // PDA-specific fields (optional - only used for PDA)
  pdaInput?: string // Input symbol (empty string = epsilon)
  pdaStackTop?: string // Stack symbol to pop (empty string = epsilon)
  pdaStackPush?: string // Stack symbols to push (empty string = epsilon, can be multiple chars like "AB")

  // TM-specific fields
  tmWrite?: string // Symbol schreiben (single char) - falls undefined: kein Schreiben
  tmMove?: 'L' | 'R' // Kopfbewegung: nur Links oder Rechts, kein N!
}

// Blank symbol for Turing machines
export const TM_BLANK = '□'

// Get transition label for canvas display
export function getTransitionLabel(t: Transition, type: AutomatonType): string {
  switch (type) {
    case 'TM': {
      const read = t.symbol || TM_BLANK
      if (t.tmWrite !== undefined && t.tmWrite !== '') {
        return `${read}/${t.tmWrite}`
      }
      return `${read}/${t.tmMove ?? 'R'}`
    }

    case 'PDA': {
      const input = t.pdaInput || 'ε'
      const stackTop = t.pdaStackTop || 'ε'
      const stackPush = t.pdaStackPush || 'ε'
      return `(${input},${stackTop})/${stackPush}`
    }

    default:
      return t.symbol || 'ε'
  }
}

export interface AutomatonProject {
  id: string
  name: string
  type: AutomatonType
  states: State[]
  transitions: Transition[]
  createdAt: Date
  updatedAt: Date
  metadata?: {
    description?: string
    alphabet?: string[]
  }
  pdaConfig?: {
    startStackSymbol: string
  }
  // TM Config
  tmConfig?: {
    blankSymbol: string
  }
}
