import { ref, computed, reactive, watch } from 'vue'
import type { AutomatonType, TMHeadEnd } from './automatonTypes'
import type { State, Transition, AutomatonProject } from './automaton'

// --- EXERCISE TYPES ---

export interface ExerciseTestCase {
  input: string
  expectedAccepted: boolean
  expectedOutput?: string
  tmHeadEnd?: TMHeadEnd
}

export interface Exercise {
  id: string
  title: string
  type: AutomatonType
  difficulty: 'leicht' | 'mittel' | 'schwer'
  description: string
  hint?: string
  testCases: ExerciseTestCase[]
  pdaConfig?: {
    startStackSymbol: string
  }
}

// --- EXERCISE STATE ---

export const exerciseModeActive = ref(false)
export const activeExerciseId = ref<string | null>(null)
export const exerciseBrowsing = ref(false) // true = show list, false = working on exercise

// Exercise workspace state (isolated from main projects)
export const exerciseStates = ref<State[]>([])
export const exerciseTransitions = ref<Transition[]>([])

// Virtual project for the exercise (so EditorCanvas can mutate it directly)
export const exerciseProject = computed((): AutomatonProject | null => {
  const exercise = activeExercise.value
  if (!exercise) return null
  return {
    id: `exercise-${exercise.id}`,
    name: exercise.title,
    type: exercise.type,
    states: exerciseStates.value,
    transitions: exerciseTransitions.value,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(exercise.pdaConfig && { pdaConfig: exercise.pdaConfig }),
  }
})
// Completion tracking (persisted to localStorage)
const STORAGE_KEY_COMPLETED = 'exercise-completed'
const STORAGE_KEY_PROGRESS_PREFIX = 'exercise-progress-'
export const completedExercises = ref<Set<string>>(new Set())

// Resume dialog state
export const showResumeDialog = ref(false)
export const pendingExerciseId = ref<string | null>(null)

// --- LOAD COMPLETION FROM STORAGE ---
function loadCompletedExercises() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_COMPLETED)
    if (stored) {
      completedExercises.value = new Set(JSON.parse(stored))
    }
  } catch (e) {
    console.error('Failed to load exercise completions:', e)
  }
}

function saveCompletedExercises() {
  try {
    localStorage.setItem(
      STORAGE_KEY_COMPLETED,
      JSON.stringify([...completedExercises.value]),
    )
  } catch (e) {
    console.error('Failed to save exercise completions:', e)
  }
}

// --- EXERCISE PROGRESS PERSISTENCE ---

function saveExerciseProgress(exerciseId: string) {
  try {
    const data = {
      states: exerciseStates.value,
      transitions: exerciseTransitions.value,
    }
    localStorage.setItem(STORAGE_KEY_PROGRESS_PREFIX + exerciseId, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save exercise progress:', e)
  }
}

function loadExerciseProgress(exerciseId: string): { states: State[]; transitions: Transition[] } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROGRESS_PREFIX + exerciseId)
    if (stored) {
      const data = JSON.parse(stored)
      if (data.states && data.transitions) return data
    }
  } catch (e) {
    console.error('Failed to load exercise progress:', e)
  }
  return null
}

export function hasExerciseProgress(exerciseId: string): boolean {
  return localStorage.getItem(STORAGE_KEY_PROGRESS_PREFIX + exerciseId) !== null
}

loadCompletedExercises()

// --- AUTO-SAVE EXERCISE PROGRESS ---
watch(
  [exerciseStates, exerciseTransitions],
  () => {
    if (activeExerciseId.value && !exerciseBrowsing.value) {
      saveExerciseProgress(activeExerciseId.value)
    }
  },
  { deep: true },
)

// --- COMPUTED ---

export const activeExercise = computed((): Exercise | null => {
  if (!activeExerciseId.value) return null
  return EXERCISES.find((e) => e.id === activeExerciseId.value) ?? null
})

export const isExerciseCompleted = (id: string): boolean => {
  return completedExercises.value.has(id)
}

