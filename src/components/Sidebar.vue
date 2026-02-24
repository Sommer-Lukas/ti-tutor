<script setup lang="ts" name="SidebarPanel">
import { ref, onMounted, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'
import { PanelLeftClose, PanelLeftOpen, Plus, Settings, FileText } from 'lucide-vue-next'
import NewAutomatonDialog from '@/components/NewAutomatonDialog.vue'
import ProjectActionsMenu from '@/components/ProjectActionsMenu.vue'
import { projects, currentProject, setCurrentProject } from '@/lib/automatonStore'

const isOpen = defineModel<boolean>('isOpen', { default: true })
const showNewDialog = ref(false)

// Listen for custom event to open dialog from empty state
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
    class="flex flex-col border-r bg-zinc-100 transition-all duration-300 ease-in-out h-full"
    :class="[isOpen ? 'w-[280px]' : 'w-[68px] items-center']"
  >
    <div class="p-4 flex flex-col gap-4">
      <div class="flex items-center" :class="{ 'justify-center': !isOpen }">
        <Button variant="ghost" size="icon" @click="isOpen = !isOpen" class="text-zinc-500">
           <PanelLeftClose v-if="isOpen" />
           <PanelLeftOpen v-else />
        </Button>
      </div>

      <Button 
        @click="showNewDialog = true"
        variant="outline" 
        class="justify-start gap-2 rounded-full bg-zinc-200 border-none hover:bg-zinc-300 text-zinc-700 font-medium h-12"
        :class="{ 'px-2 justify-center w-10 h-10': !isOpen }"
      >
        <Plus class="h-5 w-5" />
        <span v-if="isOpen">Neuer Automat</span>
      </Button>
    </div>

    <!-- Project List -->
    <div class="flex-1 overflow-y-auto px-2">
      <div v-if="isOpen" class="text-xs text-zinc-500 px-3 py-2 font-semibold">
        Projekte
      </div>
      
      <div class="space-y-1">
        <div
          v-for="project in projects"
          :key="project.id"
          class="relative group"
        >
          <button
            @click="setCurrentProject(project.id)"
            class="w-full px-3 py-2 rounded-lg text-left transition-colors"
            :class="currentProject?.id === project.id 
              ? 'bg-blue-100 text-blue-900' 
              : 'hover:bg-zinc-200 text-zinc-700'"
          >
            <div class="flex items-center gap-2">
              <FileText class="w-4 h-4 flex-shrink-0" />
              <div v-if="isOpen" class="flex-1 min-w-0 flex items-center justify-between">
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">{{ project.name }}</div>
                  <div class="text-xs opacity-60">{{ project.type }}</div>
                </div>
                
                <!-- Actions Menu (Only visible when sidebar is open) -->
                <ProjectActionsMenu 
                  :project-id="project.id"
                  :project-name="project.name"
                />
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="projects.length === 0 && isOpen" class="px-3 py-8 text-center">
        <p class="text-xs text-zinc-500 mb-2">Keine Projekte</p>
        <button 
          @click="showNewDialog = true"
          class="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Erstes Projekt erstellen
        </button>
      </div>
    </div>

    <!-- Settings at bottom -->
    <div class="p-2 border-t mt-auto">
      <Button 
        variant="ghost" 
        class="w-full justify-start gap-3 h-12" 
        :class="{ 'justify-center px-0': !isOpen }"
      >
         <Settings class="h-5 h-5 text-zinc-600" />
         <span v-if="isOpen">Einstellungen</span>
      </Button>
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
