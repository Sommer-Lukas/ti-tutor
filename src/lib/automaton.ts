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
}
