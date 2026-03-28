<!--
  TMTransitionEditor.vue — Modal editor for Turing Machine transitions.

  Each TM transition consists of:
   - Read symbol (1 character).
   - Action: 'L' (move left), 'R' (move right), or any other character
     (write that character; head stays).

  The modal provides a two-field form (Read / Action) with a live preview.
-->

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, Save, Settings } from 'lucide-vue-next'
import type { Transition } from '@/lib/automaton'

const props = defineProps<{
  visible: boolean
  transition: Transition | null
}>()

const emit = defineEmits<{
  close: []
  save: [{ tmRead: string; action: string }]
}>()

// ---------------------------------------------------------------------------
// Local form state
// ---------------------------------------------------------------------------

const tmRead = ref('')
const action = ref('')

/** Populate fields when the dialog opens with an existing transition. */
watch(
  () => props.transition,
  (t) => {
    if (t) {
      tmRead.value = t.symbol || ''
      action.value = t.tmWrite ?? t.tmMove ?? ''
    }
  },
  { immediate: true },
)

/** Enforce single-character constraint on the Read field. */
const onReadInput = (e: Event) => {
  const v = (e.target as HTMLInputElement).value
  tmRead.value = v.slice(-1)
}
/** Enforce single-character constraint on the Action field. */
const onActionInput = (e: Event) => {
  const v = (e.target as HTMLInputElement).value
  action.value = v.slice(-1)
}

/** Live preview string shown at the bottom of the form. */
const preview = computed(() => {
  const r = tmRead.value || '?'
  const a = action.value || '?'
  return `${r}/${a}`
})

/** Human-readable explanation of what the selected action means. */
const actionHint = computed(() => {
  if (action.value === 'L') return '← Kopf nach Links bewegen'
  if (action.value === 'R') return 'Kopf nach Rechts bewegen →'
  if (action.value) return `"${action.value}" auf das Band schreiben, Kopf bleibt`
  return ''
})

const canSave = computed(() => tmRead.value.length === 1 && action.value.length === 1)

const handleSave = () => {
  if (!canSave.value) return
  emit('save', { tmRead: tmRead.value, action: action.value })
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-[200] flex items-center justify-center p-4"
        @click.self="$emit('close')"
      >
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="$emit('close')"></div>

        <div
          class="relative w-full max-w-xs bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors duration-300"
        >
          <!-- Header -->
          <div
            class="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center justify-between"
          >
            <h3 class="font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
              <Settings class="w-4 h-4" /> TM Transition
            </h3>
            <button
              @click="$emit('close')"
              class="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <X class="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 space-y-4">
            <!-- Zwei Felder nebeneinander: X / Y -->
            <div class="flex items-center gap-3">
              <!-- Read Symbol -->
              <div class="flex-1 space-y-1.5">
                <label class="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Lesen</label>
                <input
                  :value="tmRead"
                  @input="onReadInput"
                  maxlength="2"
                  placeholder="z.B. a"
                  class="w-full px-3 py-3 border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-lg font-mono text-2xl text-center focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none"
                />
              </div>

              <!-- Separator -->
              <div class="text-3xl font-mono font-bold text-zinc-400 dark:text-zinc-600 mt-5">/</div>

              <!-- Action -->
              <div class="flex-1 space-y-1.5">
                <label class="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
                  >Aktion</label
                >
                <input
                  :value="action"
                  @input="onActionInput"
                  maxlength="2"
                  placeholder="L, R, b..."
                  class="w-full px-3 py-3 border-2 rounded-lg font-mono text-2xl text-center bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-colors"
                  :class="
                    action === 'L' || action === 'R'
                      ? 'border-blue-400 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-900/10 focus:border-blue-500'
                      : action
                        ? 'border-orange-400 dark:border-orange-500/50 bg-orange-50 dark:bg-orange-900/10 focus:border-orange-500'
                        : 'border-zinc-300 dark:border-zinc-700 focus:border-blue-500'
                  "
                />
              </div>
            </div>

            <!-- Hint was die Action bedeutet -->
            <div
              v-if="actionHint"
              class="px-3 py-2 rounded-lg text-xs font-medium"
              :class="
                action === 'L' || action === 'R'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                  : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
              "
            >
              {{ actionHint }}
            </div>

            <!-- Preview -->
            <div class="p-3 bg-zinc-50 dark:bg-zinc-950/50 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center">
              <p class="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold mb-1 uppercase tracking-wide">
                Kantenvorschau
              </p>
              <code class="text-3xl font-mono font-bold text-zinc-900 dark:text-zinc-100">{{ preview }}</code>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex gap-3 justify-end">
            <button
              @click="$emit('close')"
              class="px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              @click="handleSave"
              :disabled="!canSave"
              class="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save class="w-4 h-4" />
              Speichern
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
