<!--
  NewAutomatonDialog.vue — Modal dialog for creating a new automaton project.

  The user enters a project name and selects one of the four automaton types
  (DFA, NFA, PDA, TM).  On submit, the project is created via `automatonStore`
  and immediately set as the current project.
-->

<script setup lang="ts">
import { ref } from 'vue'
import { X, AlertCircle } from 'lucide-vue-next'
import { createProject, setCurrentProject } from '@/lib/automatonStore'
import { AUTOMATON_TYPES } from '@/lib/automatonTypes'
import type { AutomatonType } from '@/lib/automatonTypes'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

// ---------------------------------------------------------------------------
// Local form state
// ---------------------------------------------------------------------------

const name = ref('')
const selectedType = ref<AutomatonType>('DFA')
const showError = ref(false)
const errorMessage = ref('')

/** Validates the form and creates the project. */
const handleCreate = () => {
  // Reset error
  showError.value = false
  errorMessage.value = ''

  // Validate
  if (!name.value.trim()) {
    showError.value = true
    errorMessage.value = 'Bitte gib einen Namen ein!'
    return
  }

  // Create project
  const newProject = createProject(name.value.trim(), selectedType.value)
  setCurrentProject(newProject.id)

  // Reset & Close
  name.value = ''
  selectedType.value = 'DFA'
  showError.value = false
  emit('update:open', false)
}

/** Resets form state and closes the dialog. */
const handleClose = () => {
  name.value = ''
  selectedType.value = 'DFA'
  showError.value = false
  errorMessage.value = ''
  emit('update:open', false)
}

/** Clears inline error as soon as the user starts typing again. */
const handleInput = () => {
  if (showError.value) {
    showError.value = false
    errorMessage.value = ''
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    leave-active-class="transition-all duration-150 ease-in"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-[200] flex items-center justify-center p-4"
      @click.self="handleClose"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="handleClose"></div>

      <!-- Dialog -->
      <div
        class="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20"
        >
          <h2 class="text-lg font-bold text-zinc-900 dark:text-zinc-100">Neuer Automat</h2>
          <button @click="handleClose" class="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-black/20 transition-colors">
            <X class="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-4">
          <!-- Name Input -->
          <div>
            <label class="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2"> Name </label>
            <div class="relative">
              <input
                v-model="name"
                @input="handleInput"
                type="text"
                placeholder="z.B. 'Mein DFA'"
                class="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 border-2 rounded-lg outline-none transition-all text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                :class="
                  showError
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/10 focus:border-red-600 focus:bg-red-50 dark:focus:bg-red-900/20 shake'
                    : 'border-zinc-300 dark:border-zinc-700 focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900'
                "
                @keydown.enter="handleCreate"
                autofocus
              />

              <!-- Error Icon -->
              <Transition
                enter-active-class="transition-all duration-200"
                leave-active-class="transition-all duration-150"
                enter-from-class="opacity-0 scale-0"
                enter-to-class="opacity-100 scale-100"
                leave-from-class="opacity-100 scale-100"
                leave-to-class="opacity-0 scale-0"
              >
                <div v-if="showError" class="absolute right-3 top-1/2 -translate-y-1/2">
                  <AlertCircle class="w-5 h-5 text-red-500 dark:text-red-400" />
                </div>
              </Transition>
            </div>

            <!-- Error Message -->
            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              leave-active-class="transition-all duration-150 ease-in"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div
                v-if="showError"
                class="flex items-center gap-2 mt-2 text-xs text-red-600 dark:text-red-400 font-medium"
              >
                <AlertCircle class="w-3.5 h-3.5 flex-shrink-0" />
                <span>{{ errorMessage }}</span>
              </div>
            </Transition>
          </div>

          <!-- Type Selection -->
          <div>
            <label class="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2"> Automatentyp </label>
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="(type, key) in AUTOMATON_TYPES"
                :key="key"
                @click="selectedType = key as AutomatonType"
                class="p-4 rounded-xl border-2 transition-all hover:shadow-md"
                :class="
                  selectedType === key
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500/50'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'
                "
              >
                <div
                  class="font-bold text-sm mb-1"
                  :class="selectedType === key ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-100'"
                >
                  {{ type.shortName }}
                </div>
                <div class="text-xs text-zinc-500 dark:text-zinc-400">
                  {{ type.name }}
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex justify-end gap-3">
          <button
            @click="handleClose"
            class="px-4 py-2 rounded-lg text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            Abbrechen
          </button>
          <button
            @click="handleCreate"
            class="px-6 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-md hover:shadow-lg"
          >
            Erstellen
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Shake Animation for Error */
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-4px);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(4px);
  }
}

.shake {
  animation: shake 0.5s ease-in-out;
}
</style>
