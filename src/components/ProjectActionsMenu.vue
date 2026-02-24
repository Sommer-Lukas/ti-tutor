<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { MoreVertical, Trash2, Copy, Edit, X, Check } from 'lucide-vue-next'
import { deleteProject, duplicateProject, renameProject, setCurrentProject } from '@/lib/automatonStore'
import { openMenu, closeMenu, isMenuOpen } from '@/lib/menuState'

const props = defineProps<{
  projectId: string
  projectName: string
}>()

const menuRef = ref<HTMLElement | null>(null)
const showDeleteConfirm = ref(false)
const showRenameDialog = ref(false)
const renameInput = ref('')
const renameError = ref(false)
const renameInputRef = ref<HTMLInputElement | null>(null)

// Computed: Is this specific menu open?
const isThisMenuOpen = () => isMenuOpen(props.projectId)

const toggleMenu = () => {
  if (isThisMenuOpen()) {
    closeMenu()
  } else {
    openMenu(props.projectId)
  }
}

const handleDelete = () => {
  closeMenu()
  showDeleteConfirm.value = true
}

const confirmDelete = () => {
  deleteProject(props.projectId)
  showDeleteConfirm.value = false
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
}

const handleDuplicate = () => {
  const duplicated = duplicateProject(props.projectId)
  if (duplicated) {
    setCurrentProject(duplicated.id)
  }
  closeMenu()
}

const handleRename = () => {
  closeMenu()
  renameInput.value = props.projectName
  renameError.value = false
  showRenameDialog.value = true
  
  // Focus input after dialog opens
  setTimeout(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  }, 100)
}

const confirmRename = () => {
  // Reset error
  renameError.value = false
  
  // Validate
  if (!renameInput.value.trim()) {
    renameError.value = true
    return
  }
  
  // Check if name is unchanged
  if (renameInput.value.trim() === props.projectName) {
    cancelRename()
    return
  }
  
  // Rename
  renameProject(props.projectId, renameInput.value.trim())
  showRenameDialog.value = false
  renameInput.value = ''
}

const cancelRename = () => {
  showRenameDialog.value = false
  renameInput.value = ''
  renameError.value = false
}

const handleRenameInput = () => {
  if (renameError.value) {
    renameError.value = false
  }
}

// Close menu when clicking outside
const handleClickOutside = (e: MouseEvent) => {
  if (isThisMenuOpen() && menuRef.value && !menuRef.value.contains(e.target as Node)) {
    closeMenu()
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="relative" ref="menuRef">
    <!-- Three Dots Button -->
    <button
      @click.stop="toggleMenu"
      class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-zinc-300 transition-all"
      :class="{ 'opacity-100 bg-zinc-300': isThisMenuOpen() }"
    >
      <MoreVertical class="w-4 h-4 text-zinc-600" />
    </button>

    <!-- Dropdown Menu -->
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      leave-active-class="transition-all duration-100 ease-in"
      enter-from-class="opacity-0 scale-95 -translate-y-2"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-2"
    >
      <div
        v-if="isThisMenuOpen()"
        class="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-zinc-200 py-1 z-50"
      >
        <button
          @click.stop="handleRename"
          class="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 transition-colors flex items-center gap-3"
        >
          <Edit class="w-4 h-4 text-zinc-600" />
          <span>Umbenennen</span>
        </button>

        <button
          @click.stop="handleDuplicate"
          class="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 transition-colors flex items-center gap-3"
        >
          <Copy class="w-4 h-4 text-zinc-600" />
          <span>Duplizieren</span>
        </button>

        <div class="h-px bg-zinc-200 my-1"></div>

        <button
          @click.stop="handleDelete"
          class="w-full px-4 py-2 text-left text-sm hover:bg-red-50 transition-colors flex items-center gap-3 text-red-600"
        >
          <Trash2 class="w-4 h-4" />
          <span>Löschen</span>
        </button>
      </div>
    </Transition>

    <!-- Rename Dialog -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showRenameDialog"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @click.self="cancelRename"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="cancelRename"></div>

        <!-- Dialog -->
        <div class="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Edit class="w-5 h-5 text-blue-600" />
              </div>
              <h2 class="text-base font-bold text-zinc-900">Projekt umbenennen</h2>
            </div>
            <button
              @click="cancelRename"
              class="p-2 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <X class="w-5 h-5 text-zinc-600" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-6">
            <label class="block text-sm font-semibold text-zinc-700 mb-2">
              Neuer Name
            </label>
            <div class="relative">
              <input
                ref="renameInputRef"
                v-model="renameInput"
                @input="handleRenameInput"
                @keydown.enter="confirmRename"
                @keydown.esc="cancelRename"
                type="text"
                placeholder="Projektname eingeben..."
                class="w-full px-4 py-3 bg-zinc-50 border-2 rounded-lg outline-none transition-all text-sm"
                :class="renameError 
                  ? 'border-red-500 bg-red-50 focus:border-red-600 focus:bg-red-50 shake' 
                  : 'border-zinc-300 focus:border-blue-500 focus:bg-white'"
              />
              
              <!-- Error Icon -->
              <Transition
                enter-active-class="transition-all duration-200"
                leave-active-class="transition-all duration-150"
                enter-from-class="opacity-0 scale-0"
                enter-to-class="opacity-100 scale-100"
                leave-from-class="opacity-100 scale-100"
                leave-to-class="opacity-0 scale-0"
              >
                <div 
                  v-if="renameError"
                  class="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X class="w-5 h-5 text-red-500" />
                </div>
              </Transition>
            </div>
            
            <!-- Error Message -->
            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              leave-active-class="transition-all duration-150 ease-in"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div 
                v-if="renameError"
                class="flex items-center gap-2 mt-2 text-xs text-red-600 font-medium"
              >
                <X class="w-3.5 h-3.5 flex-shrink-0" />
                <span>Bitte gib einen gültigen Namen ein!</span>
              </div>
            </Transition>

            <!-- Hint -->
            <p class="text-xs text-zinc-500 mt-2">
              <kbd class="px-1.5 py-0.5 bg-zinc-100 rounded text-[10px] font-mono border border-zinc-300">Enter</kbd> zum Speichern, 
              <kbd class="px-1.5 py-0.5 bg-zinc-100 rounded text-[10px] font-mono border border-zinc-300">Esc</kbd> zum Abbrechen
            </p>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex justify-end gap-3">
            <button
              @click="cancelRename"
              class="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              @click="confirmRename"
              class="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <Check class="w-4 h-4" />
              Speichern
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Delete Confirmation Dialog -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @click.self="cancelDelete"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="cancelDelete"></div>

        <!-- Dialog -->
        <div class="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-red-50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 class="w-5 h-5 text-red-600" />
              </div>
              <h2 class="text-base font-bold text-red-900">Projekt löschen?</h2>
            </div>
            <button
              @click="cancelDelete"
              class="p-2 rounded-lg hover:bg-red-100 transition-colors"
            >
              <X class="w-5 h-5 text-red-600" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-6">
            <p class="text-sm text-zinc-700 mb-2">
              Möchtest du <span class="font-bold">{{ projectName }}</span> wirklich löschen?
            </p>
            <p class="text-xs text-zinc-500">
              Diese Aktion kann nicht rückgängig gemacht werden. Alle Zustände, Übergänge und Test Cases werden permanent gelöscht.
            </p>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex justify-end gap-3">
            <button
              @click="cancelDelete"
              class="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              @click="confirmDelete"
              class="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              Löschen
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Shake Animation for Error */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

.shake {
  animation: shake 0.5s ease-in-out;
}
</style>
