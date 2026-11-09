import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, ListTree, Pencil, Play, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { getUser } from "@/lib/api";
import {
  createManualTimeEntry,
  deleteTimeEntry,
  fetchAllTasks,
  fetchTimeEntries,
  startTimeEntry,
  stopTimeEntry,
  taskAssigneeIds,
  updateTimeEntry,
  readableApiError,
  type WsTimeEntry,
} from "@/lib/workspace";

export const timeKey = ["ws-time-entries"] as const;

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** The real instant an entry started.
 *  `started_at` is a bare DATETIME with no zone — parsing it directly makes the
 *  browser read server time as local time, which is where the "starts at 3 hours"
 *  bug came from. `started_at_iso` carries the offset, so it always wins. */
const startedAt = (entry: WsTimeEntry) =>
  new Date(entry.started_at_iso ?? entry.started_at.replace(" ", "T"));

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Local wall-clock from the form -> absolute instant the server can trust. */
const toIso = (date: string, time: string) => {
  const [y, mo, da] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, (mo || 1) - 1, da || 1, h || 0, mi || 0).toISOString();
};

/** Ticks once a second from the server's own elapsed count, re-anchoring on every
 *  refetch so the display can never drift from what the backend believes. */
function useElapsed(entry: WsTimeEntry | null | undefined) {
  const [elapsed, setElapsed] = useState(0);
  const anchor = useRef<{ base: number; at: number } | null>(null);
  const key = entry ? `${entry.id}:${entry.elapsed_seconds ?? ""}` : "";

  useEffect(() => {
    if (!entry) {
      anchor.current = null;
      setElapsed(0);
      return;
    }
    // No elapsed_seconds means the backend predates this fix — count from zero
    // rather than resurrecting the timezone-skewed guess.
    const base = entry.elapsed_seconds ?? 0;
    anchor.current = { base, at: Date.now() };
    setElapsed(base);
    const timer = window.setInterval(() => {
      const a = anchor.current;
      if (a) setElapsed(a.base + Math.floor((Date.now() - a.at) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return elapsed;
}

export function TimeTrackerButton() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: timeKey,
    queryFn: () => fetchTimeEntries(),
    refetchInterval: 15000,
  });
  const elapsed = useElapsed(data?.running);
  const running = !!data?.running;

  return (
    <>
      {/* Idle: a plain round button. Running: it stretches into a pill and the
          clock appears — so the time is only ever on screen while it counts. */}
      <button
        onClick={() => setOpen(true)}
        title={running ? "Tracking — open time" : "Track time"}
        className={`flex h-8 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-all duration-300 ${
          running
            ? "gap-1.5 border-amber-300/40 bg-amber-300/10 pl-2.5 pr-3 text-amber-200 hover:bg-amber-300/20"
            : "w-8 border-[var(--line)] bg-[var(--tint)] text-[var(--txt-2)] hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
        }`}
      >
        <Play className="h-3.5 w-3.5 shrink-0" fill="currentColor" />
        {running && (
          <span data-num className="font-mono text-xs tabular-nums">
            {formatDuration(elapsed)}
          </span>
        )}
      </button>
      {open && <TimeTrackerDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

function TimeTrackerDrawer({ onClose }: { onClose: () => void }) {
  const me = getUser();
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ["ws-tasks", "all"], queryFn: fetchAllTasks });
  const { data } = useQuery({
    queryKey: timeKey,
    queryFn: () => fetchTimeEntries(),
    refetchInterval: 10000,
  });

  const assigned = useMemo(
    () => tasks.filter((task) => me && taskAssigneeIds(task).includes(Number(me.id))),
    [tasks, me],
  );

  const [taskId, setTaskId] = useState(0);
  const [manual, setManual] = useState(false);
  const [editing, setEditing] = useState<WsTimeEntry | null>(null);
  const [date, setDate] = useState(localDate(new Date()));
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: timeKey });
  const onApiError = (e: Error) => toast.error(readableApiError(e));
  const start = useMutation({
    mutationFn: (id: number) => startTimeEntry(id),
    onSuccess: refresh,
    onError: onApiError,
  });
  const stop = useMutation({
    mutationFn: (id: number) => stopTimeEntry(id),
    onSuccess: refresh,
    onError: onApiError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteTimeEntry(id),
    onSuccess: () => {
      setConfirmId(null);
      refresh();
    },
    onError: onApiError,
  });

  const save = useMutation({
    mutationFn: async () => {
      const started_at = toIso(date, from);
      const ended_at = toIso(date, to);
      const duration_seconds = Math.max(
        60,
        Math.floor((new Date(ended_at).getTime() - new Date(started_at).getTime()) / 1000),
      );
      if (editing) {
        await updateTimeEntry(editing.id, {
          task_id: taskId || editing.task_id,
          started_at,
          ended_at,
          duration_seconds,
          notes,
        });
      } else {
        await createManualTimeEntry({
          task_id: taskId,
          started_at,
          ended_at,
          duration_seconds,
          notes,
        });
      }
    },
    onSuccess: () => {
      refresh();
      setManual(false);
      setEditing(null);
      setNotes("");
    },
    onError: onApiError,
  });

  const beginEdit = (entry: WsTimeEntry) => {
    const s = startedAt(entry);
    const e = entry.ended_at_iso ? new Date(entry.ended_at_iso) : s;
    setEditing(entry);
    setManual(true);
    setTaskId(entry.task_id);
    setNotes(entry.notes || "");
    setDate(localDate(s));
    setFrom(localTime(s));
    setTo(localTime(e));
  };

  const elapsed = useElapsed(data?.running);
  const running = data?.running ?? null;

  // Close on Escape, and stop the page behind from scrolling under the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  /** Finished entries, newest first, grouped into day buckets. */
  const days = useMemo(() => {
    const done = (data?.entries || []).filter((e) => e.ended_at);
    const map = new Map<string, { label: string; total: number; entries: WsTimeEntry[] }>();
    done.forEach((entry) => {
      const d = startedAt(entry);
      const key = localDate(d);
      const bucket = map.get(key);
      if (bucket) {
        bucket.total += entry.duration_seconds;
        bucket.entries.push(entry);
      } else {
        map.set(key, {
          label: d.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          }),
          total: entry.duration_seconds,
          entries: [entry],
        });
      }
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([, v]) => v);
  }, [data]);

  const runningTask = running
    ? `${running.parent_title ? `${running.parent_title} - ` : ""}${running.task_title}`
    : null;

  // Rendered into <body>: the workspace header has a backdrop-filter, which makes
  // it the containing block for fixed children and would clip this to its 56px.
  return createPortal(
    <div
      className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <aside
        onClick={(event) => event.stopPropagation()}
        className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-[var(--line)] bg-[var(--s-2)] shadow-2xl"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--line)] px-4">
          <span className="text-sm font-medium text-[var(--txt-1)]">Track time</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--txt-3)] transition hover:bg-[var(--tint-strong)] hover:text-[var(--txt-1)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="shrink-0 space-y-3 border-b border-[var(--line)] p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span
                className={`block font-mono text-4xl tabular-nums ${running ? "text-amber-200" : "text-[var(--txt-1)]"}`}
              >
                {formatDuration(elapsed)}
              </span>
              <span className="mt-1 block truncate text-[11px] text-[var(--txt-3)]">
                {runningTask || "Not tracking"}
              </span>
            </div>
            {running ? (
              <button
                onClick={() => stop.mutate(running.id)}
                disabled={stop.isPending}
                title="Stop"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-300 text-[var(--s-1)] transition hover:bg-amber-200 disabled:opacity-50"
              >
                <Square className="h-4 w-4" fill="currentColor" />
              </button>
            ) : (
              <button
                disabled={!taskId || start.isPending}
                onClick={() => start.mutate(taskId)}
                title={taskId ? "Start" : "Pick a task first"}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--txt-1)] text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-30"
              >
                <Play className="h-4 w-4" fill="currentColor" />
              </button>
            )}
          </div>

          <select
            value={taskId}
            onChange={(e) => setTaskId(Number(e.target.value))}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--input)] px-3 py-2.5 text-sm text-[var(--txt-1)] outline-none transition focus:border-[var(--line-strong)]"
          >
            <option value={0}>
              {assigned.length ? "Select assigned task" : "No tasks assigned to you"}
            </option>
            {assigned.map((task) => (
              <option key={task.id} value={task.id}>
                {task.parent_title ? `${task.parent_title} - ` : ""}
                {task.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setManual((v) => !v);
              setEditing(null);
            }}
            className="text-xs text-[var(--txt-2)] transition hover:text-[var(--txt-1)]"
          >
            {manual ? "− Hide manual entry" : "+ Add time manually"}
          </button>

          {manual && (
            <div className="space-y-2 rounded-md border border-[var(--line)] p-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded border border-[var(--line)] bg-[var(--input)] p-2 text-xs text-[var(--txt-1)]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded border border-[var(--line)] bg-[var(--input)] p-2 text-xs text-[var(--txt-1)]"
                />
                <input
                  type="time"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded border border-[var(--line)] bg-[var(--input)] p-2 text-xs text-[var(--txt-1)]"
                />
              </div>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full rounded border border-[var(--line)] bg-[var(--input)] p-2 text-xs text-[var(--txt-1)] placeholder-[var(--txt-3)]"
              />
              <button
                disabled={!(taskId || editing) || save.isPending}
                onClick={() => save.mutate()}
                className="w-full rounded bg-[var(--txt-1)] py-2 text-xs font-medium text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-30"
              >
                {save.isPending ? "Saving…" : editing ? "Update entry" : "Add entry"}
              </button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-baseline justify-between border-b border-[var(--line)] px-4 py-2.5">
          <span className="text-[10px] uppercase text-[var(--txt-3)]" style={{ letterSpacing: "0.2em" }}>
            Your history
          </span>
          <span className="font-mono text-[11px] tabular-nums text-[var(--txt-2)]">
            {formatDuration(data?.total_seconds ?? 0)} total
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {days.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-[var(--txt-3)]">
              No finished entries yet. Start a timer, or add time manually.
            </p>
          )}
          {days.map((day) => (
            <div key={day.label} className="border-b border-[var(--line)] px-4 py-3 last:border-b-0">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[11px] text-[var(--txt-2)]">{day.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-[var(--txt-3)]">
                  {formatDuration(day.total)}
                </span>
              </div>
              <div className="space-y-1.5">
                {day.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="group flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--tint)] px-3 py-2.5"
                  >
                    <Clock3 className="h-4 w-4 shrink-0 text-[var(--txt-3)]" strokeWidth={1.6} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-[var(--txt-1)]">
                        {entry.parent_title ? `${entry.parent_title} - ` : ""}
                        {entry.task_title}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-[var(--txt-3)]">
                        {localTime(startedAt(entry))}
                        {entry.ended_at_iso ? `–${localTime(new Date(entry.ended_at_iso))}` : ""}
                        {entry.notes ? ` · ${entry.notes}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--txt-2)]">
                      {formatDuration(entry.duration_seconds)}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        title="Start this task again"
                        onClick={() => start.mutate(entry.task_id)}
                        className="flex h-7 w-7 items-center justify-center rounded text-[var(--txt-3)] transition hover:bg-[var(--tint-strong)] hover:text-[var(--txt-1)]"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Edit"
                        onClick={() => beginEdit(entry)}
                        className="flex h-7 w-7 items-center justify-center rounded text-[var(--txt-3)] transition hover:bg-[var(--tint-strong)] hover:text-[var(--txt-1)]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => setConfirmId(entry.id)}
                        className="flex h-7 w-7 items-center justify-center rounded text-[var(--txt-3)] transition hover:bg-[var(--tint-strong)] hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {confirmId !== null && (
          <div className="absolute inset-x-0 bottom-0 border-t border-[var(--line)] bg-[#111] p-4">
            <p className="text-xs text-[var(--txt-1)]">Delete this time entry?</p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="rounded border border-[var(--line)] px-3 py-1.5 text-[11px] text-[var(--txt-2)] transition hover:border-[var(--line-strong)] hover:text-[var(--txt-1)]"
              >
                Cancel
              </button>
              <button
                onClick={() => remove.mutate(confirmId)}
                disabled={remove.isPending}
                className="rounded bg-red-500 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {remove.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

export function TaskTimeControl({ taskId }: { taskId: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: [...timeKey, taskId],
    queryFn: () => fetchTimeEntries(taskId),
    refetchInterval: 10000,
  });
  // Stop only what this row started; a timer on a subtask stays a subtask's.
  const mineRunning =
    data?.running && Number(data.running.task_id) === taskId ? data.running : null;
  const rolledUp =
    !!data && (data.subtask_count ?? 0) > 0 && data.total_seconds > (data.own_seconds ?? 0);
  const mutation = useMutation({
    mutationFn: async () => {
      if (mineRunning) await stopTimeEntry(mineRunning.id);
      else await startTimeEntry(taskId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timeKey });
      qc.invalidateQueries({ queryKey: [...timeKey, taskId] });
    },
    onError: (e: Error) => toast.error(readableApiError(e)),
  });

  return (
    <div className="relative flex items-center gap-2">
      <button
        onClick={() => mutation.mutate()}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] transition hover:bg-[var(--tint-strong)]"
      >
        {mineRunning ? (
          <Square className="h-3 w-3 text-amber-300" fill="currentColor" />
        ) : (
          <Play className="h-3 w-3" fill="currentColor" />
        )}
      </button>
      {/* total_seconds already covers the whole subtree; the tree glyph marks
          when that number is bigger than this task's own logged time. */}
      <button
        onClick={() => setOpen(!open)}
        title={
          rolledUp
            ? `${formatDuration(data!.own_seconds!)} on this task · ${formatDuration(
                data!.total_seconds,
              )} including ${data!.subtask_count} subtask${data!.subtask_count === 1 ? "" : "s"}`
            : "Time logged on this task"
        }
        className="flex items-center gap-1 font-mono text-xs text-[var(--txt-2)] transition hover:text-[var(--txt-1)]"
      >
        {rolledUp && <ListTree className="h-3 w-3 shrink-0 opacity-70" strokeWidth={1.8} />}
        <span data-num>{formatDuration(data?.total_seconds ?? 0)}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 max-h-64 w-80 overflow-auto rounded-md border border-[var(--line)] bg-[var(--s-2)] p-2 shadow-2xl">
          {(data?.entries || []).length === 0 && (
            <p className="p-2 text-[11px] text-[var(--txt-3)]">No time logged yet.</p>
          )}
          {data?.entries.map((entry) => (
            <div key={entry.id} className="border-b border-white/5 p-2 text-xs last:border-b-0">
              <div className="flex justify-between text-[var(--txt-2)]">
                <span className="truncate">{entry.user_name || entry.user_email}</span>
                <span className="shrink-0 font-mono tabular-nums">
                  {entry.ended_at ? formatDuration(entry.duration_seconds) : "Running"}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-[var(--txt-3)]">
                {startedAt(entry).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
