/**
 * automaton.ts — Core data model for finite automata, PDAs, and Turing machines.
 *
 * Defines the shared interfaces (`State`, `Transition`, `AutomatonProject`)
 * used across the entire application, as well as helper functions for
 * rendering transition labels on the editor canvas.
 */

import type { AutomatonType } from './automatonTypes'

// ---------------------------------------------------------------------------
// State & Transition interfaces
// ---------------------------------------------------------------------------

/** Represents a single state (node) in the automaton graph. */
export interface State {
  id: string
  label: string
  isStart: boolean
  isFinal: boolean
  /** Canvas position used by Cytoscape for rendering. */
  position: { x: number; y: number }
}

/**
 * Represents a directed transition (edge) between two states.
 *
 * The `symbol` field carries the read symbol for DFA/NFA.
 * PDA-specific and TM-specific fields are optional and only
 * populated when the automaton type requires them.
 */
export interface Transition {
  id: string
  from: string
  to: string
  /** Read symbol for DFA/NFA transitions. */
  symbol: string

  // -- PDA-specific fields (only present for PDA transitions) ----------------
  /** Input symbol to consume (empty string = epsilon transition). */
  pdaInput?: string
  /** Stack symbol that must be on top in order to fire (empty = epsilon). */
  pdaStackTop?: string
  /** Symbols to push onto the stack (empty = epsilon; multi-char e.g. "AB"). */
  pdaStackPush?: string

  // -- TM-specific fields ---------------------------------------------------
  /** Symbol to write to the tape cell. `undefined` means "don't write". */
  tmWrite?: string
  /** Head movement direction — only Left or Right (no stationary "N"). */
  tmMove?: 'L' | 'R'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Unicode blank symbol used on the Turing machine tape (U+25A1). */
export const TM_BLANK = '□'

// ---------------------------------------------------------------------------
// Transition label formatting
// ---------------------------------------------------------------------------

/**
 * Produces a human-readable label for a transition, formatted according to
 * the automaton type:
 *  - DFA / NFA → symbol
 *  - PDA       → (input,stackTop)/stackPush
 *  - TM        → read/writeOrMove
 */
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
      return t.symbol
  }
}

// ---------------------------------------------------------------------------
// Project container
// ---------------------------------------------------------------------------

/**
 * Top-level container that groups a set of states and transitions together
 * with project metadata. Each project corresponds to one automaton the user
 * is working on (or an exercise).
 */
export interface AutomatonProject {
  id: string
  name: string
  type: AutomatonType
  states: State[]
  transitions: Transition[]
  createdAt: Date
  updatedAt: Date
  /** Optional descriptive metadata (unused in current UI). */
  metadata?: {
    description?: string
    alphabet?: string[]
  }
  /** PDA-only configuration (initial stack symbol). */
  pdaConfig?: {
    startStackSymbol: string
  }
  /** TM-only configuration. */
  tmConfig?: {
    blankSymbol: string
  }
}
