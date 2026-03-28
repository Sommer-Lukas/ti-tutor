<!--
  App.vue — Root application component and main orchestrator.

  Responsibilities:
   - Renders the top bar, sidebar, editor canvas, test panel, and simulation
     controls depending on the current mode (normal editing vs. exercise).
   - Owns all simulation lifecycle state (start / step / stop / run-all-tests).
   - Shows modals (validation, guide, exercise completion popup).
   - Registers global keyboard shortcuts (F5, F10, Shift+F5).
-->

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

// -- Icon imports (lucide-vue-next) ----------------------------------------
import {
  Play,
  StepForward,
  Square,
  Clock,
  Check,
  X,
  AlertTriangle,
  ShieldAlert,
  FolderOpen,
  Plus,
  HelpCircle,
  BookOpen,
  ArrowLeft,
  Trophy,
  FileText,
  Lightbulb,
  Settings,
} from 'lucide-vue-next'

// -- Child components ------------------------------------------------------
import Sidebar from '@/components/Sidebar.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import TestPanel from '@/components/TestPanel.vue'
import SimulationStepBar from '@/components/SimulationStepBar.vue'
import SimulationTreePanel from '@/components/SimulationTreePanel.vue'
import ExerciseListView from '@/components/ExerciseListView.vue'
import DarkModeToggle from '@/components/DarkModeToggle.vue'

// -- Store / library imports -----------------------------------------------
import {
  currentProject,
  validationResult,
  currentTestCases,
  projects,
  getPDAStartStackSymbol,
} from '@/lib/automatonStore'
import {
  exerciseModeActive,
  exerciseBrowsing,
  activeExercise,
  activeExerciseId,
  backToExerciseList,
  markExerciseCompleted,
  isExerciseCompleted,
  exerciseStates,
  exerciseTransitions,
} from '@/lib/exerciseStore'
import { AUTOMATON_TYPES } from '@/lib/automatonTypes'
import { AutomatonSimulator } from '@/lib/automatonSimulator'
import type { SimulationResult } from '@/lib/automatonSimulator'

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

const isSidebarOpen = ref(true)
const rightPanelOpen = ref(true)
const showValidationModal = ref(false)
const showGuideModal = ref(false)
const showErrorToast = ref(false)
/** Toggles the floating exercise-description overlay on the canvas. */
const showExerciseDescription = ref(false)
/** Controls the "Geschafft!" (completed) celebration popup. */
const exerciseCompleteToast = ref(false)

// ---------------------------------------------------------------------------
// Simulation state
// ---------------------------------------------------------------------------

const isSimulating = ref(false)
const currentSimulation = ref<SimulationResult | null>(null)
const currentStepIndex = ref(0)
/** Aggregated results from the last "Run All Tests" invocation. */
const allTestResults = ref<Array<SimulationResult & { expected: boolean; passed: boolean }>>([])
/** ID of the test case selected for single-step simulation. */
const selectedTestCase = ref<string | null>(null)

// ---------------------------------------------------------------------------
// Computed properties
// ---------------------------------------------------------------------------

const hasProjects = computed(() => projects.value.length > 0)

/** True when the user is actively building an exercise (not just browsing). */
const isExerciseWorking = computed(
  () => exerciseModeActive.value && !exerciseBrowsing.value && activeExercise.value !== null,
)

/** True when the editor canvas should be rendered (project exists or exercising). */
const showEditor = computed(() => hasProjects.value || isExerciseWorking.value)

// -- Automaton-type convenience booleans -----------------------------------
const isDFA = computed(() => currentProject.value?.type === 'DFA')
const isNFA = computed(() => currentProject.value?.type === 'NFA')
const isPDA = computed(() => currentProject.value?.type === 'PDA')
const isTM = computed(() => currentProject.value?.type === 'TM')

/** PDA/TM show the step bar (stack / tape) above the canvas during simulation. */
const showSimulationStepBar = computed(
  () => (isPDA.value || isTM.value) && isSimulating.value && currentSimulation.value !== null,
)
/** DFA/NFA show the tree panel on the right during simulation. */
const showSimulationTreePanel = computed(
  () => (isDFA.value || isNFA.value) && isSimulating.value && currentSimulation.value !== null,
)

/**
 * Maps exercise test cases to the same shape expected by `TestPanel`,
 * generating stable synthetic IDs.
 */
const exerciseTestCasesWithIds = computed(() => {
  if (!activeExercise.value) return []
  return activeExercise.value.testCases.map((tc, idx) => ({
    id: `ex-tc-${idx}`,
    input: tc.input,
    expectedAccepted: tc.expectedAccepted,
    expectedOutput: tc.expectedOutput,
    tmHeadEnd: tc.tmHeadEnd,
  }))
})

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