// --- ACTIONS ---

export function enterExerciseMode() {
  exerciseModeActive.value = true
  exerciseBrowsing.value = true
  activeExerciseId.value = null
  exerciseStates.value = []
  exerciseTransitions.value = []
}

export function exitExerciseMode() {
  exerciseModeActive.value = false
  exerciseBrowsing.value = false
  activeExerciseId.value = null
  exerciseStates.value = []
  exerciseTransitions.value = []
}

export function startExercise(exerciseId: string) {
  const exercise = EXERCISES.find((e) => e.id === exerciseId)
  if (!exercise) return

  // Check if saved progress exists – if so, show resume dialog
  if (hasExerciseProgress(exerciseId)) {
    pendingExerciseId.value = exerciseId
    showResumeDialog.value = true
    return
  }

  // No saved progress – start fresh
  beginExerciseFresh(exerciseId)
}

export function beginExerciseFresh(exerciseId: string) {
  const exercise = EXERCISES.find((e) => e.id === exerciseId)
  if (!exercise) return

  activeExerciseId.value = exerciseId
  exerciseBrowsing.value = false
  showResumeDialog.value = false
  pendingExerciseId.value = null

  // Start with a single start state
  exerciseStates.value = [
    { id: 'q0', label: 'q0', isStart: true, isFinal: false, position: { x: 250, y: 250 } },
  ]
  exerciseTransitions.value = []

  // Clear old saved progress
  localStorage.removeItem(STORAGE_KEY_PROGRESS_PREFIX + exerciseId)
}

export function resumeExercise(exerciseId: string) {
  const exercise = EXERCISES.find((e) => e.id === exerciseId)
  if (!exercise) return

  const progress = loadExerciseProgress(exerciseId)
  if (!progress) {
    // Fallback to fresh start if progress is corrupted
    beginExerciseFresh(exerciseId)
    return
  }

  activeExerciseId.value = exerciseId
  exerciseBrowsing.value = false
  showResumeDialog.value = false
  pendingExerciseId.value = null

  exerciseStates.value = progress.states
  exerciseTransitions.value = progress.transitions
}

export function cancelResumeDialog() {
  showResumeDialog.value = false
  pendingExerciseId.value = null
}

export function backToExerciseList() {
  exerciseBrowsing.value = true
  activeExerciseId.value = null
  exerciseStates.value = []
  exerciseTransitions.value = []
}

export function markExerciseCompleted(exerciseId: string) {
  completedExercises.value.add(exerciseId)
  // Trigger reactivity by replacing the set
  completedExercises.value = new Set(completedExercises.value)
  saveCompletedExercises()
}

// --- PREDEFINED EXERCISES ---

