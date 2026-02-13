<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Play, StepForward, Square, Clock, Check, X, AlertTriangle, ShieldAlert, FolderOpen, Plus } from 'lucide-vue-next'
import Sidebar from '@/components/Sidebar.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import TestPanel from '@/components/TestPanel.vue'
import SimulationTreePanel from '@/components/SimulationTreePanel.vue'
import { currentProject, validationResult, currentTestCases, projects } from '@/lib/automatonStore'
import { AUTOMATON_TYPES } from '@/lib/automatonTypes'
import { AutomatonSimulator } from '@/lib/automatonSimulator'
import type { SimulationResult } from '@/lib/automatonSimulator'

// --- UI STATE ---
const isSidebarOpen = ref(true)
const rightPanelOpen = ref(true)
const showValidationModal = ref(false)
const showErrorToast = ref(false)

// --- SIMULATION STATE ---
const isSimulating = ref(false)
const currentSimulation = ref<SimulationResult | null>(null)
const currentStepIndex = ref(0)
const allTestResults = ref<Array<SimulationResult & { expected: boolean; passed: boolean }>>([])
const selectedTestCase = ref<string | null>(null)

// --- COMPUTED: Has Projects ---
const hasProjects = computed(() => projects.value.length > 0)

// --- WATCH: Reset simulation on project switch ---
watch(() => currentProject.value?.id, (newId, oldId) => {
  if (newId !== oldId) {
    console.log('🔄 Project switched in App.vue, resetting simulation state')
    
    // Reset all simulation state
    stopSimulation()
    allTestResults.value = []
    selectedTestCase.value = null
  }
})

// --- COMPUTED: Validation Badge Status ---
const validationStatus = computed(() => {
  if (!hasProjects.value) return 'valid'
  if (validationResult.value.errors.length > 0) return 'error'
  if (validationResult.value.warnings.length > 0) return 'warning'
  return 'valid'
})

// --- COMPUTED: Has Validation Errors ---
const hasValidationErrors = computed(() => {
  return validationResult.value.errors.length > 0
})

// --- COMPUTED: Can Run Tests ---
const canRunTests = computed(() => {
  return hasProjects.value && !hasValidationErrors.value && !isSimulating.value && currentTestCases.value.length > 0
})

// --- COMPUTED: Can Start Simulation ---
const canStartSimulation = computed(() => {
  return hasProjects.value && !hasValidationErrors.value && selectedTestCase.value !== null && !isSimulating.value
})

// --- COMPUTED: Current Step ---
const currentStep = computed(() => {
  if (!currentSimulation.value) return null
  return currentSimulation.value.steps[currentStepIndex.value]
})

// --- COMPUTED: Is At End ---
const isAtEnd = computed(() => {
  if (!currentSimulation.value) return false
  return currentStepIndex.value === currentSimulation.value.steps.length - 1
})

// --- COMPUTED: Test Results Summary ---
const testSummary = computed(() => {
  if (allTestResults.value.length === 0) return null
  
  const passed = allTestResults.value.filter(r => r.passed).length
  const failed = allTestResults.value.filter(r => !r.passed).length
  const total = allTestResults.value.length
  
  return { passed, failed, total }
})

// --- ERROR TOAST ---
const showErrorToastWithTimeout = () => {
  showErrorToast.value = true
  setTimeout(() => {
    showErrorToast.value = false
  }, 3000)
}

// --- SIMULATION ACTIONS ---
const startSimulation = () => {
  if (!hasProjects.value) return
  
  // Validation Check
  if (hasValidationErrors.value) {
    showErrorToastWithTimeout()
    return
  }

  if (!selectedTestCase.value) return
  
  const testCase = currentTestCases.value.find(tc => tc.id === selectedTestCase.value)
  if (!testCase) return

  const simulator = new AutomatonSimulator(
    currentProject.value.states,
    currentProject.value.transitions,
    currentProject.value.type
  )

  currentSimulation.value = simulator.simulate(testCase.input)
  currentStepIndex.value = 0
  isSimulating.value = true
  
  // ✅ HIDE TEST PANEL!
  rightPanelOpen.value = false
  
  console.log('🎬 Simulation started:', currentSimulation.value)
}

