import { api } from "./api";

/* ===== Types ===== */

export type WsUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  /** Uploaded profile picture; falls back to initials when null. */
  avatar_url?: string | null;
};

export type WsChannel = {
  id: number;
  name: string;
  description: string | null;
  is_private: number;
  /** People granted access when private. */
  member_ids: number[];
  /** Whole teams granted access when private. */
  team_ids: number[];
  icon?: string | null;
  color?: string | null;
};

/** Look override for a subsidiary. The list itself is defined in the client. */
export type WsSubsidiary = {
  slug: string;
  icon: string | null;
  color: string | null;
  is_private?: number;
  member_ids?: number[];
  team_ids?: number[];
};

/** One emoji on one message, already tallied server-side. */
export type WsReaction = {
  emoji: string;
  count: number;
  /** True when the signed-in user is one of the reactors. */
  mine: boolean;
  user_ids: number[];
};

export type WsMessage = {
  id: number;
  channel_id: number | null;
  sender_id: number;
  recipient_id: number | null;
  body: string;
  created_at: string;
  /** Set once the author has rewritten it; drives the "edited" marker. */
  edited_at?: string | null;
  reactions?: WsReaction[];
  /** The message this one answers, with its quoted line already resolved. */
  reply_to?: number | null;
  reply_body?: string | null;
  reply_sender_name?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
};

export type WsSpace = {
  id: number;
  name: string;
  parent_id: number | null;
  color: string | null;
  /** Name from SPACE_ICONS — the space's logo. */
  icon?: string | null;
  /** A private space hides its whole subtree from anyone without access. */
  is_private?: number;
  member_ids?: number[];
  team_ids?: number[];
};

// Cancelled sits last and is drawn in red: it is a record of work that was
// dropped on purpose, kept so the reason is not lost, not a stage work moves through.
export const TASK_STATUSES = ["todo", "in_progress", "review", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "Review",
  done: "Complete",
  cancelled: "Cancelled",
};

/* ===== Board columns =====
   The five statuses above are now only the fallback. A space can define its
   own, and a task's status is just the column key, so renaming a column keeps
   its key and leaves every task where it was. */

export const COLUMN_TONES = [
  "slate", "sky", "amber", "green", "red", "violet", "pink", "teal",
] as const;
export type ColumnTone = (typeof COLUMN_TONES)[number];

export type BoardColumn = { key: string; label: string; tone: string };

export type SpaceColumns = {
  columns: BoardColumn[];
  /** own = this space defines them, inherited = an ancestor does. */
  source: "own" | "inherited" | "default";
  from: number | null;
  hidden: string[];
  /** Own columns plus anything extra the subspaces use, for a rollup board. */
  rollup: BoardColumn[];
  defaults?: BoardColumn[];
};

export const fetchSpaceColumns = (spaceId: number) =>
  live("space_columns", () =>
    api<SpaceColumns>(`${R}space_columns&space_id=${spaceId}`),
  );

