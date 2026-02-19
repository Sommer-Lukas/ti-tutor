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
  symbol: string  // Für NEA: kann "ε" sein, für DEA: muss reguläres Symbol sein
  
  // ✅ PDA-specific fields (optional - nur für PDA verwendet)
  pdaInput?: string        // Input symbol (empty string = epsilon)
  pdaStackTop?: string     // Stack symbol to pop (empty string = epsilon)
  pdaStackPush?: string    // Stack symbols to push (empty string = epsilon, can be multiple chars like "AB")
  
  // ✅ TM-specific fields
  tmWrite?: string         // Symbol schreiben (single char) - falls undefined: kein Schreiben
  tmMove?: 'L' | 'R'      // Kopfbewegung: nur Links oder Rechts, kein N!
}

// ✅ TM: Blank Symbol Konstante
export const TM_BLANK = '□'  // Unicode Blank (U+25A1)

// ✅ Helper: Transition Label berechnen (für Canvas-Anzeige)
export function getTransitionLabel(t: Transition, type: AutomatonType): string {
  switch (type) {
    case 'TM': {
      const read = t.symbol || TM_BLANK
      // Format: "c/L", "c/d", "w/R", "#/L"
      // Wenn nur Bewegung (kein Schreiben): read/direction
      // Wenn Schreiben: read/write (direction ist separates Feld im Store)
      if (t.tmWrite !== undefined && t.tmWrite !== '') {
        return `${read}/${t.tmWrite}`      // z.B. "c/d"
      }
      return `${read}/${t.tmMove ?? 'R'}`  // z.B. "c/L", "w/R"
    }

    case 'PDA': {
      const input = t.pdaInput || 'ε'
      const stackTop = t.pdaStackTop || 'ε'
      const stackPush = t.pdaStackPush || 'ε'
      return `(${input},${stackTop})/${stackPush}`
    }

    default:
      // DFA / NFA
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
    startStackSymbol: string  // Default: "$"
  }
  // ✅ TM Config
  tmConfig?: {
    blankSymbol: string       // Default: "□"
  }
}
