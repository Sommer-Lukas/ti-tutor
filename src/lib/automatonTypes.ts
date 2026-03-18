/**
 * automatonTypes.ts — Type definitions, rule sets, and configuration for all
 * supported automaton types (DFA, NFA, PDA, TM).
 *
 * Each automaton type is described by an `AutomatonTypeConfig` record that
 * encodes its structural rules (start/final state constraints, transition
 * determinism, etc.), feature flags (stack, tape), transition formatting,
 * and editor hints.  These configs drive validation, the canvas editor,
 * and the simulation engine.
 */

// ---------------------------------------------------------------------------
// Core type aliases
// ---------------------------------------------------------------------------

/** The four automaton flavours supported by the tutor. */
export type AutomatonType = 'DFA' | 'NFA' | 'PDA' | 'TM'

/** Specifies where the TM head is expected to end after a test run. */
export type TMHeadEnd = 'start' | 'end' | 'any'

// ---------------------------------------------------------------------------
// Configuration interfaces
// ---------------------------------------------------------------------------

/** Full configuration object for a single automaton type. */
export interface AutomatonTypeConfig {
  id: AutomatonType
  name: string
  shortName: string
  description: string
  rules: AutomatonRules
  features: AutomatonFeatures
  transitionFormat: TransitionFormat
  editorHints: EditorHints
}

/** Structural rules that the validator checks against. */
export interface AutomatonRules {
  // -- Start State Rules ---
  minStartStates: number
  maxStartStates: number | 'unlimited'

  // -- Final State Rules ---
  minFinalStates: number
  maxFinalStates: number | 'unlimited'

  // -- Transition Rules ---
  /** If false, only one transition per (state, symbol) pair is allowed (DFA). */
  allowMultipleTransitionsPerSymbol: boolean
  allowEpsilonTransitions: boolean
  allowSelfLoops: boolean

  // -- Input Rules ---
  inputAlphabet: 'finite' | 'infinite'
  allowEmptyInput: boolean
}

/** Capability flags describing what hardware the automaton type exposes. */
export interface AutomatonFeatures {
  hasStack: boolean
  hasTape: boolean
  canModifyInput: boolean
  supportsNondeterminism: boolean
}

/** Describes the shape of a transition for rendering and editing purposes. */
export interface TransitionFormat {
  type: 'simple' | 'stack' | 'tape'
  inputSymbolMaxLength: number | 'unlimited'
  /** If true, a modal dialog is used to edit transitions (PDA, TM). */
  requiresModal: boolean
  /** Template for the transition label (e.g. "{symbol}" or "{read}/{write}"). */
  labelTemplate: string
}

/** Localised helper texts shown in the canvas editor UI. */
export interface EditorHints {
  transitionEditHint: string
  symbolInputPlaceholder: string
  epsilonSymbol: string
}

// ---------------------------------------------------------------------------
// Validation result types
// ---------------------------------------------------------------------------

/** Outcome of running the validator on an automaton project. */
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  type: 'transition' | 'state' | 'symbol' | 'structure'
  message: string
  severity: 'error' | 'critical'
  affectedElements: string[]
}

export interface ValidationWarning {
  type: 'completeness' | 'reachability' | 'optimization'
  message: string
  affectedElements: string[]
}

// ---------------------------------------------------------------------------
// Predefined type configurations (university‑standard rules)
// ---------------------------------------------------------------------------

