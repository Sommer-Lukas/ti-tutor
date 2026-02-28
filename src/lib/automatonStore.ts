/**
 * automatonStore.ts — Central reactive store for automaton projects.
 *
 * Manages the full lifecycle of user projects: creation, selection,
 * renaming, duplication, deletion, import/export.  All data is persisted
 * to `localStorage` and synchronised via Vue watchers.
 *
 * Also owns test-case CRUD operations and exposes a real-time validation
 * computed that re-runs whenever the current project’s states or
 * transitions change.
 *
 * When exercise mode is active the `currentProject` computed transparently
 * returns the exercise’s virtual project instead of a user project.
 */

import { ref, computed, watch, triggerRef } from 'vue'
import type { ComputedRef } from 'vue'
import type { AutomatonProject } from './automaton'
import type { AutomatonType, TMHeadEnd } from './automatonTypes'
import { AUTOMATON_TYPES } from './automatonTypes'
import { AutomatonValidator } from './automatonValidator'
import { exerciseModeActive, exerciseBrowsing, exerciseProject } from './exerciseStore'

// ---------------------------------------------------------------------------
// Reactive state
// ---------------------------------------------------------------------------

/** All user-created automaton projects. */
export const projects = ref<AutomatonProject[]>([])

/** ID of the currently selected project (null when none exists). */
export const currentProjectId = ref<string | null>(null)

/**
 * Internal counter incremented on every project switch to ensure
 * `currentProject` re-evaluates even when the ref identity is unchanged.
 */
const projectSwitchCounter = ref(0)

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

/** A single test case associated with a specific project. */
export interface TestCase {
  id: string
  projectId: string
  input: string
  expectedAccepted: boolean
  /** TM only — expected tape output after the machine halts. */
  expectedOutput?: string
  /** TM only — where the head should be after halting. */
  tmHeadEnd?: TMHeadEnd
}

export const testCases = ref<TestCase[]>([])

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** Creates a minimal default DFA project (unused, kept for reference). */
function _createDefaultProject(): AutomatonProject {
  return {
    id: crypto.randomUUID(),
    name: 'Mein erster DFA',
    type: 'DFA',
    states: [
      { id: 'q0', label: 'q0', isStart: true, isFinal: false, position: { x: 250, y: 100 } },
    ],
    transitions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/** Creates an empty sentinel project returned when no real project exists. */
function createEmptyDummyProject(): AutomatonProject {
  return {
    id: '',
    name: 'No Project',
    type: 'DFA' as AutomatonType,
    states: [],
    transitions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// ---------------------------------------------------------------------------
// Computed properties
// ---------------------------------------------------------------------------

/**
 * The currently active project — guaranteed non-null.
 *
 * Priority:
 *  1. Exercise virtual project (if exercise mode is active)
 *  2. The project matching `currentProjectId`
 *  3. The first project in the list
 *  4. An empty dummy project (fallback)
 */
export const currentProject: ComputedRef<AutomatonProject> = computed((): AutomatonProject => {
  // This dependency ensures re-computation when counter changes
  void projectSwitchCounter.value

  // Exercise mode override: return exercise project if active and working on an exercise
  if (exerciseModeActive.value && !exerciseBrowsing.value && exerciseProject.value) {
    return exerciseProject.value
  }

  // If no projects exist, return dummy project
  if (projects.value.length === 0) {
    return createEmptyDummyProject()
  }

  // Try to find current project
  if (currentProjectId.value) {
    const project = projects.value.find((p) => p.id === currentProjectId.value)
    if (project) {
      return project
    }
  }

  // Fallback to first project (guaranteed to exist because length > 0)
  return projects.value[0]!
})

/** Test cases belonging to the currently selected project. */
export const currentTestCases = computed(() => {
  if (!currentProjectId.value || projects.value.length === 0) return []
  return testCases.value.filter((tc) => tc.projectId === currentProject.value.id)
})

/** Live validation result — re-computed whenever states/transitions change. */
export const validationResult = computed(() => {
  if (projects.value.length === 0) {
    return { errors: [], warnings: [] }
  }

  const validator = new AutomatonValidator(currentProject.value.type)
  return validator.validate(currentProject.value.states, currentProject.value.transitions)
})

// ---------------------------------------------------------------------------
// Persistence (localStorage)
// ---------------------------------------------------------------------------

const STORAGE_KEY_PROJECTS = 'automaton-projects'
const STORAGE_KEY_TESTS = 'automaton-test-cases'
const STORAGE_KEY_CURRENT = 'automaton-current-project-id'

/** Loads projects, test cases, and the active project ID from localStorage. */
function loadFromStorage() {
  try {
    // Load projects
    const storedProjects = localStorage.getItem(STORAGE_KEY_PROJECTS)
    if (storedProjects) {
      const parsed = JSON.parse(storedProjects)
      projects.value = parsed.map((p: AutomatonProject) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      }))
    }

    // Load test cases
    const storedTests = localStorage.getItem(STORAGE_KEY_TESTS)
    if (storedTests) {
      testCases.value = JSON.parse(storedTests)

      // Normalize TM-specific fields for existing test cases
      testCases.value.forEach((tc) => {
        const project = projects.value.find((p) => p.id === tc.projectId)
        if (project?.type === 'TM') {
          if (tc.expectedOutput === undefined) {
            tc.expectedOutput = ''
          }
          if ((tc as { tmHeadStart?: TMHeadEnd }).tmHeadStart && !tc.tmHeadEnd) {
            tc.tmHeadEnd = (tc as { tmHeadStart?: TMHeadEnd }).tmHeadStart
          }
          if (!tc.tmHeadEnd) {
            tc.tmHeadEnd = 'start'
          }
        }
      })
    }

    // Load current project ID
    const storedCurrentId = localStorage.getItem(STORAGE_KEY_CURRENT)
    if (storedCurrentId && projects.value.find((p) => p.id === storedCurrentId)) {
      currentProjectId.value = storedCurrentId
    }

    // Only set currentProjectId if projects exist
    if (projects.value.length > 0 && !currentProjectId.value) {
      const firstProject = projects.value[0]
      if (firstProject) {
        currentProjectId.value = firstProject.id
      }
    }

    console.log('Loaded from storage:', projects.value.length, 'projects')
  } catch (error) {
    console.error('Failed to load from localStorage:', error)
    projects.value = []
    testCases.value = []
    currentProjectId.value = null
  }
}

/** Writes the current state to localStorage. */
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects.value))
    localStorage.setItem(STORAGE_KEY_TESTS, JSON.stringify(testCases.value))
    if (currentProjectId.value) {
      localStorage.setItem(STORAGE_KEY_CURRENT, currentProjectId.value)
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT)
    }
  } catch (error) {
    console.error('Failed to save to localStorage:', error)
  }
}

