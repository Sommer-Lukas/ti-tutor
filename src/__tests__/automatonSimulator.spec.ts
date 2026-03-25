import { describe, it, expect, beforeEach } from 'vitest'
import { AutomatonSimulator } from '../lib/automatonSimulator'
import type { State, Transition } from '../lib/automaton'

// Helper: Create a state with required fields
const makeState = (id: string, isStart: boolean, isFinal: boolean): State => ({
  id,
  label: id,
  isStart,
  isFinal,
  position: { x: 0, y: 0 },
})

describe('AutomatonSimulator', () => {
  describe('DFA Simulation', () => {
    let states: State[]
    let transitions: Transition[]

    beforeEach(() => {
      // Simple DFA: accepts strings ending with 'a'
      states = [makeState('q0', true, false), makeState('q1', false, true)]

      transitions = [
        { id: '1', from: 'q0', to: 'q1', symbol: 'a' },
        { id: '2', from: 'q1', to: 'q0', symbol: 'b' },
      ]
    })

    it('accepts valid input', () => {
      const simulator = new AutomatonSimulator(states, transitions, 'DFA')
      const result = simulator.simulate('a')
      expect(result.accepted).toBe(true)
    })

    it('rejects invalid input', () => {
      const simulator = new AutomatonSimulator(states, transitions, 'DFA')
      const result = simulator.simulate('b')
      expect(result.accepted).toBe(false)
    })

    it('generates step information', () => {
      const simulator = new AutomatonSimulator(states, transitions, 'DFA')
      const result = simulator.simulate('a')
      expect(result.steps.length).toBeGreaterThan(0)
      expect(result.steps[0]?.currentState).toBeDefined()
    })
  })

  describe('NFA Simulation', () => {
    let states: State[]
    let transitions: Transition[]

    beforeEach(() => {
      states = [makeState('q0', true, false), makeState('q1', false, true)]

      transitions = [
        { id: '1', from: 'q0', to: 'q0', symbol: 'a' },
        { id: '2', from: 'q0', to: 'q1', symbol: 'a' },
      ]
    })

    it('accepts input with multiple paths', () => {
      const simulator = new AutomatonSimulator(states, transitions, 'NFA')
      const result = simulator.simulate('a')
      expect(result.accepted).toBe(true)
    })

    it('handles epsilon transitions', () => {
      const epsilonTransitions: Transition[] = [
        ...transitions,
        { id: '3', from: 'q0', to: 'q1', symbol: 'ε' },
      ]
      const simulator = new AutomatonSimulator(states, epsilonTransitions, 'NFA')
      const result = simulator.simulate('')
      expect(result.steps.length).toBeGreaterThan(0)
    })

    it('tracks multiple current states across steps', () => {
      const multiTransitions: Transition[] = [
        { id: '1', from: 'q0', to: 'q0', symbol: 'a' },
        { id: '2', from: 'q0', to: 'q1', symbol: 'a' },
        { id: '3', from: 'q1', to: 'q1', symbol: 'a' },
      ]
      const simulator = new AutomatonSimulator(states, multiTransitions, 'NFA')
      const result = simulator.simulate('aa')
      expect(result.accepted).toBe(true)
      expect(Array.isArray(result.steps[1]?.currentState)).toBe(true)
    })
  })

  describe('PDA Simulation', () => {
    let states: State[]
    let transitions: Transition[]

    beforeEach(() => {
      states = [
        makeState('q0', true, false),
        makeState('q1', false, false),
        makeState('qAccept', false, true),
      ]

      transitions = [
        // Push A for each 'a'
        { id: '1', from: 'q0', to: 'q0', symbol: '', pdaInput: 'a', pdaStackTop: '$', pdaStackPush: '$A' },
        { id: '2', from: 'q0', to: 'q0', symbol: '', pdaInput: 'a', pdaStackTop: 'A', pdaStackPush: 'AA' },

        // On 'b', move to q1 and pop A
        { id: '3', from: 'q0', to: 'q1', symbol: '', pdaInput: 'b', pdaStackTop: 'A', pdaStackPush: '' },
        { id: '4', from: 'q1', to: 'q1', symbol: '', pdaInput: 'b', pdaStackTop: 'A', pdaStackPush: '' },

        // When input consumed and stack has only '$', accept by final state
        { id: '5', from: 'q1', to: 'qAccept', symbol: '', pdaInput: '', pdaStackTop: '$', pdaStackPush: '$' },
      ]
    })

    it('accepts balanced a^n b^n via stack', () => {
      const simulator = new AutomatonSimulator(states, transitions, 'PDA', {
        startStackSymbol: '$',
      })
      const result = simulator.simulate('aaabbb')
      expect(result.accepted).toBe(true)
      expect(result.steps.length).toBeGreaterThan(0)
      expect(result.steps.some((step) => Array.isArray(step.stack))).toBe(true)
    })

    it('rejects when stack does not match input', () => {
      const simulator = new AutomatonSimulator(states, transitions, 'PDA', {
        startStackSymbol: '$',
      })
      const result = simulator.simulate('aabbb')
      expect(result.accepted).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('TM Simulation', () => {
    let states: State[]
    let transitions: Transition[]

    beforeEach(() => {
      states = [
        makeState('q0', true, false),
        makeState('q1', false, false),
        makeState('qAccept', false, true),
      ]

      transitions = [
        // Read 1, move right into new blank cell
        { id: '1', from: 'q0', to: 'q1', symbol: '1', tmWrite: '1', tmMove: 'R' },
        // On blank (use # alias), write 1 and accept
        { id: '2', from: 'q1', to: 'qAccept', symbol: '#', tmWrite: '1', tmMove: 'L' },
      ]
    })

    it('expands tape and writes on blank', () => {
      const simulator = new AutomatonSimulator(states, transitions, 'TM')
      const result = simulator.simulate('1', {
        expectedOutput: '11',
        tmHeadEnd: 'start',
      })
      expect(result.accepted).toBe(true)
      expect(result.finalTape).toBeDefined()
      expect(result.finalTape?.join('')).toBe('11')
      expect(result.steps.length).toBeGreaterThan(1)
    })
  })

  describe('Error Handling', () => {
    it('returns error for missing start state', () => {
      const states: State[] = [makeState('q0', false, true)]
      const simulator = new AutomatonSimulator(states, [], 'DFA')
      const result = simulator.simulate('a')
      expect(result.accepted).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns error for multiple start states in DFA', () => {
      const states: State[] = [makeState('q0', true, false), makeState('q1', true, false)]
      const simulator = new AutomatonSimulator(states, [], 'DFA')
      const result = simulator.simulate('a')
      expect(result.accepted).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Test Runner', () => {
    it('runs multiple test cases', () => {
      const states: State[] = [makeState('q0', true, true)]
      const simulator = new AutomatonSimulator(states, [], 'DFA')

      const testCases = [
        { input: 'a', expected: true },
        { input: 'b', expected: false },
      ]

      const results = simulator.runTests(testCases)
      expect(results.length).toBe(2)
      expect(results[0]).toHaveProperty('passed')
      expect(results[0]).toHaveProperty('expected')
    })

    it('fails DFA reject tests when machine is stuck due to missing transition', () => {
      const states: State[] = [makeState('q0', true, false)]
      const transitions: Transition[] = []
      const simulator = new AutomatonSimulator(states, transitions, 'DFA')

      const results = simulator.runTests([{ input: 'a', expected: false }])

      expect(results[0]?.accepted).toBe(false)
      expect(results[0]?.isStuckDueToMissingTransition).toBe(true)
      expect(results[0]?.passed).toBe(false)
    })

    it('keeps NFA reject tests valid when no path exists for symbol', () => {
      const states: State[] = [makeState('q0', true, false)]
      const transitions: Transition[] = []
      const simulator = new AutomatonSimulator(states, transitions, 'NFA')

      const results = simulator.runTests([{ input: 'a', expected: false }])

      expect(results[0]?.accepted).toBe(false)
      expect(results[0]?.isStuckDueToMissingTransition).toBeUndefined()
      expect(results[0]?.passed).toBe(true)
    })
  })
})
