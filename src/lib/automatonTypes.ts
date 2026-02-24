// Automaton Type Definitions
export type AutomatonType = 'DFA' | 'NFA' | 'PDA' | 'TM'

export interface AutomatonTypeConfig {
  id: AutomatonType
  name: string
  shortName: string
  description: string
  rules: AutomatonRules
  features: AutomatonFeatures
  transitionFormat: TransitionFormat // ← NEU!
  editorHints: EditorHints // ← NEU!
}

export interface AutomatonRules {
  // Start State Rules
  minStartStates: number
  maxStartStates: number | 'unlimited'

  // Final State Rules
  minFinalStates: number
  maxFinalStates: number | 'unlimited'

  // Transition Rules
  allowMultipleTransitionsPerSymbol: boolean
  allowEpsilonTransitions: boolean
  allowSelfLoops: boolean

  // Input Rules
  inputAlphabet: 'finite' | 'infinite'
  allowEmptyInput: boolean
}

export interface AutomatonFeatures {
  hasStack: boolean
  hasTape: boolean
  canModifyInput: boolean
  supportsNondeterminism: boolean
}

// ✅ NEU: Transition Format Definition
export interface TransitionFormat {
  type: 'simple' | 'stack' | 'tape'
  inputSymbolMaxLength: number | 'unlimited'
  requiresModal: boolean // If true, use modal editor instead of keyboard
  labelTemplate: string // Template for displaying transition label
}

// ✅ NEU: Editor Hints
export interface EditorHints {
  transitionEditHint: string
  symbolInputPlaceholder: string
  epsilonSymbol: string
}

// Validation Result
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

// Predefined Automaton Type Configs (HOCHSCHUL-REGELN)
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
      'Mehrere Startzustände möglich, mehrere Transitionen pro Symbol erlaubt, ε-Übergänge möglich',
    rules: {
      minStartStates: 1,
      maxStartStates: 'unlimited',
      minFinalStates: 0,
      maxFinalStates: 'unlimited',
      allowMultipleTransitionsPerSymbol: true,
      allowEpsilonTransitions: true,
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
      transitionEditHint: 'Kante auswählen → Buchstabe tippen (ε erlaubt)',
      symbolInputPlaceholder: 'a oder ε',
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

// ✅ HELPER: Get current automaton config
export function getAutomatonConfig(type: AutomatonType): AutomatonTypeConfig {
  return AUTOMATON_TYPES[type]
}

// ✅ HELPER: Check if automaton requires modal editor
export function requiresModalEditor(type: AutomatonType): boolean {
  return AUTOMATON_TYPES[type].transitionFormat.requiresModal
}

// ✅ HELPER: Get transition label format
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
