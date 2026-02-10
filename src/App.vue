<script setup lang="ts">
import { ref, computed } from 'vue'
import { Play, StepForward, Square, Clock, Check, X, AlertTriangle } from 'lucide-vue-next'
import Sidebar from '@/components/Sidebar.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import TestPanel from '@/components/TestPanel.vue'
import { currentProject, validationResult } from '@/lib/automatonStore'
import { AUTOMATON_TYPES } from '@/lib/automatonTypes'

// --- UI STATE ---
const isSidebarOpen = ref(true)
const rightPanelOpen = ref(true)
const showValidationModal = ref(false)

const isSimulating = ref(false)
const currentSimulationStep = ref(0)
const selectedTestCase = ref<string | null>(null)

// --- COMPUTED: Validation Badge Status ---
const validationStatus = computed(() => {
  if (validationResult.value.errors.length > 0) return 'error'
  if (validationResult.value.warnings.length > 0) return 'warning'
  return 'valid'
})

const startSimulation = () => {
  if (!selectedTestCase.value) return
  isSimulating.value = true
  currentSimulationStep.value = 0
}

const stepSimulation = () => {
  if (!isSimulating.value) return
  currentSimulationStep.value++
}

const stopSimulation = () => {
  isSimulating.value = false
  currentSimulationStep.value = 0
}

const runAllTests = () => {
  console.log('Running all tests...')
}

const toggleValidationModal = () => {
  showValidationModal.value = !showValidationModal.value
}

const closeValidationModal = () => {
  showValidationModal.value = false
}
</script>

