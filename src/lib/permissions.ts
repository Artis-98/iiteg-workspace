import { useQuery } from "@tanstack/react-query";
import { api, getUser } from "./api";

const R = "/admin/workspace.php?resource=";

/* ===== Types ===== */

export type WsMe = {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
  /** Role slug, e.g. "op". */
  role: string;
  role_name: string;
  /** 0 is OP; higher numbers are weaker. */
  rank: number;
  /** "*" stands for every permission and belongs to OP alone. */
  permissions: string[];
};

export type WsRole = {
  id: number;
  slug: string;
  name: string;
  rank: number;
  color: string | null;
  permissions: string[];
  /** Built-in roles cannot be deleted and only an OP may edit them. */
  is_system: number;
  user_count: number;
};

/* ===== The catalogue =====
   These keys are the contract with backend/admin/permissions.php. Adding one
   here without adding it there means the server will quietly drop it. */

export type PermissionGroup = {
  title: string;
  items: { key: string; label: string; hint?: string }[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "Channels",
    items: [
      { key: "channels.create", label: "Create channels" },
      { key: "channels.edit", label: "Edit channels", hint: "Shows the pencil in the sidebar" },
      { key: "channels.delete", label: "Delete channels" },
    ],
  },
  {
    title: "Spaces",
    items: [
      { key: "spaces.create", label: "Create spaces" },
      { key: "spaces.edit", label: "Edit spaces", hint: "Shows the pencil in the sidebar" },
      { key: "spaces.delete", label: "Delete spaces" },
    ],
  },
  {
    title: "Subsidiaries",
    items: [{ key: "subsidiaries.edit", label: "Edit subsidiaries", hint: "Logo, colour and privacy" }],
  },
  {
    title: "Tasks",
    items: [
      { key: "tasks.create", label: "Create tasks" },
      { key: "tasks.edit", label: "Edit tasks" },
      { key: "tasks.delete", label: "Delete tasks" },
    ],
  },
  {
    title: "Docs",
    items: [
      { key: "docs.create", label: "Create docs" },
      { key: "docs.edit", label: "Edit docs" },
      { key: "docs.delete", label: "Delete docs" },
    ],
  },
  {
    title: "Messages",
    items: [
      {
        key: "messages.delete",
        label: "Delete other people's messages",
        hint: "Your own are always yours to remove",
      },
    ],
  },
  {
    title: "People",
    items: [
      { key: "teams.manage", label: "Manage teams" },
      { key: "roles.manage", label: "Manage roles", hint: "Only over roles below their own" },
      { key: "users.create", label: "Invite people" },
      { key: "users.edit", label: "Change someone's role" },
      { key: "users.delete", label: "Remove people" },
    ],
  },
  {
    title: "Privacy",
    items: [
      {
        key: "privacy.bypass",
        label: "See everything",
        hint: "Opens every private channel, space and subsidiary",
      },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])),
);

/* ===== Fetching ===== */

/**
 * A backend that has the roles endpoint but not yet the profile fields answers
 * without email/name/avatar_url. Fill those from the copy the login stored, so
 * the account panel is never blank against a half-updated server.
 */
const normMe = (m: WsMe): WsMe => {
  const stored = getUser();
  return {
    ...m,
    id: Number(m.id) || Number(stored?.id || 0),
    email: m.email || stored?.email || "",
    name: m.name || stored?.name || stored?.email || "",
    avatar_url: m.avatar_url ?? stored?.avatar_url ?? null,
    rank: Number(m.rank),
    permissions: Array.isArray(m.permissions) ? m.permissions : [],
  };
};

const normRole = (r: WsRole): WsRole => ({
  ...r,
  id: Number(r.id),
  rank: Number(r.rank),
  is_system: Number(r.is_system) ? 1 : 0,
  user_count: Number(r.user_count ?? 0),
  permissions: Array.isArray(r.permissions) ? r.permissions : [],
});

