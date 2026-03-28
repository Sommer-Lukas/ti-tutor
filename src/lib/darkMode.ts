import { ref, watch } from 'vue'

// Globaler Zustand für Dark Mode
export const isDark = ref(false)

// Initialisierung aus localStorage / System-Präferenz
if (typeof window !== 'undefined') {
  const storedTheme = localStorage.getItem('theme')
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  
  if (storedTheme === 'dark' || (!storedTheme && systemPrefersDark)) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  } else {
    isDark.value = false
    document.documentElement.classList.remove('dark')
  }
}

// Beobachte Änderungen und aktualisiere DOM + localStorage
watch(isDark, (newVal) => {
  if (typeof window !== 'undefined') {
    const html = document.documentElement
    if (newVal) {
      html.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      html.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }
})