// Auto-persist on any reactive change.
watch([projects, testCases, currentProjectId], saveToStorage, { deep: true })

// ---------------------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------------------

/** Creates a new project of the given type, adds it to the list, and selects it. */
export function createProject(name: string, type: AutomatonType): AutomatonProject {
  const config = AUTOMATON_TYPES[type]

  const newProject: AutomatonProject = {
    id: crypto.randomUUID(),
    name: name || `Neuer ${config.shortName}`,
    type,
    states: [
      { id: 'q0', label: 'q0', isStart: true, isFinal: false, position: { x: 250, y: 100 } },
    ],
    transitions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    // ADD: PDA config if type is PDA
    ...(type === 'PDA' && {
      pdaConfig: {
        startStackSymbol: '$',
      },
    }),
  }

  projects.value.push(newProject)

  // Set as current project
  currentProjectId.value = newProject.id

  // Force reactivity update
  projectSwitchCounter.value++
  triggerRef(projects)

  console.log('Project created:', newProject.name)

  return newProject
}

/** Switches the active project selection. */
export function setCurrentProject(projectId: string) {
  const project = projects.value.find((p) => p.id === projectId)
  if (project) {
    currentProjectId.value = projectId

    // Force reactivity update
    projectSwitchCounter.value++

    console.log('Project switched to:', project.name)
  }
}

/** Deletes a project and its associated test cases. */
export function deleteProject(projectId: string) {
  const index = projects.value.findIndex((p) => p.id === projectId)
  if (index === -1) {
    console.error('Project not found:', projectId)
    return
  }

  console.log('Deleting project:', projectId)

  // Remove project
  projects.value.splice(index, 1)

  // Remove associated test cases
  testCases.value = testCases.value.filter((tc) => tc.projectId !== projectId)

  // If deleted project was current, switch to another or set to null
  if (currentProjectId.value === projectId) {
    if (projects.value.length > 0) {
      const firstProject = projects.value[0]
      if (firstProject) {
        currentProjectId.value = firstProject.id
        projectSwitchCounter.value++
        console.log('Switched to project:', firstProject.name)
      }
    } else {
      currentProjectId.value = null
      projectSwitchCounter.value++
      console.log('No projects left - showing empty state')
    }
  }
}

/** Renames an existing project. */
export function renameProject(projectId: string, newName: string) {
  const project = projects.value.find((p) => p.id === projectId)
  if (project) {
    project.name = newName
    project.updatedAt = new Date()
    console.log('Project renamed to:', newName)
  }
}

/** Changes the automaton type of a project (e.g. DFA → NFA). */
export function updateProjectType(projectId: string, newType: AutomatonType) {
  const project = projects.value.find((p) => p.id === projectId)
  if (project) {
    project.type = newType
    project.updatedAt = new Date()

    // Initialize PDA config when converting to PDA
    if (newType === 'PDA' && !project.pdaConfig) {
      project.pdaConfig = {
        startStackSymbol: '$',
      }
    }

    console.log('Updated project type to:', newType)
  }
}

