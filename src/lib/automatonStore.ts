import { ref, computed } from 'vue'
import type { AutomatonProject } from './automaton'
import type { AutomatonType } from './automatonTypes'
import { AUTOMATON_TYPES } from './automatonTypes'
import { AutomatonValidator } from './automatonValidator'

// Current active project
export const currentProject = ref<AutomatonProject>({
  id: crypto.randomUUID(),
  name: 'Unbenannter Automat',
  type: 'DFA',
  states: [
    { id: 'q0', label: 'q0', isStart: true, isFinal: false, position: { x: 250, y: 100 } }
  ],
  transitions: [],
  createdAt: new Date(),
  updatedAt: new Date()
})

// Real-time validation
export const validationResult = computed(() => {
  const validator = new AutomatonValidator(currentProject.value.type)
  return validator.validate(currentProject.value.states, currentProject.value.transitions)
})

// --- TEST CASES ---
export interface TestCase {
  id: string
  input: string
  expectedAccepted: boolean
}

export const testCases = ref<TestCase[]>([
])

export function addTestCase(input: string, expectedAccepted: boolean) {
  testCases.value.push({
    id: crypto.randomUUID(),
    input,
    expectedAccepted
  })
}

export function removeTestCase(id: string) {
  testCases.value = testCases.value.filter(tc => tc.id !== id)
}

export function updateTestCase(id: string, input: string, expectedAccepted: boolean) {
  const tc = testCases.value.find(t => t.id === id)
  if (tc) {
    tc.input = input
    tc.expectedAccepted = expectedAccepted
  }
}

// Liste aller Projekte (später für Multi-Projekt-Support)
export const projects = ref<AutomatonProject[]>([currentProject.value])

// Helper Functions
export function createNewProject(type: AutomatonType, name?: string): AutomatonProject {
  const config = AUTOMATON_TYPES[type]
  
  return {
    id: crypto.randomUUID(),
    name: name || `Neuer ${config.shortName}`,
    type,
    states: [
      { id: 'q0', label: 'q0', isStart: true, isFinal: false, position: { x: 250, y: 100 } }
    ],
    transitions: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

export function setCurrentProject(project: AutomatonProject) {
  currentProject.value = project
}

export function updateProjectType(newType: AutomatonType) {
  currentProject.value.type = newType
  currentProject.value.updatedAt = new Date()
}
