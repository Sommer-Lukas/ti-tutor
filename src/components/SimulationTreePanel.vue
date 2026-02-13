<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { GitBranch, ArrowRight, Check, X, AlertCircle } from 'lucide-vue-next'
import type { SimulationResult } from '@/lib/automatonSimulator'
import type { AutomatonType } from '@/lib/automatonTypes'

const props = defineProps<{
  simulation: SimulationResult
  currentStepIndex: number
  automatonType: AutomatonType
}>()

// Computed: Current and previous steps for tree building
const steps = computed(() => props.simulation.steps)
const currentStep = computed(() => steps.value[props.currentStepIndex])
const isNFA = computed(() => props.automatonType === 'NFA')

// Refs for auto-scroll
const stepRefs = ref<HTMLElement[]>([])
const scrollContainer = ref<HTMLElement | null>(null)

// Set ref for each step card
const setStepRef = (el: any, idx: number) => {
  if (el) {
    stepRefs.value[idx] = el
  }
}

// Watch currentStepIndex and auto-scroll
watch(() => props.currentStepIndex, async (newIndex) => {
  await nextTick()
  
  const targetElement = stepRefs.value[newIndex]
  if (targetElement && scrollContainer.value) {
    // Smooth scroll to current step
    targetElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    })
  }
}, { immediate: true })
</script>

<template>
  <aside class="w-[400px] border-l bg-gradient-to-br from-zinc-50 to-zinc-100 flex flex-col overflow-hidden shadow-xl">
    
    <!-- HEADER -->
    <div class="px-6 py-4 border-b border-zinc-200 bg-white">
      <div class="flex items-center gap-3 mb-2">
        <div class="p-2 rounded-lg bg-blue-100">
          <GitBranch class="w-5 h-5 text-blue-600" />
        </div>
        <h2 class="text-base font-bold text-zinc-900">Simulation Tree</h2>
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
          :class="idx === currentStepIndex 
            ? 'bg-blue-50 border-blue-500 shadow-lg scale-105' 
            : idx < currentStepIndex
              ? 'bg-white border-zinc-200 opacity-60'
              : 'bg-white border-zinc-200 opacity-40'"
        >
          <!-- Card Header -->
          <div class="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div 
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                :class="idx === currentStepIndex 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-zinc-200 text-zinc-600'"
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
            
            <!-- State(s) -->
            <div class="flex items-start gap-2">
              <span class="text-xs text-zinc-500 font-semibold min-w-[70px]">State{{ isNFA && Array.isArray(step.currentState) ? 's' : '' }}:</span>
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
                  <span class="px-2 py-1 rounded-md bg-green-100 text-green-900 text-xs font-mono font-bold border border-green-300">
                    {{ step.currentState }}
                  </span>
                </template>
              </div>
            </div>

            <!-- Transition (if exists) -->
            <div v-if="step.transition" class="flex items-center gap-2 pl-2 border-l-2 border-blue-300">
              <span class="text-xs text-zinc-500 font-semibold min-w-[60px]">Read:</span>
              <code class="px-2 py-1 bg-blue-100 rounded text-blue-900 text-xs font-mono font-bold">
                {{ step.transition.symbol }}
              </code>
              <ArrowRight class="w-3 h-3 text-zinc-400" />
              <span class="px-2 py-1 rounded-md bg-green-100 text-green-900 text-xs font-mono font-bold">
                {{ step.transition.to }}
              </span>
            </div>

            <!-- Input Status -->
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
            <div v-if="isNFA && step.epsilonClosure && step.epsilonClosure.length > 0" class="flex items-start gap-2 text-[11px] pt-1">
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
            <div v-if="step.isStuck" class="flex items-center gap-2 px-2 py-1.5 bg-orange-50 rounded-lg border border-orange-300">
              <AlertCircle class="w-4 h-4 text-orange-600" />
              <span class="text-xs font-bold text-orange-900">Stuck - No transitions!</span>
            </div>

            <!-- Accepting Badge -->
            <div v-if="step.isAccepting && !step.isStuck" class="flex items-center gap-2 px-2 py-1.5 bg-green-50 rounded-lg border border-green-300">
              <Check class="w-4 h-4 text-green-600" />
              <span class="text-xs font-bold text-green-900">Accepting State</span>
            </div>

          </div>
        </div>

        <!-- Connector Line -->
        <div 
          v-if="idx < steps.length - 1"
          class="flex justify-center py-2"
        >
          <div 
            class="w-0.5 h-6 rounded-full"
            :class="idx < currentStepIndex ? 'bg-blue-400' : 'bg-zinc-300'"
          ></div>
        </div>
      </div>

    </div>

    <!-- FOOTER (Final Result) -->
    <div class="px-6 py-4 border-t border-zinc-200 bg-white">
      <div 
        class="p-4 rounded-xl flex items-center gap-3"
        :class="simulation.accepted 
          ? 'bg-green-50 border-2 border-green-500' 
          : 'bg-red-50 border-2 border-red-500'"
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
          <p 
            class="text-xs"
            :class="simulation.accepted ? 'text-green-700' : 'text-red-700'"
          >
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
