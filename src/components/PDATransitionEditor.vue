<!--
  PDATransitionEditor.vue — Modal editor for PDA (pushdown automaton)
  transitions.

  Provides two input modes:
   1. Quick-input: a single text field using the compact
      `input,stackTop/stackPush` notation.
   2. Advanced mode: individual fields for input symbol, stack-top
      and stack-push, with real-time validation.

  Includes a live preview, quick templates, and epsilon shortcuts.
-->

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, AlertCircle, Zap, ChevronDown, ChevronUp, CheckCircle, XCircle, Settings } from 'lucide-vue-next'
import type { Transition } from '@/lib/automaton'

const props = defineProps<{
  visible: boolean
  transition: Transition | null
}>()

const emit = defineEmits<{
  close: []
  save: [transition: { pdaInput: string; pdaStackTop: string; pdaStackPush: string }]
}>()

// ---------------------------------------------------------------------------
// Local form state
// ---------------------------------------------------------------------------

const input = ref('')
const stackTop = ref('')
const stackPush = ref('')

/** Quick-input text field value (compact notation). */
const quickInput = ref('')
const showAdvancedMode = ref(false)

// -- Per-field validation errors -------------------------------------------
const inputError = ref('')
const stackTopError = ref('')
const stackPushError = ref('')
const quickInputError = ref('')

