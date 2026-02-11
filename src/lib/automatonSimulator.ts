import type { State, Transition, AutomatonProject } from './automaton'
import type { AutomatonType } from './automatonTypes'

export interface SimulationStep {
  currentState: string
  remainingInput: string
  consumedInput: string
  transition?: {
    from: string
    to: string
    symbol: string
  }
  isAccepting: boolean
}

export interface SimulationResult {
  testCase: string
  steps: SimulationStep[]
  accepted: boolean
  error?: string
}

export class AutomatonSimulator {
  constructor(
    private states: State[],
    private transitions: Transition[],
    private type: AutomatonType
  ) {}

  /**
   * Simuliert einen Testfall Schritt für Schritt
   */
  simulate(input: string): SimulationResult {
    const steps: SimulationStep[] = []
    
    // Finde Startzustand
    const startStates = this.states.filter(s => s.isStart)
    
    if (startStates.length === 0) {
      return {
        testCase: input,
        steps: [],
        accepted: false,
        error: 'Kein Startzustand definiert'
      }
    }

    if (startStates.length > 1 && this.type === 'DFA') {
      return {
        testCase: input,
        steps: [],
        accepted: false,
        error: 'DFA darf nur einen Startzustand haben'
      }
    }

    // DFA Simulation
    if (this.type === 'DFA') {
      // Non-null assertion: Wir wissen, dass startStates[0] existiert
      return this.simulateDFA(input, startStates[0]!, steps)
    }

    // NFA Simulation
    if (this.type === 'NFA') {
      return this.simulateNFA(input, startStates, steps)
    }

    return {
      testCase: input,
      steps: [],
      accepted: false,
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
    steps.push({
      currentState: currentState.id,
      remainingInput,
      consumedInput,
      isAccepting: currentState.isFinal
    })

    // Process each symbol
    for (let i = 0; i < input.length; i++) {
      const symbol = input[i]
      
      // Finde Transition mit diesem Symbol
      const transition = this.transitions.find(
        t => t.from === currentState.id && t.symbol === symbol
      )

      if (!transition) {
        return {
          testCase: input,
          steps,
          accepted: false,
          error: `Keine Transition für Symbol '${symbol}' in Zustand ${currentState.id}`
        }
      }

      // Finde Zielzustand
      const nextState = this.states.find(s => s.id === transition.to)
      
      if (!nextState) {
        return {
          testCase: input,
          steps,
          accepted: false,
          error: `Zielzustand ${transition.to} nicht gefunden`
        }
      }

      // Update state
      consumedInput += symbol
      remainingInput = input.slice(i + 1)
      currentState = nextState

      // Record step
      steps.push({
        currentState: currentState.id,
        remainingInput,
        consumedInput,
        transition: {
          from: transition.from,
          to: transition.to,
          symbol: transition.symbol
        },
        isAccepting: currentState.isFinal
      })
    }

    // Check if final state
    const accepted = currentState.isFinal

    return {
      testCase: input,
      steps,
      accepted,
      error: accepted ? undefined : `Endzustand ${currentState.id} ist kein akzeptierender Zustand`
    }
  }

  private simulateNFA(
    input: string,
    startStates: State[],
    steps: SimulationStep[]
  ): SimulationResult {
    // NFA Simulation mit ε-Closure
    // Für später: Backtracking oder Breitensuche implementieren
    
    return {
      testCase: input,
      steps: [],
      accepted: false,
      error: 'NFA-Simulation noch nicht vollständig implementiert'
    }
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

      // Finde alle Transitionen von diesem Zustand
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
