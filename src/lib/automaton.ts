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
  
  // 🔮 TM-specific fields (for future Turing Machine support)
  // tmRead?: string
  // tmWrite?: string
  // tmMove?: 'L' | 'R' | 'N'
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
    alphabet?: string[]  // Explizite Alphabet-Definition
  }
  // ✅ ADD THIS:
  pdaConfig?: {
    startStackSymbol: string  // Default: "$", used for PDA simulation
  }
}
