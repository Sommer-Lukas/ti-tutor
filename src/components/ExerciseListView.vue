<!--
  ExerciseListView.vue — Full-screen exercise browsing view.

  Displays a filterable catalogue of exercises with completion status,
  difficulty badges, and a resume-or-restart dialog for exercises that
  have saved progress.
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  BookOpen,
  ArrowLeft,
  CheckCircle2,
  Minus,
  Filter,
  Star,
  Zap,
  Flame,
  Sparkles,
  RotateCcw,
  FolderOpen,
  X,
} from 'lucide-vue-next'
import {
  EXERCISES,
  getExercisesByType,
  getCompletionStatsByType,
  isExerciseCompleted,
  exitExerciseMode,
  startExercise,
  showResumeDialog,
  pendingExerciseId,
  beginExerciseFresh,
  resumeExercise,
  cancelResumeDialog,
} from '@/lib/exerciseStore'
import { AUTOMATON_TYPES } from '@/lib/automatonTypes'
import type { AutomatonType } from '@/lib/automatonTypes'
import type { Exercise } from '@/lib/exerciseStore'

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

/** Currently selected automaton-type filter (ALL shows every exercise). */
const selectedFilter = ref<AutomatonType | 'ALL'>('ALL')

/** Completion-status filter: ALL, COMPLETED, or INCOMPLETE. */
const selectedCompletionFilter = ref<'ALL' | 'COMPLETED' | 'INCOMPLETE'>('ALL')

/** Exercises matching both the type and completion filters. */
const filteredExercises = computed(() => {
  let exercises = getExercisesByType(selectedFilter.value)
  if (selectedCompletionFilter.value === 'COMPLETED') {
    exercises = exercises.filter((e) => isExerciseCompleted(e.id))
  } else if (selectedCompletionFilter.value === 'INCOMPLETE') {
    exercises = exercises.filter((e) => !isExerciseCompleted(e.id))
  }
  return exercises
})

// ---------------------------------------------------------------------------
// Filter definitions for the template pill buttons
// ---------------------------------------------------------------------------

