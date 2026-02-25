import type { State, Transition } from './automaton'
import type {
  AutomatonType,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  AutomatonTypeConfig,
} from './automatonTypes'
import { AUTOMATON_TYPES } from './automatonTypes'

export class AutomatonValidator {
  private config: AutomatonTypeConfig

  constructor(private type: AutomatonType) {
    this.config = AUTOMATON_TYPES[type]
  }

  validate(states: State[], transitions: Transition[]): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // ========== 1. VALIDATE START STATES ==========
    const startStates = states.filter((s) => s.isStart)

    if (startStates.length < this.config.rules.minStartStates) {
      errors.push({
        type: 'state',
        message: `${this.config.shortName} benötigt mindestens ${this.config.rules.minStartStates} Startzustand(e)`,
        severity: 'critical',
        affectedElements: [],
      })
    }

    if (
      this.config.rules.maxStartStates !== 'unlimited' &&
      startStates.length > this.config.rules.maxStartStates
    ) {
      errors.push({
        type: 'state',
        message: `${this.config.shortName} erlaubt maximal ${this.config.rules.maxStartStates} Startzustand(e), aktuell: ${startStates.length}`,
        severity: 'error',
        affectedElements: startStates.map((s) => s.id),
      })
    }

    // ========== 2. VALIDATE FINAL STATES ==========
    const finalStates = states.filter((s) => s.isFinal)

    if (finalStates.length < this.config.rules.minFinalStates) {
      errors.push({
        type: 'state',
        message: `${this.config.shortName} benötigt mindestens ${this.config.rules.minFinalStates} Endzustand(e)`,
        severity: 'critical',
        affectedElements: [],
      })
    }

    if (
      this.config.rules.maxFinalStates !== 'unlimited' &&
      finalStates.length > this.config.rules.maxFinalStates
    ) {
      errors.push({
        type: 'state',
        message: `${this.config.shortName} erlaubt maximal ${this.config.rules.maxFinalStates} Endzustand(e)`,
        severity: 'error',
        affectedElements: finalStates.map((s) => s.id),
      })
    }

    // PDA-specific: warning about acceptance modes
    if (finalStates.length === 0) {
      if (this.type === 'PDA') {
        // PDA can accept by empty stack OR by final state
        warnings.push({
          type: 'optimization',
          message:
            'PDA hat keine Endzustände definiert - Akzeptanz erfolgt nur durch leeren Keller (Empty Stack)',
          affectedElements: [],
        })
      } else if (this.type === 'TM') {
        // Turing Machine can have different halting conditions
        warnings.push({
          type: 'optimization',
          message:
            'Turingmaschine hat keine Endzustände - Akzeptanz erfolgt durch Halt in beliebigem Zustand',
          affectedElements: [],
        })
      } else {
        // DFA/NFA MUST have final states to accept anything
        warnings.push({
          type: 'optimization',
          message: 'Kein Endzustand definiert - Automat akzeptiert keine Wörter',
          affectedElements: [],
        })
      }
    }

    // ========== 3. VALIDATE TRANSITIONS (KRITISCH FÜR DEA!) ==========
    this.extractAlphabet(transitions)

