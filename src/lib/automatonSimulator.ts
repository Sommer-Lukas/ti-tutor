import type { State, Transition, AutomatonProject } from './automaton'
import type { AutomatonType } from './automatonTypes'

export interface SimulationStep {
  step: number
  currentState: string | string[]  // NEA/PDA: Array von Zuständen!
  remainingInput: string
  consumedInput: string
  transition?: {
    from: string
    to: string
    symbol: string
    // ✅ PDA-specific
    pdaInput?: string
    pdaStackTop?: string
    pdaStackPush?: string
  }
  isAccepting: boolean
  possibleTransitions: string[]
  isStuck?: boolean
  epsilonClosure?: string[]  // NEA: ε-Closure Info
  stack?: string[]  // ✅ PDA: Current stack state (top = last element)
}

export interface SimulationResult {
  input: string
  steps: SimulationStep[]
  accepted: boolean
  finalState: string | string[] | null  // NEA/PDA: Array von Zuständen!
  error?: string
  finalStack?: string[]  // ✅ PDA: Final stack state
}

export class AutomatonSimulator {
  private pdaStartStackSymbol: string = '$'  // ✅ PDA: Initial stack symbol

  constructor(
    private states: State[],
    private transitions: Transition[],
    private type: AutomatonType,
    pdaConfig?: { startStackSymbol: string }  // ✅ PDA Config
  ) {
    if (pdaConfig) {
      this.pdaStartStackSymbol = pdaConfig.startStackSymbol || '$'
    }
  }

  /**
   * Simuliert einen Testfall Schritt für Schritt
   */
  simulate(input: string): SimulationResult {
    const steps: SimulationStep[] = []
    
    // Finde Startzustand
    const startStates = this.states.filter(s => s.isStart)
    
    if (startStates.length === 0) {
      return {
        input,
        steps: [],
        accepted: false,
        finalState: null,
        error: 'Kein Startzustand definiert'
      }
    }

    if (startStates.length > 1 && this.type === 'DFA') {
      return {
        input,
        steps: [],
        accepted: false,
        finalState: null,
        error: 'DFA darf nur einen Startzustand haben'
      }
    }

    // DFA Simulation
    if (this.type === 'DFA') {
      return this.simulateDFA(input, startStates[0]!, steps)
    }

    // NFA Simulation
    if (this.type === 'NFA') {
      return this.simulateNFA(input, startStates, steps)
    }

    // ✅ PDA Simulation
    if (this.type === 'PDA') {
      return this.simulatePDA(input, startStates[0]!, steps)
    }

    return {
      input,
      steps: [],
      accepted: false,
      finalState: null,
      error: `Automatentyp ${this.type} noch nicht implementiert`
    }
  }
  
  private simulateDFA(
    input: string,
    startState: State,
    steps: SimulationStep[]
  ): SimulationResult {
    let currentState = startState
    let remainingInput = input
    let consumedInput = ''

    // Initial Step
    const initialPossible = this.getPossibleTransitions(currentState.id, input[0])
    steps.push({
      step: 0,
      currentState: currentState.id,
      remainingInput,
      consumedInput,
      isAccepting: currentState.isFinal,
      possibleTransitions: initialPossible
    })

    // Process each symbol
    for (let i = 0; i < input.length; i++) {
      const symbol = input[i]!
      
      // Finde Transition mit diesem Symbol
      const transition = this.transitions.find(
        t => t.from === currentState.id && t.symbol === symbol
      )

      // **STUCK CHECK: Keine Transition möglich!**
      if (!transition) {
        steps.push({
          step: i + 1,
          currentState: currentState.id,
          remainingInput: input.slice(i),
          consumedInput: consumedInput,
          isAccepting: false,  // STUCK = NOT ACCEPTING
          possibleTransitions: [],
          isStuck: true  // STUCK FLAG!
        })

        return {
          input,
          steps,
          accepted: false,  // STUCK = REJECTED
          finalState: currentState.id,
          error: `Keine Transition für Symbol '${symbol}' in Zustand ${currentState.id}`
        }
      }

      // Finde Zielzustand
      const nextState = this.states.find(s => s.id === transition.to)
      
      if (!nextState) {
        return {
          input,
          steps,
          accepted: false,
          finalState: null,
          error: `Zielzustand ${transition.to} nicht gefunden`
        }
      }

      // Update state
      consumedInput += symbol
      remainingInput = input.slice(i + 1)
      currentState = nextState

      // Get possible next transitions
      const nextSymbol = input[i + 1]
      const possibleNext = nextSymbol ? this.getPossibleTransitions(currentState.id, nextSymbol) : []

      // Record step
      steps.push({
        step: i + 1,
        currentState: currentState.id,
        remainingInput,
        consumedInput,
        transition: {
          from: transition.from,
          to: transition.to,
          symbol: transition.symbol
        },
        isAccepting: currentState.isFinal,
        possibleTransitions: possibleNext
      })
    }

    // ✅ CRITICAL CHECK: Input must be fully consumed AND in final state!
    const accepted = currentState.isFinal && remainingInput === ''

    return {
      input,
      steps,
      accepted,
      finalState: currentState.id,
      error: accepted ? undefined : `Endzustand ${currentState.id} ist kein akzeptierender Zustand`
    }
  }