/** Reset simulation state whenever the active project changes. */
watch(
  () => currentProject.value?.id,
  (newId, oldId) => {
    if (newId !== oldId) {
      console.log('Project switched, resetting simulation state')
      stopSimulation()
      allTestResults.value = []
      selectedTestCase.value = null
    }
  },
)

/** Open the exercise description panel when an exercise starts. */
watch(
  () => activeExerciseId.value,
  (newId) => {
    if (newId) {
      showExerciseDescription.value = true
    }
  },
)

/**
 * Auto-close the exercise description overlay whenever the user modifies
 * states or transitions (i.e. starts interacting with the canvas).
 */
watch(
  [exerciseStates, exerciseTransitions],
  () => {
    if (showExerciseDescription.value) {
      showExerciseDescription.value = false
    }
  },
  { deep: true },
)

/** Also close the description when a simulation begins. */
watch(isSimulating, (val) => {
  if (val && showExerciseDescription.value) {
    showExerciseDescription.value = false
  }
})

/** Summarised validation status for the badge in the top bar. */
const validationStatus = computed(() => {
  if (!hasProjects.value) return 'valid'
  if (validationResult.value.errors.length > 0) return 'error'
  if (validationResult.value.warnings.length > 0) return 'warning'
  return 'valid'
})

const hasValidationErrors = computed(() => {
  return validationResult.value.errors.length > 0
})

/** Determines whether the "Run All Tests" button should be enabled. */
const canRunTests = computed(() => {
  if (isExerciseWorking.value) {
    return !hasValidationErrors.value && !isSimulating.value && exerciseTestCasesWithIds.value.length > 0
  }
  return (
    hasProjects.value &&
    !hasValidationErrors.value &&
    !isSimulating.value &&
    currentTestCases.value.length > 0
  )
})

/** Determines whether a single-step simulation can be started. */
const canStartSimulation = computed(() => {
  if (isExerciseWorking.value) {
    return !hasValidationErrors.value && selectedTestCase.value !== null && !isSimulating.value
  }
  return (
    hasProjects.value &&
    !hasValidationErrors.value &&
    selectedTestCase.value !== null &&
    !isSimulating.value
  )
})

/** The simulation step currently being displayed. */
const currentStep = computed(() => {
  if (!currentSimulation.value) return null
  return currentSimulation.value.steps[currentStepIndex.value]
})

/** Whether the simulation has reached its final step. */
const isAtEnd = computed(() => {
  if (!currentSimulation.value) return false
  return currentStepIndex.value === currentSimulation.value.steps.length - 1
})

/** Aggregated pass/fail statistics from the last test run. */
const testSummary = computed(() => {
  if (allTestResults.value.length === 0) return null

  const passed = allTestResults.value.filter((r) => r.passed).length
  const failed = allTestResults.value.filter((r) => !r.passed).length
  const total = allTestResults.value.length

  return { passed, failed, total }
})

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Briefly flash the error toast (auto-hides after 3 s). */
const showErrorToastWithTimeout = () => {
  showErrorToast.value = true
  setTimeout(() => {
    showErrorToast.value = false
  }, 3000)
}

/**
 * Begin a step-by-step simulation for the currently selected test case.
 * Hides the test panel and opens the simulation view.
 */
const startSimulation = () => {
  if (!showEditor.value) return

  // Validation Check
  if (hasValidationErrors.value) {
    showErrorToastWithTimeout()
    return
  }

  if (!selectedTestCase.value) return

  // Find test case in exercise mode or normal mode
  const testCaseSource = isExerciseWorking.value ? exerciseTestCasesWithIds.value : currentTestCases.value
  const testCase = testCaseSource.find((tc) => tc.id === selectedTestCase.value)
  if (!testCase) return

  // Pass PDA config to simulator
  const pdaConfig =
    currentProject.value.type === 'PDA' ? { startStackSymbol: getPDAStartStackSymbol() } : undefined

  const simulator = new AutomatonSimulator(
    currentProject.value.states,
    currentProject.value.transitions,
    currentProject.value.type,
    pdaConfig,
  )

  currentSimulation.value = simulator.simulate(testCase.input, {
    expectedOutput: testCase.expectedOutput,
    tmHeadEnd: testCase.tmHeadEnd,
  })
  currentStepIndex.value = 0
  isSimulating.value = true

  // Hide test panel during simulation
  rightPanelOpen.value = false

  console.log('Simulation started:', currentSimulation.value)
}

