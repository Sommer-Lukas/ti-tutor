<!--
  SimulationStepBar.vue — Horizontal bar that appears above the canvas during
  PDA or TM simulation.

  For TM: shows a scrollable tape window (11 cells) centred on the head position.
  For PDA: shows the current stack contents in top-to-bottom order.
  Always displays consumed / remaining input and the current state.
-->

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { ChevronRight, AlertCircle } from 'lucide-vue-next'
import type { SimulationResult } from '@/lib/automatonSimulator'
import type { AutomatonType } from '@/lib/automatonTypes'

const props = defineProps<{
  simulation: SimulationResult
  currentStepIndex: number
  automatonType: AutomatonType
}>()

/** The step currently being visualised. */
const currentStep = computed(() => props.simulation.steps[props.currentStepIndex])

const tapeContainer = ref<HTMLElement | null>(null)

/** Auto-scroll the tape container so the head cell is always visible. */
watch(
  () => props.currentStepIndex,
  async () => {
    await nextTick()
    if (tapeContainer.value) {
      const activeCell = tapeContainer.value.querySelector('[data-is-head="true"]')
      if (activeCell) {
        activeCell.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        })
      }
    }
  },
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the PDA stack array as-is (bottom-to-top order). */
const formatStackDisplay = (stack: string[] | undefined): string[] => {
  if (!stack || stack.length === 0) return []
  return stack
}

/** Converts the TM BLANK symbol (□) to '#' for readability. */
const displaySymbol = (symbol: string): string => {
  return symbol === '□' ? '#' : symbol
}

/**
 * Builds a fixed-size (11 cells) window of the tape centred on the
 * current head position, padding with BLANK ('#') where necessary.
 */
const getTapeWindow = (
  tape: string[] | undefined,
  headPos: number | undefined,
): { cells: string[]; offsetStart: number } => {
  if (!tape || tape.length === 0) {
    return { cells: Array(11).fill('#'), offsetStart: 0 }
  }

  const WINDOW_SIZE = 11
  const CENTER = Math.floor(WINDOW_SIZE / 2)
  const head = headPos ?? 0

  let startPos = head - CENTER
  let endPos = startPos + WINDOW_SIZE

  let paddingLeft = 0
  if (startPos < 0) {
    paddingLeft = Math.abs(startPos)
    startPos = 0
  }

  let paddingRight = 0
  if (endPos > tape.length) {
    paddingRight = endPos - tape.length
    endPos = tape.length
  }

  const cells: string[] = [
    ...Array(paddingLeft).fill('#'),
    ...tape.slice(startPos, endPos),
    ...Array(paddingRight).fill('#'),
  ]

  return { cells, offsetStart: startPos - paddingLeft }
}

// ---------------------------------------------------------------------------
// Convenience computed properties
// ---------------------------------------------------------------------------

const isTM = computed(() => props.automatonType === 'TM')
const isPDA = computed(() => props.automatonType === 'PDA')
const isStuck = computed(() => currentStep.value?.isStuck ?? false)
</script>

