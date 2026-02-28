/**
 * utils.ts — Shared utility functions.
 *
 * - `cn()`           — Merges Tailwind CSS class strings via clsx + tailwind-merge.
 * - `valueUpdater()` — Applies an updater-or-value to a Vue ref (used by
 *                      shadcn/vue table components).
 */

import type { ClassValue } from 'clsx'
import type { Ref } from 'vue'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges class values intelligently, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Accepts either a plain value or an updater function and applies it
 * to the given ref.  Modelled after React’s setState pattern.
 */
export function valueUpdater<T>(updaterOrValue: T | ((prev: T) => T), ref: Ref<T>) {
  ref.value =
    typeof updaterOrValue === 'function'
      ? (updaterOrValue as (prev: T) => T)(ref.value)
      : updaterOrValue
}