/** Advance one step or close the simulation if already at the end. */
const stepSimulation = () => {
  if (!isSimulating.value || !currentSimulation.value) return

  if (currentStepIndex.value === currentSimulation.value.steps.length - 1) {
    console.log(
      'Simulation complete:',
      currentSimulation.value.accepted ? 'ACCEPTED' : 'REJECTED',
    )
    stopSimulation()
    return
  }

  currentStepIndex.value++
}

/** Abort the current simulation and restore the test panel. */
const stopSimulation = () => {
  isSimulating.value = false
  currentSimulation.value = null
  currentStepIndex.value = 0
  rightPanelOpen.value = true
  console.log('Simulation stopped')
}

/**
 * Execute all test cases at once and display aggregated results.
 * In exercise mode, a full pass triggers the completion popup.
 */
const runAllTests = () => {
  if (!showEditor.value) return

  // Validation Check
  if (hasValidationErrors.value) {
    showErrorToastWithTimeout()
    return
  }

  // Get test cases from exercise or normal mode
  const testSource = isExerciseWorking.value ? exerciseTestCasesWithIds.value : currentTestCases.value

  if (testSource.length === 0) {
    console.warn('No test cases available')
    return
  }

  // Pass PDA config to simulator
  const pdaConfig =
    currentProject.value.type === 'PDA' ? { startStackSymbol: getPDAStartStackSymbol() } : undefined

  const simulator = new AutomatonSimulator(
    currentProject.value.states,
    currentProject.value.transitions,
    currentProject.value.type,
    pdaConfig,
  )

  const testsWithExpectations = testSource.map((tc) => ({
    input: tc.input,
    expected: tc.expectedAccepted,
    expectedOutput: tc.expectedOutput,
    tmHeadEnd: tc.tmHeadEnd,
  }))

  allTestResults.value = simulator.runTests(testsWithExpectations)

  // If every test passes in exercise mode, mark the exercise as completed.
  if (isExerciseWorking.value && activeExerciseId.value) {
    const allPassed = allTestResults.value.every((r) => r.passed)
    if (allPassed && allTestResults.value.length > 0) {
      markExerciseCompleted(activeExerciseId.value)
      exerciseCompleteToast.value = true
    }
  }

  console.log('All test results:', allTestResults.value)
  console.log(`Passed: ${testSummary.value?.passed}/${testSummary.value?.total}`)
  console.log(`Failed: ${testSummary.value?.failed}/${testSummary.value?.total}`)
}

const toggleValidationModal = () => {
  if (!showEditor.value) return
  showValidationModal.value = !showValidationModal.value
}

const closeValidationModal = () => {
  showValidationModal.value = false
}

const toggleGuideModal = () => {
  if (!showEditor.value) return
  showGuideModal.value = !showGuideModal.value
}

const closeGuideModal = () => {
  showGuideModal.value = false
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

const handleKeyDown = (e: KeyboardEvent) => {
  if (!showEditor.value) return

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

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeyDown)
}

/** Programmatically opens the sidebar and dispatches a custom event to show the new-project dialog. */
const triggerNewProject = () => {
  isSidebarOpen.value = true
  setTimeout(() => {
    const event = new CustomEvent('open-new-automaton-dialog')
    window.dispatchEvent(event)
  }, 100)
}
</script>

