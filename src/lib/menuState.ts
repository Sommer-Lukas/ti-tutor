/**
 * menuState.ts — Lightweight global state for mutually-exclusive dropdown menus.
 *
 * Only one menu can be open at a time.  Components call `openMenu(id)` /
 * `closeMenu()` and read `isMenuOpen(id)` reactively.
 */

import { ref } from 'vue'

/** Currently open menu identifier, or `null` if all menus are closed. */
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
