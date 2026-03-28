<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next'
import { isDark } from '@/lib/darkMode'

// Funktion zum Umschalten des Modus
const toggleDarkMode = () => {
  isDark.value = !isDark.value
}
</script>

<template>
  <!-- 
    Ein einfacher, moderner Toggle-Button.
    Wir nutzen role="switch" und aria-checked für gute Accessibility.
  -->
  <button 
    type="button"
    role="switch"
    :aria-checked="isDark"
    @click="toggleDarkMode"
    class="relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-1 dark:focus:ring-zinc-600 focus:ring-offset-white dark:focus:ring-offset-zinc-950"
    :class="isDark ? 'bg-zinc-700' : 'bg-zinc-200 border border-zinc-300'"
    aria-label="Toggle Dark Mode"
    title="Toggle Dark Mode"
  >
    <!-- 
      Der "Knopf" (Thumb) der sich bewegt.
      Translate-Klassen verschieben ihn sanft je nach Zustand.
    -->
    <span 
      class="inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white transition-transform shadow-sm"
      :class="isDark ? 'translate-x-6' : 'translate-x-0.5'"
    >
      <!-- Moon Icon im Dark Mode, Sun Icon im Light Mode -->
      <Moon v-if="isDark" class="h-3 w-3 text-zinc-800" />
      <Sun v-else class="h-3 w-3 text-zinc-500" />
    </span>
  </button>
</template>