export const AUTOMATON_TYPES: Record<AutomatonType, AutomatonTypeConfig> = {
  DFA: {
    id: 'DFA',
    name: 'Deterministischer Endlicher Automat',
    shortName: 'DEA',
    description:
      'Genau EIN Startzustand, pro Zustand und Symbol maximal EINE ausgehende Transition',
    rules: {
      minStartStates: 1,
      maxStartStates: 1,
      minFinalStates: 0,
      maxFinalStates: 'unlimited',
      allowMultipleTransitionsPerSymbol: false,
      allowEpsilonTransitions: false,
      allowSelfLoops: true,
      inputAlphabet: 'finite',
      allowEmptyInput: true,
    },
    features: {
      hasStack: false,
      hasTape: false,
      canModifyInput: false,
      supportsNondeterminism: false,
    },
    transitionFormat: {
      type: 'simple',
      inputSymbolMaxLength: 1,
      requiresModal: false,
      labelTemplate: '{symbol}',
    },
    editorHints: {
      transitionEditHint: 'Kante auswählen → Buchstabe tippen',
      symbolInputPlaceholder: 'a',
      epsilonSymbol: 'ε',
    },
  },

  NFA: {
    id: 'NFA',
    name: 'Nichtdeterministischer Endlicher Automat',
    shortName: 'NEA',
    description:
      'Mehrere Startzustände möglich, mehrere Transitionen pro Symbol erlaubt, keine ε-Übergänge',
    rules: {
      minStartStates: 1,
      maxStartStates: 'unlimited',
      minFinalStates: 0,
      maxFinalStates: 'unlimited',
      allowMultipleTransitionsPerSymbol: true,
      allowEpsilonTransitions: false,
      allowSelfLoops: true,
      inputAlphabet: 'finite',
      allowEmptyInput: true,
    },
    features: {
      hasStack: false,
      hasTape: false,
      canModifyInput: false,
      supportsNondeterminism: true,
    },
    transitionFormat: {
      type: 'simple',
      inputSymbolMaxLength: 1,
      requiresModal: false,
      labelTemplate: '{symbol}',
    },
    editorHints: {
      transitionEditHint: 'Kante auswählen → Buchstabe tippen (kein ε)',
      symbolInputPlaceholder: 'a',
      epsilonSymbol: 'ε',
    },
  },

  PDA: {
    id: 'PDA',
    name: 'Kellerautomat',
    shortName: 'PDA',
    description: 'Automat mit zusätzlichem Stack-Speicher',
    rules: {
      minStartStates: 1,
      maxStartStates: 1,
      minFinalStates: 0,
      maxFinalStates: 'unlimited',
      allowMultipleTransitionsPerSymbol: true,
      allowEpsilonTransitions: true,
      allowSelfLoops: true,
      inputAlphabet: 'finite',
      allowEmptyInput: true,
    },
    features: {
      hasStack: true,
      hasTape: false,
      canModifyInput: false,
      supportsNondeterminism: true,
    },
    transitionFormat: {
      type: 'stack',
      inputSymbolMaxLength: 1,
      requiresModal: true, // ← PDA needs modal editor!
      labelTemplate: '({input},{stackTop}) / {stackPush}',
    },
    editorHints: {
      transitionEditHint: 'Doppelklick auf Kante zum Editieren',
      symbolInputPlaceholder: '(a,$) / aa',
      epsilonSymbol: 'ε',
    },
  },

  TM: {
    id: 'TM',
    name: 'Turing-Maschine',
    shortName: 'TM',
    description: 'Universal-Computer mit beschreibbarem Band',
    rules: {
      minStartStates: 1,
      maxStartStates: 1,
      minFinalStates: 0,
      maxFinalStates: 'unlimited',
      allowMultipleTransitionsPerSymbol: true,
      allowEpsilonTransitions: false,
      allowSelfLoops: true,
      inputAlphabet: 'infinite',
      allowEmptyInput: true,
    },
    features: {
      hasStack: false,
      hasTape: true,
      canModifyInput: true,
      supportsNondeterminism: true,
    },
    transitionFormat: {
      type: 'tape',
      inputSymbolMaxLength: 1,
      requiresModal: true, // ← TM also needs modal editor!
      labelTemplate: '{read} → {write}, {direction}',
    },
    editorHints: {
      transitionEditHint: 'Doppelklick auf Kante zum Editieren',
      symbolInputPlaceholder: 'a → b, R',
      epsilonSymbol: '□', // Blank symbol for TM
    },
  },
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Returns the full configuration for a given automaton type. */
export function getAutomatonConfig(type: AutomatonType): AutomatonTypeConfig {
  return AUTOMATON_TYPES[type]
}

/** Returns `true` if the given type requires a modal editor for transitions. */
export function requiresModalEditor(type: AutomatonType): boolean {
  return AUTOMATON_TYPES[type].transitionFormat.requiresModal
}

/**
 * Produces a formatted transition label string from raw field values,
 * respecting the label template of the given automaton type.
 */
export function formatTransitionLabel(
  type: AutomatonType,
  data: {
    symbol?: string
    input?: string
    stackTop?: string
    stackPush?: string
    read?: string
    write?: string
    direction?: string
  },
): string {
  const config = AUTOMATON_TYPES[type]
  const epsilon = config.editorHints.epsilonSymbol

  switch (config.transitionFormat.type) {
    case 'simple':
      return data.symbol || epsilon

    case 'stack':
      const input = data.input || epsilon
      const stackTop = data.stackTop || epsilon
      const stackPush = data.stackPush || epsilon
      return `(${input},${stackTop}) / ${stackPush}`

    case 'tape':
      const read = data.read || epsilon
      const write = data.write || epsilon
      const direction = data.direction || 'R'
      return `${read} → ${write}, ${direction}`

    default:
      return ''
  }
}
