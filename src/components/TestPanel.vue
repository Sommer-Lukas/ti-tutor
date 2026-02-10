<script setup lang="ts">
import { ref } from 'vue'
import { PlusCircle, Trash2, CheckCircle2, XCircle, Clock, ChevronRight, ChevronLeft } from 'lucide-vue-next'

interface TestCase {
  id: string
  name: string
  input: string
  expectedOutcome: 'accept' | 'reject'
  status?: 'pending' | 'running' | 'passed' | 'failed'
}

const selected = defineModel<string | null>('selected')
const visible = defineModel<boolean>('visible', { default: true })

const testCases = ref<TestCase[]>([
  { id: 'tc1', name: 'Test Case 1', input: 'ab', expectedOutcome: 'accept', status: 'pending' },
  { id: 'tc2', name: 'Test Case 2', input: 'ba', expectedOutcome: 'reject', status: 'pending' }
])

let testCaseIdCounter = 3

const addTestCase = () => {
  testCases.value.push({
    id: `tc${testCaseIdCounter++}`,
    name: `Test Case ${testCaseIdCounter - 1}`,
    input: '',
    expectedOutcome: 'accept',
    status: 'pending'
  })
}

const deleteTestCase = (id: string) => {
  testCases.value = testCases.value.filter(tc => tc.id !== id)
  if (selected.value === id) {
    selected.value = null
  }
}
</script>

<template>
  <div 
    class="relative flex-shrink-0 h-full transition-all duration-300 ease-in-out"
    :style="{ width: visible ? '320px' : '0px' }"
  >
    
    <!-- Toggle Button -->
    <button 
      @click="visible = !visible"
      class="absolute top-1/2 -translate-y-1/2 -left-8 w-8 h-16 bg-white border border-zinc-200 shadow-md hover:bg-zinc-50 hover:shadow-lg transition-all duration-200 flex items-center justify-center z-50 rounded-l-lg"
    >
      <ChevronLeft v-if="visible" class="w-5 h-5 text-zinc-600 transition-transform duration-200" />
      <ChevronRight v-else class="w-5 h-5 text-zinc-600 transition-transform duration-200" />
    </button>

    <!-- Panel Content -->
    <div 
      class="bg-zinc-50 border-l border-zinc-200 h-full transition-all duration-300 ease-in-out"
      :class="{ 'opacity-0': !visible, 'opacity-100': visible }"
    >
      
      <div class="flex flex-col h-full w-80">
        
        <div class="px-4 py-3 border-b border-zinc-200 flex items-center justify-between bg-white">
          <h2 class="text-sm font-semibold text-zinc-900">Test Cases</h2>
          <button @click="addTestCase" class="p-1.5 rounded hover:bg-zinc-100 transition-colors">
            <PlusCircle class="w-4 h-4 text-zinc-600" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <div 
            v-for="tc in testCases" 
            :key="tc.id"
            @click="selected = tc.id"
            class="px-4 py-3 border-b border-zinc-200 hover:bg-white cursor-pointer transition-colors duration-150"
            :class="selected === tc.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'bg-white'"
          >
            <div class="flex items-start justify-between gap-2 mb-2">
              <input 
                v-model="tc.name"
                class="flex-1 text-sm font-medium text-zinc-900 bg-transparent border-none outline-none"
                @click.stop
              />
              
              <div class="flex items-center gap-1">
                <CheckCircle2 v-if="tc.status === 'passed'" class="w-4 h-4 text-green-500" />
                <XCircle v-else-if="tc.status === 'failed'" class="w-4 h-4 text-red-500" />
                <Clock v-else-if="tc.status === 'running'" class="w-4 h-4 text-blue-500 animate-pulse" />
                
                <button @click.stop="deleteTestCase(tc.id)" class="p-1 rounded hover:bg-zinc-100 transition-colors">
                  <Trash2 class="w-3.5 h-3.5 text-zinc-500" />
                </button>
              </div>
            </div>

            <div class="mb-2">
              <label class="text-xs text-zinc-500 mb-1 block">Input String</label>
              <input 
                v-model="tc.input"
                class="w-full px-2 py-1 text-xs bg-zinc-50 border border-zinc-300 rounded outline-none focus:border-blue-500 focus:bg-white transition-colors"
                @click.stop
              />
            </div>

            <div>
              <label class="text-xs text-zinc-500 mb-1 block">Expected</label>
              <select 
                v-model="tc.expectedOutcome"
                class="w-full px-2 py-1 text-xs bg-zinc-50 border border-zinc-300 rounded outline-none focus:border-blue-500 focus:bg-white transition-colors"
                @click.stop
              >
                <option value="accept">Accept</option>
                <option value="reject">Reject</option>
              </select>
            </div>
          </div>

          <div v-if="testCases.length === 0" class="px-4 py-12 text-center">
            <Clock class="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p class="text-sm text-zinc-500 mb-2">No test cases</p>
            <button @click="addTestCase" class="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
              Create first test
            </button>
          </div>
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
