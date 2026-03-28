<!--
  Sidebar.vue — Collapsible left sidebar for project navigation.

  Contains:
   - “Aufgaben” (Exercises) button with completion counter.
   - “Neuer Automat” (New Automaton) button that opens `NewAutomatonDialog`.
   - Scrollable project list with per-project context menu (`ProjectActionsMenu`).
   - Hidden entirely when exercise mode is active.
-->

<script setup lang="ts" name="SidebarNavigation">
import { ref, onMounted, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'
import { PanelLeftClose, PanelLeftOpen, Plus, FileText, BookOpen } from 'lucide-vue-next'
import NewAutomatonDialog from '@/components/NewAutomatonDialog.vue'
import ProjectActionsMenu from '@/components/ProjectActionsMenu.vue'
import { projects, currentProject, setCurrentProject } from '@/lib/automatonStore'
import { exerciseModeActive, enterExerciseMode, getCompletionStats } from '@/lib/exerciseStore'

/** Two-way bound sidebar open/collapsed state. */
const isOpen = defineModel<boolean>('isOpen', { default: true })
const showNewDialog = ref(false)

// Listen for the custom event dispatched from App.vue’s empty-state CTA.
const handleOpenNewDialog = () => {
  showNewDialog.value = true
}

onMounted(() => {
  window.addEventListener('open-new-automaton-dialog', handleOpenNewDialog)
})

onUnmounted(() => {
  window.removeEventListener('open-new-automaton-dialog', handleOpenNewDialog)
})
</script>

<template>
  <aside
    class="flex flex-col border-r bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 transition-all transition-colors duration-300 ease-in-out h-full"
    :class="[isOpen ? 'w-[280px]' : 'w-[68px] items-center']"
  >
    <div class="p-4 flex flex-col gap-4">
      <div class="flex items-center" :class="{ 'justify-center': !isOpen }">
        <Button variant="ghost" size="icon" @click="isOpen = !isOpen" class="text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800">
          <PanelLeftClose v-if="isOpen" />
          <PanelLeftOpen v-else />
        </Button>
      </div>

      <!-- Exercise Mode Button -->
      <Button
        @click="enterExerciseMode()"
        variant="outline"
        class="justify-start gap-2 rounded-full border-none font-medium h-12 transition-all bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300"
        :class="{ 'px-2 justify-center w-10 h-10': !isOpen }"
      >
        <BookOpen class="h-5 w-5" />
        <span v-if="isOpen" class="flex-1 flex items-center justify-between">
          Aufgaben
          <span
            v-if="getCompletionStats().completed > 0"
            class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-300 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
          >
            {{ getCompletionStats().completed }}/{{ getCompletionStats().total }}
          </span>
        </span>
      </Button>

      <Button
        @click="showNewDialog = true"
        variant="outline"
        class="justify-start gap-2 rounded-full bg-zinc-200 border-none hover:bg-zinc-300 text-zinc-700 font-medium h-12 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300"
        :class="{ 'px-2 justify-center w-10 h-10': !isOpen }"
      >
        <Plus class="h-5 w-5" />
        <span v-if="isOpen">Neuer Automat</span>
      </Button>
    </div>

    <!-- Project List -->
    <div class="flex-1 overflow-y-auto px-2">
      <div v-if="isOpen" class="text-xs text-zinc-500 dark:text-zinc-400 px-3 py-2 font-semibold">Projekte</div>

      <div class="space-y-1">
        <div v-for="project in projects" :key="project.id" class="relative group">
          <button
            @click="setCurrentProject(project.id)"
            class="w-full px-3 py-2 rounded-lg text-left transition-colors"
            :class="
              currentProject?.id === project.id
                ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200'
                : 'hover:bg-zinc-200 text-zinc-700 dark:hover:bg-zinc-800 dark:text-zinc-300'
            "
          >
            <div class="flex items-center gap-2">
              <FileText class="w-4 h-4 flex-shrink-0" />
              <div v-if="isOpen" class="flex-1 min-w-0 flex items-center justify-between">
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">{{ project.name }}</div>
                  <div class="text-xs opacity-60">{{ project.type }}</div>
                </div>

                <!-- Actions Menu (Only visible when sidebar is open) -->
                <ProjectActionsMenu :project-id="project.id" :project-name="project.name" />
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="projects.length === 0 && isOpen" class="px-3 py-8 text-center">
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Keine Projekte</p>
        <button
          @click="showNewDialog = true"
          class="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Erstes Projekt erstellen
        </button>
      </div>
    </div>

    <!-- New Automaton Dialog -->
    <NewAutomatonDialog v-model:open="showNewDialog" />
  </aside>
</template>

<style scoped>
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #d4d4d8;
  border-radius: 3px;
}
</style>