<template>
  <div class="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden relative transition-colors duration-300">
    <!-- ============================================================= -->
    <!-- LEFT SIDEBAR (hidden in exercise mode)                        -->
    <!-- ============================================================= -->
    <Sidebar v-if="!exerciseModeActive" v-model:is-open="isSidebarOpen" />

    <!-- ============================================================= -->
    <!-- MAIN CONTENT AREA                                             -->
    <!-- ============================================================= -->
    <main class="flex-1 flex flex-col h-full min-w-0 bg-white dark:bg-zinc-900 transition-colors duration-300">
      <!-- ----------------------------------------------------------- -->
      <!-- TOP BAR (hidden when browsing exercises – that view has its   -->
      <!-- own header)                                                  -->
      <!-- ----------------------------------------------------------- -->
      <header
        v-if="!(exerciseModeActive && exerciseBrowsing)"
        class="flex h-14 items-center justify-between px-6 border-b z-50 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 flex-shrink-0 relative transition-colors duration-300"
      >
        <!-- Exercise Working Mode – back button + title + badges -->
        <div v-if="isExerciseWorking" class="flex items-center gap-3">
          <button
            @click="backToExerciseList(); allTestResults = []; selectedTestCase = null"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition-all"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
            Aufgaben
          </button>

          <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{{ activeExercise?.title }}</h1>

          <!-- Automaton Type Badge -->
          <span
            class="px-2.5 py-1 rounded-full text-xs font-bold"
            :class="
              currentProject.type === 'DFA'
                ? 'bg-blue-100 text-blue-700'
                : currentProject.type === 'NFA'
                  ? 'bg-purple-100 text-purple-700'
                  : currentProject.type === 'PDA'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-orange-100 text-orange-700'
            "
          >
            {{ AUTOMATON_TYPES[currentProject.type].shortName }}
          </span>

          <!-- Validation Status Badge -->
          <button
            @click="toggleValidationModal"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:shadow-md"
            :class="{
              'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50': validationStatus === 'valid',
              'bg-red-50 text-red-700 hover:bg-red-100 animate-pulse dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50': validationStatus === 'error',
              'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50': validationStatus === 'warning',
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

          <!-- Exercise Description Toggle -->
          <button
            @click="showExerciseDescription = !showExerciseDescription"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:shadow-md"
            :class="showExerciseDescription ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30'"
          >
            <FileText class="w-4 h-4" />
            Aufgabe
          </button>

          <!-- Completed Badge -->
          <div
            v-if="activeExerciseId && isExerciseCompleted(activeExerciseId)"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold"
          >
            <Trophy class="w-3.5 h-3.5" />
            Bestanden
          </div>
        </div>

        <!-- Normal Project Header – name + type badge + validation + help -->
        <div v-else-if="hasProjects && !exerciseModeActive" class="flex items-center gap-3">
          <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{{ currentProject.name }}</h1>

          <!-- Automaton Type Badge -->
          <span
            class="px-2.5 py-1 rounded-full text-xs font-bold"
            :class="
              currentProject.type === 'DFA'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-purple-100 text-purple-700'
            "
          >
            {{ AUTOMATON_TYPES[currentProject.type].shortName }}
          </span>

          <!-- Validation Status Badge -->
          <button
            @click="toggleValidationModal"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:shadow-md"
            :class="{
                'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50': validationStatus === 'valid',
                'bg-red-50 text-red-700 hover:bg-red-100 animate-pulse dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50': validationStatus === 'error',
                'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50': validationStatus === 'warning',
            }"
          >
            <Check v-if="validationStatus === 'valid'" class="w-4 h-4" />
            <X v-else-if="validationStatus === 'error'" class="w-4 h-4" />
            <AlertTriangle v-else class="w-4 h-4" />
              

            <span v-if="validationStatus === 'valid'">Valid</span>
            <span v-else-if="validationStatus === 'error'">
              {{ validationResult.errors.length }} Error{{
                validationResult.errors.length > 1 ? 's' : ''
              }}
            </span>
            <span v-else>
              {{ validationResult.warnings.length }} Warning{{
                validationResult.warnings.length > 1 ? 's' : ''
              }}
            </span>
          </button>

          <!-- Guide Button -->
          <button
            @click="toggleGuideModal"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:shadow-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
            title="Hilfe & Shortcuts"
          >
            <HelpCircle class="w-4 h-4" />
            <span>Hilfe</span>
          </button>
        </div>

        <!-- Empty State Header (no projects, no exercise) -->
        <div v-else class="flex items-center gap-2">
          <FolderOpen class="w-5 h-5 text-zinc-400" />
          <h1 class="text-lg font-semibold text-zinc-500">Kein Projekt geöffnet</h1>
        </div>

        <div class="ml-4 flex items-center">
          <DarkModeToggle />
        </div>
      </header>

      <!-- ----------------------------------------------------------- -->
      <!-- WORKSPACE                                                    -->
      <!-- ----------------------------------------------------------- -->
      <div class="flex-1 flex flex-col min-h-0">
        <!-- EXERCISE BROWSING VIEW (full-screen list) -->
        <ExerciseListView
          v-if="exerciseModeActive && exerciseBrowsing"
        />

        <!-- EMPTY STATE (no projects and not exercising) -->
        <div
          v-else-if="!hasProjects && !isExerciseWorking"
          class="flex-1 flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800"
        >
          <div class="text-center max-w-md px-8">
            <div
              class="w-32 h-32 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6"
            >
              <FolderOpen class="w-16 h-16 text-zinc-400 dark:text-zinc-500" />
            </div>

            <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">Willkommen!</h2>

            <p class="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
              Du hast noch keine Automaten erstellt. Erstelle deinen ersten Automaten, um mit der
              Arbeit zu beginnen.
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

        <!-- NORMAL / EXERCISE WORKSPACE -->
        <template v-else>
          <!-- PDA / TM simulation step bar (stack or tape visualisation) -->
          <SimulationStepBar
            v-if="showSimulationStepBar"
            :simulation="currentSimulation!"
            :current-step-index="currentStepIndex"
            :automaton-type="currentProject.type"
          />

          <!-- CANVAS + RIGHT PANEL ROW -->
          <div class="flex-1 flex min-h-0 overflow-hidden relative">
            <!-- Cytoscape graph editor with simulation highlighting -->
            <EditorCanvas
              class="flex-1 min-w-0"
              :current-simulation-state="
                typeof currentStep?.currentState === 'string'
                  ? currentStep.currentState
                  : typeof currentStep?.currentState === 'object'
                    ? currentStep.currentState?.[0]
                    : currentStep?.currentState
              "
              :is-simulating="isSimulating"
            />

            <!-- EXERCISE DESCRIPTION floating overlay -->
            <Transition
              enter-active-class="transition-all duration-300 ease-out"
              leave-active-class="transition-all duration-200 ease-in"
              enter-from-class="opacity-0 translate-y-2"
              enter-to-class="opacity-100 translate-y-0"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 translate-y-2"
            >
              <div
                v-if="isExerciseWorking && showExerciseDescription"
                class="absolute top-4 left-4 z-40 w-[420px] max-h-[70%] bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
              >
                <div class="px-5 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-900/30 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <BookOpen class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">Aufgabenstellung</h3>
                  </div>
                  <button
                    @click="showExerciseDescription = false"
                    class="p-1 rounded-lg hover:bg-white/50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <X class="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  </button>
                </div>
                <div class="p-5 overflow-y-auto max-h-[calc(70vh-48px)]">
                  <p class="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">{{ activeExercise?.description }}</p>
                  <div v-if="activeExercise?.hint" class="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                    <p class="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-1.5"><Lightbulb class="w-3.5 h-3.5" /> Hinweis</p>
                    <p class="text-xs text-amber-700 dark:text-amber-500/90 leading-relaxed">{{ activeExercise.hint }}</p>
                  </div>
                </div>
              </div>
            </Transition>

            <!-- TEST PANEL (hidden while simulating) -->
            <TestPanel
              v-show="!isSimulating"
              v-model:selected="selectedTestCase"
              v-model:visible="rightPanelOpen"
              :simulation-results="allTestResults"
              :readonly="isExerciseWorking"
              :exercise-test-cases="isExerciseWorking ? exerciseTestCasesWithIds : undefined"
              :exercise-automaton-type="isExerciseWorking ? activeExercise?.type : undefined"
            />

            <!-- DFA / NFA simulation tree panel -->
            <SimulationTreePanel
              v-if="showSimulationTreePanel"
              :simulation="currentSimulation!"
              :current-step-index="currentStepIndex"
              :automaton-type="currentProject.type"
            />
          </div>

          <!-- --------------------------------------------------------- -->
          <!-- BOTTOM BAR – simulation controls + Run All Tests button   -->
          <!-- --------------------------------------------------------- -->
          <div
            class="h-16 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center px-6 gap-4 shadow-lg flex-shrink-0 relative z-50"
          >
            <div class="flex items-center gap-2">
              <button
                @click="startSimulation"
                :disabled="!canStartSimulation"
                class="p-3 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed relative group"
                :class="canStartSimulation ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''"
                title="Start (F5)"
              >
                <Play
                  class="w-5 h-5 text-green-600"
                  :class="{ 'fill-green-600': canStartSimulation }"
                />

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
                :class="isSimulating ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''"
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
                class="p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title="Stop (Shift+F5)"
              >
                <Square class="w-4 h-4 text-red-600" :class="{ 'fill-red-600': isSimulating }" />
              </button>
            </div>

            <div class="w-px h-8 bg-zinc-300 dark:bg-zinc-700"></div>

            <button
              @click="runAllTests"
              :disabled="!canRunTests"
              class="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-md relative group"
              :class="
                canRunTests
                  ? 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
                  : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 cursor-not-allowed'
              "
            >
              Run All Tests

              <div
                v-if="hasValidationErrors"
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              >
                Fix {{ validationResult.errors.length }} error{{
                  validationResult.errors.length > 1 ? 's' : ''
                }}
                first!
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
              <div
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-bold"
              >
                <Check class="w-3 h-3" />
                {{ testSummary.passed }}
              </div>
              <div
                v-if="testSummary.failed > 0"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-bold"
              >
                <X class="w-3 h-3" />
                {{ testSummary.failed }}
              </div>
            </div>

            <!-- Simulation Info -->
            <div v-if="isSimulating && currentStep" class="ml-auto flex items-center gap-6">
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-zinc-500">Consumed:</span>
                  <code class="text-sm font-mono font-bold text-green-600">{{
                    currentStep.consumedInput || 'ε'
                  }}</code>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-zinc-500">Remaining:</span>
                  <code class="text-sm font-mono font-bold text-blue-600">{{
                    currentStep.remainingInput || 'ε'
                  }}</code>
                </div>
              </div>

              <div class="flex items-center gap-3 text-zinc-600 text-sm font-medium">
                <Clock class="w-5 h-5 animate-pulse text-blue-600" />
                <span class="font-semibold"
                  >Step {{ currentStepIndex + 1 }}/{{ currentSimulation?.steps.length || 0 }}</span
                >
              </div>

              <!-- Current State Badge -->
              <div
                class="px-4 py-2 rounded-full bg-green-100 border-2 border-green-500 text-green-900 text-sm font-bold"
              >
                {{
                  Array.isArray(currentStep.currentState)
                    ? '{' + currentStep.currentState.join(', ') + '}'
                    : currentStep.currentState
                }}
              </div>

              <!-- Accepting State Indicator -->
              <div
                v-if="currentStep.isStuck && isAtEnd"
                class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-600 text-white text-xs font-bold animate-pulse"
              >
                <X class="w-4 h-4" />
                STUCK
              </div>
              <div
                v-else-if="currentStep.isAccepting && isAtEnd"
                class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-600 text-white text-xs font-bold animate-pulse"
              >
                <Check class="w-4 h-4" />
                ACCEPTED
              </div>
              <div
                v-else-if="!currentStep.isAccepting && isAtEnd"
                class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold animate-pulse"
              >
                <X class="w-4 h-4" />
                REJECTED
              </div>
            </div>
          </div>
        </template>
      </div>
    </main>

    <!-- ============================================================= -->
    <!-- GLOBAL OVERLAYS (toasts + modals)                             -->
    <!-- ============================================================= -->

    <!-- ERROR TOAST (validation errors prevent test execution) -->
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
          <p class="text-xs opacity-90">
            Fix {{ validationResult.errors.length }} validation error{{
              validationResult.errors.length > 1 ? 's' : ''
            }}
            first.
          </p>
        </div>
        <button
          @click="toggleValidationModal"
          class="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors"
        >
          View Errors
        </button>
      </div>
    </Transition>

    <!-- EXERCISE COMPLETION POPUP (“Geschafft!”) -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="exerciseCompleteToast"
        class="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="exerciseCompleteToast = false"
      >
        <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative border border-zinc-200 dark:border-zinc-800">
          <button
            @click="exerciseCompleteToast = false"
            class="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
          <div class="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            <Trophy class="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">Geschafft!</h2>
          <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Alle Tests erfolgreich bestanden.</p>
          <button
            @click="exerciseCompleteToast = false; backToExerciseList()"
            class="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          >
            Zurück zu den Aufgaben
          </button>
        </div>
      </div>
    </Transition>

    <!-- VALIDATION MODAL (lists errors & warnings) -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showValidationModal && showEditor"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @click.self="closeValidationModal"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="closeValidationModal"
        ></div>

        <div
          class="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
        >
          <div
            class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30"
          >
            <div class="flex items-center gap-3">
              <Check v-if="validationStatus === 'valid'" class="w-6 h-6 text-green-600 dark:text-green-400" />
              <X v-else-if="validationStatus === 'error'" class="w-6 h-6 text-red-600 dark:text-red-400" />
              <AlertTriangle v-else class="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100">Validierung</h2>
            </div>
            <button
              @click="closeValidationModal"
              class="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <svg
                class="w-5 h-5 text-zinc-600 dark:text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div class="max-h-[60vh] overflow-y-auto">
            <div
              v-if="validationResult.errors.length > 0"
              class="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-red-50 dark:bg-red-950/20"
            >
              <div class="flex items-center gap-2 mb-4">
                <X class="w-5 h-5 text-red-600 dark:text-red-400" />
                <h3 class="text-sm font-bold text-red-900 dark:text-red-400">
                  {{ validationResult.errors.length }} Fehler
                </h3>
              </div>

              <div class="space-y-3">
                <div
                  v-for="(error, idx) in validationResult.errors"
                  :key="idx"
                  class="p-4 bg-white dark:bg-zinc-950 rounded-lg border border-red-200 dark:border-red-900/40 shadow-sm"
                >
                  <p class="text-sm font-medium text-red-900 dark:text-red-400/90 leading-relaxed">
                    {{ error.message }}
                  </p>
                  <p v-if="error.affectedElements.length > 0" class="text-xs text-red-700 dark:text-red-500/80 mt-2">
                    <span class="font-semibold">Betroffen:</span>
                    {{ error.affectedElements.length }} Element(e)
                  </p>
                </div>
              </div>
            </div>

            <div v-if="validationResult.warnings.length > 0" class="p-6 bg-yellow-50 dark:bg-yellow-950/20">
              <div class="flex items-center gap-2 mb-4">
                <AlertTriangle class="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
                <h3 class="text-sm font-bold text-yellow-900 dark:text-yellow-500">
                  {{ validationResult.warnings.length }} Warnung{{
                    validationResult.warnings.length > 1 ? 'en' : ''
                  }}
                </h3>
              </div>

              <div class="space-y-3">
                <div
                  v-for="(warning, idx) in validationResult.warnings"
                  :key="idx"
                  class="p-4 bg-white dark:bg-zinc-950 rounded-lg border border-yellow-200 dark:border-yellow-900/40 shadow-sm"
                >
                  <p class="text-sm font-medium text-yellow-900 dark:text-yellow-500/90 leading-relaxed">
                    {{ warning.message }}
                  </p>
                </div>
              </div>
            </div>

            <div
              v-if="validationResult.errors.length === 0 && validationResult.warnings.length === 0"
              class="p-8 text-center"
            >
              <div
                class="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4"
              >
                <Check class="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 class="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Perfekt!</h3>
              <p class="text-sm text-zinc-600 dark:text-zinc-400">Keine Fehler oder Warnungen gefunden.</p>
            </div>
          </div>

          <div class="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex justify-end">
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

    <!-- HELP / GUIDE MODAL (keyboard shortcuts & usage hints) -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showGuideModal && showEditor"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @click.self="closeGuideModal"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="closeGuideModal"
        ></div>

        <div
          class="relative w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
        >
          <div
            class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-zinc-800 dark:to-zinc-800"
          >
            <div class="flex items-center gap-3">
              <HelpCircle class="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100">Tastenkombinationen & Bedienung</h2>
                <p class="text-xs text-zinc-600 dark:text-zinc-400">
                  {{ AUTOMATON_TYPES[currentProject.type].shortName }} - {{ currentProject.name }}
                </p>
              </div>
            </div>
            <button
              @click="closeGuideModal"
              class="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-zinc-700 transition-colors"
            >
              <svg
                class="w-5 h-5 text-zinc-600 dark:text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div class="max-h-[70vh] overflow-y-auto p-6 space-y-6">
            <!-- Canvas Bedienung -->
            <div class="bg-zinc-50 dark:bg-zinc-950/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                Canvas Bedienung
              </h3>
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-700 dark:text-zinc-300">Neuer Zustand erstellen</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono dark:text-zinc-200">Doppelklick</kbd>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-700 dark:text-zinc-300">Zustand verschieben</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono dark:text-zinc-200">Drag & Drop</kbd>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-700 dark:text-zinc-300">Mehrere Zustände auswählen</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono dark:text-zinc-200">Box-Selection oder SHIFT+Click</kbd>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-700 dark:text-zinc-300">Mehrere Zustände verschieben</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono dark:text-zinc-200">Auswählen + Drag</kbd>
                </div>
              </div>
            </div>

            <!-- Zustände bearbeiten -->
            <div class="bg-zinc-50 dark:bg-zinc-950/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                Zustände bearbeiten
              </h3>
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-700 dark:text-zinc-300">Startzustand markieren</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono dark:text-zinc-200">Toolbar: Flag-Icon</kbd>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-700 dark:text-zinc-300">Finalzustand markieren</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono dark:text-zinc-200">Doppelklick</kbd>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-700 dark:text-zinc-300">Zustand umbenennen</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono dark:text-zinc-200">Zustand auswählen + Tippen</kbd>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-700 dark:text-zinc-300">Zustand löschen</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono dark:text-zinc-200">DEL</kbd>
                </div>
              </div>
            </div>

            <!-- Transitionen erstellen -->
            <div class="bg-zinc-50 dark:bg-zinc-950/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                Transitionen erstellen
              </h3>
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-700 dark:text-zinc-300">Neue Transition</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono dark:text-zinc-200">Rechtsklick + Klick</kbd>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-700 dark:text-zinc-300">Oder: Toolbar</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono dark:text-zinc-200">Arrow-Icon verwenden</kbd>
                </div>
              </div>
            </div>

            <!-- Transitionen bearbeiten (DFA/NFA) -->
            <div v-if="isDFA || isNFA" class="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-900/30">
              <h3 class="text-sm font-bold text-blue-900 dark:text-blue-400 mb-3 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">4</span>
                Transitionen bearbeiten ({{ AUTOMATON_TYPES[currentProject.type].shortName }})
              </h3>
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-blue-900 dark:text-blue-200">Transition auswählen</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 rounded text-xs font-mono dark:text-blue-100">Klick</kbd>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-blue-900 dark:text-blue-200">Symbol ändern</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 rounded text-xs font-mono dark:text-blue-100">Tippen</kbd>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-blue-900 dark:text-blue-200">Symbol löschen</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 rounded text-xs font-mono dark:text-blue-100">Backspace</kbd>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-blue-900 dark:text-blue-200">Transition löschen</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 rounded text-xs font-mono dark:text-blue-100">DEL</kbd>
                </div>
              </div>
            </div>

            <!-- Transitionen bearbeiten (PDA) -->
            <div v-if="isPDA" class="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10 rounded-lg p-4 border border-emerald-200 dark:border-emerald-900/30">
              <h3 class="text-sm font-bold text-emerald-900 dark:text-emerald-400 mb-3 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">4</span>
                Transitionen bearbeiten (PDA)
              </h3>
              <div class="space-y-3">
                <div class="bg-white dark:bg-zinc-900 rounded p-3 border border-emerald-200 dark:border-emerald-800">
                  <p class="text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-2 flex items-center gap-1.5"><FileText class="w-3.5 h-3.5" /> Format: input,stackTop/stackPush</p>
                  <p class="text-xs text-emerald-800 dark:text-emerald-400">Beispiel: a,$/a$</p>
                  <p class="text-xs text-emerald-700 dark:text-emerald-500 mt-1">Verwende ε für leere Eingaben</p>
                </div>
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-emerald-900 dark:text-emerald-200">Bearbeiten (Schnell)</span>
                    <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 rounded text-xs font-mono dark:text-emerald-100">Kante + Tippen</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-emerald-900 dark:text-emerald-200">Editor öffnen</span>
                    <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 rounded text-xs font-mono dark:text-emerald-100">Doppelklick</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-emerald-900 dark:text-emerald-200">Bestätigen</span>
                    <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 rounded text-xs font-mono dark:text-emerald-100">Enter</kbd>
                  </div>
                </div>
              </div>
            </div>

            <!-- Transitionen bearbeiten (TM) -->
            <div v-if="isTM" class="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-900/30">
              <h3 class="text-sm font-bold text-blue-900 dark:text-blue-400 mb-3 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">4</span>
                Transitionen bearbeiten (TM)
              </h3>
              <div class="space-y-3">
                <div class="bg-white dark:bg-zinc-900 rounded p-3 border border-blue-200 dark:border-blue-800">
                  <p class="text-xs font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-1.5"><Settings class="w-3.5 h-3.5" /> Format: read/action</p>
                  <p class="text-xs text-blue-800 dark:text-blue-400">Beispiele:</p>
                  <ul class="text-xs text-blue-700 dark:text-blue-500 mt-1 space-y-1 list-disc list-inside">
                    <li>c/L, c/d, w/R</li>
                  </ul>
                </div>
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-blue-900 dark:text-blue-200">Bearbeiten (Schnell)</span>
                    <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 rounded text-xs font-mono dark:text-blue-100">Kante + Tippen</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-blue-900 dark:text-blue-200">Editor öffnen</span>
                    <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 rounded text-xs font-mono dark:text-blue-100">Doppelklick</kbd>
                  </div>
                </div>
              </div>
            </div>

            <!-- Simulation -->
            <div class="bg-zinc-50 dark:bg-zinc-950/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-bold">5</span>
                Simulation
              </h3>
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-700 dark:text-zinc-300">Simulation starten</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono dark:text-zinc-200">F5</kbd>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-700 dark:text-zinc-300">Schritt vorwärts</span>
                  <kbd class="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono dark:text-zinc-200">F10</kbd>
                </div>
              </div>
            </div>

            <!-- Weitere Tipps -->
            <div class="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 rounded-lg p-4 border-2 border-amber-300 dark:border-amber-700/50">
              <h3 class="text-sm font-bold text-amber-900 dark:text-amber-500 mb-2 flex items-center gap-2">
                <Lightbulb class="w-4 h-4" /> Tipps
              </h3>
              <ul class="space-y-1 text-xs text-amber-900 dark:text-amber-600">
                <li>• ESC abbrechen bei Transition-Erstellung</li>
                <li>• Validierungs-Badge anklicken um Fehler anzuzeigen</li>
                <li>• Testfälle erstellen im rechten Panel</li>
                <li>• "Run All Tests" führt alle Tests automatisch aus</li>
              </ul>
            </div>
          </div>

          <div class="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30 flex justify-end">
            <button
              @click="closeGuideModal"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Verstanden
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