<template>
  <div
    v-if="currentStep"
    class="h-24 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-zinc-900 dark:to-zinc-800 border-b border-blue-200 dark:border-zinc-800 flex items-stretch overflow-hidden"
  >
    <!-- LEFT: Step Counter + State Info -->
    <div
      class="flex-shrink-0 w-48 px-6 py-4 border-r border-blue-200 dark:border-zinc-800 flex flex-col justify-center gap-2 bg-white dark:bg-zinc-900"
    >
      <div class="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">Step {{ currentStep.step }}</div>
      <div class="text-sm font-bold text-zinc-900 dark:text-zinc-200">
        State:
        <code class="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-700 dark:text-blue-300 font-mono">{{
          currentStep.currentState
        }}</code>
      </div>

      <!-- Transition Info -->
      <div v-if="currentStep.transition" class="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
        <span>{{ currentStep.transition.symbol }}</span>
        <ChevronRight class="w-3 h-3" />
        <span class="text-green-700 dark:text-green-400 font-semibold">→ {{ currentStep.transition.to }}</span>
      </div>

      <!-- Stuck Indicator -->
      <div v-if="isStuck" class="flex items-center gap-1 text-xs text-orange-700 dark:text-orange-400">
        <AlertCircle class="w-3 h-3" />
        <span>Stuck!</span>
      </div>
    </div>

    <!-- CENTER: TM Tape Window -->
    <div
      v-if="isTM && currentStep.tape"
      class="flex-1 px-6 py-4 flex flex-col justify-center gap-2 border-r border-blue-200 dark:border-zinc-800 bg-gradient-to-b from-amber-50 to-amber-100 dark:from-zinc-800 dark:to-zinc-900 overflow-hidden"
    >
      <div class="text-xs text-amber-700 dark:text-amber-500 font-semibold">Tape Window</div>

      <div ref="tapeContainer" class="flex gap-1 overflow-x-auto pb-1 scroll-smooth">
        <div
          v-for="(cell, idx) in getTapeWindow(currentStep.tape, currentStep.headPosition).cells"
          :key="idx"
          :data-is-head="idx === 5"
          class="flex-shrink-0 w-8 h-8 flex items-center justify-center font-mono font-bold text-xs rounded border-2 transition-all"
          :class="
            idx === 5
              ? 'border-orange-500 ring-2 ring-orange-400 bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-300'
              : cell === '□'
                ? 'border-blue-400 dark:border-blue-700 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200'
          "
        >
          {{ displaySymbol(cell) }}
        </div>
      </div>
    </div>

    <!-- CENTER: PDA Stack -->
    <div
      v-if="isPDA && currentStep.stack"
      class="flex-1 px-6 py-4 flex flex-col justify-center gap-2 border-r border-blue-200 dark:border-zinc-800 bg-gradient-to-b from-purple-50 to-purple-100 dark:from-zinc-800 dark:to-zinc-900 overflow-hidden"
    >
      <div class="text-xs text-purple-700 dark:text-purple-400 font-semibold">Stack</div>

      <div class="flex gap-1 overflow-x-auto pb-1">
        <div v-if="currentStep.stack.length === 0" class="text-xs text-purple-600 dark:text-purple-400 font-semibold">
          ∅ (leer)
        </div>
        <div
          v-for="(symbol, idx) in formatStackDisplay(currentStep.stack)"
          :key="idx"
          class="flex-shrink-0 px-2 py-1 rounded bg-purple-300 dark:bg-purple-900/40 text-purple-900 dark:text-purple-300 text-xs font-mono font-bold border border-purple-500 dark:border-purple-700"
        >
          {{ symbol }}
        </div>
      </div>
    </div>

    <!-- RIGHT: Input Info -->
    <div
      class="flex-shrink-0 w-48 px-6 py-4 flex flex-col justify-center gap-2 bg-white dark:bg-zinc-900 border-l dark:border-l-0 border-blue-200 dark:border-zinc-800"
    >
      <div class="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">Input Status</div>
      <div class="flex items-center gap-2">
        <div class="text-xs">
          <span class="text-zinc-600 dark:text-zinc-400">Consumed:</span>
          <code
            class="ml-1 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400 font-mono font-bold text-[10px]"
          >
            {{ currentStep.consumedInput || 'ε' }}
          </code>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="text-xs">
          <span class="text-zinc-600 dark:text-zinc-400">Remaining:</span>
          <code
            class="ml-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded text-blue-700 dark:text-blue-400 font-mono font-bold text-[10px]"
          >
            {{ currentStep.remainingInput || 'ε' }}
          </code>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scroll-smooth {
  scroll-behavior: smooth;
}

/* Custom Scrollbar */
div::-webkit-scrollbar {
  height: 4px;
}

div::-webkit-scrollbar-thumb {
  background: #a1a1aa;
  border-radius: 2px;
}

div::-webkit-scrollbar-track {
  background: transparent;
}
</style>
