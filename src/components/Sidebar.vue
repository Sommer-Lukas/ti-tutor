<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { PanelLeftClose, PanelLeftOpen, Plus, Settings } from 'lucide-vue-next'

const isOpen = defineModel<boolean>('isOpen', { default: true })
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
        variant="outline" 
        class="justify-start gap-2 rounded-full bg-zinc-200 border-none hover:bg-zinc-300 text-zinc-700 font-medium h-12"
        :class="{ 'px-2 justify-center w-10 h-10': !isOpen }"
      >
        <Plus class="h-5 w-5" />
        <span v-if="isOpen">Neuer Automat</span>
      </Button>
    </div>

    <!-- Project List (Placeholder) -->
    <div class="flex-1 overflow-y-auto px-2">
      <div v-if="isOpen" class="text-xs text-zinc-500 px-3 py-2">
        Projekte
      </div>
      <!-- Hier könntest du später eine Liste von gespeicherten Automaten anzeigen -->
    </div>

    <!-- Settings at bottom -->
    <div class="p-2 border-t mt-auto">
      <Button 
        variant="ghost" 
        class="w-full justify-start gap-3 h-12" 
        :class="{ 'justify-center px-0': !isOpen }"
      >
         <Settings class="h-5 w-5 text-zinc-600" />
         <span v-if="isOpen">Einstellungen</span>
      </Button>
    </div>
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