/** Deep-clones a project and its test cases. */
export function duplicateProject(projectId: string): AutomatonProject | null {
  const project = projects.value.find((p) => p.id === projectId)
  if (!project) return null

  const duplicatedProject: AutomatonProject = {
    ...JSON.parse(JSON.stringify(project)), // Deep clone
    id: crypto.randomUUID(),
    name: `${project.name} (Kopie)`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  projects.value.push(duplicatedProject)

  // Duplicate test cases too
  const projectTests = testCases.value.filter((tc) => tc.projectId === projectId)
  projectTests.forEach((tc) => {
    testCases.value.push({
      ...tc,
      id: crypto.randomUUID(),
      projectId: duplicatedProject.id,
    })
  })

  // Force reactivity update
  projectSwitchCounter.value++
  triggerRef(projects)

  console.log('📋 Duplicated project:', duplicatedProject.name)

  return duplicatedProject
}

// ---------------------------------------------------------------------------
// Legacy helpers (kept for backward compatibility)
// ---------------------------------------------------------------------------

export function createNewProject(type: AutomatonType, name?: string): AutomatonProject {
  return createProject(name || `Neuer ${AUTOMATON_TYPES[type].shortName}`, type)
}

// ---------------------------------------------------------------------------
// PDA configuration
// ---------------------------------------------------------------------------

/** Updates the initial stack symbol for a PDA project. */
export function updatePDAStartStackSymbol(projectId: string, symbol: string) {
  const project = projects.value.find((p) => p.id === projectId)
  if (project && project.type === 'PDA') {
    if (!project.pdaConfig) {
      project.pdaConfig = { startStackSymbol: symbol }
    } else {
      project.pdaConfig.startStackSymbol = symbol
    }
    project.updatedAt = new Date()
    console.log('Updated PDA start stack symbol to:', symbol)
  }
}

/** Reads the PDA start stack symbol for a project (defaults to '$'). */
export function getPDAStartStackSymbol(projectId?: string): string {
  const project = projectId ? projects.value.find((p) => p.id === projectId) : currentProject.value

  if (project && project.type === 'PDA') {
    return project.pdaConfig?.startStackSymbol || '$'
  }

  return '$' // Default fallback
}

// ---------------------------------------------------------------------------
// Test case CRUD
// ---------------------------------------------------------------------------

/** Adds a new test case to the current project. */
export function addTestCase(input: string, expectedAccepted: boolean) {
  if (!currentProjectId.value || projects.value.length === 0) {
    console.error('Cannot add test case: No project selected')
    return
  }

  const isTM = currentProject.value.type === 'TM'

  testCases.value.push({
    id: crypto.randomUUID(),
    projectId: currentProject.value.id,
    input,
    expectedAccepted,
    ...(isTM && {
      expectedOutput: '',
      tmHeadEnd: 'start' as TMHeadEnd,
    }),
  })
}

/** Removes a test case by ID. */
export function removeTestCase(id: string) {
  testCases.value = testCases.value.filter((tc) => tc.id !== id)
}

/** Updates the fields of an existing test case. */
export function updateTestCase(
  id: string,
  input: string,
  expectedAccepted: boolean,
  expectedOutput?: string,
  tmHeadEnd?: TMHeadEnd,
) {
  const tc = testCases.value.find((t) => t.id === id)
  if (tc) {
    tc.input = input
    tc.expectedAccepted = expectedAccepted
    if (expectedOutput !== undefined) {
      tc.expectedOutput = expectedOutput
    }
    if (tmHeadEnd !== undefined) {
      tc.tmHeadEnd = tmHeadEnd
    }
  }
}

/** Deletes all test cases for a project (or the current project). */
export function clearTestCases(projectId?: string) {
  if (projectId) {
    testCases.value = testCases.value.filter((tc) => tc.projectId !== projectId)
  } else if (currentProjectId.value) {
    testCases.value = testCases.value.filter((tc) => tc.projectId !== currentProject.value.id)
  }
}

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

/** Serialises a project and its test cases to a JSON string. */
export function exportProject(projectId: string): string {
  const project = projects.value.find((p) => p.id === projectId)
  if (!project) throw new Error('Project not found')

  const projectTests = testCases.value.filter((tc) => tc.projectId === projectId)

  return JSON.stringify(
    {
      project,
      testCases: projectTests,
      exportedAt: new Date(),
      version: '1.0',
    },
    null,
    2,
  )
}

/** Imports a project from a JSON string, assigning fresh IDs. */
export function importProject(jsonString: string): AutomatonProject {
  const data = JSON.parse(jsonString)

  const importedProject: AutomatonProject = {
    ...data.project,
    id: crypto.randomUUID(), // New ID to avoid conflicts
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  projects.value.push(importedProject)

  // Import test cases
  if (data.testCases) {
    data.testCases.forEach((tc: TestCase) => {
      testCases.value.push({
        ...tc,
        id: crypto.randomUUID(),
        projectId: importedProject.id,
      })
    })
  }

  // Force reactivity update
  projectSwitchCounter.value++
  triggerRef(projects)

  console.log('📥 Imported project:', importedProject.name)

  return importedProject
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

loadFromStorage()