  /**
   * ✨ NFA SIMULATION mit Zustandsmengen (Powerset Construction Prinzip)
   */
  private simulateNFA(
    input: string,
    startStates: State[],
    steps: SimulationStep[]
  ): SimulationResult {
    // Start mit ε-Closure aller Startzustände
    let currentStates = this.getEpsilonClosure(new Set(startStates.map(s => s.id)))
    let consumedInput = ''
    let remainingInput = input

    // Initial Step
    const hasAcceptingState = Array.from(currentStates).some(stateId => {
      const state = this.states.find(s => s.id === stateId)
      return state?.isFinal ?? false
    })

    steps.push({
      step: 0,
      currentState: Array.from(currentStates),
      remainingInput,
      consumedInput,
      isAccepting: hasAcceptingState,
      possibleTransitions: [],
      epsilonClosure: Array.from(currentStates)
    })

    // Process each symbol
    for (let i = 0; i < input.length; i++) {
      const symbol = input[i]!
      
      // Finde ALLE möglichen Transitionen von ALLEN aktuellen Zuständen
      const nextStates = new Set<string>()
      
      for (const stateId of currentStates) {
        // Finde alle Transitionen mit diesem Symbol
        const transitions = this.transitions.filter(
          t => t.from === stateId && t.symbol === symbol
        )
        
        // Füge alle Zielzustände hinzu
        for (const trans of transitions) {
          nextStates.add(trans.to)
        }
      }

      // ❌ STUCK CHECK: Keine Transitionen möglich!
      if (nextStates.size === 0) {
        steps.push({
          step: i + 1,
          currentState: Array.from(currentStates),
          remainingInput: input.slice(i),
          consumedInput: consumedInput,
          isAccepting: false,
          possibleTransitions: [],
          isStuck: true
        })

        return {
          input,
          steps,
          accepted: false,
          finalState: Array.from(currentStates),
          error: `Keine Transition für Symbol '${symbol}' von Zuständen {${Array.from(currentStates).join(', ')}}`
        }
      }

      // Berechne ε-Closure der neuen Zustände
      currentStates = this.getEpsilonClosure(nextStates)
      consumedInput += symbol
      remainingInput = input.slice(i + 1)

      // Check if any state is accepting
      const isAccepting = Array.from(currentStates).some(stateId => {
        const state = this.states.find(s => s.id === stateId)
        return state?.isFinal ?? false
      })

      // Record step
      steps.push({
        step: i + 1,
        currentState: Array.from(currentStates),
        remainingInput,
        consumedInput,
        isAccepting,
        possibleTransitions: [],
        epsilonClosure: Array.from(currentStates)
      })
    }

    // ✅ ACCEPT CHECK: Input vollständig konsumiert UND mindestens ein Endzustand
    const accepted = remainingInput === '' && Array.from(currentStates).some(stateId => {
      const state = this.states.find(s => s.id === stateId)
      return state?.isFinal ?? false
    })

    return {
      input,
      steps,
      accepted,
      finalState: Array.from(currentStates),
      error: accepted ? undefined : `Keine der Endzustände {${Array.from(currentStates).join(', ')}} ist akzeptierend`
    }
  }