const clearAllErrors = () => {
  inputError.value = ''
  stackTopError.value = ''
  stackPushError.value = ''
  quickInputError.value = ''
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Validates a single-character input or stack-top symbol. */
const validateSingleChar = (value: string): { valid: boolean; error: string; cleaned: string } => {
  // Remove all whitespace
  const trimmed = value.trim()

  // Check for whitespace in middle
  if (value !== trimmed && value.length > 0) {
    return { valid: false, error: 'Keine Leerzeichen erlaubt', cleaned: trimmed }
  }

  // Empty or epsilon is valid
  if (trimmed === '' || trimmed === 'ε') {
    return { valid: true, error: '', cleaned: trimmed }
  }

  // Must be exactly 1 character
  if (trimmed.length > 1) {
    return { valid: false, error: 'Max. 1 Zeichen', cleaned: trimmed.charAt(0) }
  }

  // No whitespace allowed
  if (/\s/.test(trimmed)) {
    return { valid: false, error: 'Keine Leerzeichen', cleaned: trimmed.replace(/\s/g, '') }
  }

  return { valid: true, error: '', cleaned: trimmed }
}

/** Validates the stack-push string (multi-character allowed). */
const validateStackPush = (value: string): { valid: boolean; error: string; cleaned: string } => {
  // Remove leading/trailing whitespace
  const trimmed = value.trim()

  // Check for whitespace
  if (value !== trimmed && value.length > 0) {
    return { valid: false, error: 'Keine Leerzeichen am Rand', cleaned: trimmed }
  }

  // Check for whitespace in middle
  if (/\s/.test(trimmed)) {
    return { valid: false, error: 'Keine Leerzeichen erlaubt', cleaned: trimmed.replace(/\s/g, '') }
  }

  // Empty or epsilon is valid
  if (trimmed === '' || trimmed === 'ε') {
    return { valid: true, error: '', cleaned: trimmed }
  }

  return { valid: true, error: '', cleaned: trimmed }
}

// ---------------------------------------------------------------------------
// Watchers: Sync transition → form on open, validate fields live
// ---------------------------------------------------------------------------

/** Load values from the existing transition into the form fields. */
watch(
  () => props.transition,
  (newTransition) => {
    if (newTransition) {
      input.value = newTransition.pdaInput || ''
      stackTop.value = newTransition.pdaStackTop || ''
      stackPush.value = newTransition.pdaStackPush || ''

      // Build quick input from existing values
      const i = input.value || 'ε'
      const s = stackTop.value || 'ε'
      const p = stackPush.value || 'ε'
      quickInput.value = `${i},${s}/${p}`

      // Clear errors
      clearAllErrors()
    } else {
      // Reset when closing
      input.value = ''
      stackTop.value = ''
      stackPush.value = ''
      quickInput.value = ''
      clearAllErrors()
    }
  },
  { immediate: true },
)

// -- Real-time validation per field (auto-corrects after 500 ms) ----------
watch(input, (newValue) => {
  const result = validateSingleChar(newValue)
  inputError.value = result.error

  // Auto-correct after 500ms
  if (!result.valid) {
    setTimeout(() => {
      input.value = result.cleaned
      inputError.value = ''
    }, 500)
  }
})

watch(stackTop, (newValue) => {
  const result = validateSingleChar(newValue)
  stackTopError.value = result.error

  // Auto-correct after 500ms
  if (!result.valid) {
    setTimeout(() => {
      stackTop.value = result.cleaned
      stackTopError.value = ''
    }, 500)
  }
})

watch(stackPush, (newValue) => {
  const result = validateStackPush(newValue)
  stackPushError.value = result.error

  // Auto-correct after 500ms
  if (!result.valid) {
    setTimeout(() => {
      stackPush.value = result.cleaned
      stackPushError.value = ''
    }, 500)
  }
})

/**
 * Parses the compact quick-input notation (e.g. "a,$/aa") into the three
 * individual fields.  Runs on every keystroke via watcher.
 */
const parseQuickInput = (value: string) => {
  // Format: input,stackTop/stackPush
  // Examples: "a,$/aa", "ε,a/", "b,$/ba$", "a,e/aa"

  quickInputError.value = ''

  // NO AUTO-REPLACE for 'e' - it stays as 'e'

  // Check for invalid characters (whitespace)
  if (/\s/.test(value)) {
    quickInputError.value = '⚠️ Keine Leerzeichen erlaubt'
    // Auto-remove whitespace after 500ms
    setTimeout(() => {
      quickInput.value = value.replace(/\s/g, '')
    }, 500)
    return
  }

  // Split by '/'
  const parts = value.split('/')

  // Check if format is correct
  if (parts.length > 2) {
    quickInputError.value = '⚠️ Zu viele "/" Zeichen'
    return
  }

  const leftSide = parts[0] || ''
  const rightSide = parts[1] || ''

  // Split left side by ','
  const leftParts = leftSide.split(',')

  // Check if format is correct
  if (leftParts.length > 2) {
    quickInputError.value = '⚠️ Zu viele "," Zeichen'
    return
  }

  let inputSymbol = leftParts[0] || ''
  let stackTopSymbol = leftParts[1] || ''

  // VALIDATION: Max 1 character for input and stackTop (except ε)
  if (inputSymbol.length > 1 && inputSymbol !== 'ε') {
    quickInputError.value = `⚠️ Input zu lang: "${inputSymbol}"`
    inputSymbol = inputSymbol.charAt(0)
  }

  if (stackTopSymbol.length > 1 && stackTopSymbol !== 'ε') {
    quickInputError.value = `⚠️ Stack Top zu lang: "${stackTopSymbol}"`
    stackTopSymbol = stackTopSymbol.charAt(0)
  }

  // Set values (OPTION 2):
  // - Empty string = epsilon (empty in store)
  // - "ε" explicitly = epsilon (empty in store)
  // - Any other character (including "e") = that character
  input.value = inputSymbol === 'ε' || inputSymbol === '' ? '' : inputSymbol
  stackTop.value = stackTopSymbol === 'ε' || stackTopSymbol === '' ? '' : stackTopSymbol
  stackPush.value = rightSide === 'ε' || rightSide === '' ? '' : rightSide
}

watch(quickInput, (newValue) => {
  parseQuickInput(newValue)
})

// ---------------------------------------------------------------------------
// Computed: preview + validation status
// ---------------------------------------------------------------------------

/** Human-readable preview string shown in the modal footer. */
const preview = computed(() => {
  const i = input.value || 'ε'
  const s = stackTop.value || 'ε'
  const p = stackPush.value || 'ε'
  return `(${i},${s}) / ${p}`
})

/** True when the form has no errors and at least one field is filled. */
const isValid = computed(() => {
  // No errors
  if (inputError.value || stackTopError.value || stackPushError.value || quickInputError.value) {
    return false
  }

  // At least one field must be filled
  return input.value.length > 0 || stackTop.value.length > 0 || stackPush.value.length > 0
})

// -- Per-field validation icons -------------------------------------------
const inputStatus = computed(() => {
  if (inputError.value) return 'error'
  if (input.value.length > 0) return 'success'
  return 'neutral'
})

const stackTopStatus = computed(() => {
  if (stackTopError.value) return 'error'
  if (stackTop.value.length > 0) return 'success'
  return 'neutral'
})

const stackPushStatus = computed(() => {
  if (stackPushError.value) return 'error'
  if (stackPush.value.length > 0) return 'success'
  return 'neutral'
})

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Emits the final PDA transition data and closes the modal. */
const handleSave = () => {
  if (!isValid.value) return

  emit('save', {
    pdaInput: input.value.trim(),
    pdaStackTop: stackTop.value.trim(),
    pdaStackPush: stackPush.value.trim(),
  })
  emit('close')
}

const handleClose = () => {
  emit('close')
}

/** Inserts the ε symbol into one of the three fields. */
const insertEpsilon = (field: 'input' | 'stackTop' | 'stackPush') => {
  if (field === 'input') input.value = 'ε'
  else if (field === 'stackTop') stackTop.value = 'ε'
  else stackPush.value = 'ε'
}

/** Clears a field and its error state. */
const clearField = (field: 'input' | 'stackTop' | 'stackPush') => {
  if (field === 'input') {
    input.value = ''
    inputError.value = ''
  } else if (field === 'stackTop') {
    stackTop.value = ''
    stackTopError.value = ''
  } else {
    stackPush.value = ''
    stackPushError.value = ''
  }
}

/** Pre-fills the quick-input field with a template string. */
const applyTemplate = (template: string) => {
  quickInput.value = template
}

// -- Keyboard shortcuts (ESC → close, Ctrl+Enter → save) ------------------
const handleKeyDown = (e: KeyboardEvent) => {
  if (!props.visible) return

  if (e.key === 'Escape') {
    handleClose()
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    handleSave()
  }
}

// Register / unregister global keyboard listener when visibility changes.
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      window.addEventListener('keydown', handleKeyDown)
    } else {
      window.removeEventListener('keydown', handleKeyDown)
    }
  },
)
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
      v-if="visible"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      @click.self="handleClose"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="handleClose"></div>

      <!-- Modal Content -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 scale-95 translate-y-4"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-95 translate-y-4"
      >
        <div
          v-if="visible"
          class="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xl shadow-lg"
              >
                <Settings class="w-5 h-5" />
              </div>
              <div>
                <h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100">PDA Transition Editor</h2>
                <p class="text-xs text-zinc-600 dark:text-zinc-400">
                  Format:
                  <code class="bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded font-mono text-emerald-700 dark:text-emerald-400"
                    >(input, stackTop) / stackPush</code
                  >
                </p>
              </div>
            </div>
            <button
              @click="handleClose"
              class="p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors group"
            >
              <X class="w-5 h-5 text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-6 space-y-5">
            <!-- QUICK INPUT MODE (POWER USER) -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Zap class="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                  <label class="text-sm font-bold text-emerald-700 dark:text-emerald-500"> Quick Input </label>
                </div>
                <span class="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full font-mono">
                  Format: a,$/aa
                </span>
              </div>

              <div class="relative">
                <input
                  v-model="quickInput"
                  type="text"
                  placeholder="z.B. a,$/aa"
                  autofocus
                  class="w-full px-4 py-3 border-2 rounded-lg focus:ring-4 focus:outline-none font-mono text-xl transition-all shadow-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  :class="[
                    quickInputError
                      ? 'border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-900/10 focus:border-red-500'
                      : 'border-emerald-300 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-900/10 focus:border-emerald-500 focus:ring-emerald-200 dark:focus:ring-emerald-900/30',
                  ]"
                />
                <!-- Validation Badge -->
                <div v-if="quickInputError" class="absolute right-3 top-1/2 -translate-y-1/2">
                  <XCircle class="w-5 h-5 text-red-500" />
                </div>
                <div
                  v-else-if="quickInput.length > 0"
                  class="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <CheckCircle class="w-5 h-5 text-emerald-500" />
                </div>
              </div>

              <!-- Error Message -->
              <div
                v-if="quickInputError"
                class="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/50 flex items-start gap-2 animate-shake"
              >
                <AlertCircle class="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <p class="text-xs text-red-900 dark:text-red-300">
                  {{ quickInputError }}
                </p>
              </div>

              <!-- Quick Templates -->
              <div class="flex gap-2 flex-wrap">
                <button
                  @click="applyTemplate('a,$/aa')"
                  class="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded text-xs font-mono text-zinc-700 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  a,$/aa
                </button>
                <button
                  @click="applyTemplate('ε,a/ε')"
                  class="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded text-xs font-mono text-zinc-700 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  ε,a/ε
                </button>
                <button
                  @click="applyTemplate('b,$/ba$')"
                  class="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded text-xs font-mono text-zinc-700 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  b,$/ba$
                </button>
                <button
                  @click="quickInput = ''; clearAllErrors()"
                  class="px-2 py-1 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded text-xs font-mono text-red-600 dark:text-red-400 transition-colors"
                >
                  Clear
                </button>
              </div>

              <p class="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <AlertCircle class="w-3 h-3" />
                Verwende ε-Symbol für Epsilon • Keine Leerzeichen • Max 1 Zeichen für Input/StackTop
              </p>
            </div>

            <!-- Separator -->
            <div class="border-t border-zinc-200 dark:border-zinc-800 relative">
              <button
                @click="showAdvancedMode = !showAdvancedMode"
                class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors flex items-center gap-1"
              >
                <component :is="showAdvancedMode ? ChevronUp : ChevronDown" class="w-3 h-3" />
                {{ showAdvancedMode ? 'Erweitert ausblenden' : 'Erweitert anzeigen' }}
              </button>
            </div>

            <!-- ADVANCED MODE (BEGINNER FRIENDLY) -->
            <Transition
              enter-active-class="transition-all duration-300 ease-out"
              leave-active-class="transition-all duration-200 ease-in"
              enter-from-class="opacity-0 -translate-y-4 scale-95"
              enter-to-class="opacity-100 translate-y-0 scale-100"
              leave-from-class="opacity-100 translate-y-0 scale-100"
              leave-to-class="opacity-0 -translate-y-4 scale-95"
            >
              <div v-if="showAdvancedMode" class="space-y-4 pt-4">
                <!-- Input Symbol -->
                <div class="space-y-2">
                  <label class="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    Input Symbol
                    <span class="text-zinc-400 dark:text-zinc-500 font-normal">(von Band gelesen)</span>
                    <component
                      :is="
                        inputStatus === 'success'
                          ? CheckCircle
                          : inputStatus === 'error'
                            ? XCircle
                            : null
                      "
                      :class="[
                        'w-4 h-4',
                        inputStatus === 'success' ? 'text-emerald-500' : 'text-red-500',
                      ]"
                      v-if="inputStatus !== 'neutral'"
                    />
                  </label>
                  <div class="flex gap-2">
                    <input
                      v-model="input"
                      type="text"
                      maxlength="1"
                      placeholder="z.B. a"
                      class="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-2 rounded-lg focus:ring-2 focus:outline-none font-mono text-lg transition-all"
                      :class="[
                        inputError
                          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 focus:border-red-500'
                          : input.length > 0
                            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-300 dark:border-emerald-700 focus:border-emerald-500'
                            : 'border-zinc-200 dark:border-zinc-700 focus:border-emerald-500',
                      ]"
                    />
                    <button
                      @click="insertEpsilon('input')"
                      class="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg font-bold text-zinc-700 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors border-2 border-transparent hover:border-emerald-300 dark:hover:border-emerald-700"
                    >
                      ε
                    </button>
                    <button
                      v-if="input.length > 0"
                      @click="clearField('input')"
                      class="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                    >
                      <X class="w-5 h-5" />
                    </button>
                  </div>
                  <p v-if="inputError" class="text-xs text-red-600 dark:text-red-400 font-semibold animate-shake">
                    {{ inputError }}
                  </p>
                  <p v-else class="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <AlertCircle class="w-3 h-3" />
                    Max. 1 Zeichen oder ε (Epsilon)
                  </p>
                </div>

                <!-- Stack Top -->
                <div class="space-y-2">
                  <label class="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    Stack Top
                    <span class="text-zinc-400 dark:text-zinc-500 font-normal">(muss oben im Keller sein)</span>
                    <component
                      :is="
                        stackTopStatus === 'success'
                          ? CheckCircle
                          : stackTopStatus === 'error'
                            ? XCircle
                            : null
                      "
                      :class="[
                        'w-4 h-4',
                        stackTopStatus === 'success' ? 'text-purple-500' : 'text-red-500',
                      ]"
                      v-if="stackTopStatus !== 'neutral'"
                    />
                  </label>
                  <div class="flex gap-2">
                    <input
                      v-model="stackTop"
                      type="text"
                      maxlength="1"
                      placeholder="z.B. $"
                      class="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-2 rounded-lg focus:ring-2 focus:outline-none font-mono text-lg transition-all"
                      :class="[
                        stackTopError
                          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 focus:border-red-500'
                          : stackTop.length > 0
                            ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-300 dark:border-purple-700 focus:border-purple-500'
                            : 'border-zinc-200 dark:border-zinc-700 focus:border-emerald-500',
                      ]"
                    />
                    <button
                      @click="insertEpsilon('stackTop')"
                      class="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg font-bold text-zinc-700 dark:text-zinc-300 hover:text-purple-700 dark:hover:text-purple-400 transition-colors border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-700"
                    >
                      ε
                    </button>
                    <button
                      v-if="stackTop.length > 0"
                      @click="clearField('stackTop')"
                      class="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                    >
                      <X class="w-5 h-5" />
                    </button>
                  </div>
                  <p v-if="stackTopError" class="text-xs text-red-600 dark:text-red-400 font-semibold animate-shake">
                    {{ stackTopError }}
                  </p>
                  <p v-else class="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <AlertCircle class="w-3 h-3" />
                    Max. 1 Zeichen oder ε
                  </p>
                </div>

                <!-- Stack Push -->
                <div class="space-y-2">
                  <label class="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    Stack Push
                    <span class="text-zinc-400 dark:text-zinc-500 font-normal">(wird auf Keller gelegt)</span>
                    <component
                      :is="
                        stackPushStatus === 'success'
                          ? CheckCircle
                          : stackPushStatus === 'error'
                            ? XCircle
                            : null
                      "
                      :class="[
                        'w-4 h-4',
                        stackPushStatus === 'success' ? 'text-blue-500' : 'text-red-500',
                      ]"
                      v-if="stackPushStatus !== 'neutral'"
                    />
                  </label>
                  <div class="flex gap-2">
                    <input
                      v-model="stackPush"
                      type="text"
                      placeholder="z.B. aa oder ε"
                      class="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-2 rounded-lg focus:ring-2 focus:outline-none font-mono text-lg transition-all"
                      :class="[
                        stackPushError
                          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 focus:border-red-500'
                          : stackPush.length > 0
                            ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-300 dark:border-blue-700 focus:border-blue-500'
                            : 'border-zinc-200 dark:border-zinc-700 focus:border-emerald-500',
                      ]"
                    />
                    <button
                      @click="insertEpsilon('stackPush')"
                      class="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg font-bold text-zinc-700 dark:text-zinc-300 hover:text-blue-700 dark:hover:text-blue-400 transition-colors border-2 border-transparent hover:border-blue-300 dark:hover:border-blue-700"
                    >
                      ε
                    </button>
                    <button
                      v-if="stackPush.length > 0"
                      @click="clearField('stackPush')"
                      class="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                    >
                      <X class="w-5 h-5" />
                    </button>
                  </div>
                  <p v-if="stackPushError" class="text-xs text-red-600 dark:text-red-400 font-semibold animate-shake">
                    {{ stackPushError }}
                  </p>
                  <p v-else class="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <AlertCircle class="w-3 h-3" />
                    Beliebig viele Zeichen oder ε (keine Leerzeichen)
                  </p>
                </div>
              </div>
            </Transition>

            <!-- Preview -->
            <div
              class="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border-2 border-emerald-200 dark:border-emerald-800/50 shadow-inner"
            >
              <p class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Preview:
              </p>
              <p class="text-3xl font-mono font-bold text-emerald-900 dark:text-emerald-100 text-center tracking-tight">
                {{ preview }}
              </p>
            </div>

            <!-- Validation Error -->
            <div
              v-if="!isValid"
              class="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800/50 flex items-start gap-2"
            >
              <AlertCircle class="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <p class="text-xs text-orange-900 dark:text-orange-300">
                Mindestens ein Feld muss ausgefüllt sein und alle Fehler behoben!
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex justify-between items-center"
          >
            <p class="text-xs text-zinc-500 dark:text-zinc-400">
              Tip: Instead of repeating, you can push "AB" to push multiple symbols
              <kbd class="px-1.5 py-0.5 bg-white dark:bg-zinc-900 rounded border dark:border-zinc-700 text-[10px] font-mono">ESC</kbd> zum
              Schließen •
              <kbd class="px-1.5 py-0.5 bg-white dark:bg-zinc-900 rounded border dark:border-zinc-700 text-[10px] font-mono">⌘+Enter</kbd>
              zum Speichern
            </p>
            <div class="flex gap-2">
              <button
                @click="handleClose"
                class="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                @click="handleSave"
                :disabled="!isValid"
                class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl disabled:shadow-none"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
/* Custom input focus animations */
input:focus {
  transform: scale(1.01);
}

/* Keyboard shortcuts styling */
kbd {
  font-family: ui-monospace, monospace;
}

/* Shake animation for errors */
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
    transform: translateX(-2px);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(2px);
  }
}

.animate-shake {
  animation: shake 0.4s ease-in-out;
}
</style>
