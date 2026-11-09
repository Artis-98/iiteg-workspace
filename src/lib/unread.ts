import { useEffect, useState } from "react";
import { fetchReadState, updateReadState } from "./workspace";

/** Client-side "last seen" bookkeeping for channels, DMs and the inbox.
 *  Stored per browser in localStorage — the backend has no read-state table. */

const KEY = "ws-seen-v1";

export type SeenScope = "channel" | "dm" | "inbox" | "mentions" | "replies";

type SeenMap = Record<string, string>;

function load(): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return raw && typeof raw === "object" ? (raw as SeenMap) : {};
  } catch {
    return {};
  }
}

let seen: SeenMap = load();
const listeners = new Set<() => void>();
let syncStarted = false;

export const seenKey = (scope: SeenScope, id?: number) =>
  id === undefined ? scope : `${scope}:${id}`;

export function getSeen(): SeenMap {
  return seen;
}

/** Timestamps arrive both as ISO and as MySQL "YYYY-MM-DD HH:MM:SS" —
 *  compare them numerically, never as raw strings. */
export function toMs(v?: string | null): number {
  if (!v) return 0;
  const n = Date.parse(v.includes("T") ? v : v.replace(" ", "T"));
  return Number.isFinite(n) ? n : 0;
}

export function markSeen(scope: SeenScope, id?: number, at: string = new Date().toISOString()) {
  const key = seenKey(scope, id);
  if (seen[key] && toMs(seen[key]) >= toMs(at)) return;
  seen = { ...seen, [key]: at };
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
  void updateReadState(scope, id ?? 0, at).catch(() => undefined);
}

function mergeRemote() {
  void fetchReadState()
    .then((states) => {
      let changed = false;
      const next = { ...seen };
      states.forEach((state) => {
        const key = seenKey(state.scope, state.scope_id || undefined);
        if (!next[key] || toMs(state.seen_at) > toMs(next[key])) {
          next[key] = state.seen_at;
          changed = true;
        }
      });
      if (!changed) return;
      seen = next;
      try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch { /* ignore */ }
      listeners.forEach((fn) => fn());
    })
    .catch(() => undefined);
}

/** Reactive access to the seen map. */
export function useSeen(): SeenMap {
  const [map, setMap] = useState<SeenMap>(seen);
  useEffect(() => {
    const fn = () => setMap(seen);
    listeners.add(fn);
    fn();
    mergeRemote();
    let timer: number | undefined;
    if (!syncStarted) {
      syncStarted = true;
      timer = window.setInterval(mergeRemote, 15000);
    }
    return () => {
      listeners.delete(fn);
      if (timer !== undefined) {
        window.clearInterval(timer);
        syncStarted = false;
      }
    };
  }, []);
  return map;
}

/** Is this timestamp newer than the last time the scope was opened? */
export function isUnseen(map: SeenMap, scope: SeenScope, id: number | undefined, at?: string | null) {
  if (!at) return false;
  const last = map[seenKey(scope, id)];
  return !last || toMs(at) > toMs(last);
}