const stepSimulation = () => {
  if (!isSimulating.value || !currentSimulation.value) return
  
  // If at end, close simulation
  if (currentStepIndex.value === currentSimulation.value.steps.length - 1) {
    console.log('✅ Simulation complete:', currentSimulation.value.accepted ? 'ACCEPTED' : 'REJECTED')
    stopSimulation()
    return
  }
  
  // Otherwise, step forward
  currentStepIndex.value++
}

const stopSimulation = () => {
  isSimulating.value = false
  currentSimulation.value = null
  currentStepIndex.value = 0
  
  // ✅ SHOW TEST PANEL AGAIN!
  rightPanelOpen.value = true
  
  console.log('⏹️ Simulation stopped')
}

const runAllTests = () => {
  if (!hasProjects.value) return
  
  // Validation Check
  if (hasValidationErrors.value) {
    showErrorToastWithTimeout()
    return
  }

  if (currentTestCases.value.length === 0) {
    console.warn('⚠️ No test cases for current project')
    return
  }

  const simulator = new AutomatonSimulator(
    currentProject.value.states,
    currentProject.value.transitions,
    currentProject.value.type
  )

  const testsWithExpectations = currentTestCases.value.map(tc => ({
    input: tc.input,
    expected: tc.expectedAccepted
  }))

  allTestResults.value = simulator.runTests(testsWithExpectations)
  
  console.log('🧪 All Test Results:', allTestResults.value)
  console.log(`✅ Passed: ${testSummary.value?.passed}/${testSummary.value?.total}`)
  console.log(`❌ Failed: ${testSummary.value?.failed}/${testSummary.value?.total}`)
}

const toggleValidationModal = () => {
  if (!hasProjects.value) return
  showValidationModal.value = !showValidationModal.value
}

const closeValidationModal = () => {
  showValidationModal.value = false
}

// --- KEYBOARD SHORTCUTS ---
const handleKeyDown = (e: KeyboardEvent) => {
  if (!hasProjects.value) return
  
  // F5 - Start Simulation
  if (e.key === 'F5') {
    e.preventDefault()
    if (canStartSimulation.value) {
      startSimulation()
    }
    return
  }

  // F10 - Step Simulation
  if (e.key === 'F10') {
    e.preventDefault()
    if (isSimulating.value) {
      stepSimulation()
    }
    return
  }

  // Shift+F5 - Stop Simulation
  if (e.shiftKey && e.key === 'F5') {
    e.preventDefault()
    if (isSimulating.value) {
      stopSimulation()
    }
    return
  }
}

// Register keyboard shortcuts
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeyDown)
}

// Trigger sidebar to open new dialog
const triggerNewProject = () => {
  isSidebarOpen.value = true
  setTimeout(() => {
    const event = new CustomEvent('open-new-automaton-dialog')
    window.dispatchEvent(event)
  }, 100)
}
</script>

