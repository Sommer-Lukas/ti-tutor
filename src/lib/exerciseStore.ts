/**
 * exerciseStore.ts — Reactive store for the “Exercises” (Aufgaben) mode.
 *
 * Manages a catalogue of predefined exercises,
 * exercise-mode navigation state, an isolated workspace (states +
 * transitions) for the exercise being solved, completion tracking, and
 * progress persistence.
 *
 * Key design decisions:
 *  - Exercise workspace is completely isolated from user projects so that
 *    starting/resuming an exercise never mutates the project list.
 *  - A virtual `AutomatonProject` (`exerciseProject`) is exposed as a
 *    computed so that `EditorCanvas` can work with exercises the same way
 *    it works with normal projects.
 *  - Progress (states & transitions) is auto-saved to `localStorage` via
 *    a deep watcher so users can resume where they left off.
 */

import { ref, computed, reactive, watch } from 'vue'
import type { AutomatonType, TMHeadEnd } from './automatonTypes'
import type { State, Transition, AutomatonProject } from './automaton'

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/** A single expected-outcome test case bundled with an exercise. */
export interface ExerciseTestCase {
  input: string
  expectedAccepted: boolean
  expectedOutput?: string
  tmHeadEnd?: TMHeadEnd
}

/** Definition of a single exercise (immutable catalogue entry). */
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

// ---------------------------------------------------------------------------
// Reactive state
// ---------------------------------------------------------------------------

/** `true` when the user has entered exercise mode (browsing or solving). */
export const exerciseModeActive = ref(false)

/** ID of the exercise currently being solved (null when browsing). */
export const activeExerciseId = ref<string | null>(null)

/** `true` when the exercise list is shown; `false` when solving an exercise. */
export const exerciseBrowsing = ref(false)

// -- Isolated exercise workspace (not shared with user projects) -----------

/** States of the automaton the user is building for the current exercise. */
export const exerciseStates = ref<State[]>([])

/** Transitions of the automaton the user is building for the current exercise. */
export const exerciseTransitions = ref<Transition[]>([])

/**
 * Virtual `AutomatonProject` derived from the current exercise workspace.
 * Returned by `automatonStore.currentProject` when exercise mode is active
 * so that `EditorCanvas` can mutate `exerciseStates` / `exerciseTransitions`
 * directly through the project reference.
 */
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
// ---------------------------------------------------------------------------
// Completion tracking (persisted to localStorage)
// ---------------------------------------------------------------------------

const STORAGE_KEY_COMPLETED = 'exercise-completed'
const STORAGE_KEY_PROGRESS_PREFIX = 'exercise-progress-'

/** Set of exercise IDs that the user has successfully completed. */
export const completedExercises = ref<Set<string>>(new Set())

// -- Resume dialog state ---------------------------------------------------

/** Controls visibility of the "Resume or restart?" dialog. */
export const showResumeDialog = ref(false)

/** Exercise ID pending the user’s resume/restart decision. */
export const pendingExerciseId = ref<string | null>(null)

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/** Loads the set of completed exercise IDs from localStorage. */
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

/** Persists the current set of completed exercise IDs. */
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

// -- Exercise progress (states + transitions) persistence -----------------

/** Saves the current exercise workspace to localStorage. */
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

/** Loads previously saved states and transitions for an exercise. */
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

/** Returns `true` if there is saved progress for the given exercise. */
export function hasExerciseProgress(exerciseId: string): boolean {
  return localStorage.getItem(STORAGE_KEY_PROGRESS_PREFIX + exerciseId) !== null
}

// Bootstrap: load completion data on module initialisation.
loadCompletedExercises()

/**
 * Deep watcher that auto-saves exercise progress whenever the user
 * modifies states or transitions in the exercise workspace.
 */
watch(
  [exerciseStates, exerciseTransitions],
  () => {
    if (activeExerciseId.value && !exerciseBrowsing.value) {
      saveExerciseProgress(activeExerciseId.value)
    }
  },
  { deep: true },
)

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

/** The currently active exercise definition (from the catalogue). */
export const activeExercise = computed((): Exercise | null => {
  if (!activeExerciseId.value) return null
  return EXERCISES.find((e) => e.id === activeExerciseId.value) ?? null
})