<template>
  <div class="flex h-screen w-full bg-zinc-50 text-zinc-900 overflow-hidden relative">
    
    <!-- LEFT SIDEBAR (Component) -->
    <Sidebar v-model:is-open="isSidebarOpen" />

    <!-- MAIN CONTENT -->
    <main class="flex-1 flex flex-col h-full min-w-0 bg-white">
      
      <!-- TOP BAR -->
      <header class="flex h-14 items-center justify-between px-6 border-b z-50 bg-white flex-shrink-0 relative">
        
        <!-- Project Name + Type Badge + Validation Status -->
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-semibold text-zinc-900">{{ currentProject.name }}</h1>
          
          <!-- Automaton Type Badge -->
          <span 
            class="px-2.5 py-1 rounded-full text-xs font-bold"
            :class="currentProject.type === 'DFA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'"
          >
            {{ AUTOMATON_TYPES[currentProject.type].shortName }}
          </span>
          
          <!-- Validation Status Badge (UPDATED LOGIC) -->
          <button
            @click="toggleValidationModal"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:shadow-md"
            :class="{
              'bg-green-50 text-green-700 hover:bg-green-100': validationStatus === 'valid',
              'bg-red-50 text-red-700 hover:bg-red-100': validationStatus === 'error',
              'bg-yellow-50 text-yellow-700 hover:bg-yellow-100': validationStatus === 'warning'
            }"
          >
            <Check v-if="validationStatus === 'valid'" class="w-4 h-4" />
            <X v-else-if="validationStatus === 'error'" class="w-4 h-4" />
            <AlertTriangle v-else class="w-4 h-4" />
            
            <span v-if="validationStatus === 'valid'">Valid</span>
            <span v-else-if="validationStatus === 'error'">
              {{ validationResult.errors.length }} Error{{ validationResult.errors.length > 1 ? 's' : '' }}
            </span>
            <span v-else>
              {{ validationResult.warnings.length }} Warning{{ validationResult.warnings.length > 1 ? 's' : '' }}
            </span>
          </button>

        </div>

        <!-- User Avatar -->
        <div class="h-8 w-8 rounded-full bg-zinc-200"></div>
      </header>

      <!-- WORKSPACE -->
      <div class="flex-1 flex flex-col min-h-0">
        
        <!-- CANVAS + RIGHT PANEL ROW -->
        <div class="flex-1 flex min-h-0 overflow-hidden">
          
          <!-- CANVAS -->
          <EditorCanvas class="flex-1 min-w-0" />

          <!-- RIGHT PANEL -->
          <TestPanel 
            v-model:selected="selectedTestCase"
            v-model:visible="rightPanelOpen"
          />

        </div>

        <!-- BOTTOM BAR -->
        <div class="h-16 bg-white border-t border-zinc-200 flex items-center px-6 gap-4 shadow-lg flex-shrink-0 relative z-50">
          
          <div class="flex items-center gap-2">
            <button 
              @click="startSimulation"
              :disabled="!selectedTestCase || isSimulating"
              class="p-3 rounded-lg hover:bg-zinc-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Start (F5)"
            >
              <Play class="w-5 h-5 text-green-600" :class="{'fill-green-600': !isSimulating && selectedTestCase}" />
            </button>

            <button 
              @click="stepSimulation"
              :disabled="!isSimulating"
              class="p-3 rounded-lg hover:bg-zinc-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Step (F10)"
            >
              <StepForward class="w-5 h-5 text-blue-600" />
            </button>

            <button 
              @click="stopSimulation"
              :disabled="!isSimulating"
              class="p-3 rounded-lg hover:bg-zinc-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Stop (Shift+F5)"
            >
              <Square class="w-4 h-4 text-red-600" :class="{'fill-red-600': isSimulating}" />
            </button>
          </div>

          <div class="w-px h-8 bg-zinc-300"></div>

          <button 
            @click="runAllTests"
            class="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-md hover:shadow-lg"
          >
            Run All Tests
          </button>

          <div v-if="isSimulating" class="ml-auto flex items-center gap-3 text-zinc-600 text-sm font-medium">
            <Clock class="w-5 h-5 animate-pulse text-blue-600" />
            <span class="font-semibold">Step {{ currentSimulationStep }}</span>
          </div>
          
        </div>

      </div>

    </main>

    <!-- VALIDATION MODAL -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div 
        v-if="showValidationModal"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @click.self="closeValidationModal"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeValidationModal"></div>
        
        <!-- Modal Content -->
        <div class="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden">
          
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50">
            <div class="flex items-center gap-3">
              <Check v-if="validationStatus === 'valid'" class="w-6 h-6 text-green-600" />
              <X v-else-if="validationStatus === 'error'" class="w-6 h-6 text-red-600" />
              <AlertTriangle v-else class="w-6 h-6 text-yellow-600" />
              <h2 class="text-base font-bold text-zinc-900">Validierung</h2>
            </div>
            <button 
              @click="closeValidationModal"
              class="p-2 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              <svg class="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content (Scrollable) -->
          <div class="max-h-[60vh] overflow-y-auto">
            
            <!-- ERRORS Section (wenn vorhanden) -->
            <div v-if="validationResult.errors.length > 0" class="p-6 border-b border-zinc-200 bg-red-50">
              <div class="flex items-center gap-2 mb-4">
                <X class="w-5 h-5 text-red-600" />
                <h3 class="text-sm font-bold text-red-900">
                  {{ validationResult.errors.length }} Fehler
                </h3>
              </div>
              
              <div class="space-y-3">
                <div 
                  v-for="(error, idx) in validationResult.errors" 
                  :key="idx"
                  class="p-4 bg-white rounded-lg border border-red-200 shadow-sm"
                >
                  <p class="text-sm font-medium text-red-900 leading-relaxed">{{ error.message }}</p>
                  <p v-if="error.affectedElements.length > 0" class="text-xs text-red-700 mt-2">
                    <span class="font-semibold">Betroffen:</span> {{ error.affectedElements.length }} Element(e)
                  </p>
                </div>
              </div>
            </div>

            <!-- WARNINGS Section (immer anzeigen wenn vorhanden!) -->
            <div v-if="validationResult.warnings.length > 0" class="p-6 bg-yellow-50">
              <div class="flex items-center gap-2 mb-4">
                <AlertTriangle class="w-5 h-5 text-yellow-600" />
                <h3 class="text-sm font-bold text-yellow-900">
                  {{ validationResult.warnings.length }} Warnung{{ validationResult.warnings.length > 1 ? 'en' : '' }}
                </h3>
              </div>
              
              <div class="space-y-3">
                <div 
                  v-for="(warning, idx) in validationResult.warnings" 
                  :key="idx"
                  class="p-4 bg-white rounded-lg border border-yellow-200 shadow-sm"
                >
                  <p class="text-sm font-medium text-yellow-900 leading-relaxed">{{ warning.message }}</p>
                </div>
              </div>
            </div>

            <!-- PERFECT STATE (keine Errors UND keine Warnings) -->
            <div v-if="validationResult.errors.length === 0 && validationResult.warnings.length === 0" class="p-8 text-center">
              <div class="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check class="w-10 h-10 text-green-600" />
              </div>
              <h3 class="text-lg font-bold text-zinc-900 mb-2">Perfekt!</h3>
              <p class="text-sm text-zinc-600">Keine Fehler oder Warnungen gefunden.</p>
            </div>

          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex justify-end">
            <button 
              @click="closeValidationModal"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Schließen
            </button>
          </div>

        </div>
      </div>
    </Transition>
    
  </div>
</template>
