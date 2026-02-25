<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { GitBranch, ArrowRight, Check, X, AlertCircle, Layers } from 'lucide-vue-next'
import type { SimulationResult } from '@/lib/automatonSimulator'
import type { AutomatonType } from '@/lib/automatonTypes'

const props = defineProps<{
  simulation: SimulationResult
  currentStepIndex: number
  automatonType: AutomatonType
}>()

// Computed: Current and previous steps for tree building
const steps = computed(() => props.simulation.steps)
const isNFA = computed(() => props.automatonType === 'NFA')
const isPDA = computed(() => props.automatonType === 'PDA')
const isTM = computed(() => props.automatonType === 'TM')

// Refs for auto-scroll
const stepRefs = ref<HTMLElement[]>([])
const scrollContainer = ref<HTMLElement | null>(null)

// Set ref for each step card
const setStepRef = (el: unknown, idx: number) => {
  if (el instanceof HTMLElement) {
    stepRefs.value[idx] = el
  }
}

// Watch currentStepIndex and auto-scroll
watch(
  () => props.currentStepIndex,
  async (newIndex) => {
    await nextTick()

    const targetElement = stepRefs.value[newIndex]
    if (targetElement && scrollContainer.value) {
      // Smooth scroll to current step
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      })
    }
  },
  { immediate: true },
)

// Helper: Get stack top - TODO: Use in template if needed
const _getStackTop = (stack: string[] | undefined): string => {
  if (!stack || stack.length === 0) return '∅'
  return stack[stack.length - 1] || '∅'
}

// Helper: Display BLANK symbol as #
const displaySymbol = (symbol: string): string => {
  return symbol === '□' ? '#' : symbol
}

// Helper: Get tape window (centered on head position, padded with #)
// Shows 11 cells with head in center (5 left, 1 center, 5 right)
const getTapeWindow = (
  tape: string[] | undefined,
  headPos: number | undefined,
): { cells: string[]; offsetStart: number } => {
  if (!tape || tape.length === 0) {
    return { cells: Array(11).fill('#'), offsetStart: 0 }
  }

  const WINDOW_SIZE = 11
  const CENTER = Math.floor(WINDOW_SIZE / 2) // 5 for window of 11
  const head = headPos ?? 0

  // Calculate start position (head should be at center)
  let startPos = head - CENTER
  let endPos = startPos + WINDOW_SIZE

  // Pad with # on left if out of bounds
  let paddingLeft = 0
  if (startPos < 0) {
    paddingLeft = Math.abs(startPos)
    startPos = 0
  }

  // Pad with # on right if out of bounds
  let paddingRight = 0
  if (endPos > tape.length) {
    paddingRight = endPos - tape.length
    endPos = tape.length
  }

  // Build window
  const cells: string[] = [
    ...Array(paddingLeft).fill('#'),
    ...tape.slice(startPos, endPos),
    ...Array(paddingRight).fill('#'),
  ]

  return { cells, offsetStart: startPos - paddingLeft }
}
</script>