    for (const state of states) {
      const outgoingTransitions = transitions.filter((t) => t.from === state.id)

      // Group transitions by symbol (for DFA/NFA)
      const transitionsBySymbol = new Map<string, Transition[]>()

      // For PDA/TM: Use complex transition signature (input,stackTop/stackPush)
      if (this.type === 'PDA') {
        for (const t of outgoingTransitions) {
          // PDA signature: "input,stackTop" (ignore stackPush for determinism check)
          const signature = `${t.pdaInput || 'ε'},${t.pdaStackTop || 'ε'}`

          if (!transitionsBySymbol.has(signature)) {
            transitionsBySymbol.set(signature, [])
          }
          transitionsBySymbol.get(signature)!.push(t)
        }
      } else {
        // DFA/NFA: Use simple symbol
        for (const t of outgoingTransitions) {
          const symbols = this.parseTransitionSymbol(t.symbol)

          for (const symbol of symbols) {
            if (!transitionsBySymbol.has(symbol)) {
              transitionsBySymbol.set(symbol, [])
            }
            transitionsBySymbol.get(symbol)!.push(t)
          }
        }
      }

      // Check epsilon transitions (not applicable for PDA - it's built-in)
      if (this.type !== 'PDA' && this.type !== 'TM') {
        if (transitionsBySymbol.has('ε') && !this.config.rules.allowEpsilonTransitions) {
          const epsilonTrans = transitionsBySymbol.get('ε')!
          errors.push({
            type: 'transition',
            message: `${this.config.shortName} erlaubt KEINE ε-Übergänge (Zustand: ${state.label})`,
            severity: 'error',
            affectedElements: epsilonTrans.map((t) => t.id),
          })
        }
      }

      // *** KRITISCH: Check multiple transitions per symbol (DEA vs NEA) ***
      for (const [symbol, trans] of transitionsBySymbol) {
        if (trans.length > 1 && !this.config.rules.allowMultipleTransitionsPerSymbol) {
          if (this.type === 'PDA') {
            // Special PDA message
            const [input, stackTop] = symbol.split(',')
            errors.push({
              type: 'transition',
              message: `PDA-Nondeterminismus: Zustand "${state.label}" hat ${trans.length} Transitionen für (Input: "${input}", Stack-Top: "${stackTop}") (Ziele: ${trans
                .map((t) => {
                  const targetState = states.find((s) => s.id === t.to)
                  return targetState?.label || t.to
                })
                .join(', ')})`,
              severity: 'error',
              affectedElements: [state.id, ...trans.map((t) => t.id)],
            })
          } else {
            errors.push({
              type: 'transition',
              message: `${this.config.shortName}-Verletzung: Zustand "${state.label}" hat ${trans.length} Transitionen für Symbol "${symbol}" (Ziele: ${trans
                .map((t) => {
                  const targetState = states.find((s) => s.id === t.to)
                  return targetState?.label || t.to
                })
                .join(', ')})`,
              severity: 'error',
              affectedElements: [state.id, ...trans.map((t) => t.id)],
            })
          }
        }
      }
    }

    // ========== 4. CHECK REACHABILITY ==========
    if (startStates.length > 0) {
      const reachableStates = this.computeReachableStates(states, transitions)
      const unreachableStates = states.filter((s) => !s.isStart && !reachableStates.has(s.id))

      if (unreachableStates.length > 0) {
        warnings.push({
          type: 'reachability',
          message: `${unreachableStates.length} Zustand(e) nicht vom Startzustand erreichbar: ${unreachableStates.map((s) => s.label).join(', ')}`,
          affectedElements: unreachableStates.map((s) => s.id),
        })
      }
    }

    // ========== 5. PDA-SPECIFIC VALIDATIONS ==========
    if (this.type === 'PDA') {
      // Check if all transitions have valid stack operations
      for (const t of transitions) {
        // pdaInput, pdaStackTop, pdaStackPush can be empty (epsilon)
        // But they should be defined (not undefined)
        if (
          t.pdaInput === undefined ||
          t.pdaStackTop === undefined ||
          t.pdaStackPush === undefined
        ) {
          errors.push({
            type: 'transition',
            message: `PDA-Transition ist unvollständig: Von "${states.find((s) => s.id === t.from)?.label}" nach "${states.find((s) => s.id === t.to)?.label}"`,
            severity: 'error',
            affectedElements: [t.id],
          })
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Parse transition symbol: "a,b" → ["a", "b"], "ε" → ["ε"], "" → ["ε"]
   */
  private parseTransitionSymbol(symbol: string): string[] {
    if (!symbol || symbol.trim() === '') return ['ε']
    if (symbol.trim() === 'ε' || symbol.trim() === 'epsilon') return ['ε']

    return symbol
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  private extractAlphabet(transitions: Transition[]): Set<string> {
    const alphabet = new Set<string>()

    if (this.type === 'PDA') {
      // Extract input alphabet from PDA transitions
      for (const t of transitions) {
        if (t.pdaInput && t.pdaInput !== '') {
          alphabet.add(t.pdaInput)
        }
      }
    } else {
      // Extract from symbol field
      for (const t of transitions) {
        const symbols = this.parseTransitionSymbol(t.symbol)
        symbols.forEach((s) => {
          if (s !== 'ε') alphabet.add(s)
        })
      }
    }

    return alphabet
  }

  private computeReachableStates(states: State[], transitions: Transition[]): Set<string> {
    const reachable = new Set<string>()
    const startStates = states.filter((s) => s.isStart)
    const queue = [...startStates.map((s) => s.id)]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (reachable.has(current)) continue

      reachable.add(current)

      // Follow all outgoing transitions (including ε)
      const outgoing = transitions.filter((t) => t.from === current)
      for (const t of outgoing) {
        if (!reachable.has(t.to)) {
          queue.push(t.to)
        }
      }
    }

    return reachable
  }
}
