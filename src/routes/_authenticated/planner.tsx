import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, User, Users } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getUser } from "@/lib/api";
import {
  TASK_STATUS_LABELS,
  fetchAllTasks,
  fetchWsUsers,
  initials,
  taskAssigneeIds,
  updateTask,
  type WsTask,
} from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "Planner — IITEG Workspace" },
      { name: "description", content: "Plan iiteg work across subsidiaries and spaces." },
      { property: "og:title", content: "Planner — IITEG Workspace" },
      { property: "og:description", content: "Plan iiteg work across subsidiaries and spaces." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlannerPage,
});

const labelStyle = { letterSpacing: "0.2em" } as const;
const DAYS = 21;

const dayMs = 86400000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * dayMs);
const iso = (s: string | null | undefined) => (s ? s.slice(0, 10) : null);
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function taskRange(t: WsTask) {
  const s = iso(t.start_date);
  const e = iso(t.end_date) || iso(t.due_date);
  if (!s && !e) return null;
  const from = startOfDay(new Date(s || e!));
  const to = startOfDay(new Date(e || s!));
  return to < from ? { from: to, to: from } : { from, to };
}

const statusColor: Record<string, string> = {
  todo: "bg-[var(--s-4)]/70 border-[var(--line-strong)]",
  in_progress: "bg-sky-500/60 border-sky-400",
  review: "bg-amber-500/60 border-amber-400",
  done: "bg-emerald-500/50 border-emerald-400",
  cancelled: "bg-red-500/40 border-red-400",
};

type Drag = {
  taskId: number;
  mode: "move" | "start" | "end";
  startX: number;
  from: Date;
  to: Date;
  shiftDays: number;
};

