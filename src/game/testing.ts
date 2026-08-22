/**
 * Test-only helpers. Never imported by the app — vitest is a dev dependency, so
 * a stray import from application code fails the production build loudly.
 */
import { vi } from 'vitest'

export const STORAGE_KEY = 'binomial-picker/v1'

/**
 * A minimal synchronous localStorage. zustand's persist middleware hydrates
 * during store creation when storage is synchronous, so seeding this before
 * importing the store is equivalent to a page load.
 */
function stubLocalStorage(seed?: string): Map<string, string> {
  const entries = new Map<string, string>()
  if (seed !== undefined) entries.set(STORAGE_KEY, seed)

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, String(value)),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
    key: (i: number) => [...entries.keys()][i] ?? null,
    get length() {
      return entries.size
    },
  })

  return entries
}

/**
 * A fresh game as it would be on a page load, with its storage and the scoring
 * rules alongside. Pass `seed` to load with persisted state already present.
 */
export async function loadGame(seed?: string) {
  const storage = stubLocalStorage(seed)
  vi.resetModules()
  const [store, scoring] = await Promise.all([import('./store'), import('./scoring')])
  return { storage, ...store, ...scoring }
}
