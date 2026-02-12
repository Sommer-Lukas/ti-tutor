import { ref } from 'vue'

// Global state to track which menu is currently open
export const openMenuId = ref<string | null>(null)

export function openMenu(menuId: string) {
  openMenuId.value = menuId
}

export function closeMenu() {
  openMenuId.value = null
}

export function isMenuOpen(menuId: string): boolean {
  return openMenuId.value === menuId
}
