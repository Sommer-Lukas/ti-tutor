<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, Save } from 'lucide-vue-next'
import type { Transition } from '@/lib/automaton'

const props = defineProps<{
  visible: boolean
  transition: Transition | null
}>()

const emit = defineEmits<{
  close: []
  save: [{ tmRead: string; action: string }]
}>()

const tmRead = ref('')
const action = ref('')

// Beim Öffnen: bestehende Werte laden
watch(() => props.transition, (t) => {
  if (t) {
    tmRead.value = t.symbol || ''
    action.value = t.tmWrite ?? t.tmMove ?? ''
  }
}, { immediate: true })

// Immer nur 1 Zeichen erlauben
const onReadInput = (e: Event) => {
  const v = (e.target as HTMLInputElement).value
  tmRead.value = v.slice(-1)
}
const onActionInput = (e: Event) => {
  const v = (e.target as HTMLInputElement).value
  action.value = v.slice(-1)
}

// Preview
const preview = computed(() => {
  const r = tmRead.value || '?'
  const a = action.value || '?'
  return `${r}/${a}`
})

// Bedeutung der Action für den User
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

        <div class="relative w-full max-w-xs bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden">

          <!-- Header -->
          <div class="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h3 class="font-bold text-zinc-900 text-sm flex items-center gap-2">
              <span>⚙️</span> TM Transition
            </h3>
            <button @click="$emit('close')" class="p-1.5 rounded-lg hover:bg-zinc-200 transition-colors">
              <X class="w-4 h-4 text-zinc-600" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 space-y-4">

            <!-- Zwei Felder nebeneinander: X / Y -->
            <div class="flex items-center gap-3">
              
              <!-- Read Symbol -->
              <div class="flex-1 space-y-1.5">
                <label class="text-xs font-bold text-zinc-500 uppercase tracking-wide">Lesen</label>
                <input
                  :value="tmRead"
                  @input="onReadInput"
                  maxlength="2"
                  placeholder="z.B. a"
                  class="w-full px-3 py-3 border-2 border-zinc-300 rounded-lg font-mono text-2xl text-center focus:border-blue-500 focus:outline-none"
                />
              </div>

              <!-- Separator -->
              <div class="text-3xl font-mono font-bold text-zinc-400 mt-5">/</div>

              <!-- Action -->
              <div class="flex-1 space-y-1.5">
                <label class="text-xs font-bold text-zinc-500 uppercase tracking-wide">Aktion</label>
                <input
                  :value="action"
                  @input="onActionInput"
                  maxlength="2"
                  placeholder="L, R, b..."
                  class="w-full px-3 py-3 border-2 rounded-lg font-mono text-2xl text-center focus:outline-none transition-colors"
                  :class="action === 'L' || action === 'R'
                    ? 'border-blue-400 bg-blue-50 focus:border-blue-500'
                    : action
                      ? 'border-orange-400 bg-orange-50 focus:border-orange-500'
                      : 'border-zinc-300 focus:border-blue-500'"
                />
              </div>
            </div>

            <!-- Hint was die Action bedeutet -->
            <div v-if="actionHint" class="px-3 py-2 rounded-lg text-xs font-medium"
              :class="action === 'L' || action === 'R'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-orange-50 text-orange-700'"
            >
              {{ actionHint }}
            </div>

            <!-- Preview -->
            <div class="p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-center">
              <p class="text-[10px] text-zinc-400 font-semibold mb-1 uppercase tracking-wide">Kantenvorschau</p>
              <code class="text-3xl font-mono font-bold text-zinc-900">{{ preview }}</code>
            </div>

          </div>

          <!-- Footer -->
          <div class="px-5 py-4 border-t border-zinc-200 bg-zinc-50 flex gap-3 justify-end">
            <button
              @click="$emit('close')"
              class="px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors"
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