<template>
  <aside
    class="border-l bg-gradient-to-br from-zinc-50 to-zinc-100 flex flex-col overflow-hidden shadow-xl"
    :class="isPDA || isTM ? 'w-[600px]' : 'w-[400px]'"
  >
    <!-- HEADER -->
    <div class="px-6 py-4 border-b border-zinc-200 bg-white">
      <div class="flex items-center gap-3 mb-2">
        <div class="p-2 rounded-lg bg-blue-100">
          <GitBranch class="w-5 h-5 text-blue-600" />
        </div>
        <h2 class="text-base font-bold text-zinc-900">Simulation Tree</h2>

        <!-- PDA Badge -->
        <div
          v-if="isPDA"
          class="px-2 py-1 rounded-full bg-purple-100 border border-purple-300 flex items-center gap-1"
        >
          <Layers class="w-3 h-3 text-purple-700" />
          <span class="text-[10px] font-bold text-purple-900 uppercase tracking-wide">PDA</span>
        </div>

        <!-- TM Badge -->
        <div
          v-if="isTM"
          class="px-2 py-1 rounded-full bg-amber-100 border border-amber-300 flex items-center gap-1"
        >
          <span class="text-[10px] font-bold text-amber-900 uppercase tracking-wide">TM</span>
        </div>
      </div>

      <div class="flex items-center gap-2 text-xs">
        <span class="text-zinc-500">Input:</span>
        <code class="px-2 py-1 bg-zinc-100 rounded font-mono font-bold text-zinc-900">
          {{ simulation.input || 'ε' }}
        </code>
      </div>
    </div>

    <!-- TREE CONTENT (Scrollable) -->
    <div ref="scrollContainer" class="flex-1 overflow-y-auto p-6 space-y-3">
      <!-- STEP CARDS -->
      <div
        v-for="(step, idx) in steps"
        :key="idx"
        :ref="(el) => setStepRef(el, idx)"
        class="relative"
      >
        <!-- Card -->
        <div
          class="rounded-xl border-2 transition-all duration-300"
          :class="
            idx === currentStepIndex
              ? 'bg-blue-50 border-blue-500 shadow-lg scale-105'
              : idx < currentStepIndex
                ? 'bg-white border-zinc-200 opacity-60'
                : 'bg-white border-zinc-200 opacity-40'
          "
        >
          <!-- Card Header -->
          <div class="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                :class="
                  idx === currentStepIndex ? 'bg-blue-600 text-white' : 'bg-zinc-200 text-zinc-600'
                "
              >
                {{ idx }}
              </div>
              <span class="text-sm font-semibold text-zinc-900">
                {{ idx === 0 ? 'Start' : `Step ${idx}` }}
              </span>
            </div>

            <!-- Status Badge -->
            <div
              v-if="idx === currentStepIndex"
              class="px-2 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wide"
            >
              Current
            </div>
          </div>

          <!-- Card Body -->
          <div class="px-4 py-3 space-y-2">
            <!-- PDA: Two-Column Layout (State + Stack) -->
            <div v-if="isPDA" class="grid grid-cols-2 gap-3">
              <!-- Left: State Info -->
              <div class="space-y-2">
                <!-- State -->
                <div class="flex items-start gap-2">
                  <span class="text-xs text-zinc-500 font-semibold">State:</span>
                  <span
                    class="px-2 py-1 rounded-md bg-green-100 text-green-900 text-xs font-mono font-bold border border-green-300"
                  >
                    {{ step.currentState }}
                  </span>
                </div>

                <!-- Transition (if exists) -->
                <div v-if="step.transition" class="space-y-1">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] text-zinc-500 font-semibold">Transition:</span>
                  </div>
                  <div class="px-2 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
                    <div class="text-[10px] space-y-0.5">
                      <div class="flex items-center gap-1">
                        <span class="text-zinc-500">Read:</span>
                        <code class="font-mono font-bold text-purple-900">{{
                          step.transition.pdaInput
                        }}</code>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-zinc-500">Pop:</span>
                        <code class="font-mono font-bold text-purple-900">{{
                          step.transition.pdaStackTop
                        }}</code>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-zinc-500">Push:</span>
                        <code class="font-mono font-bold text-purple-900">{{
                          step.transition.pdaStackPush
                        }}</code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right: Stack Visualization -->
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 mb-1">
                  <Layers class="w-3 h-3 text-purple-600" />
                  <span class="text-xs text-purple-700 font-bold">Stack</span>
                  <span class="text-[10px] text-purple-500">(Top → Bottom)</span>
                </div>

                <!-- Stack Display -->
                <div class="bg-purple-50 rounded-lg border-2 border-purple-300 p-2 min-h-[80px]">
                  <div v-if="step.stack && step.stack.length > 0" class="space-y-1">
                    <!-- Show stack from top to bottom -->
                    <div
                      v-for="(symbol, stackIdx) in [...step.stack].reverse()"
                      :key="stackIdx"
                      class="px-2 py-1 bg-purple-200 rounded text-center font-mono font-bold text-sm border border-purple-400"
                      :class="stackIdx === 0 ? 'bg-purple-300 ring-2 ring-purple-500' : ''"
                    >
                      {{ symbol }}
                      <span v-if="stackIdx === 0" class="text-[9px] text-purple-700 ml-1"
                        >← TOP</span
                      >
                    </div>
                  </div>
                  <div v-else class="text-center text-zinc-400 text-xs font-semibold py-4">
                    ∅ (leer)
                  </div>
                </div>
              </div>
            </div>

            <!-- TM: Two-Column Layout (State + Tape) -->
            <div v-if="isTM" class="grid grid-cols-2 gap-3">
              <!-- Left: State Info -->
              <div class="space-y-2">
                <!-- State -->
                <div class="flex items-start gap-2">
                  <span class="text-xs text-zinc-500 font-semibold">State:</span>
                  <span
                    class="px-2 py-1 rounded-md bg-green-100 text-green-900 text-xs font-mono font-bold border border-green-300"
                  >
                    {{ step.currentState }}
                  </span>
                </div>

                <!-- Transition (if exists) -->
                <div v-if="step.transition" class="space-y-1">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] text-zinc-500 font-semibold">Transition:</span>
                  </div>
                  <div class="px-2 py-1.5 bg-amber-50 rounded-lg border border-amber-200">
                    <div class="text-[10px] space-y-0.5">
                      <div class="flex items-center gap-1">
                        <span class="text-zinc-500">Read:</span>
                        <code class="font-mono font-bold text-amber-900">{{
                          displaySymbol(step.transition.symbol)
                        }}</code>
                      </div>
                      <div
                        v-if="step.transition.tmWrite !== undefined"
                        class="flex items-center gap-1"
                      >
                        <span class="text-zinc-500">Write:</span>
                        <code class="font-mono font-bold text-amber-900">{{
                          displaySymbol(step.transition.tmWrite || '')
                        }}</code>
                      </div>
                      <div v-if="step.transition.tmMove" class="flex items-center gap-1">
                        <span class="text-zinc-500">Move:</span>
                        <code class="font-mono font-bold text-amber-900">{{
                          step.transition.tmMove
                        }}</code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right: Tape Visualization -->
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 mb-1">
                  <span class="text-xs text-amber-700 font-bold">📊 Tape</span>
                  <span class="text-[10px] text-amber-500"
                    >(Head @ {{ step.headPosition ?? 0 }})</span
                  >
                </div>

                <!-- Tape Display (Window view with padding) -->
                <div class="bg-amber-50 rounded-lg border-2 border-amber-300 p-2 overflow-x-auto">
                  <div class="flex gap-1 min-w-min">
                    <!-- Show tape window (11 cells with head centered) -->
                    <div
                      v-for="(cell, cellIdx) in getTapeWindow(step.tape, step.headPosition).cells"
                      :key="cellIdx"
                      class="w-8 h-8 flex items-center justify-center font-mono font-bold text-sm rounded border-2"
                      :class="{
                        'bg-amber-400 border-amber-600 text-amber-900 ring-2 ring-amber-600':
                          cellIdx === 5, // Center = head position
                        'bg-blue-100 border-blue-300 text-blue-600': cell === '#' && cellIdx !== 5,
                        'bg-white border-amber-200 text-zinc-900': cell !== '#' && cellIdx !== 5,
                      }"
                    >
                      {{ displaySymbol(cell) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- NON-PDA/TM: Original Layout -->
            <template v-else>
              <!-- State(s) -->
              <div class="flex items-start gap-2">
                <span class="text-xs text-zinc-500 font-semibold min-w-[70px]"
                  >State{{ isNFA && Array.isArray(step.currentState) ? 's' : '' }}:</span
                >
                <div class="flex flex-wrap gap-1.5">
                  <template v-if="Array.isArray(step.currentState)">
                    <span
                      v-for="state in step.currentState"
                      :key="state"
                      class="px-2 py-1 rounded-md bg-purple-100 text-purple-900 text-xs font-mono font-bold border border-purple-300"
                    >
                      {{ state }}
                    </span>
                  </template>
                  <template v-else>
                    <span
                      class="px-2 py-1 rounded-md bg-green-100 text-green-900 text-xs font-mono font-bold border border-green-300"
                    >
                      {{ step.currentState }}
                    </span>
                  </template>
                </div>
              </div>

              <!-- Transition (if exists) -->
              <div
                v-if="step.transition"
                class="flex items-center gap-2 pl-2 border-l-2 border-blue-300"
              >
                <span class="text-xs text-zinc-500 font-semibold min-w-[60px]">Read:</span>
                <code
                  class="px-2 py-1 bg-blue-100 rounded text-blue-900 text-xs font-mono font-bold"
                >
                  {{ step.transition.symbol }}
                </code>
                <ArrowRight class="w-3 h-3 text-zinc-400" />
                <span
                  class="px-2 py-1 rounded-md bg-green-100 text-green-900 text-xs font-mono font-bold"
                >
                  {{ step.transition.to }}
                </span>
              </div>
            </template>

            <!-- Input Status (for all types) -->
            <div class="flex items-center gap-4 text-[11px] pt-2 border-t border-zinc-200">
              <div class="flex items-center gap-1.5">
                <span class="text-zinc-500 font-semibold">Consumed:</span>
                <code class="px-1.5 py-0.5 bg-green-50 rounded text-green-700 font-mono font-bold">
                  {{ step.consumedInput || 'ε' }}
                </code>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-zinc-500 font-semibold">Remaining:</span>
                <code class="px-1.5 py-0.5 bg-blue-50 rounded text-blue-700 font-mono font-bold">
                  {{ step.remainingInput || 'ε' }}
                </code>
              </div>
            </div>

            <!-- Epsilon Closure (for NFA) -->
            <div
              v-if="isNFA && step.epsilonClosure && step.epsilonClosure.length > 0"
              class="flex items-start gap-2 text-[11px] pt-1"
            >
              <span class="text-zinc-500 font-semibold min-w-[70px]">ε-Closure:</span>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="state in step.epsilonClosure"
                  :key="state"
                  class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-bold text-[10px]"
                >
                  {{ state }}
                </span>
              </div>
            </div>

            <!-- Stuck Indicator -->
            <div
              v-if="step.isStuck"
              class="flex items-center gap-2 px-2 py-1.5 bg-orange-50 rounded-lg border border-orange-300"
            >
              <AlertCircle class="w-4 h-4 text-orange-600" />
              <span class="text-xs font-bold text-orange-900">Stuck - No transitions!</span>
            </div>

            <!-- Accepting Badge -->
            <div
              v-if="step.isAccepting && !step.isStuck"
              class="flex items-center gap-2 px-2 py-1.5 bg-green-50 rounded-lg border border-green-300"
            >
              <Check class="w-4 h-4 text-green-600" />
              <span class="text-xs font-bold text-green-900">Accepting State</span>
            </div>
          </div>
        </div>

        <!-- Connector Line -->
        <div v-if="idx < steps.length - 1" class="flex justify-center py-2">
          <div
            class="w-0.5 h-6 rounded-full"
            :class="idx < currentStepIndex ? 'bg-blue-400' : 'bg-zinc-300'"
          ></div>
        </div>
      </div>
    </div>

    <!-- FOOTER (Final Result) -->
    <div class="px-6 py-4 border-t border-zinc-200 bg-white">
      <!-- PDA: Final Stack Info -->
      <!-- PDA: Final Stack Info -->
      <div
        v-if="isPDA && simulation.finalStack"
        class="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200"
      >
        <div class="flex items-center gap-2 mb-2">
          <Layers class="w-4 h-4 text-purple-600" />
          <span class="text-xs font-bold text-purple-900">Final Stack:</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <template v-if="simulation.finalStack.length > 0">
            <span
              v-for="(symbol, idx) in simulation.finalStack"
              :key="idx"
              class="px-2 py-1 rounded bg-purple-200 text-purple-900 text-xs font-mono font-bold border border-purple-400"
            >
              {{ symbol }}
            </span>
          </template>
          <span v-else class="text-xs text-purple-600 font-semibold"
            >∅ (leer) - Accepted by empty stack!</span
          >
        </div>
      </div>

      <!-- TM: Final Tape Info -->
      <div
        v-if="isTM && simulation.finalTape"
        class="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200"
      >
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs font-bold text-amber-900">Final Tape:</span>
        </div>
        <div class="flex flex-wrap gap-1">
          <div
            v-for="(cell, idx) in simulation.finalTape"
            :key="idx"
            class="w-7 h-7 flex items-center justify-center font-mono font-bold text-[11px] rounded border"
            :class="
              cell === '□'
                ? 'bg-blue-100 border-blue-300 text-blue-600'
                : 'bg-white border-amber-400 text-zinc-900'
            "
          >
            {{ displaySymbol(cell) }}
          </div>
        </div>
        <div class="text-xs text-amber-700 font-mono mt-2 break-all">
          {{ simulation.finalTape.map((c) => displaySymbol(c)).join('') }}
        </div>
      </div>

      <!-- Result Badge -->
      <div
        class="p-4 rounded-xl flex items-center gap-3"
        :class="
          simulation.accepted
            ? 'bg-green-50 border-2 border-green-500'
            : 'bg-red-50 border-2 border-red-500'
        "
      >
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center"
          :class="simulation.accepted ? 'bg-green-600' : 'bg-red-600'"
        >
          <Check v-if="simulation.accepted" class="w-6 h-6 text-white" />
          <X v-else class="w-6 h-6 text-white" />
        </div>
        <div>
          <p
            class="text-sm font-bold"
            :class="simulation.accepted ? 'text-green-900' : 'text-red-900'"
          >
            {{ simulation.accepted ? 'ACCEPTED ✓' : 'REJECTED ✗' }}
          </p>
          <p class="text-xs" :class="simulation.accepted ? 'text-green-700' : 'text-red-700'">
            {{ simulation.error || 'Input successfully processed' }}
          </p>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* Custom Scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #a1a1aa;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

/* Smooth scroll behavior */
.overflow-y-auto {
  scroll-behavior: smooth;
}
</style>
