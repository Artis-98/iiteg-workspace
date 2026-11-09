import { useQuery } from "@tanstack/react-query";
import { Lock, Users, Globe } from "lucide-react";
import { fetchTeams, fetchWsUsers } from "@/lib/workspace";
import { Avatar } from "./Avatar";

const labelCls = "mb-1 block text-[10px] uppercase text-[var(--txt-3)]";
const labelStyle = { letterSpacing: "0.2em" } as const;

/**
 * The private / public switch shared by the channel, space and subsidiary edit
 * dialogs. Private means hidden: anyone not named here, and not on one of the
 * chosen teams, does not see the thing at all.
 */
export function PrivacyFields({
  isPrivate,
  onPrivate,
  userIds,
  onUserIds,
  teamIds,
  onTeamIds,
  noun = "this",
}: {
  isPrivate: boolean;
  onPrivate: (v: boolean) => void;
  userIds: number[];
  onUserIds: (v: number[]) => void;
  teamIds: number[];
  onTeamIds: (v: number[]) => void;
  /** Used in the explanatory line, e.g. "channel". */
  noun?: string;
}) {
  const { data: users } = useQuery({ queryKey: ["ws-users"], queryFn: fetchWsUsers });
  const { data: teams } = useQuery({ queryKey: ["ws-teams"], queryFn: fetchTeams });

  const toggle = (list: number[], id: number, set: (v: number[]) => void) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="space-y-3">
      <label className={labelCls} style={labelStyle}>Visibility</label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPrivate(false)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] uppercase transition ${
            isPrivate
              ? "border-[var(--line)] text-[var(--txt-3)]"
              : "border-[var(--line-strong)] text-[var(--txt-1)]"
          }`}
          style={labelStyle}
        >
          <Globe className="h-3 w-3" strokeWidth={1.8} /> Public
        </button>
        <button
          type="button"
          onClick={() => onPrivate(true)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] uppercase transition ${
            isPrivate
              ? "border-[var(--line-strong)] text-[var(--txt-1)]"
              : "border-[var(--line)] text-[var(--txt-3)]"
          }`}
          style={labelStyle}
        >
          <Lock className="h-3 w-3" strokeWidth={1.8} /> Private
        </button>
      </div>

      {!isPrivate && (
        <p className="text-[10px] text-[var(--txt-3)]">Everyone in the workspace can see {noun}.</p>
      )}

      {isPrivate && (
        <>
          <div>
            <label className={labelCls} style={labelStyle}>
              Teams with access {teamIds.length ? `(${teamIds.length})` : ""}
            </label>
            <div className="max-h-32 space-y-1 overflow-auto rounded-lg border border-[var(--line)] bg-[var(--input)] p-2">
              {(teams || []).length === 0 && (
                <p className="px-1 py-1 text-[10px] text-[var(--txt-3)]">
                  No teams yet — create one in the Teams tab.
                </p>
              )}
              {(teams || []).map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[13px] text-[var(--txt-2)] hover:bg-[var(--tint)]"
                >
                  <input
                    type="checkbox"
                    checked={teamIds.includes(t.id)}
                    onChange={() => toggle(teamIds, t.id, onTeamIds)}
                  />
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: t.color || "#7c6cff" }} />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--txt-3)]">
                    <Users className="h-3 w-3" strokeWidth={1.6} />
                    {t.member_ids.length}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>
              People with access {userIds.length ? `(${userIds.length})` : ""}
            </label>
            <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-[var(--line)] bg-[var(--input)] p-2">
              {(users || []).map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[13px] text-[var(--txt-2)] hover:bg-[var(--tint)]"
                >
                  <input
                    type="checkbox"
                    checked={userIds.includes(u.id)}
                    onChange={() => toggle(userIds, u.id, onUserIds)}
                  />
                  <Avatar name={u.name} email={u.email} src={u.avatar_url} size={20} />
                  <span className="min-w-0 flex-1 truncate">{u.name || u.email}</span>
                </label>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-[var(--txt-3)]">
            Anyone not listed here cannot see {noun} at all. People whose role can see everything
            still can.
          </p>
        </>
      )}
    </div>
  );
}