  /**
   * 📚 PDA SIMULATION mit Stack-Management
   * 
   * PDA akzeptiert auf zwei Arten:
   * 1. By Final State: Input verbraucht UND in Endzustand
   * 2. By Empty Stack: Input verbraucht UND Stack leer
   */
  private simulatePDA(
    input: string,
    startState: State,
    steps: SimulationStep[]
  ): SimulationResult {
    let currentState = startState
    let remainingInput = input
    let consumedInput = ''
    let stack: string[] = [this.pdaStartStackSymbol]  // Initialize stack with start symbol

    // Initial Step
    steps.push({
      step: 0,
      currentState: currentState.id,
      remainingInput,
      consumedInput,
      isAccepting: currentState.isFinal,
      possibleTransitions: [],
      stack: [...stack]
    })

    let stepCounter = 0

    // Process input (with possible ε-moves)
    while (remainingInput.length > 0 || this.hasPDAEpsilonMoves(currentState.id, stack)) {
      stepCounter++
      
      // Safety: Prevent infinite loops (max 1000 steps)
      if (stepCounter > 1000) {
        return {
          input,
          steps,
          accepted: false,
          finalState: currentState.id,
          finalStack: stack,
          error: 'Simulation abgebrochen: Zu viele Schritte (mögliche Endlosschleife)'
        }
      }

      const currentSymbol = remainingInput.length > 0 ? remainingInput[0]! : ''
      const stackTop = stack.length > 0 ? stack[stack.length - 1]! : ''

      // Find applicable transitions (prioritize input over ε)
      let transition = this.findPDATransition(currentState.id, currentSymbol, stackTop)
      
      // If no input transition, try ε-move
      if (!transition) {
        transition = this.findPDATransition(currentState.id, '', stackTop)
      }

      // ❌ STUCK: No transition possible
      if (!transition) {
        steps.push({
          step: stepCounter,
          currentState: currentState.id,
          remainingInput,
          consumedInput,
          isAccepting: false,
          possibleTransitions: [],
          isStuck: true,
          stack: [...stack]
        })

        return {
          input,
          steps,
          accepted: false,
          finalState: currentState.id,
          finalStack: stack,
          error: `Keine PDA-Transition für (Input: '${currentSymbol || 'ε'}', Stack-Top: '${stackTop || 'leer'}') in Zustand ${currentState.id}`
        }
      }

      // ✅ Apply transition
      const consumesInput = transition.pdaInput !== undefined && transition.pdaInput !== ''
      const inputSymbol = transition.pdaInput || 'ε'
      const stackTopSymbol = transition.pdaStackTop || 'ε'
      const stackPushSymbols = transition.pdaStackPush || ''

      // Pop from stack (if stackTop is not epsilon)
      if (transition.pdaStackTop && transition.pdaStackTop !== '') {
        const currentStackTop = stack.length > 0 ? stack[stack.length - 1] : undefined
        if (stack.length === 0 || currentStackTop !== transition.pdaStackTop) {
          return {
            input,
            steps,
            accepted: false,
            finalState: currentState.id,
            finalStack: stack,
            error: `Stack-Mismatch: Erwartet '${transition.pdaStackTop}', aber Stack-Top ist '${currentStackTop || 'leer'}'`
          }
        }
        stack.pop()
      }

      // Push to stack (normal order: left-to-right in notation means bottom-to-top in stack)
      // Example: "$a" means push $ first (bottom), then a (top)
      if (stackPushSymbols && stackPushSymbols !== '') {
        for (let i = 0; i < stackPushSymbols.length; i++) {
          stack.push(stackPushSymbols[i]!)
        }
      }


      // Update state and input
      if (consumesInput) {
        consumedInput += remainingInput[0]!
        remainingInput = remainingInput.slice(1)
      }

      const nextState = this.states.find(s => s.id === transition!.to)
      if (!nextState) {
        return {
          input,
          steps,
          accepted: false,
          finalState: null,
          finalStack: stack,
          error: `Zielzustand ${transition.to} nicht gefunden`
        }
      }

      currentState = nextState

      // Record step
      steps.push({
        step: stepCounter,
        currentState: currentState.id,
        remainingInput,
        consumedInput,
        transition: {
          from: transition.from,
          to: transition.to,
          symbol: `(${inputSymbol},${stackTopSymbol})/${stackPushSymbols || 'ε'}`,
          pdaInput: inputSymbol,
          pdaStackTop: stackTopSymbol,
          pdaStackPush: stackPushSymbols || 'ε'
        },
        isAccepting: currentState.isFinal || stack.length === 0,
        possibleTransitions: [],
        stack: [...stack]
      })
    }

    // ✅ ACCEPTANCE CHECK (Two modes!)
    const acceptedByFinalState = currentState.isFinal && remainingInput === ''
    const acceptedByEmptyStack = stack.length === 0 && remainingInput === ''
    const accepted = acceptedByFinalState || acceptedByEmptyStack

    return {
      input,
      steps,
      accepted,
      finalState: currentState.id,
      finalStack: stack,
      error: accepted 
        ? undefined 
        : `PDA rejected: Input verbraucht=${remainingInput === ''}, Endzustand=${currentState.isFinal}, Stack leer=${stack.length === 0}`
    }
  }

