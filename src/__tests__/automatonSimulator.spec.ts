import { describe, it, expect, beforeEach } from 'vitest'
import { AutomatonSimulator } from '../lib/automatonSimulator'
import type { State, Transition } from '../lib/automaton'

// Helper: Create a state with required fields
const makeState = (id: string, isStart: boolean, isFinal: boolean): State => ({
  id, label: id, isStart, isFinal, position: { x: 0, y: 0 }
})

describe('AutomatonSimulator', () => {
  describe('DFA Simulation', () => {
    let states: State[]
    let transitions: Transition[]

    beforeEach(() => {
      // Simple DFA: accepts strings ending with 'a'
      states = [
        makeState('q0', true, false),
        makeState('q1', false, true)
      ]

      transitions = [
        { id: '1', from: 'q0', to: 'q1', symbol: 'a' },
        { id: '2', from: 'q1', to: 'q0', symbol: 'b' }
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
      states = [
        makeState('q0', true, false),
        makeState('q1', false, true)
      ]

      transitions = [
        { id: '1', from: 'q0', to: 'q0', symbol: 'a' },
        { id: '2', from: 'q0', to: 'q1', symbol: 'a' }
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
        { id: '3', from: 'q0', to: 'q1', symbol: 'ε' }
      ]
      const simulator = new AutomatonSimulator(states, epsilonTransitions, 'NFA')
      const result = simulator.simulate('')
      expect(result.steps.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('returns error for missing start state', () => {
      const states: State[] = [
        makeState('q0', false, true)
      ]
      const simulator = new AutomatonSimulator(states, [], 'DFA')
      const result = simulator.simulate('a')
      expect(result.accepted).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns error for multiple start states in DFA', () => {
      const states: State[] = [
        makeState('q0', true, false),
        makeState('q1', true, false)
      ]
      const simulator = new AutomatonSimulator(states, [], 'DFA')
      const result = simulator.simulate('a')
      expect(result.accepted).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Test Runner', () => {
    it('runs multiple test cases', () => {
      const states: State[] = [
        makeState('q0', true, true)
      ]
      const simulator = new AutomatonSimulator(states, [], 'DFA')
      
      const testCases = [
        { input: 'a', expected: true },
        { input: 'b', expected: false }
      ]
      
      const results = simulator.runTests(testCases)
      expect(results.length).toBe(2)
      expect(results[0]).toHaveProperty('passed')
      expect(results[0]).toHaveProperty('expected')
    })
  })
})
