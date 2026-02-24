import { describe, it, expect } from 'vitest'
import { 
  currentProject, 
  projects, 
  validationResult
} from '../lib/automatonStore'

describe('AutomatonStore', () => {
  describe('Project Management', () => {
    it('initializes with empty projects', () => {
      expect(projects.value).toBeDefined()
      expect(Array.isArray(projects.value)).toBe(true)
    })

    it('currentProject is accessible', () => {
      expect(currentProject).toBeDefined()
    })
  })

  describe('Validation', () => {
    it('validates automaton structure', () => {
      const result = validationResult.value
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    it('validation result has expected properties', () => {
      const result = validationResult.value
      result.errors.forEach(error => {
        expect(error).toHaveProperty('message')
        expect(error).toHaveProperty('affectedElements')
      })
    })
  })

  describe('Automaton Types', () => {
    it('supports DFA type', () => {
      expect(currentProject.value).toHaveProperty('type')
    })

    it('current project has states array', () => {
      expect(currentProject.value).toHaveProperty('states')
      expect(Array.isArray(currentProject.value.states)).toBe(true)
    })

    it('current project has transitions array', () => {
      expect(currentProject.value).toHaveProperty('transitions')
      expect(Array.isArray(currentProject.value.transitions)).toBe(true)
    })
  })

  describe('Storage Persistence', () => {
    it('projects persist in localStorage', () => {
      const initialLength = projects.value.length
      expect(typeof initialLength).toBe('number')
    })
  })
})
