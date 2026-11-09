import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/** Who is at their desk.
 *
 *  The client only reports "active" or "idle" — the server decides whether a
 *  heartbeat is recent enough to count as online at all, so a tab that dies
 *  without firing an unload event still fades out on its own. */

export type PresenceState = "online" | "afk" | "offline";
export type WsPresence = { user_id: number; state: PresenceState; seconds_ago: number };

const ENDPOINT = "/admin/workspace.php?resource=presence";

/** No keyboard or pointer for this long, and you are away rather than online. */
const IDLE_AFTER_MS = 4 * 60 * 1000;
const BEAT_MS = 30_000;
const POLL_MS = 25_000;

export const presenceKey = ["ws-presence"] as const;

/** Turns off once a backend without the presence resource answers. */
let supported = true;

const unsupported = (e: unknown) =>
  e instanceof Error && /unknown resource|method not allowed/i.test(e.message);

async function report(state: "active" | "idle" | "gone", keepalive = false) {
  if (!supported) return;
  try {
    await api(ENDPOINT, { method: "PUT", body: JSON.stringify({ state }), keepalive });
  } catch (e) {
    if (unsupported(e)) supported = false;
  }
}

export const fetchPresence = (): Promise<WsPresence[]> => {
  // Once the backend has told us it has no presence resource, stop asking on
  // every poll — otherwise an un-upgraded API collects a 400 every 25 seconds.
  if (!supported) return Promise.resolve([]);
  return api<{ presence: WsPresence[] }>(ENDPOINT)
    .then((r) => (r.presence || []).map((p) => ({ ...p, user_id: Number(p.user_id) })))
    .catch((e) => {
      if (unsupported(e)) supported = false;
      return [] as WsPresence[];
    });
};

/** Mount once, high in the tree. Beats while the tab lives. */
export function usePresenceHeartbeat() {
  useEffect(() => {
    let lastActivity = Date.now();
    const touch = () => {
      lastActivity = Date.now();
    };
    const events = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "focus"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const currentState = () =>
      document.visibilityState === "hidden" || Date.now() - lastActivity > IDLE_AFTER_MS
        ? "idle"
        : "active";

    const beat = () => report(currentState());
    beat();
    const timer = window.setInterval(beat, BEAT_MS);

    // Switching tabs should register immediately, not at the next beat.
    const onVisibility = () => beat();
    document.addEventListener("visibilitychange", onVisibility);

    // Best effort on close; if it never lands, the TTL handles it server-side.
    const onLeave = () => report("gone", true);
    window.addEventListener("pagehide", onLeave);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      window.clearInterval(timer);
    };
  }, []);
}

/** Lookup of user id -> state. Anyone absent from the table is offline. */
export function usePresenceMap(): Map<number, PresenceState> {
  const { data } = useQuery({
    queryKey: presenceKey,
    queryFn: fetchPresence,
    refetchInterval: POLL_MS,
  });
  const map = new Map<number, PresenceState>();
  (data || []).forEach((p) => map.set(p.user_id, p.state));
  return map;
}

/** Signing out should clear presence rather than leaving a ghost for the TTL. */
export const clearPresence = () => report("gone", true);