export const EXERCISES: Exercise[] = [
  // ========== DFA ==========
  {
    id: 'dfa-01',
    title: 'Wörter die auf "ab" enden',
    type: 'DFA',
    difficulty: 'leicht',
    description:
      'Erstelle einen DFA über dem Alphabet {a, b}, der genau die Wörter akzeptiert, die auf "ab" enden.\n\nBeispiel: "ab" ✓, "aab" ✓, "bab" ✓, "ba" ✗, "a" ✗',
    hint: 'Du brauchst 3 Zustände: einen für "nichts gesehen", einen für "a gesehen", und einen finalen für "ab gesehen".',
    testCases: [
      { input: 'ab', expectedAccepted: true },
      { input: 'aab', expectedAccepted: true },
      { input: 'bab', expectedAccepted: true },
      { input: 'ababab', expectedAccepted: true },
      { input: 'bbab', expectedAccepted: true },
      { input: 'a', expectedAccepted: false },
      { input: 'b', expectedAccepted: false },
      { input: 'ba', expectedAccepted: false },
      { input: 'aa', expectedAccepted: false },
      { input: 'aba', expectedAccepted: false },
    ],
  },

  // ========== NFA ==========
  {
    id: 'nfa-01',
    title: 'Vorletztes Zeichen ist 1',
    type: 'NFA',
    difficulty: 'leicht',
    description:
      'Erstelle einen NFA über dem Alphabet {0, 1}, der genau die Wörter mit Länge ≥ 2 akzeptiert, bei denen das vorletzte Zeichen eine 1 ist.\n\nBeispiel: "10" ✓, "11" ✓, "010" ✓, "00" ✗',
    hint: 'Nutze Nichtdeterminismus: Rate, wann das vorletzte Zeichen kommt. Du brauchst nur 3 Zustände.',
    testCases: [
      { input: '10', expectedAccepted: true },
      { input: '11', expectedAccepted: true },
      { input: '010', expectedAccepted: true },
      { input: '110', expectedAccepted: true },
      { input: '0011', expectedAccepted: true },
      { input: '0', expectedAccepted: false },
      { input: '1', expectedAccepted: false },
      { input: '00', expectedAccepted: false },
      { input: '01', expectedAccepted: false },
      { input: '001', expectedAccepted: false },
    ],
  },

  // ========== PDA ==========
  {
    id: 'pda-01',
    title: 'Sprache {aⁿbⁿ | n ≥ 1}',
    type: 'PDA',
    difficulty: 'leicht',
    description:
      'Erstelle einen PDA, der die Sprache L = {aⁿbⁿ | n ≥ 1} akzeptiert. Das heißt, gleich viele a\'s gefolgt von gleich vielen b\'s.\n\nBeispiel: "ab" ✓, "aabb" ✓, "aaabbb" ✓, "aab" ✗, "ba" ✗',
    hint: 'Pushe für jedes "a" ein Symbol auf den Stack. Poppe für jedes "b" ein Symbol. Akzeptiere, wenn der Stack leer ist (nur noch Startsymbol).',
    pdaConfig: { startStackSymbol: '$' },
    testCases: [
      { input: 'ab', expectedAccepted: true },
      { input: 'aabb', expectedAccepted: true },
      { input: 'aaabbb', expectedAccepted: true },
      { input: 'aaaabbbb', expectedAccepted: true },
      { input: '', expectedAccepted: false },
      { input: 'a', expectedAccepted: false },
      { input: 'b', expectedAccepted: false },
      { input: 'aab', expectedAccepted: false },
      { input: 'abb', expectedAccepted: false },
      { input: 'ba', expectedAccepted: false },
    ],
  },

  // ========== TM ==========
  {
    id: 'tm-01',
    title: 'Unäres Inkrement',
    type: 'TM',
    difficulty: 'leicht',
    description:
      'Erstelle eine Turingmaschine, die eine unäre Zahl (bestehend aus 1en) um 1 erhöht. Die Maschine soll ans Ende der Eingabe fahren und dort eine 1 anfügen.\n\nBeispiel: "1" → "11", "111" → "1111"',
    hint: 'Fahre nach rechts bis zum Blank, schreibe eine 1, und halte an.',
    testCases: [
      { input: '1', expectedAccepted: true, expectedOutput: '11', tmHeadEnd: 'end' },
      { input: '11', expectedAccepted: true, expectedOutput: '111', tmHeadEnd: 'end' },
      { input: '111', expectedAccepted: true, expectedOutput: '1111', tmHeadEnd: 'end' },
    ],
  },
]

// --- FILTER HELPERS ---

export function getExercisesByType(type: AutomatonType | 'ALL'): Exercise[] {
  if (type === 'ALL') return EXERCISES
  return EXERCISES.filter((e) => e.type === type)
}

export function getCompletionStats() {
  const total = EXERCISES.length
  const completed = EXERCISES.filter((e) => completedExercises.value.has(e.id)).length
  return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
}

export function getCompletionStatsByType(type: AutomatonType) {
  const exercises = EXERCISES.filter((e) => e.type === type)
  const total = exercises.length
  const completed = exercises.filter((e) => completedExercises.value.has(e.id)).length
  return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
}
