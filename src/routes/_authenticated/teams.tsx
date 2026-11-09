import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePresenceMap } from "@/lib/presence";
import { PresenceDot } from "@/components/workspace/PresenceDot";
import { Plus, Pencil, Trash2, X, Users, Shield, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { AssigneeBubbles } from "@/components/workspace/BubblePicker";
import { Avatar } from "@/components/workspace/Avatar";
import {
  createTeam,
  deleteTeam,
  fetchTeams,
  fetchWsUsers,
  initials,
  updateTeam,
  type WsTeam,
  type WsUser,
} from "@/lib/workspace";
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  canAssignRole,
  canEditRole,
  createRole,
  deleteRole,
  fetchRoles,
  setUserRole,
  updateRole,
  useCan,
  type WsMe,
  type WsRole,
} from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({
    meta: [
      { title: "Teams — IITEG Workspace" },
      { name: "description", content: "Create teams and assign people across the IITEG Workspace." },
      { property: "og:title", content: "Teams — IITEG Workspace" },
      { property: "og:description", content: "Create teams and assign people across the IITEG Workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamsPage,
});

const labelStyle = { letterSpacing: "0.2em" } as const;
const labelCls = "mb-1 block text-[10px] uppercase text-[var(--txt-3)]";
const inputCls =
  "w-full border border-[var(--line)] bg-[var(--s-2)] px-3 py-2 text-sm text-[var(--txt-1)] placeholder-[var(--txt-3)] outline-none focus:border-[var(--line-strong)]";

function TeamsPage() {
  const qc = useQueryClient();
  const { data: users } = useQuery({ queryKey: ["ws-users"], queryFn: fetchWsUsers });
  const { data: teams } = useQuery({ queryKey: ["ws-teams"], queryFn: fetchTeams });
  const { data: roles } = useQuery({ queryKey: ["ws-roles"], queryFn: fetchRoles });
  const presence = usePresenceMap();
  const { me, can } = useCan();
  const [editing, setEditing] = useState<WsTeam | null | "new">(null);
  const [roleEditing, setRoleEditing] = useState<WsRole | null | "new">(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ws-teams"] });
  const invalidateRoles = () => {
    qc.invalidateQueries({ queryKey: ["ws-roles"] });
    qc.invalidateQueries({ queryKey: ["ws-users"] });
    qc.invalidateQueries({ queryKey: ["ws-me"] });
  };

  const removeRole = useMutation({
    mutationFn: (id: number) => deleteRole(id),
    onSuccess: () => {
      toast.success("Role removed — anyone who had it is now a Member");
      invalidateRoles();
    },
    onError: (e: Error) => toast.error(e.message || "Could not remove role"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteTeam(id),
    onSuccess: () => {
      toast.success("Team removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not remove team"),
  });

  const userById = (id: number) => (users || []).find((u) => u.id === id);

  return (
    <WorkspaceShell>
      <header className="flex h-12 shrink-0 items-center border-b border-[var(--line)] px-6">
        <h1 className="text-[11px] uppercase text-[var(--txt-2)]" style={{ letterSpacing: "0.25em" }}>
          Teams
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {can("roles.manage") && (
            <button
              onClick={() => setRoleEditing("new")}
              className="flex items-center gap-1.5 border border-[var(--line)] px-3 py-1.5 text-[9px] font-bold uppercase text-[var(--txt-2)] transition hover:text-[var(--txt-1)]"
              style={labelStyle}
            >
              <Plus className="h-3 w-3" strokeWidth={2} /> New role
            </button>
          )}
          {can("teams.manage") && (
            <button
              onClick={() => setEditing("new")}
              className="flex items-center gap-1.5 bg-[var(--txt-1)] px-3 py-1.5 text-[9px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90"
              style={labelStyle}
            >
              <Plus className="h-3 w-3" strokeWidth={2} /> New team
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-8 overflow-auto p-6">
        <section>
          <h2 className="mb-1 text-[9px] uppercase text-[var(--txt-3)]" style={{ letterSpacing: "0.25em" }}>
            Roles
          </h2>
          <p className="mb-3 text-[11px] text-[var(--txt-3)]">
            Rank orders the hierarchy — the lower the number, the more power. OP is the master role
            and outranks everyone; you can only edit or hand out roles below your own.
          </p>
          {(roles || []).length === 0 && (
            <p className="border border-[var(--line)] bg-[var(--s-2)] px-4 py-8 text-center text-[11px] text-[var(--txt-3)] backdrop-blur-md">
              Roles could not be loaded. Check the API connection and try again.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(roles || []).map((r) => {
              const editable = canEditRole(me, r);
              const everything = r.permissions.includes("*");
              return (
                <div key={r.id} className="group border border-[var(--line)] bg-[var(--s-2)] p-4 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    {everything ? (
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} style={{ color: r.color || "#7c6cff" }} />
                    ) : (
                      <Shield className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} style={{ color: r.color || "#7c6cff" }} />
                    )}
                    <p className="min-w-0 flex-1 truncate text-sm text-[var(--txt-1)]">{r.name}</p>
                    <span
                      className="shrink-0 border border-[var(--line)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--txt-3)]"
                      style={labelStyle}
                      title="Rank — lower outranks higher"
                    >
                      {r.rank}
                    </span>
                    {editable && (
                      <button
                        onClick={() => setRoleEditing(r)}
                        title="Edit role"
                        className="text-[var(--txt-3)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--txt-1)]"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                    )}
                    {editable && !r.is_system && (
                      <button
                        onClick={() => removeRole.mutate(r.id)}
                        title="Delete role"
                        className="text-[var(--txt-3)] opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                    )}
                    {!editable && (
                      <Lock className="h-3 w-3 shrink-0 text-[var(--txt-3)]" strokeWidth={1.8} />
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--txt-3)]">
                    {everything
                      ? "Every permission, including ones added later."
                      : `${r.permissions.length} of ${ALL_PERMISSIONS.length} permissions`}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--txt-3)]">
                    <Users className="h-3 w-3" strokeWidth={1.8} />
                    {r.user_count} {r.user_count === 1 ? "person" : "people"}
                    {r.is_system ? <span>· built-in</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[9px] uppercase text-[var(--txt-3)]" style={{ letterSpacing: "0.25em" }}>
            Teams
          </h2>
          {(teams || []).length === 0 && (
            <p className="border border-[var(--line)] bg-[var(--s-2)] px-4 py-8 text-center text-[11px] text-[var(--txt-3)] backdrop-blur-md">
              No teams yet — create one and assign people. The same person can belong to several teams.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(teams || []).map((t) => (
              <div key={t.id} className="group border border-[var(--line)] bg-[var(--s-2)] p-4 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color || "#7c6cff" }} />
                  <p className="min-w-0 flex-1 truncate text-sm text-[var(--txt-1)]">{t.name}</p>
                  {can("teams.manage") && (
                    <>
                      <button
                        onClick={() => setEditing(t)}
                        title="Edit team"
                        className="text-[var(--txt-3)] opacity-0 transition group-hover:opacity-100 hover:text-[var(--txt-1)]"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                      <button
                        onClick={() => remove.mutate(t.id)}
                        title="Delete team"
                        className="text-[var(--txt-3)] opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                    </>
                  )}
                </div>
                {t.description && <p className="mt-2 text-[11px] text-[var(--txt-3)]">{t.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.member_ids.length === 0 && (
                    <span className="text-[10px] text-[var(--txt-3)]">No members yet</span>
                  )}
                  {t.member_ids.map((id) => {
                    const u = userById(id);
                    return (
                      <span
                        key={id}
                        title={u?.email}
                        className="flex items-center gap-1.5 border border-[var(--line)] px-2 py-1 text-[10px] text-[var(--txt-2)]"
                      >
                        <Avatar name={u?.name} email={u?.email} src={u?.avatar_url} size={16} />
                        {u?.name || u?.email || `#${id}`}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[9px] uppercase text-[var(--txt-3)]" style={{ letterSpacing: "0.25em" }}>
            People
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(users || []).map((u) => {
              const memberOf = (teams || []).filter((t) => t.member_ids.includes(u.id));
              return (
                <div
                  key={u.id}
                  className="border border-[var(--line)] bg-[var(--s-2)] px-4 py-3 backdrop-blur-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex shrink-0">
                      <Avatar name={u.name} email={u.email} src={u.avatar_url} size={36} />
                      <PresenceDot
                        state={presence.get(u.id)}
                        size={10}
                        ring
                        className="absolute -bottom-px -right-px"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--txt-1)]">{u.name}</p>
                      <p className="truncate text-[11px] text-[var(--txt-3)]">{u.email}</p>
                    </div>
                    <RolePicker
                      user={u}
                      roles={roles || []}
                      me={me}
                      onSaved={invalidateRoles}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Users className="h-3 w-3 text-[var(--txt-3)]" strokeWidth={1.8} />
                    {memberOf.length === 0 ? (
                      <span className="text-[10px] text-[var(--txt-3)]">No team</span>
                    ) : (
                      memberOf.map((t) => (
                        <span
                          key={t.id}
                          className="flex items-center gap-1 border border-[var(--line)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--txt-2)]"
                          style={labelStyle}
                        >
                          <span className="h-1.5 w-1.5 rounded-sm" style={{ background: t.color || "#7c6cff" }} />
                          {t.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {editing !== null && (
        <TeamModal
          team={editing === "new" ? null : editing}
          users={users || []}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      )}

      {roleEditing !== null && (
        <RoleModal
          role={roleEditing === "new" ? null : roleEditing}
          me={me}
          onClose={() => setRoleEditing(null)}
          onSaved={invalidateRoles}
        />
      )}
    </WorkspaceShell>
  );
}

/** The role badge on a person's card, which doubles as the way to change it. */
function RolePicker({
  user, roles, me, onSaved,
}: {
  user: WsUser;
  roles: WsRole[];
  me: WsMe | undefined;
  onSaved: () => void;
}) {
  const assignable = roles.filter((r) => canAssignRole(me, r));
  const current = roles.find((r) => r.slug === user.role);

  const save = useMutation({
    mutationFn: (slug: string) => setUserRole(user.id, slug),
    onSuccess: () => {
      toast.success(`${user.name || user.email} updated`);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Could not change that role"),
  });

  // Nothing to offer — show the role as a plain badge instead of a dead select.
  if (!assignable.length || (current && !canAssignRole(me, current))) {
    return (
      <span
        className="ml-auto shrink-0 border border-[var(--line)] px-2 py-0.5 text-[9px] uppercase text-[var(--txt-3)]"
        style={labelStyle}
      >
        {current?.name || user.role}
      </span>
    );
  }

  return (
    <select
      value={user.role}
      disabled={save.isPending}
      onChange={(e) => save.mutate(e.target.value)}
      title="Change this person's role"
      className="ml-auto shrink-0 border border-[var(--line)] bg-[var(--s-2)] px-2 py-0.5 text-[9px] uppercase text-[var(--txt-2)] outline-none transition hover:text-[var(--txt-1)] focus:border-[var(--line-strong)] disabled:opacity-50"
      style={labelStyle}
    >
      {/* The role they hold now may sit above what we may assign — keep it listed. */}
      {current && !assignable.some((r) => r.slug === current.slug) && (
        <option value={current.slug}>{current.name}</option>
      )}
      {assignable.map((r) => (
        <option key={r.id} value={r.slug}>
          {r.name}
        </option>
      ))}
    </select>
  );
}

/** Create or edit a role: a name, where it sits in the hierarchy, and the ticks. */
function RoleModal({
  role, me, onClose, onSaved,
}: {
  role: WsRole | null;
  me: WsMe | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role?.name || "");
  const [rank, setRank] = useState(role?.rank ?? 50);
  const [color, setColor] = useState(role?.color || "#7c6cff");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions || []);

  const everything = permissions.includes("*");
  // The OP role is the anchor of the hierarchy and is not editable in pieces.
  const locked = role?.slug === "op";

  const toggle = (key: string) =>
    setPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));

  const toggleGroup = (keys: string[], on: boolean) =>
    setPermissions((prev) => (on ? [...new Set([...prev, ...keys])] : prev.filter((p) => !keys.includes(p))));

  const save = useMutation({
    mutationFn: async () => {
      if (role) {
        await updateRole(role.id, locked ? { name, color } : { name, rank, color, permissions });
        return;
      }
      await createRole({ name, rank, color, permissions });
    },
    onSuccess: () => {
      toast.success(role ? "Role updated" : "Role created");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save role"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col border border-[var(--line)] bg-[var(--s-2)] backdrop-blur-md"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <span className="text-[10px] uppercase text-[var(--txt-2)]" style={{ letterSpacing: "0.25em" }}>
            {role ? `Edit ${role.name}` : "New role"}
          </span>
          <button onClick={onClose} className="text-[var(--txt-3)] hover:text-[var(--txt-1)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="min-h-0 flex-1 space-y-4 overflow-auto p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <label className={labelCls} style={labelStyle}>Name</label>
            <input
              className={inputCls}
              required
              value={name}
              placeholder="Moderator"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls} style={labelStyle}>Rank</label>
              <input
                type="number"
                className={inputCls}
                required
                min={1}
                value={rank}
                disabled={locked}
                onChange={(e) => setRank(Number(e.target.value))}
              />
              <p className="mt-1 text-[10px] text-[var(--txt-3)]">
                Lower outranks higher. OP is 0, Admin is 10.
                {me ? ` Yours is ${me.rank}.` : ""}
              </p>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Colour</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-16 border border-[var(--line)] bg-transparent"
              />
            </div>
          </div>

          {locked || everything ? (
            <p className="border border-[var(--line)] bg-[var(--s-3)] px-3 py-3 text-[11px] text-[var(--txt-2)]">
              This role holds every permission, including any added in future. Only an OP can grant
              that, and it cannot be narrowed down here.
            </p>
          ) : (
            <div className="space-y-3">
              <label className={labelCls} style={labelStyle}>
                Can do {permissions.length ? `(${permissions.length})` : ""}
              </label>
              {PERMISSION_GROUPS.map((group) => {
                const keys = group.items.map((i) => i.key);
                const allOn = keys.every((k) => permissions.includes(k));
                return (
                  <div key={group.title} className="border border-[var(--line)] bg-[var(--input)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] uppercase text-[var(--txt-2)]" style={labelStyle}>
                        {group.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleGroup(keys, !allOn)}
                        className="text-[9px] uppercase text-[var(--txt-3)] transition hover:text-[var(--txt-1)]"
                        style={labelStyle}
                      >
                        {allOn ? "None" : "All"}
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <label
                          key={item.key}
                          className="flex cursor-pointer items-start gap-2 text-[13px] text-[var(--txt-2)]"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={permissions.includes(item.key)}
                            onChange={() => toggle(item.key)}
                          />
                          <span className="min-w-0">
                            {item.label}
                            {item.hint && (
                              <span className="block text-[10px] text-[var(--txt-3)]">{item.hint}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="submit"
            disabled={save.isPending}
            className="w-full bg-[var(--txt-1)] py-2.5 text-[11px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-50"
            style={labelStyle}
          >
            {save.isPending ? "Saving…" : role ? "Save role" : "Create role"}
          </button>
        </form>
      </div>
    </div>
  );
}

function TeamModal({
  team, users, onClose, onSaved,
}: {
  team: WsTeam | null;
  users: WsUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(team?.name || "");
  const [description, setDescription] = useState(team?.description || "");
  const [color, setColor] = useState(team?.color || "#7c6cff");
  const [members, setMembers] = useState<number[]>(team?.member_ids || []);

  const save = useMutation({
    mutationFn: async () => {
      if (team) {
        await updateTeam(team.id, { name, description: description || null, color, member_ids: members });
        return;
      }
      await createTeam({ name, description, color, member_ids: members });
    },

    onSuccess: () => {
      toast.success(team ? "Team updated" : "Team created");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save team"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-[var(--line)] bg-[var(--s-2)] backdrop-blur-md"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <span className="text-[10px] uppercase text-[var(--txt-2)]" style={{ letterSpacing: "0.25em" }}>
            {team ? "Edit team" : "New team"}
          </span>
          <button onClick={onClose} className="text-[var(--txt-3)] hover:text-[var(--txt-1)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          className="space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <label className={labelCls} style={labelStyle}>Name</label>
            <input className={inputCls} required value={name} placeholder="Design team" onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Description</label>
            <input className={inputCls} value={description} placeholder="Optional" onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Colour</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 border border-[var(--line)] bg-transparent" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>
              Members {members.length ? `(${members.length})` : ""}
            </label>
            <div className="max-h-56 overflow-auto border border-[var(--line)] bg-[var(--input)] p-2">
              <AssigneeBubbles
                users={users}
                selected={members}
                onToggle={(id) =>
                  setMembers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
              />
            </div>
            <p className="mt-1 text-[10px] text-[var(--txt-3)]">
              Click a bubble to add or remove someone. A person can be in several teams.
            </p>
          </div>

          <button
            type="submit"
            disabled={save.isPending}
            className="w-full bg-[var(--txt-1)] py-2.5 text-[11px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-50"
            style={labelStyle}
          >
            {save.isPending ? "Saving…" : team ? "Save team" : "Create team"}
          </button>
        </form>
      </div>
    </div>
  );
}
