import type { State, Transition } from './automaton'
import type { AutomatonType, ValidationResult, ValidationError, ValidationWarning, AutomatonTypeConfig } from './automatonTypes'
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
    const startStates = states.filter(s => s.isStart)
    
    if (startStates.length < this.config.rules.minStartStates) {
      errors.push({
        type: 'state',
        message: `${this.config.shortName} benötigt mindestens ${this.config.rules.minStartStates} Startzustand(e)`,
        severity: 'critical',
        affectedElements: []
      })
    }
    
    // ✅ FIXED: !== 'unlimited' statt !== null
    if (this.config.rules.maxStartStates !== 'unlimited' && startStates.length > this.config.rules.maxStartStates) {
      errors.push({
        type: 'state',
        message: `${this.config.shortName} erlaubt maximal ${this.config.rules.maxStartStates} Startzustand(e), aktuell: ${startStates.length}`,
        severity: 'error',
        affectedElements: startStates.map(s => s.id)
      })
    }
    
    // ========== 2. VALIDATE FINAL STATES ==========
    const finalStates = states.filter(s => s.isFinal)
    
    if (finalStates.length < this.config.rules.minFinalStates) {
      errors.push({
        type: 'state',
        message: `${this.config.shortName} benötigt mindestens ${this.config.rules.minFinalStates} Endzustand(e)`,
        severity: 'critical',
        affectedElements: []
      })
    }
    
    // ✅ FIXED: !== 'unlimited' statt !== null
    if (this.config.rules.maxFinalStates !== 'unlimited' && finalStates.length > this.config.rules.maxFinalStates) {
      errors.push({
        type: 'state',
        message: `${this.config.shortName} erlaubt maximal ${this.config.rules.maxFinalStates} Endzustand(e)`,
        severity: 'error',
        affectedElements: finalStates.map(s => s.id)
      })
    }
    
    if (finalStates.length === 0) {
      warnings.push({
        type: 'optimization',
        message: 'Kein Endzustand definiert - Automat akzeptiert keine Wörter',
        affectedElements: []
      })
    }
    
    // ========== 3. VALIDATE TRANSITIONS (KRITISCH FÜR DEA!) ==========
    const alphabet = this.extractAlphabet(transitions)
    
    for (const state of states) {
      const outgoingTransitions = transitions.filter(t => t.from === state.id)
      
      // Group transitions by symbol
      const transitionsBySymbol = new Map<string, Transition[]>()
      for (const t of outgoingTransitions) {
        const symbols = this.parseTransitionSymbol(t.symbol)
        
        for (const symbol of symbols) {
          if (!transitionsBySymbol.has(symbol)) {
            transitionsBySymbol.set(symbol, [])
          }
          transitionsBySymbol.get(symbol)!.push(t)
        }
      }
      
      // Check epsilon transitions
      if (transitionsBySymbol.has('ε') && !this.config.rules.allowEpsilonTransitions) {
        const epsilonTrans = transitionsBySymbol.get('ε')!
        errors.push({
          type: 'transition',
          message: `${this.config.shortName} erlaubt KEINE ε-Übergänge (Zustand: ${state.label})`,
          severity: 'error',
          affectedElements: epsilonTrans.map(t => t.id)
        })
      }
      
      // *** KRITISCH: Check multiple transitions per symbol (DEA vs NEA) ***
      for (const [symbol, trans] of transitionsBySymbol) {
        if (trans.length > 1 && !this.config.rules.allowMultipleTransitionsPerSymbol) {
          errors.push({
            type: 'transition',
            message: `${this.config.shortName}-Verletzung: Zustand "${state.label}" hat ${trans.length} Transitionen für Symbol "${symbol}" (Ziele: ${trans.map(t => {
              const targetState = states.find(s => s.id === t.to)
              return targetState?.label || t.to
            }).join(', ')})`,
            severity: 'error',
            affectedElements: [state.id, ...trans.map(t => t.id)]
          })
        }
      }
    }
    
    // ========== 4. CHECK REACHABILITY ==========
    if (startStates.length > 0) {
      const reachableStates = this.computeReachableStates(states, transitions)
      const unreachableStates = states.filter(s => !s.isStart && !reachableStates.has(s.id))
      
      if (unreachableStates.length > 0) {
        warnings.push({
          type: 'reachability',
          message: `${unreachableStates.length} Zustand(e) nicht vom Startzustand erreichbar: ${unreachableStates.map(s => s.label).join(', ')}`,
          affectedElements: unreachableStates.map(s => s.id)
        })
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
  
  /**
   * Parse transition symbol: "a,b" → ["a", "b"], "ε" → ["ε"], "" → ["ε"]
   */
  private parseTransitionSymbol(symbol: string): string[] {
    if (!symbol || symbol.trim() === '') return ['ε']
    if (symbol.trim() === 'ε' || symbol.trim() === 'epsilon') return ['ε']
    
    return symbol.split(',').map(s => s.trim()).filter(s => s.length > 0)
  }
  
  private extractAlphabet(transitions: Transition[]): Set<string> {
    const alphabet = new Set<string>()
    for (const t of transitions) {
      const symbols = this.parseTransitionSymbol(t.symbol)
      symbols.forEach(s => {
        if (s !== 'ε') alphabet.add(s)
      })
    }
    return alphabet
  }
  
  private computeReachableStates(states: State[], transitions: Transition[]): Set<string> {
    const reachable = new Set<string>()
    const startStates = states.filter(s => s.isStart)
    const queue = [...startStates.map(s => s.id)]
    
    while (queue.length > 0) {
      const current = queue.shift()!
      if (reachable.has(current)) continue
      
      reachable.add(current)
      
      // Follow all outgoing transitions (including ε)
      const outgoing = transitions.filter(t => t.from === current)
      for (const t of outgoing) {
        if (!reachable.has(t.to)) {
          queue.push(t.to)
        }
      }
    }
    
    return reachable
  }
}
