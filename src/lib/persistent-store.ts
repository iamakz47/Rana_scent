import { useSyncExternalStore } from "react";
import type { z } from "zod";

// A tiny external store persisted to localStorage and synced across tabs.
// Reads are validated with Zod so corrupted or tampered storage is discarded.
export function createPersistentStore<S extends z.ZodType>(
  key: string,
  schema: S,
  initial: z.infer<S>,
) {
  type State = z.infer<S>;
  let state: State = initial;
  let hydrated = false;
  const listeners = new Set<() => void>();

  function read(): State {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = schema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : initial;
    } catch {
      return initial;
    }
  }

  function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    state = read();
    window.addEventListener("storage", (event) => {
      if (event.key !== key) return;
      state = read();
      listeners.forEach((listener) => listener());
    });
  }

  function set(next: State | ((current: State) => State)) {
    hydrate();
    state = typeof next === "function" ? (next as (current: State) => State)(state) : next;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Storage may be full or blocked (private mode); keep in-memory state.
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    hydrate();
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function useStore(): State {
    return useSyncExternalStore(
      subscribe,
      () => state,
      () => initial,
    );
  }

  return { useStore, set, get: () => state };
}
