/**
 * automatonSimulator.ts — Step-by-step simulation engine for DFA, NFA, PDA,
 * and Turing machines.
 *
 * The `AutomatonSimulator` class takes a snapshot of states and transitions
 * and can:
 *  - `simulate(input)`  — produce a full trace of `SimulationStep[]`
 *  - `runTests(cases)`  — batch-run test cases and compare results
 *  - `accepts(input)`   — quick accept/reject without storing steps
 *
 * Each automaton type has a dedicated private simulation method that
 * faithfully models the theoretical computation model (deterministic
 * transitions, powerset construction, stack operations, tape read/write).
 */

import type { State, Transition } from './automaton'
import type { AutomatonType, TMHeadEnd } from './automatonTypes'

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** A single snapshot of the machine’s configuration at one instant. */
export interface SimulationStep {
  step: number
  /** Current state ID(s) — a single string for DFA/PDA/TM, an array for NFA. */
  currentState: string | string[]
  remainingInput: string
  consumedInput: string
  transition?: {
    from: string
    to: string
    symbol: string
    pdaInput?: string
    pdaStackTop?: string
    pdaStackPush?: string
    tmWrite?: string
    tmMove?: 'L' | 'R'
  }
  isAccepting: boolean
  possibleTransitions: string[]
  /** True if the current configuration is stuck (no transition available). */
  isStuck?: boolean
  /** NFA only — the full ε-closure of the current state set. */
  epsilonClosure?: string[]
  /** PDA only — snapshot of the stack (top is last element). */
  stack?: string[]
  /** TM only — snapshot of the tape. */
  tape?: string[]
  /** TM only — current head position on the tape. */
  headPosition?: number
}

/** Complete result of a simulation run. */
export interface SimulationResult {
  input: string
  steps: SimulationStep[]
  accepted: boolean
  finalState: string | string[] | null
  error?: string
  /** True when simulation failed because a required transition was missing. */
  isStuckDueToMissingTransition?: boolean
  finalStack?: string[]
  finalTape?: string[]
  finalOutput?: string
}

/** Options that configure expected-output comparison (primarily for TM). */
export interface SimulationOptions {
  expectedOutput?: string
  tmHeadEnd?: TMHeadEnd
}

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

export class AutomatonSimulator {
  /** Initial stack symbol for PDA simulations (default '$'). */
  private pdaStartStackSymbol: string = '$'

  constructor(
    private states: State[],
    private transitions: Transition[],
    private type: AutomatonType,
    pdaConfig?: { startStackSymbol: string },
  ) {
    if (pdaConfig) {
      this.pdaStartStackSymbol = pdaConfig.startStackSymbol || '$'
    }
  }