export const saveSpaceColumns = (
  spaceId: number,
  body: { columns?: BoardColumn[]; hidden?: string[] },
) =>
  live("space_columns", () =>
    api<SpaceColumns>(`${R}space_columns&space_id=${spaceId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  );

/** Drop this space's own columns and go back to inheriting. */
export const resetSpaceColumns = (spaceId: number) =>
  live("space_columns", () =>
    api<SpaceColumns>(`${R}space_columns&space_id=${spaceId}`, { method: "DELETE" }),
  );

export const TASK_PRIORITIES = ["none", "low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type WsTask = {
  id: number;
  space_id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: number | null;
  assignee_name?: string | null;
  assignee_ids?: number[];
  assignee_names?: string[];
  parent_id?: number | null;
  parent_title?: string | null;
  /** YY-NNN on a top-level task. Null on anything with a parent. */
  project_no?: string | null;
  /** Two-digit component index within its project. Null on a top-level task. */
  item_no?: number | null;
  /** The owning project's number, resolved server-side for components too. */
  root_project_no?: string | null;
  comment_count?: number;
  due_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  sort_order: number;
  space_name?: string | null;
  tracked_seconds?: number;
  /** This task plus every subtask beneath it, at any depth. */
  tracked_seconds_total?: number;
};

export type WsReadState = {
  scope: "channel" | "dm" | "inbox" | "mentions" | "replies";
  scope_id: number;
  seen_at: string;
};

export type WsTimeEntry = {
  id: number;
  task_id: number;
  task_title: string;
  parent_title?: string | null;
  space_name?: string | null;
  user_id: number;
  user_name?: string | null;
  user_email?: string | null;
  started_at: string;
  ended_at: string | null;
  /** Absolute ISO-8601 with offset. Always prefer these over the naive
   *  `started_at`/`ended_at`, which carry no timezone and read as local. */
  started_at_iso?: string | null;
  ended_at_iso?: string | null;
  /** Server-computed, only present on the running entry. */
  elapsed_seconds?: number;
  duration_seconds: number;
  notes: string | null;
};

export type WsTaskComment = {
  id: number;
  task_id: number;
  user_id: number | null;
  body: string;
  created_at: string;
  user_name?: string | null;
  user_email?: string | null;
  reply_to?: number | null;
  reply_body?: string | null;
  reply_user_name?: string | null;
};


export type WsTeam = {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  member_ids: number[];
};

/** A shared document. List responses carry `excerpt`; only a single fetch carries `body`. */
export type WsDoc = {
  id: number;
  space_id: number | null;
  title: string;
  body?: string | null;
  excerpt?: string | null;
  is_pinned: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  space_name?: string | null;
  updated_by_name?: string | null;
};


const R = "/admin/workspace.php?resource=";

/* ===== Live status (for the corner badge) =====
   All data comes from your configured API — there is no demo/in-memory fallback. */
export type WsSource = "unknown" | "live" | "degraded" | "offline";
export type WsRequestStatus = {
  resource: string;
  state: "checking" | "success" | "error";
  checkedAt: string;
  latencyMs: number | null;
  error: string | null;
};
export type WsStatus = {
  source: WsSource;
  error: string | null;
  lastSync: string | null;
  lastCheck: string | null;
  inFlight: number;
  successes: number;
  failures: number;
  requests: WsRequestStatus[];
};
const wsRequests = new Map<string, WsRequestStatus>();
let wsLastSync: string | null = null;
let wsLastCheck: string | null = null;
let wsInFlight = 0;
let wsSuccesses = 0;
let wsFailures = 0;
const listeners = new Set<() => void>();

function notifyWsStatus() {
  listeners.forEach((listener) => listener());
}

/** Unwraps the JSON error envelope the PHP API returns into a plain sentence. */
export function readableApiError(error: unknown) {
  if (!(error instanceof Error)) return "API unreachable";
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    return parsed.error || error.message;
  } catch {
    return error.message;
  }
}

export const getWsStatus = (): WsStatus => {
  const requests = Array.from(wsRequests.values()).sort((a, b) => a.resource.localeCompare(b.resource));
  const errors = requests.filter((request) => request.state === "error");
  const hasSuccess = requests.some((request) => request.state === "success");
  const source: WsSource = requests.length === 0
    ? "unknown"
    : errors.length === 0
      ? "live"
      : hasSuccess
        ? "degraded"
        : "offline";

  return {
    source,
    error: errors.at(-1)?.error || null,
    lastSync: wsLastSync,
    lastCheck: wsLastCheck,
    inFlight: wsInFlight,
    successes: wsSuccesses,
    failures: wsFailures,
    requests,
  };
};
export function subscribeWsStatus(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function live<T>(resource: string, call: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  wsInFlight += 1;
  wsLastCheck = checkedAt;
  wsRequests.set(resource, { resource, state: "checking", checkedAt, latencyMs: null, error: null });
  notifyWsStatus();
  try {
    const res = await call();
    const completedAt = new Date().toISOString();
    wsSuccesses += 1;
    wsLastSync = completedAt;
    wsLastCheck = completedAt;
    wsRequests.set(resource, {
      resource,
      state: "success",
      checkedAt: completedAt,
      latencyMs: Date.now() - startedAt,
      error: null,
    });
    return res;
  } catch (e) {
    const completedAt = new Date().toISOString();
    wsFailures += 1;
    wsLastCheck = completedAt;
    wsRequests.set(resource, {
      resource,
      state: "error",
      checkedAt: completedAt,
      latencyMs: Date.now() - startedAt,
      error: readableApiError(e),
    });
    throw e;
  } finally {
    wsInFlight = Math.max(0, wsInFlight - 1);
    notifyWsStatus();
  }
}

/* ===== Id normalisation =====
   MySQL/PDO hands back integers as strings, so every id is coerced here.
   Without this, `ids.includes(user.id)` silently fails everywhere. */
const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);
const numList = (v: unknown): number[] =>
  Array.isArray(v) ? v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0) : [];

const normUser = (u: WsUser): WsUser => ({ ...u, id: Number(u.id) });

/* Messages and comments were the last shapes still handed back raw, so their
   sender_id / user_id stayed strings while every user id had been coerced to a
   number. Any `=== me.id` or `find(u => u.id === …)` against them silently
   failed — no error, just a comparison that could never be true. */
const normMessage = (m: WsMessage): WsMessage => ({
  ...m,
  id: Number(m.id),
  sender_id: Number(m.sender_id),
  channel_id: num(m.channel_id),
  recipient_id: num(m.recipient_id),
  // Reaction counts arrive as strings for the same reason ids did.
  reply_to: num(m.reply_to),
  reactions: (m.reactions || []).map((r) => ({
    ...r,
    count: Number(r.count),
    mine: Boolean(r.mine),
    user_ids: numList(r.user_ids),
  })),
});

const normComment = (c: WsTaskComment): WsTaskComment => ({
  ...c,
  id: Number(c.id),
  task_id: Number(c.task_id),
  user_id: num(c.user_id),
});

const normTask = (t: WsTask): WsTask => ({
  ...t,
  id: Number(t.id),
  space_id: Number(t.space_id),
  assignee_id: num(t.assignee_id),
  assignee_ids: numList(t.assignee_ids),
  parent_id: num(t.parent_id),
  item_no: num(t.item_no),
  comment_count: Number(t.comment_count ?? 0),
  sort_order: Number(t.sort_order ?? 0),
  tracked_seconds: Number(t.tracked_seconds ?? 0),
  tracked_seconds_total: Number(t.tracked_seconds_total ?? t.tracked_seconds ?? 0),
});

const normTimeEntry = (entry: WsTimeEntry): WsTimeEntry => ({
  ...entry,
  id: Number(entry.id),
  task_id: Number(entry.task_id),
  user_id: Number(entry.user_id),
  duration_seconds: Number(entry.duration_seconds ?? 0),
  elapsed_seconds: entry.elapsed_seconds === undefined ? undefined : Number(entry.elapsed_seconds),
});

const normTeam = (t: WsTeam): WsTeam => ({
  ...t,
  id: Number(t.id),
  member_ids: numList(t.member_ids),
});

const normDoc = (d: WsDoc): WsDoc => ({
  ...d,
  id: Number(d.id),
  space_id: num(d.space_id),
  created_by: num(d.created_by),
  updated_by: num(d.updated_by),
  is_pinned: Number(d.is_pinned) ? 1 : 0,
});

/* ===== Users ===== */

export const fetchWsUsers = () =>
  live("users", () => api<{ users: WsUser[] }>(`${R}users`).then((r) => r.users.map(normUser)));

export const createWsUser = (p: { email: string; password: string; name?: string; role?: string }) =>
  live("users", () => api<{ id: number }>(`${R}users`, { method: "POST", body: JSON.stringify(p) }));

/* ===== Channels ===== */

const normChannel = (c: WsChannel): WsChannel => ({
  ...c,
  id: Number(c.id),
  is_private: Number(c.is_private) ? 1 : 0,
  member_ids: numList(c.member_ids),
  team_ids: numList(c.team_ids),
});

export const fetchChannels = () =>
  live("channels", () =>
    api<{ channels: WsChannel[] }>(`${R}channels`).then((r) => (r.channels || []).map(normChannel)),
  );

export const createChannel = (p: {
  name: string;
  description?: string;
  is_private: boolean;
  member_ids: number[];
  team_ids?: number[];
  icon?: string;
  color?: string;
}) => live("channels", () => api<{ id: number }>(`${R}channels`, { method: "POST", body: JSON.stringify(p) }));

export const updateChannel = (
  id: number,
  p: {
    name?: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    is_private?: boolean;
    member_ids?: number[];
    team_ids?: number[];
  },
) =>
  live("channels", () =>
    api<{ success: boolean }>(`${R}channels&id=${id}`, { method: "PUT", body: JSON.stringify(p) }),
  );

export const deleteChannel = (id: number) =>
  live("channels", () => api<{ success: boolean }>(`${R}channels&id=${id}`, { method: "DELETE" }));

/* ===== Subsidiary look overrides ===== */

/** Looks, plus the slugs this user may not see at all. */
export type WsSubsidiaryAccess = { looks: WsSubsidiary[]; hidden: string[] };

const normSubsidiary = (s: WsSubsidiary): WsSubsidiary => ({
  ...s,
  is_private: Number(s.is_private) ? 1 : 0,
  member_ids: numList(s.member_ids),
  team_ids: numList(s.team_ids),
});

/** Older backends have no `subsidiaries` resource — fall back to no overrides. */
export const fetchSubsidiaryLooks = (): Promise<WsSubsidiaryAccess> =>
  api<{ subsidiaries: WsSubsidiary[]; hidden?: string[] }>(`${R}subsidiaries`)
    .then((r) => ({
      looks: (r.subsidiaries || []).map(normSubsidiary),
      hidden: r.hidden || [],
    }))
    .catch(() => ({ looks: [], hidden: [] }));

export const saveSubsidiaryLook = (p: {
  slug: string;
  icon?: string | null;
  color?: string | null;
  is_private?: boolean;
  member_ids?: number[];
  team_ids?: number[];
}) =>
  live("subsidiaries", () =>
    api<{ success: boolean }>(`${R}subsidiaries`, { method: "PUT", body: JSON.stringify(p) }),
  );

/* ===== Messages ===== */

export const fetchChannelMessages = (channelId: number) =>
  live("messages", () =>
    api<{ messages: WsMessage[] }>(`${R}messages&channel_id=${channelId}`).then((r) =>
      (r.messages || []).map(normMessage),
    ),
  );

export const fetchDirectMessages = (userId: number) =>
  live("messages", () =>
    api<{ messages: WsMessage[] }>(`${R}messages&dm=${userId}`).then((r) =>
      (r.messages || []).map(normMessage),
    ),
  );

export const sendMessage = (p: {
  channel_id?: number; recipient_id?: number; body: string; reply_to?: number | null;
}) =>
  live("messages", () => api<{ id: number }>(`${R}messages`, { method: "POST", body: JSON.stringify(p) }));

/** Rewrite your own message. The server refuses anyone else's outright. */
export const editMessage = (id: number, body: string) =>
  live("messages", () =>
    api<{ success: boolean }>(`${R}messages&id=${id}`, { method: "PUT", body: JSON.stringify({ body }) }),
  );

export const deleteMessage = (id: number) =>
  live("messages", () => api<{ success: boolean }>(`${R}messages&id=${id}`, { method: "DELETE" }));

/** Add or remove one emoji — the same call does both. */
export const toggleReaction = (messageId: number, emoji: string) =>
  live("message_reactions", () =>
    api<{ success: boolean; on: boolean }>(`${R}message_reactions`, {
      method: "POST",
      body: JSON.stringify({ message_id: messageId, emoji }),
    }),
  );

/* ===== Spaces ===== */

const normSpace = (s: WsSpace): WsSpace => ({
  ...s,
  id: Number(s.id),
  parent_id: num(s.parent_id),
  is_private: Number(s.is_private) ? 1 : 0,
  member_ids: numList(s.member_ids),
  team_ids: numList(s.team_ids),
});

export const fetchSpaces = () =>
  live("spaces", () => api<{ spaces: WsSpace[] }>(`${R}spaces`).then((r) => (r.spaces || []).map(normSpace)));

export const createSpace = (p: {
  name: string;
  parent_id?: number | null;
  color?: string;
  icon?: string;
  is_private?: boolean;
  member_ids?: number[];
  team_ids?: number[];
}) =>
  live("spaces", () => api<{ id: number }>(`${R}spaces`, { method: "POST", body: JSON.stringify(p) }));

export const updateSpace = (
  id: number,
  p: {
    name?: string;
    color?: string | null;
    icon?: string | null;
    is_private?: boolean;
    member_ids?: number[];
    team_ids?: number[];
  },
) =>
  live("spaces", () => api<{ success: boolean }>(`${R}spaces&id=${id}`, { method: "PUT", body: JSON.stringify(p) }));

export const deleteSpace = (id: number) =>
  live("spaces", () => api<{ success: boolean }>(`${R}spaces&id=${id}`, { method: "DELETE" }));

/* ===== Teams ===== */

export const fetchTeams = () =>
  live("teams", () => api<{ teams: WsTeam[] }>(`${R}teams`).then((r) => r.teams.map(normTeam)));

export const createTeam = (p: { name: string; description?: string; color?: string; member_ids: number[] }) =>
  live("teams", () => api<{ id: number }>(`${R}teams`, { method: "POST", body: JSON.stringify(p) }));

export const updateTeam = (
  id: number,
  p: { name?: string; description?: string | null; color?: string | null; member_ids?: number[] }
) => live("teams", () => api<{ success: boolean }>(`${R}teams&id=${id}`, { method: "PUT", body: JSON.stringify(p) }));

export const deleteTeam = (id: number) =>
  live("teams", () => api<{ success: boolean }>(`${R}teams&id=${id}`, { method: "DELETE" }));

/* ===== Tasks ===== */

export const fetchTasks = (spaceId: number) =>
  live("tasks", () => api<{ tasks: WsTask[] }>(`${R}tasks&space_id=${spaceId}`).then((r) => r.tasks.map(normTask)));

export const fetchAllTasks = () =>
  live("tasks", () => api<{ tasks: WsTask[] }>(`${R}tasks&all=1`).then((r) => r.tasks.map(normTask)));



export const createTask = (p: Partial<WsTask> & { space_id: number; title: string }) =>
  live("tasks", () => api<{ id: number }>(`${R}tasks`, { method: "POST", body: JSON.stringify(p) }));

export const updateTask = (id: number, p: Partial<WsTask>) =>
  live("tasks", () => api<{ success: boolean }>(`${R}tasks&id=${id}`, { method: "PUT", body: JSON.stringify(p) }));

export const deleteTask = (id: number) =>
  live("tasks", () => api<{ success: boolean }>(`${R}tasks&id=${id}`, { method: "DELETE" }));

/* ===== Synced notification read-state ===== */

export const fetchReadState = () =>
  live("read_state", () => api<{ states: WsReadState[] }>(`${R}read_state`).then((r) => r.states));

export const updateReadState = (scope: WsReadState["scope"], scopeId: number, seenAt: string) =>
  live("read_state", () => api<{ success: boolean }>(`${R}read_state`, {
    method: "PUT",
    body: JSON.stringify({ scope, scope_id: scopeId, seen_at: seenAt }),
  }));

/* ===== Time tracking ===== */

export const fetchTimeEntries = (taskId?: number) =>
  live("time_entries", () =>
    api<{
      entries: WsTimeEntry[];
      running: WsTimeEntry | null;
      /** With `taskId`, this covers the task and every subtask below it. */
      total_seconds: number;
      own_seconds?: number;
      subtask_count?: number;
    }>(`${R}time_entries${taskId ? `&task_id=${taskId}` : ""}`).then((r) => ({
      ...r,
      entries: r.entries.map(normTimeEntry),
      running: r.running ? normTimeEntry(r.running) : null,
      total_seconds: Number(r.total_seconds ?? 0),
      own_seconds: Number(r.own_seconds ?? r.total_seconds ?? 0),
      subtask_count: Number(r.subtask_count ?? 0),
    })),
  );

export const startTimeEntry = (taskId: number, startedAt?: string) =>
  live("time_entries", () => api<{ id: number }>(`${R}time_entries`, {
    method: "POST",
    body: JSON.stringify({ action: "start", task_id: taskId, started_at: startedAt }),
  }));

export const createManualTimeEntry = (p: {
  task_id: number;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  notes?: string;
}) => live("time_entries", () => api<{ id: number }>(`${R}time_entries`, {
  method: "POST",
  body: JSON.stringify({ action: "manual", ...p }),
}));

export const stopTimeEntry = (id: number) =>
  live("time_entries", () => api<{ success: boolean }>(`${R}time_entries&id=${id}`, {
    method: "PUT",
    body: JSON.stringify({ action: "stop" }),
  }));

export const updateTimeEntry = (id: number, p: {
  task_id?: number;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  notes?: string | null;
}) => live("time_entries", () => api<{ success: boolean }>(`${R}time_entries&id=${id}`, {
  method: "PUT",
  body: JSON.stringify(p),
}));

export const deleteTimeEntry = (id: number) =>
  live("time_entries", () => api<{ success: boolean }>(`${R}time_entries&id=${id}`, { method: "DELETE" }));

/* ===== Task chat (internal comments) ===== */

export const fetchTaskComments = (taskId: number) =>
  live("task_comments", () =>
    api<{ comments: WsTaskComment[] }>(`${R}task_comments&task_id=${taskId}`).then((r) =>
      (r.comments || []).map(normComment),
    ),
  );

export const createTaskComment = (taskId: number, body: string, replyTo?: number | null) =>
  live("task_comments", () =>
    api<{ id: number }>(`${R}task_comments`, {
      method: "POST",
      body: JSON.stringify({ task_id: taskId, body, reply_to: replyTo || undefined }),
    })
  );

export const deleteTaskComment = (id: number) =>
  live("task_comments", () =>
    api<{ success: boolean }>(`${R}task_comments&id=${id}`, { method: "DELETE" })
  );

/* ===== Docs ===== */

/** Without `spaceId`, every doc. With it, the space and all of its subspaces. */
export const fetchDocs = (spaceId?: number) =>
  live("docs", () =>
    api<{ docs: WsDoc[] }>(`${R}docs${spaceId ? `&space_id=${spaceId}` : ""}`).then((r) =>
      r.docs.map(normDoc),
    ),
  );

export const fetchDoc = (id: number) =>
  live("docs", () => api<{ doc: WsDoc }>(`${R}docs&id=${id}`).then((r) => normDoc(r.doc)));

export const createDoc = (p: { title: string; space_id?: number | null; body?: string }) =>
  live("docs", () => api<{ id: number }>(`${R}docs`, { method: "POST", body: JSON.stringify(p) }));

export const updateDoc = (
  id: number,
  p: { title?: string; body?: string; space_id?: number | null; is_pinned?: 0 | 1 },
) =>
  live("docs", () =>
    api<{ success: boolean }>(`${R}docs&id=${id}`, { method: "PUT", body: JSON.stringify(p) }),
  );

export const deleteDoc = (id: number) =>
  live("docs", () => api<{ success: boolean }>(`${R}docs&id=${id}`, { method: "DELETE" }));

/* ===== Task helpers ===== */

/** Ids of everyone assigned (falls back to the legacy single assignee). */
export function taskAssigneeIds(t: WsTask): number[] {
  if (t.assignee_ids && t.assignee_ids.length) return t.assignee_ids;
  return t.assignee_id ? [t.assignee_id] : [];
}

/** Display names of everyone assigned. */
export function taskAssigneeNames(t: WsTask): string[] {
  if (t.assignee_names && t.assignee_names.length) return t.assignee_names;
  return t.assignee_name ? [t.assignee_name] : [];
}

/** "Parent - subtask" label used in task and planner views. */
export function taskDisplayTitle(t: WsTask): string {
  return t.parent_title ? `${t.parent_title} - ${t.title}` : t.title;
}

/** Sort so subtasks follow their parent. */
/* ===== Project numbering ===== */

export type WsNumbering = {
  year: number;
  next: number;
  /** Leading digit of a document number to what that kind of document is. */
  categories: Record<string, string>;
  /** The number the next new project would take. */
  preview?: string;
};

export const fetchNumbering = () =>
  live("numbering", () => api<{ numbering: WsNumbering }>(`${R}numbering`).then((r) => r.numbering));

export const saveNumbering = (p: { next?: number; categories?: Record<string, string> }) =>
  live("numbering", () =>
    api<{ numbering: WsNumbering }>(`${R}numbering`, { method: "PUT", body: JSON.stringify(p) }).then(
      (r) => r.numbering,
    ),
  );

/**
 * What to show on a card. A project shows its own number; a component shows the
 * project's number and its two-digit index, with the category digit left as a
 * dot because that is chosen per document, not per task.
 */
export function taskNumber(task: WsTask, projectNo?: string | null): string | null {
  if (task.project_no) return task.project_no;
  if (task.item_no === null || task.item_no === undefined || !projectNo) return null;
  return `${projectNo}-·${String(task.item_no).padStart(2, "0")}`;
}

/** The concrete document number for one category digit, e.g. 26-005-101. */
export function documentNumber(projectNo: string, itemNo: number, digit: string): string {
  return `${projectNo}-${digit}${String(itemNo).padStart(2, "0")}`;
}

/** Walk up to the top-level task so a component can borrow its project number. */
export function projectNoFor(task: WsTask, all: WsTask[]): string | null {
  const seen = new Set<number>();
  let cur: WsTask | undefined = task;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (cur.project_no) return cur.project_no;
    cur = cur.parent_id ? all.find((t) => t.id === cur!.parent_id) : undefined;
  }
  return null;
}

export function sortWithSubtasks(tasks: WsTask[]): WsTask[] {
  const roots = tasks.filter((t) => !t.parent_id);
  const out: WsTask[] = [];
  const push = (t: WsTask) => {
    out.push(t);
    tasks.filter((c) => c.parent_id === t.id).forEach(push);
  };
  roots.forEach(push);
  tasks.forEach((t) => { if (!out.includes(t)) out.push(t); });
  return out;
}


export const checkWorkspaceConnection = () =>
  live("connection", () => api<{ spaces: WsSpace[] }>(`${R}spaces`).then(() => undefined));

/* ===== Helpers ===== */

export function spaceChildren(spaces: WsSpace[], parentId: number | null) {
  return spaces.filter((s) => s.parent_id === parentId);
}

export function initials(nameOrEmail: string) {
  const base = nameOrEmail.includes("@") ? nameOrEmail.split("@")[0] : nameOrEmail;
  return base
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/* ===== Mentions ===== */

/** Stable @handle for a person — the local part of their email, lowercased. */
export function mentionHandle(u: { email: string; name?: string | null }) {
  return (u.email.split("@")[0] || u.name || "user").toLowerCase().replace(/[^\w.\-]/g, "");
}

/** Does this text mention the given person? */
export function mentionsUser(text: string, u: { email: string; name?: string | null }) {
  const handle = mentionHandle(u);
  return new RegExp(`@${handle}\\b`, "i").test(text) || /@(all|channel|everyone)\b/i.test(text);
}

/* ===== Activity feed (inbox) ===== */

export type WsActivityComment = {
  id: number;
  task_id: number;
  task_title: string | null;
  task_status: TaskStatus | null;
  parent_id: number | null;
  user_id: number | null;
  user_name?: string | null;
  user_email?: string | null;
  body: string;
  created_at: string;
  assignee_ids: number[];
  /** Author of the comment this one answers, so "replied to me" is exact. */
  reply_to_user_id?: number | null;
};

export type WsActivityMessage = {
  id: number;
  channel_id: number | null;
  channel_name: string | null;
  sender_id: number;
  sender_name?: string | null;
  sender_email?: string | null;
  recipient_id: number | null;
  body: string;
  created_at: string;
  /** Author of the message this one answers, so "replied to me" is exact. */
  reply_to_user_id?: number | null;
};

/** Older backends lack ?resource=activity — rebuild the feed from channels + DMs. */
async function activityFallback() {
  const [channels, users] = await Promise.all([fetchChannels(), fetchWsUsers()]);
  const perChannel = await Promise.all(
    channels.map(async (c) => {
      const msgs = await fetchChannelMessages(Number(c.id)).catch(() => []);
      return msgs.map((m) => ({
        ...m,
        id: Number(m.id),
        channel_id: Number(c.id),
        channel_name: c.name,
        sender_id: Number(m.sender_id),
        recipient_id: num(m.recipient_id),
      }));
    })
  );
  const perDm = await Promise.all(
    users.map(async (u) => {
      const msgs = await fetchDirectMessages(u.id).catch(() => []);
      return msgs.map((m) => ({
        ...m,
        id: Number(m.id),
        channel_id: null,
        channel_name: null,
        sender_id: Number(m.sender_id),
        recipient_id: num(m.recipient_id),
      }));
    })
  );
  const seenIds = new Set<number>();
  const messages: WsActivityMessage[] = [];
  [...perChannel, ...perDm].flat().forEach((m) => {
    const key = m.channel_id ? m.id * 10 + 1 : m.id * 10;
    if (seenIds.has(key)) return;
    seenIds.add(key);
    messages.push(m as WsActivityMessage);
  });
  return { comments: [] as WsActivityComment[], messages };
}

export const fetchActivity = () =>
  live("activity", () =>
    api<{ comments: WsActivityComment[]; messages: WsActivityMessage[] }>(`${R}activity`)
      .catch(() => activityFallback())
      .then((r) => ({
      comments: (r.comments || []).map((c) => ({
        ...c,
        id: Number(c.id),
        task_id: Number(c.task_id),
        user_id: num(c.user_id),
        parent_id: num(c.parent_id),
        assignee_ids: numList(c.assignee_ids),
      })),
      messages: (r.messages || []).map((m) => ({
        ...m,
        id: Number(m.id),
        channel_id: num(m.channel_id),
        sender_id: Number(m.sender_id),
        recipient_id: num(m.recipient_id),
      })),
    }))
  );