function PlannerPage() {
  const me = getUser();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"mine" | "overall">("mine");
  const [offset, setOffset] = useState(0);

  const { data: tasks } = useQuery({ queryKey: ["ws-tasks-all"], queryFn: fetchAllTasks });
  const { data: users } = useQuery({ queryKey: ["ws-users"], queryFn: fetchWsUsers });

  const save = useMutation({
    mutationFn: ({ id, start, end }: { id: number; start: string; end: string }) =>
      updateTask(id, { start_date: start, end_date: end }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ws-tasks-all"] }),
    onError: (e: Error) => toast.error(e.message || "Could not move task"),
  });

  const gridStart = useMemo(() => addDays(startOfDay(new Date()), offset * 7), [offset]);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const gridEnd = days[DAYS - 1]!;

  /* ---- drag to reschedule ---- */
  const laneRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  useEffect(() => {
    if (!drag) return;
    const cell = (laneRef.current?.offsetWidth || 700) / DAYS;
    const onMove = (e: MouseEvent) => {
      const shiftDays = Math.round((e.clientX - drag.startX) / cell);
      setDrag((d) => (d && d.shiftDays !== shiftDays ? { ...d, shiftDays } : d));
    };
    const onUp = () => {
      setDrag(null);
      if (!drag.shiftDays) return;
      const r = previewRange(drag);
      save.mutate({ id: drag.taskId, start: toIso(r.from), end: toIso(r.to) });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, save]);

  function previewRange(d: Drag) {
    if (d.mode === "move") return { from: addDays(d.from, d.shiftDays), to: addDays(d.to, d.shiftDays) };
    if (d.mode === "start") {
      const from = addDays(d.from, d.shiftDays);
      return { from: from > d.to ? d.to : from, to: d.to };
    }
    const to = addDays(d.to, d.shiftDays);
    return { from: d.from, to: to < d.from ? d.from : to };
  }

  const scheduled = useMemo(() => {
    return (tasks || [])
      .map((t) => {
        let range = taskRange(t);
        if (drag && drag.taskId === t.id && range) range = previewRange(drag);
        return { task: t, range };
      })
      .filter((x) => x.range && x.range.to >= gridStart && x.range.from <= gridEnd) as {
      task: WsTask;
      range: { from: Date; to: Date };
    }[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, gridStart, gridEnd, drag]);

  const mine = scheduled.filter((x) => me && taskAssigneeIds(x.task).includes(me.id));

  const byUser = useMemo(() => {
    const groups: { key: string; name: string; rows: typeof scheduled }[] = [];
    (users || []).forEach((u) => {
      const rows = scheduled.filter((x) => taskAssigneeIds(x.task).includes(u.id));
      if (rows.length) groups.push({ key: `u${u.id}`, name: u.name || u.email, rows });
    });
    const un = scheduled.filter((x) => taskAssigneeIds(x.task).length === 0);
    if (un.length) groups.push({ key: "none", name: "Unassigned", rows: un });
    return groups;
  }, [scheduled, users]);

  /** Parents that have subtasks are not counted — a parent overlapping its own subtask is not real overlap. */
  const parentsWithSubtasks = useMemo(() => {
    const s = new Set<number>();
    (tasks || []).forEach((t) => { if (t.parent_id) s.add(t.parent_id); });
    return s;
  }, [tasks]);

  const loadPerDay = useMemo(() => {
    const countable = scheduled.filter((x) => !parentsWithSubtasks.has(x.task.id));
    return days.map((d) => {
      const active = countable.filter((x) => x.range.from <= d && x.range.to >= d);
      const people = new Set(active.flatMap((x) => taskAssigneeIds(x.task)));
      return { count: active.length, people: people.size };
    });
  }, [days, scheduled, parentsWithSubtasks]);

  const colFor = (r: { from: Date; to: Date }) => {
    const startIdx = Math.max(0, Math.round((r.from.getTime() - gridStart.getTime()) / dayMs));
    const endIdx = Math.min(DAYS - 1, Math.round((r.to.getTime() - gridStart.getTime()) / dayMs));
    return { left: (startIdx / DAYS) * 100, width: ((endIdx - startIdx + 1) / DAYS) * 100 };
  };

  const rowsToRender =
    mode === "mine"
      ? [{ key: "mine", name: me?.name || "My tasks", rows: mine }]
      : byUser;

  return (
    <WorkspaceShell>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--line)] px-5">
        <h1 className="text-[11px] uppercase text-[var(--txt-2)]" style={{ letterSpacing: "0.25em" }}>
          Planner
        </h1>
        <div className="ml-3 flex border border-[var(--line)]">
          {([
            { id: "mine", label: "My planner", icon: User },
            { id: "overall", label: "Overall planner", icon: Users },
          ] as const).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] uppercase transition ${
                mode === m.id ? "bg-[var(--txt-1)] text-[var(--s-1)]" : "text-[var(--txt-3)] hover:text-[var(--txt-1)]"
              }`}
              style={labelStyle}
            >
              <m.icon className="h-3 w-3" strokeWidth={1.8} />
              {m.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setOffset((o) => o - 1)} className="border border-[var(--line)] p-1.5 text-[var(--txt-2)] hover:text-[var(--txt-1)]">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] uppercase text-[var(--txt-3)]" style={labelStyle}>
            {gridStart.toLocaleDateString()} — {gridEnd.toLocaleDateString()}
          </span>
          <button onClick={() => setOffset((o) => o + 1)} className="border border-[var(--line)] p-1.5 text-[var(--txt-2)] hover:text-[var(--txt-1)]">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} className="border border-[var(--line)] px-2 py-1.5 text-[9px] uppercase text-[var(--txt-3)] hover:text-[var(--txt-1)]" style={labelStyle}>
              Today
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div className="min-w-[900px] border border-[var(--line)] bg-[var(--s-2)] backdrop-blur-md">
          {/* day header */}
          <div className="flex border-b border-[var(--line)]">
            <div className="w-[220px] shrink-0 border-r border-[var(--line)] px-3 py-2 text-[9px] uppercase text-[var(--txt-3)]" style={labelStyle}>
              {mode === "mine" ? "My tasks" : "People"}
            </div>
            <div className="flex flex-1" ref={laneRef}>
              {days.map((d, i) => {
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                const today = d.getTime() === startOfDay(new Date()).getTime();
                return (
                  <div
                    key={i}
                    className={`flex-1 border-r border-[var(--line)]/60 px-1 py-2 text-center text-[9px] ${
                      today ? "bg-[var(--tint-strong)] text-[var(--txt-1)]" : weekend ? "bg-[var(--input)] text-[var(--txt-3)]" : "text-[var(--txt-3)]"
                    }`}
                  >
                    <div>{d.toLocaleDateString(undefined, { weekday: "narrow" })}</div>
                    <div className="text-[10px]">{d.getDate()}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {rowsToRender.length === 0 && (
            <div className="px-4 py-10 text-center text-[11px] text-[var(--txt-3)]">
              No scheduled tasks in this range. Open a task and set its start and finish dates.
            </div>
          )}

          {rowsToRender.map((group) => (
            <div key={group.key} className="border-b border-[var(--line)]/70">
              {mode === "overall" && (
                <div className="flex items-center gap-2 border-b border-[var(--line)]/60 bg-[var(--input)] px-3 py-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--s-3)] text-[8px] text-[var(--txt-2)]">
                    {initials(group.name)}
                  </span>
                  <span className="text-[11px] text-[var(--txt-2)]">{group.name}</span>
                  <span className="text-[10px] text-[var(--txt-3)]">{group.rows.length} tasks</span>
                </div>
              )}
              {group.rows.length === 0 && mode === "mine" && (
                <div className="px-4 py-8 text-center text-[11px] text-[var(--txt-3)]">
                  Nothing scheduled for you in this range.
                </div>
              )}
              {group.rows.map(({ task, range }) => {
                const pos = colFor(range);
                return (
                  <div key={`${group.key}-${task.id}`} className="flex items-center border-t border-[var(--line)]/40">
                    <div className="w-[220px] shrink-0 border-r border-[var(--line)] px-3 py-2">
                      <p className="truncate text-[12px] text-[var(--txt-1)]">
                        {task.parent_title ? <span className="text-[var(--txt-3)]">{task.parent_title} - </span> : null}
                        {task.title}
                      </p>
                      <p className="truncate text-[10px] text-[var(--txt-3)]">
                        {task.space_name} · {TASK_STATUS_LABELS[task.status]}
                      </p>
                    </div>
                    <div className="relative h-9 flex-1">
                      <div className="absolute inset-0 flex">
                        {days.map((d, i) => (
                          <div
                            key={i}
                            className={`flex-1 border-r border-[var(--line)]/40 ${
                              d.getDay() === 0 || d.getDay() === 6 ? "bg-[var(--input)]" : ""
                            }`}
                          />
                        ))}
                      </div>
                      <div
                        title={`${range.from.toLocaleDateString()} → ${range.to.toLocaleDateString()} — drag to move, drag edges to resize`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setDrag({ taskId: task.id, mode: "move", startX: e.clientX, from: range.from, to: range.to, shiftDays: 0 });
                        }}
                        className={`absolute top-2 flex h-5 cursor-grab items-center overflow-hidden rounded-[3px] border px-2 text-[9px] uppercase text-[var(--txt-1)] select-none active:cursor-grabbing ${
                          statusColor[task.status] || statusColor.todo
                        } ${drag?.taskId === task.id ? "ring-1 ring-white/70" : ""}`}
                        style={{ left: `${pos.left}%`, width: `${pos.width}%`, ...labelStyle }}
                      >
                        <span
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDrag({ taskId: task.id, mode: "start", startX: e.clientX, from: range.from, to: range.to, shiftDays: 0 });
                          }}
                          className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-[var(--tint-strong)]"
                        />
                        <span className="truncate px-1">{task.title}</span>
                        <span
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDrag({ taskId: task.id, mode: "end", startX: e.clientX, from: range.from, to: range.to, shiftDays: 0 });
                          }}
                          className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-[var(--tint-strong)]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {mode === "overall" && (
            <div className="flex items-center border-t border-[var(--line)] bg-[var(--input)]">
              <div className="w-[220px] shrink-0 border-r border-[var(--line)] px-3 py-2 text-[9px] uppercase text-[var(--txt-3)]" style={labelStyle}>
                Load / overlap
              </div>
              <div className="flex flex-1">
                {loadPerDay.map((l, i) => (
                  <div
                    key={i}
                    title={`${l.count} tasks · ${l.people} people`}
                    className={`flex-1 border-r border-[var(--line)]/60 py-2 text-center text-[10px] ${
                      l.count > 3 ? "bg-red-500/20 text-red-300" : l.count > 1 ? "bg-amber-500/15 text-amber-300" : "text-[var(--txt-3)]"
                    }`}
                  >
                    {l.count || "·"}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 flex items-center gap-2 text-[10px] text-[var(--txt-3)]">
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.6} />
          Drag a bar to shift dates, drag its edges to change start or finish. Parent tasks with subtasks are excluded from the overlap count.
        </p>
      </div>
    </WorkspaceShell>
  );
}
