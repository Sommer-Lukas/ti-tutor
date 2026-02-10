// Automaton Type Definitions
export type AutomatonType = 'DFA' | 'NFA' | 'PDA' | 'TM'

export interface AutomatonTypeConfig {
  id: AutomatonType
  name: string
  shortName: string
  description: string
  rules: AutomatonRules
  features: AutomatonFeatures
}

export interface AutomatonRules {
  // Start State Rules
  minStartStates: number
  maxStartStates: number | 'unlimited'  // 'unlimited' statt null
  
  // Final State Rules
  minFinalStates: number
  maxFinalStates: number | 'unlimited'  // 'unlimited' statt null
  
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
    description: 'Genau EIN Startzustand, pro Zustand und Symbol maximal EINE ausgehende Transition',
    rules: {
      minStartStates: 1,
      maxStartStates: 1,
      minFinalStates: 0,
      maxFinalStates: 'unlimited',  // ✅ String statt null
      allowMultipleTransitionsPerSymbol: false,
      allowEpsilonTransitions: false,
      allowSelfLoops: true,
      inputAlphabet: 'finite',
      allowEmptyInput: true
    },
    features: {
      hasStack: false,
      hasTape: false,
      canModifyInput: false,
      supportsNondeterminism: false
    }
  },
  
  NFA: {
    id: 'NFA',
    name: 'Nichtdeterministischer Endlicher Automat',
    shortName: 'NEA',
    description: 'Mehrere Startzustände möglich, mehrere Transitionen pro Symbol erlaubt, ε-Übergänge möglich',
    rules: {
      minStartStates: 1,
      maxStartStates: 'unlimited',  // ✅ String statt null
      minFinalStates: 0,
      maxFinalStates: 'unlimited',  // ✅ String statt null
      allowMultipleTransitionsPerSymbol: true,
      allowEpsilonTransitions: true,
      allowSelfLoops: true,
      inputAlphabet: 'finite',
      allowEmptyInput: true
    },
    features: {
      hasStack: false,
      hasTape: false,
      canModifyInput: false,
      supportsNondeterminism: true
    }
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
      allowEmptyInput: true
    },
    features: {
      hasStack: true,
      hasTape: false,
      canModifyInput: false,
      supportsNondeterminism: true
    }
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
      allowEmptyInput: true
    },
    features: {
      hasStack: false,
      hasTape: true,
      canModifyInput: true,
      supportsNondeterminism: true
    }
  }
}
