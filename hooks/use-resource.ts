"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/finflow/api";

interface Snapshot {
  data: unknown;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
}
interface Entry {
  snapshot: Snapshot;
  listeners: Set<() => void>;
  updatedAt: number;
  loaded: boolean;
  generation: number;
  pending?: Promise<void>;
  controller?: AbortController;
}
const initial: Snapshot = {
  data: undefined,
  error: null,
  isLoading: true,
  isValidating: false,
};
const disabled: Snapshot = { ...initial, isLoading: false };
const cache = new Map<string, Entry>();
const FRESH_FOR_MS = 30_000;

function entryFor(path: string): Entry {
  let entry = cache.get(path);
  if (!entry) {
    entry = {
      snapshot: initial,
      listeners: new Set(),
      updatedAt: 0,
      loaded: false,
      generation: 0,
    };
    cache.set(path, entry);
  }
  return entry;
}

function publish(entry: Entry, patch: Partial<Snapshot>): void {
  entry.snapshot = { ...entry.snapshot, ...patch };
  entry.listeners.forEach((listener) => listener());
}

function revalidate(path: string, force = false): Promise<void> {
  const entry = entryFor(path);
  if (entry.pending) return entry.pending;
  if (!force && Date.now() - entry.updatedAt < FRESH_FOR_MS)
    return Promise.resolve();
  const generation = entry.generation;
  const controller = new AbortController();
  entry.controller = controller;
  publish(entry, { isValidating: true, isLoading: !entry.loaded, error: null });
  const pending = api
    .get<unknown>(path, { signal: controller.signal })
    .then((data) => {
      if (entry.generation !== generation) return;
      entry.loaded = true;
      entry.updatedAt = Date.now();
      publish(entry, { data, error: null, isLoading: false });
    })
    .catch((error: unknown) => {
      if (entry.generation !== generation || controller.signal.aborted) return;
      entry.updatedAt = Date.now();
      publish(entry, {
        error:
          error instanceof Error
            ? error
            : new Error("Não foi possível carregar os dados."),
        isLoading: false,
      });
    })
    .finally(() => {
      if (entry.pending !== pending) return;
      entry.pending = undefined;
      entry.controller = undefined;
      publish(entry, { isValidating: false });
    });
  entry.pending = pending;
  return pending;
}

/** Revalidate mounted queries and mark inactive queries stale after a mutation. */
export function invalidateResources(prefixes: string[]): void {
  cache.forEach((entry, path) => {
    if (
      !prefixes.some(
        (prefix) =>
          prefix === "/" ||
          path === prefix ||
          path.startsWith(`${prefix}?`) ||
          path.startsWith(`${prefix}/`),
      )
    )
      return;
    entry.updatedAt = 0;
    // Discard a response requested before the mutation, which could contain stale data.
    entry.generation += 1;
    entry.controller?.abort();
    entry.pending = undefined;
    entry.controller = undefined;
    if (entry.listeners.size) void revalidate(path, true);
  });
}

/** Clear private data when credentials change or the user disconnects. */
export function clearResources(): void {
  cache.forEach((entry) => {
    entry.generation += 1;
    entry.controller?.abort();
    entry.pending = undefined;
    entry.controller = undefined;
    entry.loaded = false;
    entry.updatedAt = 0;
    publish(entry, initial);
  });
}

export function useResource<T>(path: string | null): {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  refresh: () => void;
} {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!path) return () => {};
      const entry = entryFor(path);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    [path],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    useCallback(() => (path ? entryFor(path).snapshot : disabled), [path]),
    useCallback(() => (path ? initial : disabled), [path]),
  );

  useEffect(() => {
    if (!path) return;
    void revalidate(path);
    const onVisible = () => {
      if (document.visibilityState === "visible") void revalidate(path);
    };
    const onOnline = () => {
      void revalidate(path, true);
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [path]);

  const refresh = useCallback(() => {
    if (path) void revalidate(path, true);
  }, [path]);
  return { ...snapshot, data: snapshot.data as T | undefined, refresh };
}