  /**
   * Runs a full simulation of the given input string and returns the
   * recorded steps together with the accept/reject verdict.
   */
  simulate(input: string, options?: SimulationOptions): SimulationResult {
    const steps: SimulationStep[] = []

    // Finde Startzustand
    const startStates = this.states.filter((s) => s.isStart)

    if (startStates.length === 0) {
      return {
        input,
        steps: [],
        accepted: false,
        finalState: null,
        error: 'Kein Startzustand definiert',
      }
    }

    if (startStates.length > 1 && this.type === 'DFA') {
      return {
        input,
        steps: [],
        accepted: false,
        finalState: null,
        error: 'DFA darf nur einen Startzustand haben',
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

    // PDA Simulation
    if (this.type === 'PDA') {
      return this.simulatePDA(input, startStates[0]!, steps)
    }

    // TM Simulation
    if (this.type === 'TM') {
      return this.simulateTM(input, startStates[0]!, options)
    }

    return {
      input,
      steps: [],
      accepted: false,
      finalState: null,
      error: `Automatentyp ${this.type} noch nicht implementiert`,
    }
  }

  // -------------------------------------------------------------------------
  // DFA simulation
  // -------------------------------------------------------------------------

  /**
   * Deterministic simulation: follows exactly one transition per input
   * symbol.  Gets stuck (rejects) if no transition exists.
   */
  private simulateDFA(input: string, startState: State, steps: SimulationStep[]): SimulationResult {
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
      possibleTransitions: initialPossible,
    })

    // Process each symbol
    for (let i = 0; i < input.length; i++) {
      const symbol = input[i]!

      // Finde Transition mit diesem Symbol
      const transition = this.transitions.find(
        (t) => t.from === currentState.id && t.symbol === symbol,
      )

      // **STUCK CHECK: Keine Transition möglich!**
      if (!transition) {
        steps.push({
          step: i + 1,
          currentState: currentState.id,
          remainingInput: input.slice(i),
          consumedInput: consumedInput,
          isAccepting: false, // STUCK = NOT ACCEPTING
          possibleTransitions: [],
          isStuck: true, // STUCK FLAG!
        })

        return {
          input,
          steps,
          accepted: false, // STUCK = REJECTED
          finalState: currentState.id,
          error: `Keine Transition für Symbol '${symbol}' in Zustand ${currentState.id}`,
          isStuckDueToMissingTransition: input.slice(i).length > 0,
        }
      }

      // Finde Zielzustand
      const nextState = this.states.find((s) => s.id === transition.to)

      if (!nextState) {
        return {
          input,
          steps,
          accepted: false,
          finalState: null,
          error: `Zielzustand ${transition.to} nicht gefunden`,
        }
      }

      // Update state
      consumedInput += symbol
      remainingInput = input.slice(i + 1)
      currentState = nextState

      // Get possible next transitions
      const nextSymbol = input[i + 1]
      const possibleNext = nextSymbol
        ? this.getPossibleTransitions(currentState.id, nextSymbol)
        : []

      // Record step
      steps.push({
        step: i + 1,
        currentState: currentState.id,
        remainingInput,
        consumedInput,
        transition: {
          from: transition.from,
          to: transition.to,
          symbol: transition.symbol,
        },
        isAccepting: currentState.isFinal,
        possibleTransitions: possibleNext,
      })
    }

    // CRITICAL CHECK: Input must be fully consumed AND in final state!
    const accepted = currentState.isFinal && remainingInput === ''

    return {
      input,
      steps,
      accepted,
      finalState: currentState.id,
      error: accepted ? undefined : `Endzustand ${currentState.id} ist kein akzeptierender Zustand`,
    }
  }

  // -------------------------------------------------------------------------
  // NFA simulation (powerset / subset construction)
  // -------------------------------------------------------------------------

  /**
   * Non-deterministic simulation using the powerset approach: maintains
   * a *set* of current states and computes the ε-closure after each step.
   */
  private simulateNFA(
    input: string,
    startStates: State[],
    steps: SimulationStep[],
  ): SimulationResult {
    // Start mit ε-Closure aller Startzustände
    let currentStates = this.getEpsilonClosure(new Set(startStates.map((s) => s.id)))
    let consumedInput = ''
    let remainingInput = input

    // Initial Step
    const hasAcceptingState = Array.from(currentStates).some((stateId) => {
      const state = this.states.find((s) => s.id === stateId)
      return state?.isFinal ?? false
    })

    steps.push({
      step: 0,
      currentState: Array.from(currentStates),
      remainingInput,
      consumedInput,
      isAccepting: hasAcceptingState,
      possibleTransitions: [],
      epsilonClosure: Array.from(currentStates),
    })

    // Process each symbol
    for (let i = 0; i < input.length; i++) {
      const symbol = input[i]!

      // Finde ALLE möglichen Transitionen von ALLEN aktuellen Zuständen
      const nextStates = new Set<string>()

      for (const stateId of currentStates) {
        // Finde alle Transitionen mit diesem Symbol
        const transitions = this.transitions.filter(
          (t) => t.from === stateId && t.symbol === symbol,
        )

        // Füge alle Zielzustände hinzu
        for (const trans of transitions) {
          nextStates.add(trans.to)
        }
      }

      // STUCK CHECK: Keine Transitionen möglich!
      if (nextStates.size === 0) {
        steps.push({
          step: i + 1,
          currentState: Array.from(currentStates),
          remainingInput: input.slice(i),
          consumedInput: consumedInput,
          isAccepting: false,
          possibleTransitions: [],
          isStuck: true,
        })

        return {
          input,
          steps,
          accepted: false,
          finalState: Array.from(currentStates),
          error: `Keine Transition für Symbol '${symbol}' von Zuständen {${Array.from(currentStates).join(', ')}}`,
        }
      }

      // Berechne ε-Closure der neuen Zustände
      currentStates = this.getEpsilonClosure(nextStates)
      consumedInput += symbol
      remainingInput = input.slice(i + 1)

      // Check if any state is accepting
      const isAccepting = Array.from(currentStates).some((stateId) => {
        const state = this.states.find((s) => s.id === stateId)
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
        epsilonClosure: Array.from(currentStates),
      })
    }

    // ACCEPT CHECK: Input vollständig konsumiert UND mindestens ein Endzustand
    const accepted =
      remainingInput === '' &&
      Array.from(currentStates).some((stateId) => {
        const state = this.states.find((s) => s.id === stateId)
        return state?.isFinal ?? false
      })

    return {
      input,
      steps,
      accepted,
      finalState: Array.from(currentStates),
      error: accepted
        ? undefined
        : `Keine der Endzustände {${Array.from(currentStates).join(', ')}} ist akzeptierend`,
    }
  }