const filters: Array<{ value: AutomatonType | 'ALL'; label: string; color: string }> = [
  { value: 'ALL', label: 'Alle', color: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700' },
  { value: 'DFA', label: 'DEA', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50' },
  { value: 'NFA', label: 'NEA', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50' },
  { value: 'PDA', label: 'PDA', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50' },
  { value: 'TM', label: 'TM', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50' },
]

const completionFilters: Array<{ value: 'ALL' | 'COMPLETED' | 'INCOMPLETE'; label: string; color: string }> = [
  { value: 'ALL', label: 'Alle', color: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700' },
  { value: 'INCOMPLETE', label: 'Nicht abgeschlossen', color: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50' },
  { value: 'COMPLETED', label: 'Abgeschlossen', color: 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50' },
]

// ---------------------------------------------------------------------------
// Helpers for difficulty rendering
// ---------------------------------------------------------------------------

/** Maps a difficulty level to the corresponding lucide icon component. */
const getDifficultyIcon = (difficulty: Exercise['difficulty']) => {
  switch (difficulty) {
    case 'leicht':
      return Star
    case 'mittel':
      return Zap
    case 'schwer':
      return Flame
  }
}

/** Returns Tailwind classes for the difficulty badge. */
const getDifficultyColor = (difficulty: Exercise['difficulty']) => {
  switch (difficulty) {
    case 'leicht':
      return 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400'
    case 'mittel':
      return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'schwer':
      return 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400'
  }
}

/** Returns Tailwind classes for the automaton-type badge. */
const getTypeBadgeColor = (type: AutomatonType) => {
  switch (type) {
    case 'DFA':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    case 'NFA':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    case 'PDA':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'TM':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 overflow-hidden">
    <!-- Hero Header -->
    <div class="bg-indigo-600 dark:bg-indigo-900 text-white px-8 py-6 flex-shrink-0 relative">
      <button
        @click="exitExerciseMode"
        class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-sm font-medium"
      >
        <ArrowLeft class="w-4 h-4" />
        <span class="hidden sm:inline">Zurück</span>
      </button>
      <div class="max-w-4xl mx-auto">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <BookOpen class="w-6 h-6" />
          </div>
          <div>
            <h1 class="text-2xl font-bold">Aufgaben</h1>
            <p class="text-indigo-200 text-sm">Lerne durch praktische Übungen</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="px-8 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">
      <div class="max-w-4xl mx-auto space-y-3">
        <!-- Automaton Type Filters -->
        <div class="flex items-center gap-2 flex-wrap">
          <Filter class="w-4 h-4 text-zinc-400 mr-1" />
          <button
            v-for="filter in filters"
            :key="filter.value"
            @click="selectedFilter = filter.value"
            class="px-4 py-2 rounded-full text-xs font-bold transition-all border-2"
            :class="
              selectedFilter === filter.value
                ? filter.color + ' border-current shadow-sm scale-105'
                : 'bg-white text-zinc-400 border-transparent hover:text-zinc-600 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300'
            "
          >
            {{ filter.label }}
            <span v-if="filter.value !== 'ALL'" class="ml-1 opacity-70">
              ({{ getCompletionStatsByType(filter.value as AutomatonType).completed }}/{{ getCompletionStatsByType(filter.value as AutomatonType).total }})
            </span>
          </button>
        </div>
        <!-- Completion Status Filters -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-semibold text-zinc-400 mr-1">Status:</span>
          <button
            v-for="filter in completionFilters"
            :key="filter.value"
            @click="selectedCompletionFilter = filter.value"
            class="px-4 py-2 rounded-full text-xs font-bold transition-all border-2"
            :class="
              selectedCompletionFilter === filter.value
                ? filter.color + ' border-current shadow-sm scale-105'
                : 'bg-white text-zinc-400 border-transparent hover:text-zinc-600 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300'
            "
          >
            {{ filter.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Exercise List -->
    <div class="flex-1 overflow-y-auto px-8 py-6">
      <div class="max-w-4xl mx-auto space-y-3">
        <div
          v-for="exercise in filteredExercises"
          :key="exercise.id"
          @click="startExercise(exercise.id)"
          class="group relative bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden"
        >
          <!-- Completed Glow -->
          <div
            v-if="isExerciseCompleted(exercise.id)"
            class="absolute inset-0 bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/20 pointer-events-none"
          ></div>

          <div class="relative flex items-center gap-4 px-5 py-4">
            <!-- Completion Status -->
            <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              :class="isExerciseCompleted(exercise.id) ? 'bg-green-100 dark:bg-green-900/30' : 'bg-zinc-100 dark:bg-zinc-900/50'"
            >
              <CheckCircle2
                v-if="isExerciseCompleted(exercise.id)"
                class="w-6 h-6 text-green-500 dark:text-green-400"
              />
              <Minus v-else class="w-5 h-5 text-zinc-300 dark:text-zinc-600" />
            </div>

            <!-- Exercise Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                  {{ exercise.title }}
                </h3>
              </div>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                {{ exercise.description.split('\n')[0] }}
              </p>
            </div>

            <!-- Badges -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <!-- Type Badge -->
              <span
                class="px-2.5 py-1 rounded-full text-[10px] font-bold"
                :class="getTypeBadgeColor(exercise.type)"
              >
                {{ AUTOMATON_TYPES[exercise.type].shortName }}
              </span>

              <!-- Difficulty Badge -->
              <span
                class="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                :class="getDifficultyColor(exercise.difficulty)"
              >
                <component :is="getDifficultyIcon(exercise.difficulty)" class="w-3 h-3" />
                {{ exercise.difficulty }}
              </span>

              <!-- Test Case Count -->
              <span class="px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold">
                {{ exercise.testCases.length }} Tests
              </span>
            </div>

            <!-- Arrow -->
            <svg class="w-5 h-5 text-zinc-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="filteredExercises.length === 0" class="text-center py-16">
          <Sparkles class="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <p class="text-zinc-500 text-sm">Keine Aufgaben für diesen Filter gefunden.</p>
        </div>
      </div>
    </div>

    <!-- Resume / Restart Dialog -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showResumeDialog && pendingExerciseId"
        class="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="cancelResumeDialog"
      >
        <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-8 max-w-sm w-full text-center relative">
          <button
            @click="cancelResumeDialog"
            class="absolute top-4 right-4 p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
          <div class="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
            <FolderOpen class="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 class="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">Gespeicherter Fortschritt</h2>
          <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Es gibt einen gespeicherten Stand für diese Aufgabe. Möchtest du fortfahren oder neu starten?</p>
          <div class="flex gap-3">
            <button
              @click="beginExerciseFresh(pendingExerciseId!)"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-semibold transition-colors"
            >
              <RotateCcw class="w-4 h-4" />
              Neu starten
            </button>
            <button
              @click="resumeExercise(pendingExerciseId!)"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <FolderOpen class="w-4 h-4" />
              Fortsetzen
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
