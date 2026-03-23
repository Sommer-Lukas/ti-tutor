import { ref, computed } from 'vue'

export type RenameMode = 'canvas-node' | 'canvas-edge' | 'project-create' | 'project-rename' | null

export interface RenameState {
  active: boolean
  mode: RenameMode
  value: string
  targetId: string | null
  originalValue: string | null
}

const defaultState: RenameState = {
  active: false,
  mode: null,
  value: '',
  targetId: null,
  originalValue: null,
}

export const renameState = ref<RenameState>({ ...defaultState })

/**
 * Check if we can accept keyboard input for renaming
 * Respects focus state - prevents interference with input fields
 */
export function canAcceptRenameInput(): boolean {
  const activeEl = document.activeElement as HTMLElement

  // If any input/textarea is focused, don't allow rename mode handling
  if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') {
    return false
  }

  return renameState.value.active
}

/**
 * Start rename mode with specified type and target
 */
export function startRename(
  mode: RenameMode,
  targetId: string,
  initialValue: string = '',
): void {
  renameState.value = {
    active: true,
    mode,
    value: initialValue,
    targetId,
    originalValue: initialValue,
  }
}

/**
 * Add character to current rename value
 */
export function appendCharacter(char: string): void {
  if (renameState.value.active) {
    renameState.value.value += char
  }
}

/**
 * Remove last character from rename value (backspace)
 */
export function removeLastCharacter(): void {
  if (renameState.value.active) {
    renameState.value.value = renameState.value.value.slice(0, -1)
  }
}

/**
 * Set the complete value
 */
export function setValue(value: string): void {
  if (renameState.value.active) {
    renameState.value.value = value
  }
}

/**
 * Get current rename value
 */
export function getValue(): string {
  return renameState.value.value
}

/**
 * Get current rename mode
 */
export function getMode(): RenameMode {
  return renameState.value.mode
}

/**
 * Get target ID (node/edge/project ID being renamed)
 */
export function getTargetId(): string | null {
  return renameState.value.targetId
}

/**
 * Check if rename has changed from original
 */
export function hasChanged(): boolean {
  return renameState.value.value !== renameState.value.originalValue
}

/**
 * Exit rename mode without applying changes
 */
export function cancelRename(): void {
  renameState.value = { ...defaultState }
}

/**
 * Apply rename and exit mode
 * Note: Caller is responsible for persisting changes
 */
export function commitRename(): { mode: RenameMode; targetId: string | null; value: string } {
  const result = {
    mode: renameState.value.mode,
    targetId: renameState.value.targetId,
    value: renameState.value.value,
  }
  renameState.value = { ...defaultState }
  return result
}

/**
 * Computed: Is a specific mode active?
 */
export const isNodeRenaming = computed(() => renameState.value.mode === 'canvas-node')
export const isEdgeRenaming = computed(() => renameState.value.mode === 'canvas-edge')
export const isProjectRenaming = computed(() => renameState.value.mode === 'project-rename')
export const isProjectCreating = computed(() => renameState.value.mode === 'project-create')