<template>
  <div class="flex h-screen w-full bg-zinc-50 text-zinc-900 overflow-hidden relative">
    
    <!-- LEFT SIDEBAR (Component) -->
    <Sidebar v-model:is-open="isSidebarOpen" />

    <!-- MAIN CONTENT -->
    <main class="flex-1 flex flex-col h-full min-w-0 bg-white">
      
      <!-- TOP BAR -->
      <header class="flex h-14 items-center justify-between px-6 border-b z-50 bg-white flex-shrink-0 relative">
        
        <!-- Project Name + Type Badge + Validation Status -->
        <div v-if="hasProjects" class="flex items-center gap-3">
          <h1 class="text-lg font-semibold text-zinc-900">{{ currentProject.name }}</h1>
          
          <!-- Automaton Type Badge -->
          <span 
            class="px-2.5 py-1 rounded-full text-xs font-bold"
            :class="currentProject.type === 'DFA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'"
          >
            {{ AUTOMATON_TYPES[currentProject.type].shortName }}
          </span>
          
          <!-- Validation Status Badge -->
          <button
            @click="toggleValidationModal"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:shadow-md"
            :class="{
              'bg-green-50 text-green-700 hover:bg-green-100': validationStatus === 'valid',
              'bg-red-50 text-red-700 hover:bg-red-100 animate-pulse': validationStatus === 'error',
              'bg-yellow-50 text-yellow-700 hover:bg-yellow-100': validationStatus === 'warning'
            }"
          >
            <Check v-if="validationStatus === 'valid'" class="w-4 h-4" />
            <X v-else-if="validationStatus === 'error'" class="w-4 h-4" />
            <AlertTriangle v-else class="w-4 h-4" />
            
            <span v-if="validationStatus === 'valid'">Valid</span>
            <span v-else-if="validationStatus === 'error'">
              {{ validationResult.errors.length }} Error{{ validationResult.errors.length > 1 ? 's' : '' }}
            </span>
            <span v-else>
              {{ validationResult.warnings.length }} Warning{{ validationResult.warnings.length > 1 ? 's' : '' }}
            </span>
          </button>
        </div>

        <!-- Empty State Header -->
        <div v-else class="flex items-center gap-2">
          <FolderOpen class="w-5 h-5 text-zinc-400" />
          <h1 class="text-lg font-semibold text-zinc-500">Kein Projekt geöffnet</h1>
        </div>

        <!-- User Avatar -->
        <div class="h-8 w-8 rounded-full bg-zinc-200"></div>
      </header>

      <!-- WORKSPACE -->
      <div class="flex-1 flex flex-col min-h-0">
        
        <!-- EMPTY STATE (When no projects) -->
        <div v-if="!hasProjects" class="flex-1 flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100">
          <div class="text-center max-w-md px-8">
            <div class="w-32 h-32 rounded-full bg-zinc-200 flex items-center justify-center mx-auto mb-6">
              <FolderOpen class="w-16 h-16 text-zinc-400" />
            </div>

            <h2 class="text-2xl font-bold text-zinc-900 mb-3">
              Willkommen! 👋
            </h2>

            <p class="text-zinc-600 mb-6 leading-relaxed">
              Du hast noch keine Automaten erstellt. Erstelle deinen ersten Automaten, um mit der Arbeit zu beginnen.
            </p>

            <button
              @click="triggerNewProject"
              class="inline-flex items-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
            >
              <Plus class="w-5 h-5" />
              <span>Neuen Automaten erstellen</span>
            </button>

            <p class="text-xs text-zinc-500 mt-6">
              Oder öffne die Sidebar links und klicke auf "Neuer Automat"
            </p>
          </div>
        </div>

        <!-- NORMAL WORKSPACE (When projects exist) -->
        <template v-else>
          <!-- CANVAS + RIGHT PANEL ROW -->
          <div class="flex-1 flex min-h-0 overflow-hidden relative">
            
            <!-- CANVAS with Simulation State -->
            <EditorCanvas 
              class="flex-1 min-w-0"
              :current-simulation-state="currentStep?.currentState"
              :is-simulating="isSimulating"
            />

            <!-- TEST PANEL (Hidden during simulation) -->
            <TestPanel 
              v-show="!isSimulating"
              v-model:selected="selectedTestCase"
              v-model:visible="rightPanelOpen"
              :simulation-results="allTestResults"
            />

            <!-- SIMULATION TREE PANEL (Shown during simulation) -->
            <SimulationTreePanel
              v-if="isSimulating && currentSimulation"
              :simulation="currentSimulation"
              :current-step-index="currentStepIndex"
              :automaton-type="currentProject.type"
            />

          </div>

          <!-- BOTTOM BAR -->
          <div class="h-16 bg-white border-t border-zinc-200 flex items-center px-6 gap-4 shadow-lg flex-shrink-0 relative z-50">
            
            <div class="flex items-center gap-2">
              <button 
                @click="startSimulation"
                :disabled="!canStartSimulation"
                class="p-3 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed relative group"
                :class="canStartSimulation ? 'hover:bg-zinc-100' : ''"
                title="Start (F5)"
              >
                <Play class="w-5 h-5 text-green-600" :class="{'fill-green-600': canStartSimulation}" />
                
                <div 
                  v-if="hasValidationErrors && !isSimulating && selectedTestCase"
                  class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                >
                  Fix errors first!
                </div>
              </button>

              <button 
                @click="stepSimulation"
                :disabled="!isSimulating"
                class="p-3 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed relative group"
                :class="isSimulating ? 'hover:bg-zinc-100' : ''"
                :title="isAtEnd ? 'Step to close (F10)' : 'Step (F10)'"
              >
                <StepForward class="w-5 h-5 text-blue-600" />
                
                <div 
                  v-if="isAtEnd && isSimulating"
                  class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                >
                  Press to close
                </div>
              </button>

              <button 
                @click="stopSimulation"
                :disabled="!isSimulating"
                class="p-3 rounded-lg hover:bg-zinc-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title="Stop (Shift+F5)"
              >
                <Square class="w-4 h-4 text-red-600" :class="{'fill-red-600': isSimulating}" />
              </button>
            </div>

            <div class="w-px h-8 bg-zinc-300"></div>

            <button 
              @click="runAllTests"
              :disabled="!canRunTests"
              class="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-md relative group"
              :class="canRunTests 
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg' 
                : 'bg-zinc-300 text-zinc-500 cursor-not-allowed'"
            >
              Run All Tests
              
              <div 
                v-if="hasValidationErrors"
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              >
                Fix {{ validationResult.errors.length }} error{{ validationResult.errors.length > 1 ? 's' : '' }} first!
              </div>
              
              <div 
                v-else-if="currentTestCases.length === 0"
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-zinc-600 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              >
                No test cases yet!
              </div>
            </button>

            <!-- Test Summary Badge -->
            <div v-if="testSummary" class="flex items-center gap-2">
              <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-bold">
                <Check class="w-3 h-3" />
                {{ testSummary.passed }}
              </div>
              <div v-if="testSummary.failed > 0" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-bold">
                <X class="w-3 h-3" />
                {{ testSummary.failed }}
              </div>
            </div>

            <!-- Simulation Info -->
            <div v-if="isSimulating && currentStep" class="ml-auto flex items-center gap-6">
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-zinc-500">Consumed:</span>
                  <code class="text-sm font-mono font-bold text-green-600">{{ currentStep.consumedInput || 'ε' }}</code>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-zinc-500">Remaining:</span>
                  <code class="text-sm font-mono font-bold text-blue-600">{{ currentStep.remainingInput || 'ε' }}</code>
                </div>
              </div>
              
              <div class="flex items-center gap-3 text-zinc-600 text-sm font-medium">
                <Clock class="w-5 h-5 animate-pulse text-blue-600" />
                <span class="font-semibold">Step {{ currentStepIndex + 1 }}/{{ currentSimulation?.steps.length || 0 }}</span>
              </div>

              <!-- Current State Badge -->
              <div class="px-4 py-2 rounded-full bg-green-100 border-2 border-green-500 text-green-900 text-sm font-bold">
                {{ Array.isArray(currentStep.currentState) ? '{' + currentStep.currentState.join(', ') + '}' : currentStep.currentState }}
              </div>

              <!-- Accepting State Indicator -->
              <div v-if="currentStep.isStuck && isAtEnd" 
                   class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-600 text-white text-xs font-bold animate-pulse">
                <X class="w-4 h-4" />
                STUCK
              </div>
              <div v-else-if="currentStep.isAccepting && isAtEnd" 
                   class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-600 text-white text-xs font-bold animate-pulse">
                <Check class="w-4 h-4" />
                ACCEPTED
              </div>
              <div v-else-if="!currentStep.isAccepting && isAtEnd" 
                   class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold animate-pulse">
                <X class="w-4 h-4" />
                REJECTED
              </div>
            </div>
            
          </div>
        </template>

      </div>

    </main>

    <!-- ERROR TOAST -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div 
        v-if="showErrorToast"
        class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border-2 border-red-400"
      >
        <ShieldAlert class="w-6 h-6 animate-pulse" />
        <div>
          <p class="font-bold text-sm">Cannot Run Tests!</p>
          <p class="text-xs opacity-90">Fix {{ validationResult.errors.length }} validation error{{ validationResult.errors.length > 1 ? 's' : '' }} first.</p>
        </div>
        <button 
          @click="toggleValidationModal"
          class="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors"
        >
          View Errors
        </button>
      </div>
    </Transition>

    <!-- VALIDATION MODAL -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div 
        v-if="showValidationModal && hasProjects"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @click.self="closeValidationModal"
      >
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeValidationModal"></div>
        
        <div class="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden">
          
          <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50">
            <div class="flex items-center gap-3">
              <Check v-if="validationStatus === 'valid'" class="w-6 h-6 text-green-600" />
              <X v-else-if="validationStatus === 'error'" class="w-6 h-6 text-red-600" />
              <AlertTriangle v-else class="w-6 h-6 text-yellow-600" />
              <h2 class="text-base font-bold text-zinc-900">Validierung</h2>
            </div>
            <button 
              @click="closeValidationModal"
              class="p-2 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              <svg class="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="max-h-[60vh] overflow-y-auto">
            
            <div v-if="validationResult.errors.length > 0" class="p-6 border-b border-zinc-200 bg-red-50">
              <div class="flex items-center gap-2 mb-4">
                <X class="w-5 h-5 text-red-600" />
                <h3 class="text-sm font-bold text-red-900">
                  {{ validationResult.errors.length }} Fehler
                </h3>
              </div>
              
              <div class="space-y-3">
                <div 
                  v-for="(error, idx) in validationResult.errors" 
                  :key="idx"
                  class="p-4 bg-white rounded-lg border border-red-200 shadow-sm"
                >
                  <p class="text-sm font-medium text-red-900 leading-relaxed">{{ error.message }}</p>
                  <p v-if="error.affectedElements.length > 0" class="text-xs text-red-700 mt-2">
                    <span class="font-semibold">Betroffen:</span> {{ error.affectedElements.length }} Element(e)
                  </p>
                </div>
              </div>
            </div>

            <div v-if="validationResult.warnings.length > 0" class="p-6 bg-yellow-50">
              <div class="flex items-center gap-2 mb-4">
                <AlertTriangle class="w-5 h-5 text-yellow-600" />
                <h3 class="text-sm font-bold text-yellow-900">
                  {{ validationResult.warnings.length }} Warnung{{ validationResult.warnings.length > 1 ? 'en' : '' }}
                </h3>
              </div>
              
              <div class="space-y-3">
                <div 
                  v-for="(warning, idx) in validationResult.warnings" 
                  :key="idx"
                  class="p-4 bg-white rounded-lg border border-yellow-200 shadow-sm"
                >
                  <p class="text-sm font-medium text-yellow-900 leading-relaxed">{{ warning.message }}</p>
                </div>
              </div>
            </div>

            <div v-if="validationResult.errors.length === 0 && validationResult.warnings.length === 0" class="p-8 text-center">
              <div class="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check class="w-10 h-10 text-green-600" />
              </div>
              <h3 class="text-lg font-bold text-zinc-900 mb-2">Perfekt!</h3>
              <p class="text-sm text-zinc-600">Keine Fehler oder Warnungen gefunden.</p>
            </div>

          </div>

          <div class="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex justify-end">
            <button 
              @click="closeValidationModal"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Schließen
            </button>
          </div>

        </div>
      </div>
    </Transition>
    
  </div>
</template>