/** Returns `true` if the user has completed the given exercise. */
export const isExerciseCompleted = (id: string): boolean => {
  return completedExercises.value.has(id)
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Enters exercise mode and shows the exercise list. */
export function enterExerciseMode() {
  exerciseModeActive.value = true
  exerciseBrowsing.value = true
  activeExerciseId.value = null
  exerciseStates.value = []
  exerciseTransitions.value = []
}

/** Leaves exercise mode and returns to the normal project editor. */
export function exitExerciseMode() {
  exerciseModeActive.value = false
  exerciseBrowsing.value = false
  activeExerciseId.value = null
  exerciseStates.value = []
  exerciseTransitions.value = []
}

/**
 * Initiates an exercise.  If saved progress exists a resume dialog is shown;
 * otherwise the exercise starts fresh with a single start state.
 */
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

/** Starts an exercise from scratch, discarding any saved progress. */
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

/** Resumes an exercise from previously saved progress. */
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

/** Closes the resume/restart dialog without starting the exercise. */
export function cancelResumeDialog() {
  showResumeDialog.value = false
  pendingExerciseId.value = null
}

/** Returns to the exercise list, clearing the current workspace. */
export function backToExerciseList() {
  exerciseBrowsing.value = true
  activeExerciseId.value = null
  exerciseStates.value = []
  exerciseTransitions.value = []
}

/** Marks an exercise as completed and persists the change. */
export function markExerciseCompleted(exerciseId: string) {
  completedExercises.value.add(exerciseId)
  // Trigger reactivity by replacing the set
  completedExercises.value = new Set(completedExercises.value)
  saveCompletedExercises()
}

// ---------------------------------------------------------------------------
// Exercise catalogue
// ---------------------------------------------------------------------------

/**
 * Predefined exercises — one per automaton type.  Each entry defines the
 * task description, optional hint, and a set of test cases used for
 * automated grading.
 */
export const EXERCISES: Exercise[] = [
  // ========== DFA ==========
  {
    id: 'dfa-01',
    title: 'Wörter die auf "ab" enden',
    type: 'DFA',
    difficulty: 'leicht',
    description:
      'Erstelle einen DFA über dem Alphabet {a, b}, der genau die Wörter akzeptiert, die auf "ab" enden.\n\nBeispiel: "ab" ✓, "aab" ✓, "bab" ✓, "ba" ✗, "a" ✗',
    hint: '',
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
  {
    id: 'dfa-02',
    title: 'Enthält die Teilkette "XXYZX"',
    type: 'DFA',
    difficulty: 'mittel',
    description:
      'Gegeben ist das Alphabet {X, Y, Z}. Konstruiere einen DFA, der genau die Wörter akzeptiert, die die Zeichenkette "XXYZX" als Teilwort enthalten.',
    hint: '',
    testCases: [
      { input: 'XXYZX', expectedAccepted: true },
      { input: 'ZXXYZX', expectedAccepted: true },
      { input: 'XXYZXX', expectedAccepted: true },
      { input: 'YXXYZXZ', expectedAccepted: true },
      { input: 'XXXYZX', expectedAccepted: true },
      { input: 'XXYZ', expectedAccepted: false },
      { input: 'XXYZZX', expectedAccepted: false },
      { input: 'XYZXX', expectedAccepted: false },
      { input: 'ZZZZ', expectedAccepted: false },
      { input: 'YXXXZXXXYZXX', expectedAccepted: true },
      { input: 'XXZYXXZYX', expectedAccepted: false },
    ],
  },
  {
    id: 'dfa-03',
    title: 'Mindestens dreimal gleich hintereinander',
    type: 'DFA',
    difficulty: 'mittel',
    description:
      'L sei die Sprache aller Wörter über {a, b}, die mindestens ein Zeichen dreimal hintereinander enthalten (also "aaa" oder "bbb" als Teilwort).',
    hint: '', 
    testCases: [
      { input: 'aabbaabababaababbbaba', expectedAccepted: true },
      { input: 'baaaab', expectedAccepted: true },
      { input: 'aaab', expectedAccepted: true },
      { input: 'abbba', expectedAccepted: true },
      { input: 'ababab', expectedAccepted: false },
      { input: 'aabbaa', expectedAccepted: false },
      { input: 'ab', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },
  {
    id: 'dfa-04',
    title: 'Anzahl a ist ungleich 3',
    type: 'DFA',
    difficulty: 'mittel',
    description:
      'Gegeben X = {a, b}. Konstruiere einen DFA für L = { w ∈ X* | |w|a ≠ 3 }.',
    hint: '',
    testCases: [
      { input: '', expectedAccepted: true },
      { input: 'bbb', expectedAccepted: true },
      { input: 'a', expectedAccepted: true },
      { input: 'aa', expectedAccepted: true },
      { input: 'aaaa', expectedAccepted: true },
      { input: 'aaab', expectedAccepted: false },
      { input: 'baaba', expectedAccepted: false },
      { input: 'ababa', expectedAccepted: false },
    ],
  },
  {
    id: 'dfa-05',
    title: 'Genau zwei a und ein b',
    type: 'DFA',
    difficulty: 'mittel',
    description:
      'Gegeben X = {a, b}. Konstruiere einen DFA für L = { w ∈ X* | |w|a = 2 ∧ |w|b = 1 }.',
      hint: '',
    testCases: [
      { input: 'aab', expectedAccepted: true },
      { input: 'aba', expectedAccepted: true },
      { input: 'baa', expectedAccepted: true },
      { input: '', expectedAccepted: false },
      { input: 'aa', expectedAccepted: false },
      { input: 'ab', expectedAccepted: false },
      { input: 'abb', expectedAccepted: false },
      { input: 'aaab', expectedAccepted: false },
    ],
  },
  {
    id: 'dfa-06',
    title: 'Wörter der Form (ab)^n(aabb)^m',
    type: 'DFA',
    difficulty: 'schwer',
    description:
      'Gegeben X = {a, b}. Konstruiere einen DFA für L = { w ∈ X* | w = (ab)^n(aabb)^m mit n, m ∈ ℕ }. Das bedeutet: mindestens ein "ab"-Block gefolgt von mindestens einem "aabb"-Block.',
    hint: '',
    testCases: [
      { input: 'abaabb', expectedAccepted: true },
      { input: 'ababaabb', expectedAccepted: true },
      { input: 'abaabbaabb', expectedAccepted: true },
      { input: 'ababaabbaabb', expectedAccepted: true },
      { input: 'ab', expectedAccepted: false },
      { input: 'aabb', expectedAccepted: false },
      { input: '', expectedAccepted: false },
      { input: 'a', expectedAccepted: false },
      { input: 'abaabbab', expectedAccepted: false },
      { input: 'abaaba', expectedAccepted: false }
    ],
  },
  {
    id: 'dfa-07',
    title: 'Vereinigung: ab^n oder ba^m (n,m≥2)',
    type: 'DFA',
    difficulty: 'mittel',
    description:
      'Gegeben X = {a, b}. Konstruiere einen DFA für L = {ab^n | n ≥ 2} ∪ {ba^m | m ≥ 2}.',
    hint: '',
    testCases: [
      { input: 'abb', expectedAccepted: true },
      { input: 'abbb', expectedAccepted: true },
      { input: 'baa', expectedAccepted: true },
      { input: 'baaa', expectedAccepted: true },
      { input: 'ab', expectedAccepted: false },
      { input: 'ba', expectedAccepted: false },
      { input: 'aab', expectedAccepted: false },
      { input: 'bba', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },
  {
    id: 'dfa-08',
    title: 'Zwischen zwei Einsen mindestens zwei Nullen',
    type: 'DFA',
    difficulty: 'mittel',
    description:
      'Konstruiere einen DFA über {0,1}*, der genau die Wörter akzeptiert, bei denen zwischen zwei Einsen immer mindestens zwei Nullen stehen.',
    hint: '',
    testCases: [
      { input: '', expectedAccepted: true },
      { input: '0', expectedAccepted: true },
      { input: '1', expectedAccepted: true },
      { input: '1001', expectedAccepted: true },
      { input: '10001', expectedAccepted: true },
      { input: '0100100', expectedAccepted: true },
      { input: '11', expectedAccepted: false },
      { input: '101', expectedAccepted: false },
      { input: '1100', expectedAccepted: false },
      { input: '100101', expectedAccepted: false },
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
  {
    id: 'nfa-02',
    title: 'Enthält die Teilkette "XXYZX"',
    type: 'NFA',
    difficulty: 'leicht',
    description:
      'Gegeben ist das Alphabet {X, Y, Z}. Konstruiere einen NFA, der alle Wörter akzeptiert, welche die Zeichenkette XXYZX enthalten.\n\nBeispiel: "XXYZX" ✓, "ZXXYZXY" ✓, "XXYZY" ✗',
    hint: 'Rate nichtdeterministisch, wann die Teilkette XXYZX beginnt. Einmal gefunden, akzeptiere sofort.',
    testCases: [
      { input: 'XXYZX', expectedAccepted: true },
      { input: 'ZXXYZX', expectedAccepted: true },
      { input: 'XXYZXX', expectedAccepted: true },
      { input: 'YXXYZXZ', expectedAccepted: true },
      { input: 'XXYZZXXYZX', expectedAccepted: true },
      { input: '', expectedAccepted: false },
      { input: 'XXYZ', expectedAccepted: false },
      { input: 'XXYZZX', expectedAccepted: false },
      { input: 'XYZXX', expectedAccepted: false },
      { input: 'ZZZZ', expectedAccepted: false },
    ],
  },
  {
    id: 'nfa-03',
    title: 'Beginnt mit "ab" oder endet mit "ba"',
    type: 'NFA',
    difficulty: 'leicht',
    description:
      'Konstruiere einen NFA über {a, b}*, der genau die Wörter akzeptiert, die entweder mit "ab" beginnen ODER mit "ba" enden (oder beides).\n\nBeispiel: "ab" ✓, "aba" ✓, "bba" ✓, "bb" ✗',
    hint: 'Nutze zwei parallele Pfade: einer für den Präfix "ab", einer für das Suffix "ba".',
    testCases: [
      { input: 'ab', expectedAccepted: true },
      { input: 'aba', expectedAccepted: true },
      { input: 'abba', expectedAccepted: true },
      { input: 'bba', expectedAccepted: true },
      { input: 'aaba', expectedAccepted: true },
      { input: '', expectedAccepted: false },
      { input: 'a', expectedAccepted: false },
      { input: 'b', expectedAccepted: false },
      { input: 'ba', expectedAccepted: true },
      { input: 'bb', expectedAccepted: false },
    ],
  },
  {
    id: 'nfa-04',
    title: 'Sprache xⁿyᵐxᵏ mit k mod 3 = 0',
    type: 'NFA',
    difficulty: 'mittel',
    description:
      'Konstruiere einen NFA für L = {xⁿ yᵐ xᵏ | n, m ∈ ℕ, k ∈ ℕ₀ ∧ k mod 3 ≡ 0}.\n\nDas heißt: mindestens ein x, dann mindestens ein y, dann eine durch 3 teilbare Anzahl von x (auch 0 ist erlaubt).\n\nBeispiel: "xy" ✓ (k=0), "xyxxx" ✓ (k=3), "xyx" ✗',
    hint: 'Nach den y\'s zähle die x\'s modulo 3 mit drei Zuständen. Nur der Zustand "0 mod 3" ist akzeptierend.',
    testCases: [
      { input: 'xy', expectedAccepted: true },
      { input: 'xxy', expectedAccepted: true },
      { input: 'xyxxx', expectedAccepted: true },
      { input: 'xxyyxxx', expectedAccepted: true },
      { input: 'xxyxxxxxx', expectedAccepted: true },
      { input: 'xyx', expectedAccepted: false },
      { input: 'xyxx', expectedAccepted: false },
      { input: 'xxyxxxx', expectedAccepted: false },
      { input: '', expectedAccepted: false },
      { input: 'x', expectedAccepted: false },
    ],
  },
  {
    id: 'nfa-05',
    title: 'Drittletztes Zeichen ist "a"',
    type: 'NFA',
    difficulty: 'mittel',
    description:
      'Erstelle einen NFA über {a, b}*, der genau die Wörter mit Länge ≥ 3 akzeptiert, bei denen das drittletzte Zeichen ein "a" ist.\n\nBeispiel: "aaa" ✓, "abb" ✓, "bab" ✗',
    hint: 'Rate nichtdeterministisch, wann das drittletzte Zeichen kommt, und lese dann noch genau 2 Zeichen.',
    testCases: [
      { input: 'aaa', expectedAccepted: true },
      { input: 'aab', expectedAccepted: true },
      { input: 'aba', expectedAccepted: true },
      { input: 'abb', expectedAccepted: true },
      { input: 'baa', expectedAccepted: false },
      { input: 'bab', expectedAccepted: false },
      { input: 'bba', expectedAccepted: false },
      { input: 'bbb', expectedAccepted: false },
      { input: 'aa', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },
  {
    id: 'nfa-06',
    title: 'Enthält "aa" oder "bb", aber nicht beides',
    type: 'NFA',
    difficulty: 'mittel',
    description:
      'Konstruiere einen NFA über {a, b}*, der Wörter akzeptiert, die entweder "aa" ODER "bb" als Teilwort enthalten, aber nicht beide.\n\nBeispiel: "aab" ✓, "bba" ✓, "aabb" ✗',
    hint: 'Verwende getrennte Zweige und verhindere das jeweils andere Muster nach einem Match.',
    testCases: [
      { input: 'aa', expectedAccepted: true },
      { input: 'bb', expectedAccepted: true },
      { input: 'aab', expectedAccepted: true },
      { input: 'bba', expectedAccepted: true },
      { input: 'baab', expectedAccepted: true },
      { input: 'aabb', expectedAccepted: false },
      { input: 'bbaa', expectedAccepted: false },
      { input: 'aabba', expectedAccepted: false },
      { input: 'ab', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },
  {
    id: 'nfa-07',
    title: 'Palindrome der Länge ≤ 5',
    type: 'NFA',
    difficulty: 'schwer',
    description:
      'Erstelle einen NFA über {a, b}, der alle Palindrome (vorwärts = rückwärts) der Länge ≤ 5 akzeptiert.\n\nBeispiel: "aba" ✓, "abba" ✓, "abcba" wäre ✓ wenn "c" im Alphabet wäre, "abc" ✗',
    hint: 'Rate nichtdeterministisch die Mitte des Palindroms und prüfe Symmetrie. Enumere kurze Fälle explizit.',
    testCases: [
      { input: '', expectedAccepted: true },
      { input: 'a', expectedAccepted: true },
      { input: 'b', expectedAccepted: true },
      { input: 'aa', expectedAccepted: true },
      { input: 'aba', expectedAccepted: true },
      { input: 'abba', expectedAccepted: true },
      { input: 'ababa', expectedAccepted: true },
      { input: 'aabaa', expectedAccepted: true },
      { input: 'ab', expectedAccepted: false },
      { input: 'abc', expectedAccepted: false },
      { input: 'abaab', expectedAccepted: false },
      { input: 'abcdef', expectedAccepted: false },
    ],
  },
  {
    id: 'nfa-08',
    title: 'Wörter mit gleichem Präfix und Suffix (Länge 2)',
    type: 'NFA',
    difficulty: 'schwer',
    description:
      'Konstruiere einen NFA über {a, b}, der Wörter akzeptiert, die mit dem gleichen 2-Zeichen-Block beginnen und enden (Länge ≥ 4).\n\nBeispiel: "abXXab" ✓, "aaaa" ✓, "abba" ✗',
    hint: 'Rate nichtdeterministisch den Start-Block und merke ihn. Am Ende prüfe, ob die letzten 2 Zeichen übereinstimmen.',
    testCases: [
      { input: 'aaaa', expectedAccepted: true },
      { input: 'abab', expectedAccepted: true },
      { input: 'ababab', expectedAccepted: true },
      { input: 'aabbaa', expectedAccepted: true },
      { input: 'baaaba', expectedAccepted: true },
      { input: 'abba', expectedAccepted: false },
      { input: 'aab', expectedAccepted: false },
      { input: 'ab', expectedAccepted: false },
      { input: '', expectedAccepted: false },
      { input: 'abc', expectedAccepted: false },
    ],
  },
  {
    id: 'nfa-09',
    title: 'Wörter mit aⁿbⁿ als Teilwort (n≥1)',
    type: 'NFA',
    difficulty: 'schwer',
    description:
      'Erstelle einen NFA über {a, b}, der Wörter akzeptiert, die irgendwo die Struktur aⁿbⁿ (n ≥ 1) als zusammenhängendes Teilwort enthalten.\n\nBeispiel: "ab" ✓, "aabb" ✓, "baabb" ✓, "aabbb" ✗',
    hint: 'Rate den Anfang von aⁿbⁿ nichtdeterministisch, zähle dann a\'s und gleiche sie mit b\'s ab (ε-Übergänge helfen).',
    testCases: [
      { input: 'ab', expectedAccepted: true },
      { input: 'aabb', expectedAccepted: true },
      { input: 'aaabbb', expectedAccepted: true },
      { input: 'baab', expectedAccepted: true },
      { input: 'aabba', expectedAccepted: true },
      { input: 'baaabbbaa', expectedAccepted: true },
      { input: 'aab', expectedAccepted: true },
      { input: 'abb', expectedAccepted: true },
      { input: 'a', expectedAccepted: false },
      { input: '', expectedAccepted: false },
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
  {
    id: 'pda-02',
    title: 'Mindestens so viele b wie a',
    type: 'PDA',
    difficulty: 'leicht',
    description:
      'Erstelle einen PDA für L = {aⁿbᵐ | n, m ∈ ℕ, n ≤ m}. Das heißt, mindestens ein a, mindestens ein b, und mindestens so viele b\'s wie a\'s.\n\nBeispiel: "ab" ✓, "abb" ✓, "aabbb" ✓, "aab" ✗',
    hint: 'Pushe für jedes a, poppe für jedes b. Akzeptiere im Endzustand, wenn noch b\'s kommen oder der Stack leer wurde.',
    pdaConfig: { startStackSymbol: '$' },
    testCases: [
      { input: 'ab', expectedAccepted: true },
      { input: 'abb', expectedAccepted: true },
      { input: 'abbb', expectedAccepted: true },
      { input: 'aabb', expectedAccepted: true },
      { input: 'aabbb', expectedAccepted: true },
      { input: 'aaabbbbb', expectedAccepted: true },
      { input: 'a', expectedAccepted: false },
      { input: 'aab', expectedAccepted: false },
      { input: 'aaabb', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },
  {
    id: 'pda-03',
    title: 'Palindrom mit Mittelmarker',
    type: 'PDA',
    difficulty: 'leicht',
    description:
      'Erstelle einen PDA für L = {wcwᴿ | w ∈ {a,b}*}, wobei wᴿ das Spiegelwort von w ist und c der Mitte-Marker.\n\nBeispiel: "aca" ✓, "abcba" ✓, "aabcbaa" ✓, "abc" ✗',
    hint: 'Pushe alle Zeichen vor c auf den Stack. Nach c poppe und vergleiche mit der Eingabe.',
    pdaConfig: { startStackSymbol: '$' },
    testCases: [
      { input: 'c', expectedAccepted: true },
      { input: 'aca', expectedAccepted: true },
      { input: 'bcb', expectedAccepted: true },
      { input: 'abcba', expectedAccepted: true },
      { input: 'aabcbaa', expectedAccepted: true },
      { input: 'ababcbaba', expectedAccepted: true },
      { input: '', expectedAccepted: false },
      { input: 'abc', expectedAccepted: false },
      { input: 'abcab', expectedAccepted: false },
      { input: 'aa', expectedAccepted: false },
    ],
  },
  {
    id: 'pda-04',
    title: 'Sprache {aⁿbⁿcᵐdᵐ | n, m ∈ ℕ}',
    type: 'PDA',
    difficulty: 'mittel',
    description:
      'Konstruiere einen PDA für L = {aⁿbⁿcᵐdᵐ | n, m ∈ ℕ}. Zwei unabhängige Zählungen: erst aⁿbⁿ, dann cᵐdᵐ.\n\nBeispiel: "abcd" ✓, "aabbcd" ✓, "aabbccdd" ✓, "abc" ✗',
    hint: 'Stack für a\'s nutzen, bei b\'s abbauen. Bei c danach wieder neu aufbauen, bei d\'s wieder abbauen.',
    pdaConfig: { startStackSymbol: '$' },
    testCases: [
      { input: 'abcd', expectedAccepted: true },
      { input: 'aabbcd', expectedAccepted: true },
      { input: 'abccdd', expectedAccepted: true },
      { input: 'aabbccdd', expectedAccepted: true },
      { input: 'aaabbbcccdddd', expectedAccepted: false },
      { input: 'abc', expectedAccepted: false },
      { input: 'aabcd', expectedAccepted: false },
      { input: 'abccd', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },
  {
    id: 'pda-05',
    title: 'Sprache {a²ⁿbⁿ | n ∈ ℕ}',
    type: 'PDA',
    difficulty: 'mittel',
    description:
      'Konstruiere einen PDA für L = {a²ⁿbⁿ | n ∈ ℕ}. Doppelt so viele a\'s wie b\'s (beide mindestens 1).\n\nBeispiel: "aab" ✓, "aaaabb" ✓, "aaaaaabbb" ✓, "ab" ✗',
    hint: 'Pushe nur für jedes zweite a ein Symbol. Poppe dann für jedes b ein Symbol.',
    pdaConfig: { startStackSymbol: '$' },
    testCases: [
      { input: 'aab', expectedAccepted: true },
      { input: 'aaaabb', expectedAccepted: true },
      { input: 'aaaaaabbb', expectedAccepted: true },
      { input: 'aaaaaaaabbbb', expectedAccepted: true },
      { input: 'ab', expectedAccepted: false },
      { input: 'aaab', expectedAccepted: false },
      { input: 'aaabb', expectedAccepted: false },
      { input: 'aabbb', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },
  {
    id: 'pda-06',
    title: 'Sprache {aᵐbⁿ | m > n, m ∈ ℕ, n ∈ ℕ₀}',
    type: 'PDA',
    difficulty: 'mittel',
    description:
      'Konstruiere einen PDA für L = {aᵐbⁿ | m ∈ ℕ, n ∈ ℕ₀, m > n}. Mehr a\'s als b\'s (mindestens ein a, b\'s können fehlen).\n\nBeispiel: "a" ✓, "aa" ✓, "aab" ✓, "aaab" ✓, "ab" ✗',
    hint: 'Pushe für jedes a. Poppe für jedes b. Akzeptiere nur, wenn noch mindestens ein Symbol (außer $) auf dem Stack ist.',
    pdaConfig: { startStackSymbol: '$' },
    testCases: [
      { input: 'a', expectedAccepted: true },
      { input: 'aa', expectedAccepted: true },
      { input: 'aab', expectedAccepted: true },
      { input: 'aaab', expectedAccepted: true },
      { input: 'aaaabb', expectedAccepted: true },
      { input: 'aaaaabbb', expectedAccepted: true },
      { input: 'ab', expectedAccepted: false },
      { input: 'aabb', expectedAccepted: false },
      { input: 'aaabbb', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },
  {
    id: 'pda-07',
    title: 'Sprache {aⁿbᵐcᵐdⁿ | n, m ∈ ℕ}',
    type: 'PDA',
    difficulty: 'schwer',
    description:
      'Konstruiere einen PDA für L = {aⁿbᵐcᵐdⁿ | n, m ∈ ℕ}. Verschachtelte Struktur: äußere n, innere m.\n\nBeispiel: "abcd" ✓, "aabbccdd" ✓, "aaabbbcccddd" ✓, "abdc" ✗',
    hint: 'Pushe für a\'s ein Symbol (z.B. A), für b\'s ein anderes (z.B. B). Bei c poppe B\'s, bei d poppe A\'s.',
    pdaConfig: { startStackSymbol: '$' },
    testCases: [
      { input: 'abcd', expectedAccepted: true },
      { input: 'aabbccdd', expectedAccepted: true },
      { input: 'aaabbbcccddd', expectedAccepted: true },
      { input: 'aaaabbbbccccdddd', expectedAccepted: true },
      { input: 'aabcdd', expectedAccepted: true },
      { input: 'aaabbcccddd', expectedAccepted: false },
      { input: 'abdc', expectedAccepted: false },
      { input: 'abc', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },
  {
    id: 'pda-08',
    title: 'Sprache {aⁿbᵐaⁿ | n, m ∈ ℕ}',
    type: 'PDA',
    difficulty: 'schwer',
    description:
      'Konstruiere einen PDA für L = {aⁿbᵐaⁿ | n, m ∈ ℕ}. Gleich viele a\'s vor und nach beliebig vielen b\'s.\n\nBeispiel: "aba" ✓, "aabaa" ✓, "aabbbbaa" ✓, "abaa" ✗',
    hint: 'Pushe für die ersten a\'s. Bei b\'s nichts tun. Bei den zweiten a\'s poppe und vergleiche.',
    pdaConfig: { startStackSymbol: '$' },
    testCases: [
      { input: 'aba', expectedAccepted: true },
      { input: 'aabaa', expectedAccepted: true },
      { input: 'aabbaa', expectedAccepted: true },
      { input: 'aabbbbaa', expectedAccepted: true },
      { input: 'aaabbaaa', expectedAccepted: true },
      { input: 'ab', expectedAccepted: false },
      { input: 'abaa', expectedAccepted: false },
      { input: 'aaba', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },
  {
    id: 'pda-09',
    title: 'Sprache {aᵐbⁿcⁱ | m + n = i, m ∈ ℕ₀, n, i ∈ ℕ}',
    type: 'PDA',
    difficulty: 'schwer',
    description:
      'Konstruiere einen PDA für L = {aᵐbⁿcⁱ | m ∈ ℕ₀, n, i ∈ ℕ, m + n = i}. Die Anzahl der c\'s muss der Summe von a\'s und b\'s entsprechen.\n\nBeispiel: "bc" ✓, "abc" ✗, "abcc" ✓, "aabbcccc" ✓',
    hint: 'Pushe für jedes a und jedes b ein Symbol. Poppe für jedes c ein Symbol. Akzeptiere bei leerem Stack.',
    pdaConfig: { startStackSymbol: '$' },
    testCases: [
      { input: 'bc', expectedAccepted: true },
      { input: 'bbc', expectedAccepted: false },
      { input: 'abcc', expectedAccepted: true },
      { input: 'aabbcccc', expectedAccepted: true },
      { input: 'aaabbbcccccc', expectedAccepted: true },
      { input: 'abc', expectedAccepted: false },
      { input: 'abccc', expectedAccepted: false },
      { input: 'aabbccc', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },
  {
    id: 'pda-10',
    title: 'Sprache {aⁿbⁱcʲ | n = i + j, i, n ∈ ℕ, j ∈ ℕ₀}',
    type: 'PDA',
    difficulty: 'schwer',
    description:
      'Konstruiere einen PDA für L = {aⁿbⁱcʲ | i, n ∈ ℕ, j ∈ ℕ₀, n = i + j}. Die Anzahl der a\'s muss der Summe von b\'s und c\'s entsprechen.\n\nBeispiel: "ab" ✓, "abc" ✗, "aabbc" ✓, "aaabbc" ✓',
    hint: 'Pushe für jedes a. Poppe für jedes b und jedes c. Mindestens ein b ist Pflicht.',
    pdaConfig: { startStackSymbol: '$' },
    testCases: [
      { input: 'ab', expectedAccepted: true },
      { input: 'aabb', expectedAccepted: true },
      { input: 'aaabbc', expectedAccepted: true },
      { input: 'aaaabbcc', expectedAccepted: true },
      { input: 'aaaaaabbbccc', expectedAccepted: true },
      { input: 'aabbc', expectedAccepted: false },
      { input: 'aaaabbbbcccc', expectedAccepted: false },
      { input: 'abb', expectedAccepted: false },
      { input: 'abc', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },
  {
    id: 'pda-11',
    title: 'Sprache {a²ᵐbⁿcⁿdᵐ | m, n ∈ ℕ}',
    type: 'PDA',
    difficulty: 'schwer',
    description:
      'Konstruiere einen PDA für L = {a²ᵐbⁿcⁿdᵐ | m, n ∈ ℕ}. Verschachtelt mit doppelter a-Zählung.\n\nBeispiel: "aabccd" ✓, "aaaabbccdd" ✓, "abcd" ✗',
    hint: 'Pushe nur bei jedem zweiten a. Pushe für b\'s. Poppe bei c\'s, poppe bei d\'s die a-Symbole.',
    pdaConfig: { startStackSymbol: '$' },
    testCases: [
      { input: 'aabcd', expectedAccepted: true },
      { input: 'aaaabbccdd', expectedAccepted: true },
      { input: 'aaaaaabbbcccddd', expectedAccepted: true },
      { input: 'aabbcc', expectedAccepted: false },
      { input: 'aabbccdd', expectedAccepted: false },
      { input: 'aaaaaabbbbccccdddd', expectedAccepted: false },
      { input: 'abcd', expectedAccepted: false },
      { input: '', expectedAccepted: false },
    ],
  },

  // ========== TM ==========
  {
    id: 'tm-01',
    title: 'Unäres Inkrement',
    type: 'TM',
    difficulty: 'leicht',
    description:
      'Erstelle eine Turingmaschine, die eine Zahl in Unärdarstellung um 1 erhöht. Unärdarstellung: 0=I, 1=II, 2=III, usw.\n\nBeispiel: "II" → "III" (1→2), "IIII" → "IIIII" (3→4)',
    hint: 'Fahre nach rechts bis zum Blank, schreibe ein I, und halte an.',
    testCases: [
      { input: 'I', expectedAccepted: true, expectedOutput: 'II', tmHeadEnd: 'end' },
      { input: 'II', expectedAccepted: true, expectedOutput: 'III', tmHeadEnd: 'end' },
      { input: 'III', expectedAccepted: true, expectedOutput: 'IIII', tmHeadEnd: 'end' },
      { input: 'IIII', expectedAccepted: true, expectedOutput: 'IIIII', tmHeadEnd: 'end' },
    ],
  },
  {
    id: 'tm-02',
    title: 'Transformation aⁿ → b$b^(n-1)',
    type: 'TM',
    difficulty: 'mittel',
    description:
      'Erstelle eine TM, die eine Folge von a\'s transformiert: aⁿ → b$b^(n-1).\n\nBeispiel: "a" → "b$", "aa" → "b$b", "aaa" → "b$bb"',
    hint: 'Ersetze das erste a durch b, schreibe $, dann ersetze die restlichen (n-1) a\'s durch b\'s.',
    testCases: [
      { input: 'a', expectedAccepted: true, expectedOutput: 'b$', tmHeadEnd: 'any' },
      { input: 'aa', expectedAccepted: true, expectedOutput: 'b$b', tmHeadEnd: 'any' },
      { input: 'aaa', expectedAccepted: true, expectedOutput: 'b$bb', tmHeadEnd: 'any' },
      { input: 'aaaa', expectedAccepted: true, expectedOutput: 'b$bbb', tmHeadEnd: 'any' },
    ],
  },
  {
    id: 'tm-03',
    title: 'Längenberechnung in Unär',
    type: 'TM',
    difficulty: 'mittel',
    description:
      'Erstelle eine TM für x ∈ {c, d}*, die die Anzahl |x| in Unärdarstellung berechnet. Nach Durchlauf steht nur die Anzahl auf dem Band (als I\'s) und der Kopf am Anfang. Unärdarstellung: 0=I, 1=II, 2=III.\n\nBeispiel: "cd" → "III" (2 Zeichen), "cdd" → "IIII" (3 Zeichen)',
    hint: 'Ersetze jedes c und d durch I, dann füge ein weiteres I hinzu. Positioniere den Kopf am Anfang.',
    testCases: [
      { input: 'c', expectedAccepted: true, expectedOutput: 'II', tmHeadEnd: 'start' },
      { input: 'd', expectedAccepted: true, expectedOutput: 'II', tmHeadEnd: 'start' },
      { input: 'cd', expectedAccepted: true, expectedOutput: 'III', tmHeadEnd: 'start' },
      { input: 'cdd', expectedAccepted: true, expectedOutput: 'IIII', tmHeadEnd: 'start' },
      { input: 'ccdd', expectedAccepted: true, expectedOutput: 'IIIII', tmHeadEnd: 'start' },
    ],
  },
  {
    id: 'tm-04',
    title: 'Akzeptiere: beginnt mit c, endet mit d',
    type: 'TM',
    difficulty: 'leicht',
    description:
      'Erstelle eine TM für L = {x ∈ {c, d}* | x beginnt mit c und endet mit d}. Die TM soll akzeptieren, falls das Wort diese Eigenschaft hat.\n\nBeispiel: "cd" ✓, "ccd" ✓, "cdd" ✓, "dc" ✗',
    hint: 'Prüfe erstes Zeichen = c, fahre zum letzten Zeichen, prüfe = d.',
    testCases: [
      { input: 'cd', expectedAccepted: true, expectedOutput: 'cd', tmHeadEnd: 'any' },
      { input: 'ccd', expectedAccepted: true, expectedOutput: 'ccd', tmHeadEnd: 'any' },
      { input: 'cdd', expectedAccepted: true, expectedOutput: 'cdd', tmHeadEnd: 'any' },
      { input: 'ccdd', expectedAccepted: true, expectedOutput: 'ccdd', tmHeadEnd: 'any' },
      { input: 'cdcd', expectedAccepted: true, expectedOutput: 'cdcd', tmHeadEnd: 'any' },
      { input: 'c', expectedAccepted: false },
      { input: 'd', expectedAccepted: false },
      { input: 'dc', expectedAccepted: false },
      { input: 'cc', expectedAccepted: false },
    ],
  },
  {
    id: 'tm-05',
    title: 'Verdopple Unärzahl',
    type: 'TM',
    difficulty: 'mittel',
    description:
      'Erstelle eine TM, die eine Zahl in Unärdarstellung verdoppelt. Der Kopf soll am Ende der Ausgabe liegen. Unärdarstellung: 1=II, 2=III, 3=IIII.\n\nBeispiel: "II" → "III" (1→2), "III" → "IIIII" (2→4), "IIII" → "IIIIIII" (3→6)',
    hint: 'Für jedes I füge ein weiteres I ans Ende hinzu. Markiere verarbeitete I\'s (z.B. mit X).',
    testCases: [
      { input: 'II', expectedAccepted: true, expectedOutput: 'III', tmHeadEnd: 'end' },
      { input: 'III', expectedAccepted: true, expectedOutput: 'IIIII', tmHeadEnd: 'end' },
      { input: 'IIII', expectedAccepted: true, expectedOutput: 'IIIIIII', tmHeadEnd: 'end' },
      { input: 'IIIII', expectedAccepted: true, expectedOutput: 'IIIIIIIII', tmHeadEnd: 'end' },
    ],
  },
  {
    id: 'tm-06',
    title: 'Binär-Inkrement',
    type: 'TM',
    difficulty: 'schwer',
    description:
      'Erstelle eine TM, die eine Binärzahl um 1 erhöht (mit Übertrag). Die Zahl wird von links nach rechts gelesen.\n\nBeispiel: "1" → "10", "10" → "11", "11" → "100", "101" → "110"',
    hint: 'Fahre ans Ende, addiere 1 mit Übertrag von rechts nach links (0→1, 1→0 mit Carry).',
    testCases: [
      { input: '1', expectedAccepted: true, expectedOutput: '10', tmHeadEnd: 'any' },
      { input: '10', expectedAccepted: true, expectedOutput: '11', tmHeadEnd: 'any' },
      { input: '11', expectedAccepted: true, expectedOutput: '100', tmHeadEnd: 'any' },
      { input: '101', expectedAccepted: true, expectedOutput: '110', tmHeadEnd: 'any' },
      { input: '111', expectedAccepted: true, expectedOutput: '1000', tmHeadEnd: 'any' },
    ],
  },
  {
    id: 'tm-07',
    title: 'Palindrom-Prüfung',
    type: 'TM',
    difficulty: 'schwer',
    description:
      'Erstelle eine TM über {a, b}, die prüft, ob die Eingabe ein Palindrom ist (vorwärts = rückwärts).\n\nBeispiel: "aba" ✓, "abba" ✓, "aab" ✗',
    hint: 'Markiere und vergleiche äußere Zeichen von beiden Enden, arbeite dich zur Mitte vor.',
    testCases: [
      { input: 'a', expectedAccepted: true, expectedOutput: 'a', tmHeadEnd: 'any' },
      { input: 'aa', expectedAccepted: true, expectedOutput: 'aa', tmHeadEnd: 'any' },
      { input: 'aba', expectedAccepted: true, expectedOutput: 'aba', tmHeadEnd: 'any' },
      { input: 'abba', expectedAccepted: true, expectedOutput: 'abba', tmHeadEnd: 'any' },
      { input: 'ababa', expectedAccepted: true, expectedOutput: 'ababa', tmHeadEnd: 'any' },
      { input: 'ab', expectedAccepted: false },
      { input: 'aab', expectedAccepted: false },
      { input: 'abc', expectedAccepted: false },
    ],
  },
  {
    id: 'tm-08',
    title: 'Unär-Subtraktion (n - 1)',
    type: 'TM',
    difficulty: 'leicht',
    description:
      'Erstelle eine TM, die eine Zahl in Unärdarstellung um 1 verringert (Dekrement). Unärdarstellung: 0=I, 1=II, 2=III.\n\nBeispiel: "III" → "II" (2→1), "IIII" → "III" (3→2), "II" → "I" (1→0)',
    hint: 'Lösche einfach das letzte I.',
    testCases: [
      { input: 'II', expectedAccepted: true, expectedOutput: 'I', tmHeadEnd: 'any' },
      { input: 'III', expectedAccepted: true, expectedOutput: 'II', tmHeadEnd: 'any' },
      { input: 'IIII', expectedAccepted: true, expectedOutput: 'III', tmHeadEnd: 'any' },
      { input: 'IIIII', expectedAccepted: true, expectedOutput: 'IIII', tmHeadEnd: 'any' },
    ],
  },
  {
    id: 'tm-09',
    title: 'Kopiere Wort (x → xx)',
    type: 'TM',
    difficulty: 'schwer',
    description:
      'Erstelle eine TM über {a, b}, die das Eingabewort verdoppelt: x → xx.\n\nBeispiel: "a" → "aa", "ab" → "abab", "aba" → "abaaba"',
    hint: 'Markiere jedes Zeichen, kopiere es ans Ende. Verwende Hilfszeichen zur Markierung.',
    testCases: [
      { input: 'a', expectedAccepted: true, expectedOutput: 'aa', tmHeadEnd: 'any' },
      { input: 'b', expectedAccepted: true, expectedOutput: 'bb', tmHeadEnd: 'any' },
      { input: 'ab', expectedAccepted: true, expectedOutput: 'abab', tmHeadEnd: 'any' },
      { input: 'aba', expectedAccepted: true, expectedOutput: 'abaaba', tmHeadEnd: 'any' },
      { input: 'abba', expectedAccepted: true, expectedOutput: 'abbaabba', tmHeadEnd: 'any' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Filter & statistics helpers
// ---------------------------------------------------------------------------

/** Returns exercises filtered by automaton type (or all if 'ALL'). */
export function getExercisesByType(type: AutomatonType | 'ALL'): Exercise[] {
  if (type === 'ALL') return EXERCISES
  return EXERCISES.filter((e) => e.type === type)
}

/** Returns overall completion statistics (total, completed, percentage). */
export function getCompletionStats() {
  const total = EXERCISES.length
  const completed = EXERCISES.filter((e) => completedExercises.value.has(e.id)).length
  return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
}

/** Returns completion statistics scoped to a single automaton type. */
export function getCompletionStatsByType(type: AutomatonType) {
  const exercises = EXERCISES.filter((e) => e.type === type)
  const total = exercises.length
  const completed = exercises.filter((e) => completedExercises.value.has(e.id)).length
  return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
}
