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
    class="h-24 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 flex items-stretch overflow-hidden"
  >
    <!-- LEFT: Step Counter + State Info -->
    <div
      class="flex-shrink-0 w-48 px-6 py-4 border-r border-blue-200 flex flex-col justify-center gap-2 bg-white"
    >
      <div class="text-xs text-zinc-500 font-semibold">Step {{ currentStep.step }}</div>
      <div class="text-sm font-bold text-zinc-900">
        State:
        <code class="bg-blue-100 px-2 py-1 rounded text-blue-700 font-mono">{{
          currentStep.currentState
        }}</code>
      </div>

      <!-- Transition Info -->
      <div v-if="currentStep.transition" class="text-xs text-zinc-600 flex items-center gap-1">
        <span>{{ currentStep.transition.symbol }}</span>
        <ChevronRight class="w-3 h-3" />
        <span class="text-green-700 font-semibold">→ {{ currentStep.transition.to }}</span>
      </div>

      <!-- Stuck Indicator -->
      <div v-if="isStuck" class="flex items-center gap-1 text-xs text-orange-700">
        <AlertCircle class="w-3 h-3" />
        <span>Stuck!</span>
      </div>
    </div>

    <!-- CENTER: TM Tape Window -->
    <div
      v-if="isTM && currentStep.tape"
      class="flex-1 px-6 py-4 flex flex-col justify-center gap-2 border-r border-blue-200 bg-gradient-to-b from-amber-50 to-amber-100 overflow-hidden"
    >
      <div class="text-xs text-amber-700 font-semibold">Tape Window</div>

      <div ref="tapeContainer" class="flex gap-1 overflow-x-auto pb-1 scroll-smooth">
        <div
          v-for="(cell, idx) in getTapeWindow(currentStep.tape, currentStep.headPosition).cells"
          :key="idx"
          :data-is-head="idx === 5"
          class="flex-shrink-0 w-8 h-8 flex items-center justify-center font-mono font-bold text-xs rounded border-2 transition-all"
          :class="
            idx === 5
              ? 'border-orange-500 ring-2 ring-orange-400 bg-orange-100 text-orange-900'
              : cell === '□'
                ? 'border-blue-400 bg-blue-100 text-blue-600'
                : 'border-zinc-400 bg-white text-zinc-900'
          "
        >
          {{ displaySymbol(cell) }}
        </div>
      </div>
    </div>

    <!-- CENTER: PDA Stack -->
    <div
      v-if="isPDA && currentStep.stack"
      class="flex-1 px-6 py-4 flex flex-col justify-center gap-2 border-r border-blue-200 bg-gradient-to-b from-purple-50 to-purple-100 overflow-hidden"
    >
      <div class="text-xs text-purple-700 font-semibold">Stack</div>

      <div class="flex gap-1 overflow-x-auto pb-1">
        <div v-if="currentStep.stack.length === 0" class="text-xs text-purple-600 font-semibold">
          ∅ (leer)
        </div>
        <div
          v-for="(symbol, idx) in formatStackDisplay(currentStep.stack)"
          :key="idx"
          class="flex-shrink-0 px-2 py-1 rounded bg-purple-300 text-purple-900 text-xs font-mono font-bold border border-purple-500"
        >
          {{ symbol }}
        </div>
      </div>
    </div>

    <!-- RIGHT: Input Info -->
    <div
      class="flex-shrink-0 w-48 px-6 py-4 flex flex-col justify-center gap-2 bg-white border-l border-blue-200"
    >
      <div class="text-xs text-zinc-500 font-semibold">Input Status</div>
      <div class="flex items-center gap-2">
        <div class="text-xs">
          <span class="text-zinc-600">Consumed:</span>
          <code
            class="ml-1 px-1.5 py-0.5 bg-green-50 rounded text-green-700 font-mono font-bold text-[10px]"
          >
            {{ currentStep.consumedInput || 'ε' }}
          </code>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="text-xs">
          <span class="text-zinc-600">Remaining:</span>
          <code
            class="ml-1 px-1.5 py-0.5 bg-blue-50 rounded text-blue-700 font-mono font-bold text-[10px]"
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
