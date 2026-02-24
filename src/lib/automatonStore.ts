import { ref, computed, watch, triggerRef } from 'vue'
import type { ComputedRef } from 'vue'
import type { AutomatonProject } from './automaton'
import type { AutomatonType } from './automatonTypes'
import { AUTOMATON_TYPES } from './automatonTypes'
import { AutomatonValidator } from './automatonValidator'

// --- MULTI-PROJECT MANAGEMENT ---
export const projects = ref<AutomatonProject[]>([])
export const currentProjectId = ref<string | null>(null)

// Force update counter for reactivity
const projectSwitchCounter = ref(0)

// --- TEST CASES ---
export interface TestCase {
  id: string
  projectId: string
  input: string
  expectedAccepted: boolean
}

export const testCases = ref<TestCase[]>([])

// --- HELPER: Create Default Project ---
function _createDefaultProject(): AutomatonProject {
  return {
    id: crypto.randomUUID(),
    name: 'Mein erster DFA',
    type: 'DFA',
    states: [
      { id: 'q0', label: 'q0', isStart: true, isFinal: false, position: { x: 250, y: 100 } }
    ],
    transitions: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

// --- HELPER: Create Empty Dummy Project ---
function createEmptyDummyProject(): AutomatonProject {
  return {
    id: '',
    name: 'No Project',
    type: 'DFA' as AutomatonType,
    states: [],
    transitions: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

// --- COMPUTED: Current Project (GUARANTEED NON-NULL!) ---
export const currentProject: ComputedRef<AutomatonProject> = computed((): AutomatonProject => {
  // This dependency ensures re-computation when counter changes
  void projectSwitchCounter.value
  
  // If no projects exist, return dummy project
  if (projects.value.length === 0) {
    return createEmptyDummyProject()
  }
  
  // Try to find current project
  if (currentProjectId.value) {
    const project = projects.value.find(p => p.id === currentProjectId.value)
    if (project) {
      return project
    }
  }
  
  // Fallback to first project (guaranteed to exist because length > 0)
  return projects.value[0]!
})

// --- COMPUTED: Current Project Test Cases ---
export const currentTestCases = computed(() => {
  if (!currentProjectId.value || projects.value.length === 0) return []
  return testCases.value.filter(tc => tc.projectId === currentProject.value.id)
})

// --- COMPUTED: Real-time Validation ---
export const validationResult = computed(() => {
  if (projects.value.length === 0) {
    return { errors: [], warnings: [] }
  }
  
  const validator = new AutomatonValidator(currentProject.value.type)
  return validator.validate(currentProject.value.states, currentProject.value.transitions)
})

// --- INITIALIZATION ---
const STORAGE_KEY_PROJECTS = 'automaton-projects'
const STORAGE_KEY_TESTS = 'automaton-test-cases'
const STORAGE_KEY_CURRENT = 'automaton-current-project-id'

function loadFromStorage() {
  try {
    // Load projects
    const storedProjects = localStorage.getItem(STORAGE_KEY_PROJECTS)
    if (storedProjects) {
      const parsed = JSON.parse(storedProjects)
      projects.value = parsed.map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt)
      }))
    }

    // Load test cases
    const storedTests = localStorage.getItem(STORAGE_KEY_TESTS)
    if (storedTests) {
      testCases.value = JSON.parse(storedTests)
    }

    // Load current project ID
    const storedCurrentId = localStorage.getItem(STORAGE_KEY_CURRENT)
    if (storedCurrentId && projects.value.find(p => p.id === storedCurrentId)) {
      currentProjectId.value = storedCurrentId
    }

    // ✅ Only set currentProjectId if projects exist
    if (projects.value.length > 0 && !currentProjectId.value && projects.value[0]) {
      currentProjectId.value = projects.value[0]!.id
    }

    console.log('✅ Loaded from storage:', projects.value.length, 'projects')
  } catch (error) {
    console.error('Failed to load from localStorage:', error)
    projects.value = []
    testCases.value = []
    currentProjectId.value = null
  }
}

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

// Watch for changes and auto-save
watch([projects, testCases, currentProjectId], saveToStorage, { deep: true })

// --- PROJECT MANAGEMENT ---

export function createProject(name: string, type: AutomatonType): AutomatonProject {
  const config = AUTOMATON_TYPES[type]
  
  const newProject: AutomatonProject = {
    id: crypto.randomUUID(),
    name: name || `Neuer ${config.shortName}`,
    type,
    states: [
      { id: 'q0', label: 'q0', isStart: true, isFinal: false, position: { x: 250, y: 100 } }
    ],
    transitions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    // ✅ ADD: PDA config if type is PDA
    ...(type === 'PDA' && {
      pdaConfig: {
        startStackSymbol: '$'
      }
    })
  }
  
  projects.value.push(newProject)
  
  // Set as current project
  currentProjectId.value = newProject.id
  
  // Force reactivity update
  projectSwitchCounter.value++
  triggerRef(projects)
  
  console.log('✅ Created project:', newProject.name)
  
  return newProject
}

export function setCurrentProject(projectId: string) {
  const project = projects.value.find(p => p.id === projectId)
  if (project) {
    currentProjectId.value = projectId
    
    // Force reactivity update
    projectSwitchCounter.value++
    
    console.log('✅ Project switched to:', project.name)
  }
}

