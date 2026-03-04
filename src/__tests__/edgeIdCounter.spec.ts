/**
 * edgeIdCounter.spec.ts — Tests for the edge ID counter logic.
 *
 * Verifies that new transitions receive unique IDs that never collide with
 * existing transition IDs.  This prevents the bug where creating a new edge
 * would silently overwrite visuals of an already-existing edge in the
 * Cytoscape graph.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { currentProject } from '@/lib/automatonStore'
import type { Transition } from '@/lib/automaton'

// ---------------------------------------------------------------------------
// Helpers — replicate the counter logic from EditorCanvas.vue so we can
// unit-test it without mounting the full component.
// ---------------------------------------------------------------------------

/**
 * Mirrors `syncEdgeIdCounter()` from EditorCanvas.vue.
 * Scans existing transition IDs of the form "e<number>" and returns the
 * next safe counter value (max + 1, or 0 if none exist).
 */
function computeNextEdgeCounter(transitions: Transition[]): number {
  const existing = transitions
    .map((t) => {
      const m = t.id.match(/^e(\d+)$/)
      return m && m[1] != null ? parseInt(m[1], 10) : -1
    })
    .filter((n) => n >= 0)
  return existing.length > 0 ? Math.max(...existing) + 1 : 0
}

/** Creates a minimal transition object for testing. */
function makeTransition(id: string, from = 'q0', to = 'q1'): Transition {
  return { id, from, to, symbol: '' }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Edge ID Counter', () => {
  describe('computeNextEdgeCounter', () => {
    it('returns 0 when there are no transitions', () => {
      expect(computeNextEdgeCounter([])).toBe(0)
    })

    it('returns max+1 for sequential IDs (e0, e1, e2)', () => {
      const transitions = [
        makeTransition('e0'),
        makeTransition('e1'),
        makeTransition('e2'),
      ]
      expect(computeNextEdgeCounter(transitions)).toBe(3)
    })

    it('returns max+1 even with gaps (e0, e3, e7)', () => {
      const transitions = [
        makeTransition('e0'),
        makeTransition('e3'),
        makeTransition('e7'),
      ]
      expect(computeNextEdgeCounter(transitions)).toBe(8)
    })

    it('ignores non-numeric IDs like "custom_edge"', () => {
      const transitions = [
        makeTransition('e2'),
        makeTransition('custom_edge'),
        makeTransition('edge_5'),
      ]
      expect(computeNextEdgeCounter(transitions)).toBe(3)
    })

    it('handles a single transition (e0)', () => {
      expect(computeNextEdgeCounter([makeTransition('e0')])).toBe(1)
    })

    it('handles large ID numbers', () => {
      const transitions = [makeTransition('e999')]
      expect(computeNextEdgeCounter(transitions)).toBe(1000)
    })

    it('ignores IDs that start with "e" but have trailing chars (e5x)', () => {
      const transitions = [makeTransition('e5x'), makeTransition('e2')]
      // "e5x" does NOT match /^e(\d+)$/, so only e2 counts
      expect(computeNextEdgeCounter(transitions)).toBe(3)
    })
  })

  describe('Edge ID uniqueness on new transition creation', () => {
    beforeEach(() => {
      // Reset project transitions
      currentProject.value.transitions = []
      currentProject.value.states = [
        { id: 'q0', label: 'q0', isStart: true, isFinal: false, position: { x: 0, y: 0 } },
        { id: 'q1', label: 'q1', isStart: false, isFinal: true, position: { x: 100, y: 0 } },
        { id: 'q2', label: 'q2', isStart: false, isFinal: false, position: { x: 200, y: 0 } },
      ]
    })

    it('new edge ID does not collide with existing transitions', () => {
      // Simulate pre-existing transitions (e.g. loaded from storage)
      currentProject.value.transitions = [
        makeTransition('e0', 'q0', 'q1'),
        makeTransition('e1', 'q1', 'q0'),
        makeTransition('e2', 'q0', 'q0'),
      ]

      // Compute counter the same way EditorCanvas does on init
      let edgeIdCounter = computeNextEdgeCounter(currentProject.value.transitions)
      expect(edgeIdCounter).toBe(3)

      // Simulate creating a new edge
      const newEdgeId = `e${edgeIdCounter++}`
      expect(newEdgeId).toBe('e3')

      // Verify it doesn't match any existing ID
      const existingIds = currentProject.value.transitions.map((t) => t.id)
      expect(existingIds).not.toContain(newEdgeId)
    })

    it('creating multiple new edges produces unique IDs', () => {
      currentProject.value.transitions = [
        makeTransition('e0', 'q0', 'q1'),
        makeTransition('e1', 'q1', 'q2'),
      ]

      let edgeIdCounter = computeNextEdgeCounter(currentProject.value.transitions)

      const newIds: string[] = []
      for (let i = 0; i < 5; i++) {
        const id = `e${edgeIdCounter++}`
        newIds.push(id)
      }

      // All new IDs should be unique among themselves
      const uniqueNewIds = new Set(newIds)
      expect(uniqueNewIds.size).toBe(5)

      // None of them should collide with existing ones
      const existingIds = new Set(currentProject.value.transitions.map((t) => t.id))
      for (const id of newIds) {
        expect(existingIds.has(id)).toBe(false)
      }
    })

    it('counter handles project with deleted transitions (gaps)', () => {
      // Imagine user created e0..e4 but deleted e1 and e3
      currentProject.value.transitions = [
        makeTransition('e0', 'q0', 'q1'),
        makeTransition('e2', 'q0', 'q0'),
        makeTransition('e4', 'q1', 'q2'),
      ]

      const edgeIdCounter = computeNextEdgeCounter(currentProject.value.transitions)
      // Should be 5 (max=4, +1), NOT 3 (count of existing)
      expect(edgeIdCounter).toBe(5)

      const newEdgeId = `e${edgeIdCounter}`
      const existingIds = currentProject.value.transitions.map((t) => t.id)
      expect(existingIds).not.toContain(newEdgeId)
    })

    it('original bug scenario: counter starting at 0 overwrites edges', () => {
      // This is the EXACT bug scenario:
      // Project has e0, e1, e2 from a previous session.
      // Old code would start edgeIdCounter at 0 → new edge gets "e0" → collision!
      currentProject.value.transitions = [
        makeTransition('e0', 'q0', 'q1'),
        makeTransition('e1', 'q1', 'q2'),
        makeTransition('e2', 'q0', 'q2'),
      ]

      // BAD: old behaviour (counter = 0)
      const badCounter = 0
      const badNewId = `e${badCounter}`
      expect(badNewId).toBe('e0') // collides with existing e0!
      expect(currentProject.value.transitions.some((t) => t.id === badNewId)).toBe(true)

      // GOOD: new behaviour (counter = max+1)
      const goodCounter = computeNextEdgeCounter(currentProject.value.transitions)
      const goodNewId = `e${goodCounter}`
      expect(goodNewId).toBe('e3') // no collision
      expect(currentProject.value.transitions.some((t) => t.id === goodNewId)).toBe(false)
    })
  })
})