  /**
   * Helper: Find PDA transition for (state, input, stackTop)
   */
  private findPDATransition(stateId: string, input: string, stackTop: string): Transition | undefined {
    // Normalize empty string to epsilon for comparison
    const normalizedInput = input === '' ? '' : input
    const normalizedStackTop = stackTop === '' ? '' : stackTop

    return this.transitions.find(t => {
      if (t.from !== stateId) return false

      const tInput = t.pdaInput === undefined ? '' : t.pdaInput
      const tStackTop = t.pdaStackTop === undefined ? '' : t.pdaStackTop

      return tInput === normalizedInput && tStackTop === normalizedStackTop
    })
  }

  /**
   * Helper: Check if PDA has epsilon moves from current state with current stack
   */
  private hasPDAEpsilonMoves(stateId: string, stack: string[]): boolean {
    const stackTop = stack.length > 0 ? stack[stack.length - 1]! : ''
    
    return this.transitions.some(t => {
      if (t.from !== stateId) return false
      
      const tInput = t.pdaInput === undefined ? '' : t.pdaInput
      const tStackTop = t.pdaStackTop === undefined ? '' : t.pdaStackTop
      
      return tInput === '' && tStackTop === stackTop
    })
  }

  /**
   * 🔄 Berechnet die ε-Closure einer Zustandsmenge
   * (Alle Zustände die über ε-Transitionen erreichbar sind)
   */
  private getEpsilonClosure(states: Set<string>): Set<string> {
    const closure = new Set(states)
    const queue = Array.from(states)

    while (queue.length > 0) {
      const current = queue.shift()!
      
      // Finde alle ε-Transitionen von diesem Zustand
      const epsilonTransitions = this.transitions.filter(
        t => t.from === current && (t.symbol === 'ε' || t.symbol === 'epsilon' || t.symbol === '')
      )
      
      for (const trans of epsilonTransitions) {
        if (!closure.has(trans.to)) {
          closure.add(trans.to)
          queue.push(trans.to)
        }
      }
    }

    return closure
  }

  /**
   * Helper: Get possible transitions from a state with a symbol
   */
  private getPossibleTransitions(stateId: string, symbol: string | undefined): string[] {
    if (!symbol) return []
    
    return this.transitions
      .filter(t => t.from === stateId && t.symbol === symbol)
      .map(t => t.to)
  }

  /**
   * Führt mehrere Testfälle aus
   */
  runTests(testCases: Array<{ input: string; expected: boolean }>): Array<SimulationResult & { expected: boolean; passed: boolean }> {
    return testCases.map(test => {
      const result = this.simulate(test.input)
      return {
        ...result,
        expected: test.expected,
        passed: result.accepted === test.expected
      }
    })
  }

  /**
   * Prüft ob ein bestimmtes Wort akzeptiert wird (ohne Schritte zu speichern)
   */
  accepts(input: string): boolean {
    const result = this.simulate(input)
    return result.accepted
  }

  /**
   * Gibt alle erreichbaren Zustände zurück
   */
  getReachableStates(): Set<string> {
    const startStates = this.states.filter(s => s.isStart)
    if (startStates.length === 0) return new Set()

    const reachable = new Set<string>()
    const queue = [...startStates.map(s => s.id)]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (reachable.has(current)) continue
      
      reachable.add(current)

      // Finde alle Transitionen von diesem Zustand (inkl. ε)
      const outgoingTransitions = this.transitions.filter(t => t.from === current)
      for (const transition of outgoingTransitions) {
        if (!reachable.has(transition.to)) {
          queue.push(transition.to)
        }
      }
    }

    return reachable
  }
}