  // -------------------------------------------------------------------------
  // PDA simulation
  // -------------------------------------------------------------------------

  /**
   * Pushdown automaton simulation with stack management.
   *
   * Acceptance modes (both are recognised):
   *  1. **By final state** — input consumed AND machine is in a final state.
   *  2. **By empty stack** — input consumed AND the stack is empty.
   */
  private simulatePDA(input: string, startState: State, steps: SimulationStep[]): SimulationResult {
    let currentState = startState
    let remainingInput = input
    let consumedInput = ''
    const stack: string[] = [this.pdaStartStackSymbol] // Initialize stack with start symbol

    // Initial Step
    steps.push({
      step: 0,
      currentState: currentState.id,
      remainingInput,
      consumedInput,
      isAccepting: currentState.isFinal,
      possibleTransitions: [],
      stack: [...stack],
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
          error: 'Simulation abgebrochen: Zu viele Schritte (mögliche Endlosschleife)',
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

      // STUCK: No transition possible
      if (!transition) {
        steps.push({
          step: stepCounter,
          currentState: currentState.id,
          remainingInput,
          consumedInput,
          isAccepting: false,
          possibleTransitions: [],
          isStuck: true,
          stack: [...stack],
        })

        return {
          input,
          steps,
          accepted: false,
          finalState: currentState.id,
          finalStack: stack,
          error: `Keine PDA-Transition für (Input: '${currentSymbol || 'ε'}', Stack-Top: '${stackTop || 'leer'}') in Zustand ${currentState.id}`,
          isStuckDueToMissingTransition: remainingInput.length > 0,
        }
      }

      // Apply transition
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
            error: `Stack-Mismatch: Erwartet '${transition.pdaStackTop}', aber Stack-Top ist '${currentStackTop || 'leer'}'`,
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

      const nextState = this.states.find((s) => s.id === transition!.to)
      if (!nextState) {
        return {
          input,
          steps,
          accepted: false,
          finalState: null,
          finalStack: stack,
          error: `Zielzustand ${transition.to} nicht gefunden`,
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
          pdaStackPush: stackPushSymbols || 'ε',
        },
        isAccepting: currentState.isFinal || stack.length === 0,
        possibleTransitions: [],
        stack: [...stack],
      })
    }

    // ACCEPTANCE CHECK (Two modes)
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
        : `PDA rejected: Input verbraucht=${remainingInput === ''}, Endzustand=${currentState.isFinal}, Stack leer=${stack.length === 0}`,
    }
  }

  // -------------------------------------------------------------------------
  // Turing machine simulation
  // -------------------------------------------------------------------------

  /**
   * Turing machine simulation with a read/write tape and a movable head.
   *
   * Acceptance criterion:
   *  - The machine reaches a final (accepting) state.
   *  - The tape output matches the expected output.
   *  - The head position matches the expected end position.
   *
   * A safety limit of 1 000 steps prevents runaway loops.
   */
  private simulateTM(
    input: string,
    startState: State,
    options?: SimulationOptions,
  ): SimulationResult {
    if (options?.expectedOutput === undefined) {
      return {
        input,
        steps: [],
        accepted: false,
        finalState: null,
        error: 'TM-Testfall braucht eine erwartete Ausgabe (Expected Output).',
      }
    }

    const headEnd = options?.tmHeadEnd ?? 'start'

    return this.simulateTMFromPosition(input, startState, headEnd, options.expectedOutput)
  }

  private simulateTMFromPosition(
    input: string,
    startState: State,
    headEnd: TMHeadEnd,
    expectedOutput: string,
  ): SimulationResult {
    let currentState = startState
    let tape: string[] = input.split('') // Tape starts with input
    let headPosition = 0
    let originIndex = 0
    const consumedInput = ''
    const steps: SimulationStep[] = []

    // BLANK symbol (Unicode: U+25A1)
    const BLANK = '□'

    if (tape.length === 0) {
      tape = [BLANK]
      headPosition = 0
    }

    // Initial Step
    steps.push({
      step: 0,
      currentState: currentState.id,
      remainingInput: input,
      consumedInput: '',
      isAccepting: currentState.isFinal,
      possibleTransitions: [],
      tape: [...tape],
      headPosition: headPosition,
    })

    let stepCounter = 0
    const MAX_STEPS = 1000 // Safety limit to prevent infinite loops

    // Main simulation loop
    while (stepCounter < MAX_STEPS) {
      stepCounter++

      // Read current cell
      const readSymbol = tape[headPosition] ?? BLANK

      // Find matching transition
      const transition = this.findTMTransition(currentState.id, readSymbol)

      if (!transition) {
        // STUCK: No transition found
        steps.push({
          step: stepCounter,
          currentState: currentState.id,
          remainingInput: '',
          consumedInput: consumedInput,
          isAccepting: false,
          possibleTransitions: [],
          isStuck: true,
          tape: [...tape],
          headPosition: headPosition,
        })

        const outputInfo = this.getTapeOutputInfo(tape)
        const finalOutput = outputInfo.output

        if (currentState.isFinal) {
          const outputMatches = finalOutput === expectedOutput
          const headMatches = this.isTMHeadEndMatch(
            headEnd,
            headPosition,
            originIndex,
            outputInfo.leftIndex,
            outputInfo.rightIndex,
          )
          const accepted = outputMatches && headMatches
          steps[steps.length - 1]!.isAccepting = accepted
          return {
            input,
            steps,
            accepted,
            finalState: currentState.id,
            finalTape: [...tape],
            finalOutput,
            error: accepted
              ? undefined
              : this.buildTMRejectionReason(
                  expectedOutput,
                  finalOutput,
                  headEnd,
                  headPosition,
                  originIndex,
                  outputInfo.leftIndex,
                  outputInfo.rightIndex,
                ),
          }
        }

        return {
          input,
          steps,
          accepted: false,
          finalState: currentState.id,
          finalTape: [...tape],
          finalOutput,
          error: `Keine Transition fuer Symbol '${this.normalizeBLANK(readSymbol) === '□' ? '#' : this.normalizeBLANK(readSymbol)}' in Zustand ${currentState.id}. Du benoetigst eine Transition mit Symbol '#', 'BLANK', 'epsilon', '.', oder '_' fuer Blank-Zellen!`,
          isStuckDueToMissingTransition: true,
        }
      }

      // Apply transition

      // 1) Write to tape (if specified)
      if (transition.tmWrite !== undefined && transition.tmWrite !== '') {
        tape[headPosition] = this.normalizeBLANK(transition.tmWrite)
      }

      // 2) Move head (if specified)
      if (transition.tmMove === 'L') {
        headPosition--
        // Expand tape to the left if needed
        if (headPosition < 0) {
          tape.unshift(BLANK)
          headPosition = 0
          originIndex += 1
        }
      } else if (transition.tmMove === 'R') {
        headPosition++
        // Expand tape to the right if needed
        if (headPosition >= tape.length) {
          tape.push(BLANK)
        }
      }

      // 3) Move to next state
      const nextState = this.states.find((s) => s.id === transition.to)
      if (!nextState) {
        const finalOutput = this.getTapeOutputInfo(tape).output

        return {
          input,
          steps,
          accepted: false,
          finalState: null,
          finalTape: [...tape],
          finalOutput,
          error: `Zielzustand ${transition.to} nicht gefunden`,
        }
      }

      currentState = nextState

      // Record step
      steps.push({
        step: stepCounter,
        currentState: currentState.id,
        remainingInput: '',
        consumedInput: consumedInput,
        transition: {
          from: transition.from,
          to: transition.to,
          symbol: this.normalizeBLANK(readSymbol),
          tmWrite: transition.tmWrite ? this.normalizeBLANK(transition.tmWrite) : undefined,
          tmMove: transition.tmMove,
        },
        isAccepting: currentState.isFinal,
        possibleTransitions: [],
        tape: [...tape],
        headPosition: headPosition,
      })

      // Check if in accepting state
      if (currentState.isFinal) {
        const outputInfo = this.getTapeOutputInfo(tape)
        const finalOutput = outputInfo.output
        const outputMatches = finalOutput === expectedOutput
        const headMatches = this.isTMHeadEndMatch(
          headEnd,
          headPosition,
          originIndex,
          outputInfo.leftIndex,
          outputInfo.rightIndex,
        )
        const accepted = outputMatches && headMatches
        steps[steps.length - 1]!.isAccepting = accepted

        return {
          input,
          steps,
          accepted,
          finalState: currentState.id,
          finalTape: [...tape],
          finalOutput,
          error: accepted
            ? undefined
            : this.buildTMRejectionReason(
                expectedOutput,
                finalOutput,
                headEnd,
                headPosition,
                originIndex,
                outputInfo.leftIndex,
                outputInfo.rightIndex,
              ),
        }
      }
    }

    // Max steps exceeded
    const finalOutput = this.getTapeOutputInfo(tape).output

    return {
      input,
      steps,
      accepted: false,
      finalState: currentState.id,
      finalTape: [...tape],
      finalOutput,
      error: `Simulation abgebrochen: Zu viele Schritte (${MAX_STEPS}). Moegliche Endlosschleife!`,
    }
  }

  // -------------------------------------------------------------------------
  // TM helper methods
  // -------------------------------------------------------------------------

  /** Checks whether the head ended at the expected position. */
  private isTMHeadEndMatch(
    headEnd: TMHeadEnd,
    headPosition: number,
    originIndex: number,
    outputLeftIndex: number | null,
    outputRightIndex: number | null,
  ): boolean {
    if (headEnd === 'any') return true

    const startIndex = outputLeftIndex ?? originIndex
    const endIndex = outputRightIndex ?? originIndex
    const expectedIndex = headEnd === 'end' ? endIndex : startIndex

    return headPosition === expectedIndex
  }

  /** Builds a human-readable rejection reason for a TM test failure. */
  private buildTMRejectionReason(
    expectedOutput: string,
    finalOutput: string,
    headEnd: TMHeadEnd,
    headPosition: number,
    originIndex: number,
    outputLeftIndex: number | null,
    outputRightIndex: number | null,
  ): string {
    const outputMatches = finalOutput === expectedOutput
    const headMatches = this.isTMHeadEndMatch(
      headEnd,
      headPosition,
      originIndex,
      outputLeftIndex,
      outputRightIndex,
    )

    if (outputMatches && !headMatches && headEnd !== 'any') {
      const startIndex = outputLeftIndex ?? originIndex
      const endIndex = outputRightIndex ?? originIndex
      const expectedIndex = headEnd === 'end' ? endIndex : startIndex
      const expectedLabel = headEnd === 'end' ? 'Ende' : 'Anfang'
      return `Kopfposition stimmt nicht: erwartet ${expectedLabel} (Index ${expectedIndex}), bekommen Index ${headPosition}`
    }

    if (!outputMatches) {
      return `Output passt nicht: erwartet "${expectedOutput}", bekommen "${finalOutput}"`
    }

    return 'TM akzeptiert nicht'
  }

  /**
   * Extracts the meaningful (non-blank) content from the tape together
   * with the bounding indices of the output region.
   */
  private getTapeOutputInfo(tape: string[]): {
    output: string
    leftIndex: number | null
    rightIndex: number | null
  } {
    const BLANK = '□'
    let left = 0
    let right = tape.length - 1

    while (left <= right && tape[left] === BLANK) {
      left++
    }

    while (right >= left && tape[right] === BLANK) {
      right--
    }

    if (left > right) {
      return { output: '', leftIndex: null, rightIndex: null }
    }

    return {
      output: tape.slice(left, right + 1).join(''),
      leftIndex: left,
      rightIndex: right,
    }
  }

  // -------------------------------------------------------------------------
  // Shared helper methods
  // -------------------------------------------------------------------------

  /**
   * Normalises various blank-symbol aliases ('.', '#', '_', 'ε', 'BLANK')
   * to the canonical Unicode blank '□'.
   */
  private normalizeBLANK(symbol: string): string {
    if (
      !symbol ||
      symbol === '' ||
      symbol === '.' ||
      symbol === 'BLANK' ||
      symbol === 'ε' ||
      symbol === '#' ||
      symbol === '_'
    ) {
      return '□'
    }
    return symbol
  }

  /** Finds the TM transition for the given state and tape symbol. */
  private findTMTransition(stateId: string, readSymbol: string): Transition | undefined {
    const normalizedReadSymbol = this.normalizeBLANK(readSymbol)

    return this.transitions.find((t) => {
      if (t.from !== stateId) return false

      // Normalize transition symbol (handle BLANK aliases)
      const tSymbol = this.normalizeBLANK(t.symbol)

      return tSymbol === normalizedReadSymbol
    })
  }

  /** Finds the PDA transition for the given state, input symbol, and stack top. */
  private findPDATransition(
    stateId: string,
    input: string,
    stackTop: string,
  ): Transition | undefined {
    // Normalize empty string to epsilon for comparison
    const normalizedInput = input === '' ? '' : input
    const normalizedStackTop = stackTop === '' ? '' : stackTop

    return this.transitions.find((t) => {
      if (t.from !== stateId) return false

      const tInput = t.pdaInput === undefined ? '' : t.pdaInput
      const tStackTop = t.pdaStackTop === undefined ? '' : t.pdaStackTop

      return tInput === normalizedInput && tStackTop === normalizedStackTop
    })
  }

  /** Returns `true` if the PDA has any ε-input transitions from the given state. */
  private hasPDAEpsilonMoves(stateId: string, stack: string[]): boolean {
    const stackTop = stack.length > 0 ? stack[stack.length - 1]! : ''

    return this.transitions.some((t) => {
      if (t.from !== stateId) return false

      const tInput = t.pdaInput === undefined ? '' : t.pdaInput
      const tStackTop = t.pdaStackTop === undefined ? '' : t.pdaStackTop

      return tInput === '' && tStackTop === stackTop
    })
  }

  /**
   * Computes the ε-closure of a set of NFA states — i.e. all states
   * reachable via zero or more ε-transitions.
   */
  private getEpsilonClosure(states: Set<string>): Set<string> {
    const closure = new Set(states)
    const queue = Array.from(states)

    while (queue.length > 0) {
      const current = queue.shift()!

      // Finde alle ε-Transitionen von diesem Zustand
      const epsilonTransitions = this.transitions.filter(
        (t) => t.from === current && (t.symbol === 'ε' || t.symbol === 'epsilon'),
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

  /** Lists target state IDs reachable from `stateId` via `symbol`. */
  private getPossibleTransitions(stateId: string, symbol: string | undefined): string[] {
    if (!symbol) return []

    return this.transitions
      .filter((t) => t.from === stateId && t.symbol === symbol)
      .map((t) => t.to)
  }

  /**
   * Batch-runs an array of test cases and attaches pass/fail metadata
   * to each result for display in the test panel.
   */
  runTests(
    testCases: Array<{
      input: string
      expected: boolean
      expectedOutput?: string
      tmHeadEnd?: TMHeadEnd
    }>,
  ): Array<SimulationResult & { expected: boolean; passed: boolean }> {
    return testCases.map((test) => {
      const result = this.simulate(test.input, {
        expectedOutput: test.expectedOutput,
        tmHeadEnd: test.tmHeadEnd,
      })
      return {
        ...result,
        expected: test.expected,
        passed: result.accepted === test.expected && !result.isStuckDueToMissingTransition,
      }
    })
  }

  /** Quick accept/reject check without recording intermediate steps. */
  accepts(input: string): boolean {
    const result = this.simulate(input)
    return result.accepted
  }

  /** Returns the set of state IDs reachable from any start state. */
  getReachableStates(): Set<string> {
    const startStates = this.states.filter((s) => s.isStart)
    if (startStates.length === 0) return new Set()

    const reachable = new Set<string>()
    const queue = startStates.map((s) => s.id)

    while (queue.length > 0) {
      const current = queue.shift()!
      if (reachable.has(current)) continue

      reachable.add(current)

      // Finde alle Transitionen von diesem Zustand (inkl. ε)
      const outgoingTransitions = this.transitions.filter((t) => t.from === current)
      for (const transition of outgoingTransitions) {
        if (!reachable.has(transition.to)) {
          queue.push(transition.to)
        }
      }
    }

    return reachable
  }
}
