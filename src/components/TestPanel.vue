<script setup lang="ts">
import { computed } from 'vue'
import { PlusCircle, Trash2, CheckCircle2, XCircle, Clock, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-vue-next'
import { testCases, addTestCase, removeTestCase, updateTestCase } from '@/lib/automatonStore'
import type { SimulationResult } from '@/lib/automatonSimulator'

const props = defineProps<{
  selected: string | null
  visible: boolean
  simulationResults?: Array<SimulationResult & { expected: boolean; passed: boolean }>
}>()

const emit = defineEmits<{
  'update:selected': [value: string | null]
  'update:visible': [value: boolean]
}>()

// Get result for a specific test case
const getTestResult = (testCaseId: string) => {
  if (!props.simulationResults) return null
  
  const testCase = testCases.value.find(tc => tc.id === testCaseId)
  if (!testCase) return null
  
  // FIXED: Search by 'input' instead of 'testCase'
  return props.simulationResults.find(r => r.input === testCase.input)
}

// Get status for a test case
const getTestStatus = (testCaseId: string): 'pending' | 'passed' | 'failed' => {
  const result = getTestResult(testCaseId)
  if (!result) return 'pending'
  return result.passed ? 'passed' : 'failed'
}

const handleAddTest = () => {
  addTestCase('', true)
  // Auto-select the new test
  const newTest = testCases.value[testCases.value.length - 1]
  if (newTest) {
    emit('update:selected', newTest.id)
  }
}

const handleDeleteTest = (id: string) => {
  removeTestCase(id)
  if (props.selected === id) {
    emit('update:selected', null)
  }
}

const handleSelectTest = (id: string) => {
  emit('update:selected', id)
}

const updateInput = (id: string, input: string) => {
  const tc = testCases.value.find(t => t.id === id)
  if (tc) {
    updateTestCase(id, input, tc.expectedAccepted)
  }
}

const updateExpected = (id: string, expectedAccepted: boolean) => {
  const tc = testCases.value.find(t => t.id === id)
  if (tc) {
    updateTestCase(id, tc.input, expectedAccepted)
  }
}

// Test Summary
const testSummary = computed(() => {
  if (!props.simulationResults || props.simulationResults.length === 0) return null
  
  const passed = props.simulationResults.filter(r => r.passed).length
  const failed = props.simulationResults.filter(r => !r.passed).length
  const total = props.simulationResults.length
  
  return { passed, failed, total }
})
</script>

<template>
  <div 
    class="relative flex-shrink-0 h-full transition-all duration-300 ease-in-out"
    :style="{ width: visible ? '320px' : '0px' }"
  >
    
    <!-- Toggle Button -->
    <button 
      @click="emit('update:visible', !visible)"
      class="absolute top-1/2 -translate-y-1/2 -left-8 w-8 h-16 bg-white border border-zinc-200 shadow-md hover:bg-zinc-50 hover:shadow-lg transition-all duration-200 flex items-center justify-center z-50 rounded-l-lg"
    >
      <ChevronLeft v-if="visible" class="w-5 h-5 text-zinc-600 transition-transform duration-200" />
      <ChevronRight v-else class="w-5 h-5 text-zinc-600 transition-transform duration-200" />
    </button>

    <!-- Panel Content -->
    <div 
      class="bg-zinc-50 border-l border-zinc-200 h-full transition-all duration-300 ease-in-out flex flex-col"
      :class="{ 'opacity-0': !visible, 'opacity-100': visible }"
    >
      
      <!-- Header -->
      <div class="px-4 py-3 border-b border-zinc-200 flex items-center justify-between bg-white flex-shrink-0">
        <h2 class="text-sm font-semibold text-zinc-900">Test Cases</h2>
        <button 
          @click="handleAddTest" 
          class="p-1.5 rounded hover:bg-zinc-100 transition-colors"
          title="Add Test Case"
        >
          <PlusCircle class="w-4 h-4 text-zinc-600" />
        </button>
      </div>

      <!-- Test List (Scrollable) -->
      <div class="flex-1 overflow-y-auto">
        <div 
          v-for="tc in testCases" 
          :key="tc.id"
          @click="handleSelectTest(tc.id)"
          class="px-4 py-3 border-b border-zinc-200 hover:bg-white cursor-pointer transition-colors duration-150 group"
          :class="selected === tc.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'bg-white'"
        >
          <!-- Header Row: Name + Status + Delete -->
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex-1 text-sm font-medium text-zinc-900">
              Test {{ testCases.findIndex(t => t.id === tc.id) + 1 }}
            </div>
            
            <div class="flex items-center gap-1">
              <!-- Status Icon -->
              <div v-if="getTestStatus(tc.id) === 'passed'" class="relative group/status">
                <CheckCircle2 class="w-4 h-4 text-green-500" />
                <div class="absolute right-0 top-full mt-1 w-48 p-2 bg-zinc-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all z-50 pointer-events-none">
                  ✅ Test passed
                </div>
              </div>
              
              <div v-else-if="getTestStatus(tc.id) === 'failed'" class="relative group/status">
                <XCircle class="w-4 h-4 text-red-500" />
                <!-- Error Tooltip -->
                <div class="absolute right-0 top-full mt-1 w-64 p-3 bg-zinc-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all z-50 pointer-events-none">
                  <div class="font-bold mb-1 text-red-400 flex items-center gap-1">
                    <AlertCircle class="w-3 h-3" />
                    Test Failed
                  </div>
                  <div class="mb-2 text-zinc-300">{{ getTestResult(tc.id)?.error || 'Unexpected result' }}</div>
                  <div class="flex items-center justify-between text-xs border-t border-zinc-700 pt-2 mt-2">
                    <div>
                      <span class="text-zinc-400">Expected:</span>
                      <span :class="tc.expectedAccepted ? 'text-green-400 ml-1' : 'text-red-400 ml-1'">
                        {{ tc.expectedAccepted ? 'ACCEPT' : 'REJECT' }}
                      </span>
                    </div>
                    <div>
                      <span class="text-zinc-400">Got:</span>
                      <span :class="getTestResult(tc.id)?.accepted ? 'text-green-400 ml-1' : 'text-red-400 ml-1'">
                        {{ getTestResult(tc.id)?.accepted ? 'ACCEPT' : 'REJECT' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <Clock v-else class="w-4 h-4 text-zinc-400" />
              
              <button 
                @click.stop="handleDeleteTest(tc.id)" 
                class="p-1 rounded hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 class="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>

          <!-- Input Field -->
          <div class="mb-2">
            <label class="text-xs text-zinc-500 mb-1 block">Input String</label>
            <input 
              :value="tc.input"
              @input="(e) => updateInput(tc.id, (e.target as HTMLInputElement).value)"
              class="w-full px-2 py-1 text-xs bg-zinc-50 border border-zinc-300 rounded outline-none focus:border-blue-500 focus:bg-white transition-colors font-mono"
              placeholder="z.B. 'aabb'"
              @click.stop
            />
          </div>

          <!-- Expected Outcome -->
          <div>
            <label class="text-xs text-zinc-500 mb-1 block">Expected</label>
            <select 
              :value="tc.expectedAccepted ? 'accept' : 'reject'"
              @change="(e) => updateExpected(tc.id, (e.target as HTMLSelectElement).value === 'accept')"
              class="w-full px-2 py-1 text-xs bg-zinc-50 border border-zinc-300 rounded outline-none focus:border-blue-500 focus:bg-white transition-colors font-medium"
              @click.stop
            >
              <option value="accept">✅ Accept</option>
              <option value="reject">❌ Reject</option>
            </select>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="testCases.length === 0" class="px-4 py-12 text-center">
          <Clock class="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p class="text-sm text-zinc-500 mb-2">No test cases</p>
          <button 
            @click="handleAddTest" 
            class="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Create first test
          </button>
        </div>
      </div>

      <!-- Test Summary Footer -->
      <div 
        v-if="testSummary" 
        class="px-4 py-3 border-t border-zinc-200 bg-white flex-shrink-0"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-zinc-700">Test Results</span>
          <span class="text-xs text-zinc-500">
            {{ testSummary.total }} test{{ testSummary.total > 1 ? 's' : '' }}
          </span>
        </div>
        
        <div class="flex gap-2">
          <div class="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg bg-green-100">
            <CheckCircle2 class="w-4 h-4 text-green-700" />
            <span class="text-sm font-bold text-green-700">
              {{ testSummary.passed }}
            </span>
          </div>
          
          <div class="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg bg-red-100">
            <XCircle class="w-4 h-4 text-red-700" />
            <span class="text-sm font-bold text-red-700">
              {{ testSummary.failed }}
            </span>
          </div>
        </div>

        <!-- All Passed Badge -->
        <div 
          v-if="testSummary.failed === 0 && testSummary.total > 0" 
          class="mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold animate-pulse"
        >
          <CheckCircle2 class="w-4 h-4" />
          All tests passed!
        </div>
      </div>

    </div>

  </div>
</template>

<style scoped>
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #d4d4d8;
  border-radius: 3px;
  transition: background 0.2s;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a1a1aa;
}
</style>