export function deleteProject(projectId: string) {
  const index = projects.value.findIndex(p => p.id === projectId)
  if (index === -1) {
    console.error('❌ Project not found:', projectId)
    return
  }

  console.log('🗑️ Deleting project:', projectId)

  // Remove project
  projects.value.splice(index, 1)
  
  // Remove associated test cases
  testCases.value = testCases.value.filter(tc => tc.projectId !== projectId)
  
  // If deleted project was current, switch to another or set to null
  if (currentProjectId.value === projectId) {
    if (projects.value.length > 0) {
      const firstProject = projects.value[0]
      if (firstProject) {
        currentProjectId.value = firstProject.id
        projectSwitchCounter.value++
        console.log('📌 Switched to project:', firstProject.name)
      }
    } else {
      currentProjectId.value = null
      projectSwitchCounter.value++
      console.log('📭 No projects left - showing empty state')
    }
  }
}

export function renameProject(projectId: string, newName: string) {
  const project = projects.value.find(p => p.id === projectId)
  if (project) {
    project.name = newName
    project.updatedAt = new Date()
    console.log('✏️ Renamed project to:', newName)
  }
}

export function updateProjectType(projectId: string, newType: AutomatonType) {
  const project = projects.value.find(p => p.id === projectId)
  if (project) {
    project.type = newType
    project.updatedAt = new Date()
    
    // ✅ ADD: Initialize PDA config when converting to PDA
    if (newType === 'PDA' && !project.pdaConfig) {
      project.pdaConfig = {
        startStackSymbol: '$'
      }
    }
    
    console.log('🔄 Updated project type to:', newType)
  }
}

export function duplicateProject(projectId: string): AutomatonProject | null {
  const project = projects.value.find(p => p.id === projectId)
  if (!project) return null

  const duplicatedProject: AutomatonProject = {
    ...JSON.parse(JSON.stringify(project)), // Deep clone
    id: crypto.randomUUID(),
    name: `${project.name} (Kopie)`,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  projects.value.push(duplicatedProject)
  
  // Duplicate test cases too
  const projectTests = testCases.value.filter(tc => tc.projectId === projectId)
  projectTests.forEach(tc => {
    testCases.value.push({
      ...tc,
      id: crypto.randomUUID(),
      projectId: duplicatedProject.id
    })
  })

  // Force reactivity update
  projectSwitchCounter.value++
  triggerRef(projects)

  console.log('📋 Duplicated project:', duplicatedProject.name)

  return duplicatedProject
}

// --- LEGACY SUPPORT (for compatibility) ---
export function createNewProject(type: AutomatonType, name?: string): AutomatonProject {
  return createProject(name || `Neuer ${AUTOMATON_TYPES[type].shortName}`, type)
}

// ✅ NEW: PDA Configuration Management
export function updatePDAStartStackSymbol(projectId: string, symbol: string) {
  const project = projects.value.find(p => p.id === projectId)
  if (project && project.type === 'PDA') {
    if (!project.pdaConfig) {
      project.pdaConfig = { startStackSymbol: symbol }
    } else {
      project.pdaConfig.startStackSymbol = symbol
    }
    project.updatedAt = new Date()
    console.log('📚 Updated PDA start stack symbol to:', symbol)
  }
}

export function getPDAStartStackSymbol(projectId?: string): string {
  const project = projectId 
    ? projects.value.find(p => p.id === projectId)
    : currentProject.value
    
  if (project && project.type === 'PDA') {
    return project.pdaConfig?.startStackSymbol || '$'
  }
  
  return '$' // Default fallback
}

// --- TEST CASE MANAGEMENT ---

export function addTestCase(input: string, expectedAccepted: boolean) {
  if (!currentProjectId.value || projects.value.length === 0) {
    console.error('❌ Cannot add test case: No project selected')
    return
  }
  
  testCases.value.push({
    id: crypto.randomUUID(),
    projectId: currentProject.value.id,
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

export function clearTestCases(projectId?: string) {
  if (projectId) {
    testCases.value = testCases.value.filter(tc => tc.projectId !== projectId)
  } else if (currentProjectId.value) {
    testCases.value = testCases.value.filter(tc => tc.projectId !== currentProject.value.id)
  }
}

// --- EXPORT/IMPORT (for later) ---

export function exportProject(projectId: string): string {
  const project = projects.value.find(p => p.id === projectId)
  if (!project) throw new Error('Project not found')

  const projectTests = testCases.value.filter(tc => tc.projectId === projectId)

  return JSON.stringify({
    project,
    testCases: projectTests,
    exportedAt: new Date(),
    version: '1.0'
  }, null, 2)
}

export function importProject(jsonString: string): AutomatonProject {
  const data = JSON.parse(jsonString)
  
  const importedProject: AutomatonProject = {
    ...data.project,
    id: crypto.randomUUID(), // New ID to avoid conflicts
    createdAt: new Date(),
    updatedAt: new Date()
  }

  projects.value.push(importedProject)

  // Import test cases
  if (data.testCases) {
    data.testCases.forEach((tc: TestCase) => {
      testCases.value.push({
        ...tc,
        id: crypto.randomUUID(),
        projectId: importedProject.id
      })
    })
  }

  // Force reactivity update
  projectSwitchCounter.value++
  triggerRef(projects)

  console.log('📥 Imported project:', importedProject.name)

  return importedProject
}

// --- INITIALIZE ON LOAD ---
loadFromStorage()