/**
 * A backend that predates roles answers "unknown resource". Rather than lock
 * the whole UI, fall back to the legacy role string the login already returned.
 */
function legacyMe(): WsMe {
  const u = getUser();
  const legacy = (u?.role || "member").toLowerCase();
  const isBoss = legacy === "op" || legacy === "superadmin" || legacy === "admin";
  return {
    id: Number(u?.id || 0),
    email: u?.email || "",
    name: u?.name || u?.email || "",
    avatar_url: u?.avatar_url ?? null,
    role: legacy,
    role_name: legacy,
    rank: isBoss ? 0 : 100,
    permissions: isBoss ? ["*"] : ["tasks.create", "tasks.edit", "docs.create", "docs.edit"],
  };
}

export const fetchMe = () =>
  api<{ me: WsMe }>(`${R}me`).then((r) => normMe(r.me));

export const fetchRoles = () =>
  api<{ roles: WsRole[] }>(`${R}roles`)
    .then((r) => (r.roles || []).map(normRole))
    .catch(() => [] as WsRole[]);

export const createRole = (p: {
  name: string;
  rank: number;
  color?: string | null;
  permissions: string[];
}) => api<{ id: number; slug: string }>(`${R}roles`, { method: "POST", body: JSON.stringify(p) });

export const updateRole = (
  id: number,
  p: { name?: string; rank?: number; color?: string | null; permissions?: string[] },
) => api<{ success: boolean }>(`${R}roles&id=${id}`, { method: "PUT", body: JSON.stringify(p) });

export const deleteRole = (id: number) =>
  api<{ success: boolean }>(`${R}roles&id=${id}`, { method: "DELETE" });

/* ===== Your own profile ===== */

/** Change your own display name and/or avatar. Email is not editable. */
export const updateMyProfile = (p: { name?: string; avatar_url?: string | null }) =>
  api<{ success: boolean; me: WsMe }>(`${R}me`, {
    method: "PUT",
    body: JSON.stringify(p),
  }).then((r) => normMe(r.me));

/** Change your own password. The server checks the current one first. */
export const changeMyPassword = (current_password: string, new_password: string) =>
  api<{ success: boolean }>(`${R}me`, {
    method: "PUT",
    body: JSON.stringify({ current_password, new_password }),
  });

/** Give somebody a different role. */
export const setUserRole = (userId: number, role: string) =>
  api<{ success: boolean }>(`${R}users&id=${userId}`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });

/* ===== Hooks ===== */

export function useMe() {
  const { data } = useQuery({ queryKey: ["ws-me"], queryFn: fetchMe, staleTime: 60_000 });
  return data;
}

export function hasPermission(me: WsMe | undefined, perm: string): boolean {
  if (!me) return false;
  return me.permissions.includes("*") || me.permissions.includes(perm);
}

/**
 * `can("channels.edit")` for the signed-in user. Returns false while the role
 * is still loading, so an edit button never flashes into view and then leaves.
 */
export function useCan() {
  const me = useMe();
  return {
    me,
    isOp: !!me?.permissions.includes("*"),
    can: (perm: string) => hasPermission(me, perm),
  };
}

/* ===== Hierarchy rules =====
   Mirrored from permissions.php so the UI disables what the server would
   refuse. The server is still the one that decides. */

/** May I edit or delete this role? */
export function canEditRole(me: WsMe | undefined, role: WsRole): boolean {
  if (!me || !hasPermission(me, "roles.manage")) return false;
  if (me.permissions.includes("*")) return true;
  if (role.is_system) return false;
  return role.rank > me.rank;
}

/** May I put somebody into this role? Equal rank is allowed, above it is not. */
export function canAssignRole(me: WsMe | undefined, role: WsRole): boolean {
  if (!me || !hasPermission(me, "users.edit")) return false;
  if (me.permissions.includes("*")) return true;
  if (role.permissions.includes("*")) return false;
  return role.rank >= me.rank;
}
