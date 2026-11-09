import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Inbox,
  MessageSquareReply,
  AtSign,
  Hash,
  Lock,
  Plus,
  ChevronRight,
  ChevronDown,
  Send,
  X,
  Trash2,
  CalendarDays,
  Boxes,
  Printer,
  Layers,
  ArrowUpRight,
  AlertTriangle,
  Flag,
  UserCircle2,
  GripVertical,
  ClipboardList,
  CalendarClock,
  Link2,
  Pencil,
  MessageSquare,
  CornerDownRight,
  ListTree,
  PackageSearch,
  SmilePlus,
  Check,
  FolderOpen,
  FolderPlus,
} from "lucide-react";


import { toast } from "sonner";
import { DEFAULT_BRANDING, useBranding } from "@/lib/branding";
import { extensions, extensionPanels } from "@/extensions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getUser } from "@/lib/api";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { AssigneeBubbles, BubblePopover } from "@/components/workspace/BubblePicker";
import { ChatComposer } from "@/components/workspace/ChatComposer";
import { MessageText } from "@/components/workspace/MessageText";
import {
  SpaceIcon,
  SpaceIconPicker,
  DEFAULT_SPACE_ICON,
} from "@/components/workspace/SpaceIcon";
import { TaskTimeControl } from "@/components/workspace/TimeTracker";
import { isUnseen, markSeen, useSeen } from "@/lib/unread";
import { usePresenceMap } from "@/lib/presence";
import { useIsMobile } from "@/hooks/use-mobile";
import { PresenceAvatar, PresenceDot } from "@/components/workspace/PresenceDot";
import { Avatar } from "@/components/workspace/Avatar";

/** Small count balloon shown next to sidebar rows. */
function UnreadBadge({ count, tone = "default" }: { count: number; tone?: "default" | "mention" }) {
  if (!count) return null;
  return (
    <span
      className={`ml-auto flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-medium leading-none ${
        tone === "mention"
          ? "bg-amber-400/90 text-[var(--s-1)]"
          : "bg-[var(--txt-1)] text-[var(--s-1)]"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** dd/mm — compact enough for kanban cards. */
const shortDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITIES,
  createChannel,
  updateChannel,
  fetchSubsidiaryLooks,
  saveSubsidiaryLook,
  updateSpace,

  createSpace,
  createTask,
  deleteSpace,
  deleteTask,
  fetchChannelMessages,
  fetchChannels,
  fetchDirectMessages,
  fetchSpaces,
  fetchTasks,
  fetchWsUsers,
  fetchTaskComments,
  fetchActivity,
  fetchAllTasks,
  mentionHandle,
  mentionsUser,
  createTaskComment,
  initials,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  spaceChildren,
  updateTask,
  taskAssigneeIds,
  taskAssigneeNames,
  sortWithSubtasks,
  fetchSpaceColumns,
  saveSpaceColumns,
  resetSpaceColumns,
  readableApiError,
  COLUMN_TONES,
  type BoardColumn,
  type SpaceColumns,
  taskNumber,
  projectNoFor,
  documentNumber,
  fetchNumbering,
  saveNumbering,
  type WsNumbering,
  type TaskPriority,
  type TaskStatus,
  type WsSpace,
  type WsChannel,
  type WsMessage,
  type WsTaskComment,
  type WsSubsidiary,
  type WsTask,
  type WsUser,
} from "@/lib/workspace";
import { PrivacyFields } from "@/components/workspace/PrivacyFields";
import { useCan } from "@/lib/permissions";



export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — IITEG Workspace" },
      { name: "description", content: "Channels, direct messages and task boards for the iiteg team." },
      { property: "og:title", content: "Home — IITEG Workspace" },
      { property: "og:description", content: "Channels, direct messages and task boards for the iiteg team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

export type View =
  | { kind: "inbox" | "replies" | "assigned" | "mytasks" }
  | { kind: "channel"; id: number }
  | { kind: "dm"; id: number }
  | { kind: "space"; id: number }
  | { kind: "sub"; slug: string; tab?: string };

export const SUBSIDIARIES = extensions;


function HomePage() {
  return <Workspace initialView={{ kind: "inbox" }} />;
}

export function Workspace({ initialView }: { initialView: View }) {
  const [view, setView] = useState<View>(initialView);
  const [navOpen, setNavOpen] = useState(false);

  const select = (v: View) => {
    setView(v);
    setNavOpen(false);
  };

  return (
    <WorkspaceShell onMenu={() => setNavOpen(true)}>
      <div className="flex min-h-0 flex-1">
        {/* Mobile drawer backdrop */}
        {navOpen && (
          <button
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-40 bg-[var(--input)] backdrop-blur-sm md:hidden"
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[300px] transition-transform duration-300 md:static md:z-auto md:w-auto md:max-w-none md:translate-x-0 ${
            navOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <WorkspaceNav view={view} onSelect={select} onClose={() => setNavOpen(false)} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <main className="flex min-w-0 flex-1 flex-col bg-transparent">
              <MainPane view={view} onSelect={select} />
            </main>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}



/* ================= Sidebar ================= */

function WorkspaceNav({ view, onSelect, onClose }: { view: View; onSelect: (v: View) => void; onClose?: () => void }) {
  const workspaceBranding = useBranding().data || DEFAULT_BRANDING;
  const qc = useQueryClient();
  const me = getUser();
  const { can } = useCan();
  const [openSpaces, setOpenSpaces] = useState<Record<number, boolean>>({ });
  const [channelModal, setChannelModal] = useState(false);
  const [channelEdit, setChannelEdit] = useState<WsChannel | null>(null);
  const [subEdit, setSubEdit] = useState<string | null>(null);
  const [spaceParent, setSpaceParent] = useState<number | null | undefined>(undefined);
  const [spaceEdit, setSpaceEdit] = useState<WsSpace | null>(null);
  const [numberingOpen, setNumberingOpen] = useState(false);
  const { data: subLooks } = useQuery({
    queryKey: ["ws-subsidiaries"],
    queryFn: fetchSubsidiaryLooks,
  });
  const presence = usePresenceMap();


  const { data: channels } = useQuery({ queryKey: ["ws-channels"], queryFn: fetchChannels });
  const { data: users } = useQuery({ queryKey: ["ws-users"], queryFn: fetchWsUsers });
  const { data: spaces } = useQuery({ queryKey: ["ws-spaces"], queryFn: fetchSpaces });

  const { data: activity } = useQuery({
    queryKey: ["ws-activity"],
    queryFn: fetchActivity,
    refetchInterval: 20000,
  });
  const seen = useSeen();

  /* Unread counts derived from the activity feed vs. what I've already opened. */
  const unread = useMemo(() => {
    const channelCounts: Record<number, number> = {};
    const channelMentions: Record<number, number> = {};
    const dmCounts: Record<number, number> = {};
    let mentions = 0;
    let inbox = 0;
    let replies = 0;
    if (!me) return { channelCounts, channelMentions, dmCounts, mentions, inbox, replies };

    (activity?.messages || []).forEach((m) => {
      if (m.sender_id === me.id) return;
      const mentioned = mentionsUser(m.body, me);
      if (m.channel_id) {
        if (isUnseen(seen, "channel", m.channel_id, m.created_at)) {
          channelCounts[m.channel_id] = (channelCounts[m.channel_id] || 0) + 1;
          if (mentioned) channelMentions[m.channel_id] = (channelMentions[m.channel_id] || 0) + 1;
        }
      } else if (m.recipient_id === me.id) {
        if (isUnseen(seen, "dm", m.sender_id, m.created_at)) {
          dmCounts[m.sender_id] = (dmCounts[m.sender_id] || 0) + 1;
        }
      }
      if (mentioned && isUnseen(seen, "mentions", undefined, m.created_at)) mentions += 1;
      if (m.reply_to_user_id === me.id && isUnseen(seen, "replies", undefined, m.created_at)) replies += 1;
      if (isUnseen(seen, "inbox", undefined, m.created_at)) inbox += 1;
    });

    (activity?.comments || []).forEach((c) => {
      if (c.user_id === me.id) return;
      const mentioned = mentionsUser(c.body, me);
      const onMyTask = c.assignee_ids.includes(me.id);
      if (mentioned && isUnseen(seen, "mentions", undefined, c.created_at)) mentions += 1;
      if (c.reply_to_user_id === me.id && isUnseen(seen, "replies", undefined, c.created_at)) replies += 1;
      if ((mentioned || onMyTask) && isUnseen(seen, "inbox", undefined, c.created_at)) inbox += 1;
    });

    return { channelCounts, channelMentions, dmCounts, mentions, inbox, replies };
  }, [activity, seen, me]);

  const quick = [
    { kind: "inbox" as const, label: "Inbox", icon: Inbox, count: unread.inbox, tone: "default" as const },
    { kind: "mytasks" as const, label: "My tasks", icon: ClipboardList, count: 0, tone: "default" as const },
    { kind: "replies" as const, label: "Replies", icon: MessageSquareReply, count: unread.replies, tone: "default" as const },
    { kind: "assigned" as const, label: "Mentions", icon: AtSign, count: unread.mentions, tone: "mention" as const },
  ];

  const [order, setOrder] = useState<string[]>(() => {
    const def = ["channels", "dms", "spaces", "subs"];
    if (typeof window === "undefined") return def;
    try {
      const raw = JSON.parse(localStorage.getItem("ws-section-order") || "null");
      if (Array.isArray(raw) && raw.length === def.length && def.every((k) => raw.includes(k))) return raw;
    } catch { /* ignore */ }
    return def;
  });
  const [dragKey, setDragKey] = useState<string | null>(null);

  const move = (from: string, to: string) => {
    if (from === to) return;
    setOrder((prev) => {
      const next = prev.filter((k) => k !== from);
      next.splice(next.indexOf(to), 0, from);
      try { localStorage.setItem("ws-section-order", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const sections: Record<string, { title: string; onAdd?: () => void; body: React.ReactNode }> = {
    channels: {
      title: "Channels",
      onAdd: can("channels.create") ? () => setChannelModal(true) : undefined,
      body: (channels || []).map((c) => (
        <NavRow
          key={c.id}
          active={view.kind === "channel" && view.id === c.id}
          onClick={() => onSelect({ kind: "channel", id: c.id })}
          icon={
            /* A custom logo replaces the default #/lock glyph entirely. */
            c.icon ? (
              <SpaceIcon name={c.icon} color={c.color} className="h-[15px] w-[15px]" />
            ) : c.is_private ? (
              <Lock className="h-[13px] w-[13px]" strokeWidth={1.6} />
            ) : (
              <Hash className="h-[13px] w-[13px]" strokeWidth={1.6} />
            )
          }
          label={c.name}
          right={
            <>
              <UnreadBadge
                count={unread.channelCounts[c.id] || 0}
                tone={unread.channelMentions[c.id] ? "mention" : "default"}
              />
              {can("channels.edit") && (
                <span className="ml-auto hidden items-center gap-1 group-hover:flex">
                  <button
                    title="Edit channel"
                    onClick={() => setChannelEdit(c)}
                    className="text-[var(--txt-3)] transition hover:text-[var(--txt-1)]"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={1.8} />
                  </button>
                </span>
              )}
            </>
          }
        />
      )),
    },
    dms: {
      title: "Direct messages",
      body: (users || [])
        .filter((u) => u.id !== me?.id)
        .map((u) => (
          <NavRow
            key={u.id}
            active={view.kind === "dm" && view.id === u.id}
            onClick={() => onSelect({ kind: "dm", id: u.id })}
            icon={
              <PresenceAvatar
                initials={initials(u.name || u.email)}
                src={u.avatar_url}
                state={presence.get(u.id)}
                title={u.email}
              />
            }
            label={u.name || u.email}
            right={<UnreadBadge count={unread.dmCounts[u.id] || 0} />}
          />
        )),
    },
    spaces: {
      title: "Spaces",
      onAdd: can("spaces.create") ? () => setSpaceParent(null) : undefined,
      body: spaceChildren(spaces || [], null).map((s) => (
        <SpaceRow
          key={s.id}
          space={s}
          spaces={spaces || []}
          depth={0}
          view={view}
          open={openSpaces}
          toggle={(id) => setOpenSpaces((p) => ({ ...p, [id]: !p[id] }))}
          onSelect={onSelect}
          onAddSub={(id) => setSpaceParent(id)}
          onEdit={(s2) => setSpaceEdit(s2)}

        />
      )).concat(
        // Numbering is board-wide rather than per space, so it sits at the foot
        // of the list instead of inside any one space.
        <button
          key="ws-numbering"
          onClick={() => setNumberingOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-[var(--txt-3)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
        >
          <ListTree className="h-3.5 w-3.5" strokeWidth={1.8} />
          Project numbering
        </button>,
      ),
    },
    subs: {
      title: "Subsidiaries",
      // The list is hard-coded here, so the server tells us which slugs to drop.
      body: SUBSIDIARIES.filter((s) => !(subLooks?.hidden || []).includes(s.slug)).map((s) => {
        const look = subLooks?.looks.find((l) => l.slug === s.slug);
        return (
          <NavRow
            key={s.slug}
            active={view.kind === "sub" && view.slug === s.slug}
            onClick={() => onSelect({ kind: "sub", slug: s.slug, tab: "overview" })}
            icon={
              look?.icon ? (
                <SpaceIcon name={look.icon} color={look.color} className="h-[15px] w-[15px]" />
              ) : (
                <s.icon className="h-[14px] w-[14px]" strokeWidth={1.6} />
              )
            }
            label={s.name}
            right={
              can("subsidiaries.edit") ? (
                <span className="ml-auto hidden items-center gap-1 group-hover:flex">
                  <button
                    title="Edit subsidiary"
                    onClick={() => setSubEdit(s.slug)}
                    className="text-[var(--txt-3)] transition hover:text-[var(--txt-1)]"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={1.8} />
                  </button>
                </span>
              ) : null
            }
          />
        );
      }),
    },
  };

  return (
    <aside className="workspace-sidebar panel-1 flex h-full w-full shrink-0 flex-col overflow-hidden border-r md:w-[268px]">
      {onClose && (
        <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2 md:hidden">
          <span className="text-[9px] uppercase text-[var(--txt-3)]" style={{ letterSpacing: "0.25em" }}>
            Workspace
          </span>
          <button onClick={onClose} aria-label="Close navigation" className="text-[var(--txt-3)] transition hover:text-[var(--txt-1)]">
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>
      )}
      <div className="workspace-sidebar-heading">
        <span className="workspace-emblem" aria-hidden="true">{workspaceBranding.name.charAt(0)}</span>
        <div><strong>{workspaceBranding.name}</strong><small>People, projects & operations</small></div>
      </div>
      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">


        <Section title="Home">
          {quick.map((q) => (
            <NavRow
              key={q.kind}
              active={view.kind === q.kind}
              onClick={() => onSelect({ kind: q.kind })}
              icon={<q.icon className="h-[14px] w-[14px]" strokeWidth={1.6} />}
              label={q.label}
              right={<UnreadBadge count={q.count} tone={q.tone} />}
            />
          ))}
        </Section>

        {order.map((key) => {
          const s = sections[key];
          if (!s) return null;
          return (
            <Section
              key={key}
              title={s.title}
              onAdd={s.onAdd}
              draggable
              dragging={dragKey === key}
              onDragStart={() => setDragKey(key)}
              onDragEnd={() => setDragKey(null)}
              onDropSection={() => {
                if (dragKey) move(dragKey, key);
                setDragKey(null);
              }}
            >
              {s.body}
            </Section>
          );
        })}

      </div>

      {channelModal && (
        <ChannelModal
          onClose={() => setChannelModal(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["ws-channels"] })}
        />
      )}
      {spaceParent !== undefined && (
        <SpaceModal
          parentId={spaceParent}
          parentName={spaces?.find((s) => s.id === spaceParent)?.name}
          onClose={() => setSpaceParent(undefined)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["ws-spaces"] })}
        />
      )}
      {spaceEdit && (
        <SpaceEditModal
          space={spaceEdit}
          onClose={() => setSpaceEdit(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["ws-spaces"] })}
        />
      )}
      {numberingOpen && <NumberingModal onClose={() => setNumberingOpen(false)} />}
      {channelEdit && (
        <ChannelEditModal
          channel={channelEdit}
          onClose={() => setChannelEdit(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["ws-channels"] })}
        />
      )}
      {subEdit && (
        <SubsidiaryEditModal
          slug={subEdit}
          look={subLooks?.looks.find((l) => l.slug === subEdit)}
          onClose={() => setSubEdit(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["ws-subsidiaries"] })}
        />
      )}

    </aside>
  );
}

function Section({
  title, children, onAdd, draggable, dragging, onDragStart, onDragEnd, onDropSection,
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDropSection?: () => void;
}) {
  return (
    <div
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={draggable ? (e) => { e.preventDefault(); onDropSection?.(); } : undefined}
      className={`workspace-section border-t border-[var(--line)] px-2 py-3 transition ${dragging ? "opacity-40" : ""}`}
    >
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`group flex items-center justify-between px-2 pb-1.5 ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <span className="label-micro flex items-center gap-1.5">
          {draggable && (
            <GripVertical className="h-3 w-3 opacity-0 transition group-hover:opacity-100" strokeWidth={1.6} />
          )}
          {title}
        </span>
        {onAdd && (
          <button onClick={onAdd} className="text-[var(--txt-3)] transition hover:text-[var(--txt-1)]">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}


function NavRow({
  active, onClick, icon, label, depth = 0, right,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  depth?: number;
  right?: React.ReactNode;
}) {
  return (
    <div
      data-active={active ? "true" : "false"}
      className={`workspace-nav-row group flex items-center gap-2 rounded-md px-2.5 py-[7px] text-[13px] transition ${
        active
          ? "bg-[var(--sel)] font-medium text-[var(--txt-1)] shadow-[inset_0_0_0_1px_var(--line)]"
          : "text-[var(--txt-2)] hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
      }`}
      style={{ paddingLeft: 8 + depth * 12 }}
    >
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="shrink-0 text-[var(--txt-3)]">{icon}</span>
        <span className="truncate">{label}</span>
      </button>
      {right}
    </div>
  );
}

function SpaceRow({
  space, spaces, depth, view, open, toggle, onSelect, onAddSub, onEdit,
}: {
  space: WsSpace;
  spaces: WsSpace[];
  depth: number;
  view: View;
  open: Record<number, boolean>;
  toggle: (id: number) => void;
  onSelect: (v: View) => void;
  onAddSub: (id: number) => void;
  onEdit: (s: WsSpace) => void;
}) {
  const qc = useQueryClient();
  const { can } = useCan();
  const kids = spaceChildren(spaces, space.id);
  const isOpen = open[space.id];

  const remove = useMutation({
    mutationFn: () => deleteSpace(space.id),
    onSuccess: () => {
      toast.success("Space removed");
      qc.invalidateQueries({ queryKey: ["ws-spaces"] });
    },
  });

  return (
    <Fragment>
      <NavRow
        depth={depth}
        active={view.kind === "space" && view.id === space.id}
        onClick={() => onSelect({ kind: "space", id: space.id })}
        icon={
          <span
            role={kids.length ? "button" : undefined}
            tabIndex={-1}
            title={kids.length ? (isOpen ? "Collapse" : "Expand") : space.name}
            onClick={(e) => {
              if (!kids.length) return;
              e.stopPropagation();
              toggle(space.id);
            }}
            /* The logo is the resting state; the expand arrow only surfaces
               under the cursor, and only where there is something to expand. */
            className={`group/ic relative flex h-[15px] w-[15px] items-center justify-center ${
              kids.length ? "cursor-pointer" : ""
            }`}
          >
            <SpaceIcon
              name={space.icon}
              color={space.color}
              className={`h-[15px] w-[15px] transition-opacity ${
                kids.length ? "group-hover/ic:opacity-0" : ""
              }`}
            />
            {!!kids.length && (
              <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/ic:opacity-100">
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                )}
              </span>
            )}
          </span>
        }
        label={space.name}
        right={
          <span className="hidden items-center gap-1 group-hover:flex">
            {space.is_private ? (
              <Lock className="h-3 w-3 text-[var(--txt-3)]" strokeWidth={1.8} />
            ) : null}
            {can("spaces.create") && (
              <button
                title="Add subspace"
                onClick={() => onAddSub(space.id)}
                className="text-[var(--txt-3)] transition hover:text-[var(--txt-1)]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            )}
            {can("spaces.edit") && (
              <button
                title="Edit space"
                onClick={() => onEdit(space)}
                className="text-[var(--txt-3)] transition hover:text-[var(--txt-1)]"
              >
                <Pencil className="h-3 w-3" strokeWidth={1.8} />
              </button>
            )}
            {can("spaces.delete") && (
              <button
                title="Delete space"
                onClick={() => remove.mutate()}
                className="text-[var(--txt-3)] transition hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
              </button>
            )}
          </span>
        }
      />
      {isOpen &&
        kids.map((k) => (
          <SpaceRow
            key={k.id}
            space={k}
            spaces={spaces}
            depth={depth + 1}
            view={view}
            open={open}
            toggle={toggle}
            onSelect={onSelect}
            onAddSub={onAddSub}
            onEdit={onEdit}
          />
        ))}
    </Fragment>
  );
}


/* ================= Modals ================= */

/** Correct the run and name what each leading digit of a document number means. */
function NumberingModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["ws-numbering"], queryFn: fetchNumbering });
  const [next, setNext] = useState("");
  const [cats, setCats] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data || dirty) return;
    setNext(String(data.next));
    setCats(data.categories || {});
  }, [data, dirty]);

  const save = useMutation({
    mutationFn: () => saveNumbering({ next: Number(next) || 1, categories: cats }),
    onSuccess: (cfg: WsNumbering) => {
      qc.setQueryData(["ws-numbering"], cfg);
      qc.invalidateQueries({ queryKey: ["ws-tasks"] });
      toast.success(`Next project will be ${cfg.preview}`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const year = data?.year ?? Number(String(new Date().getFullYear()).slice(2));
  const preview = `${String(year).padStart(2, "0")}-${String(Number(next) || 1).padStart(3, "0")}`;

  return (
    <Modal title="Project numbering" onClose={onClose}>
      <div className="space-y-5 p-4">
        <div>
          <label className="block text-[10px] uppercase text-[var(--txt-3)]" style={labelStyle}>
            Next project number
          </label>
          <div className="mt-2 flex items-center gap-3">
            <span data-num className="text-[13px] text-[var(--txt-3)]">{String(year).padStart(2, "0")}-</span>
            <input
              type="number"
              min={1}
              max={999}
              value={next}
              onChange={(e) => { setNext(e.target.value); setDirty(true); }}
              className="w-24 rounded-lg border border-[var(--line)] bg-[var(--input)] px-3 py-2 text-[13px] text-[var(--txt-1)] outline-none focus:border-[var(--txt-3)]"
            />
            <span data-num className="text-[12px] text-[var(--txt-2)]">→ {preview}</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--txt-3)]">
            Set this if the run drifts. A number already issued is skipped rather
            than reused, so two projects can never share a reference. The run
            restarts at 001 in January.
          </p>
        </div>

        <div>
          <label className="block text-[10px] uppercase text-[var(--txt-3)]" style={labelStyle}>
            Document types
          </label>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--txt-3)]">
            The leading digit of a component's number. Leave a row blank to drop it.
          </p>
          <div className="mt-2 space-y-1.5">
            {Array.from({ length: 10 }, (_, i) => String(i)).map((d) => (
              <div key={d} className="flex items-center gap-2">
                <span data-num className="w-14 shrink-0 text-[11px] text-[var(--txt-3)]">
                  {d}00
                </span>
                <input
                  value={cats[d] || ""}
                  placeholder={d === "0" ? "unused" : "e.g. Production drawings"}
                  onChange={(e) => {
                    setDirty(true);
                    setCats((c) => ({ ...c, [d]: e.target.value }));
                  }}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--input)] px-3 py-1.5 text-[12px] text-[var(--txt-1)] outline-none focus:border-[var(--txt-3)]"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-[12px] text-[var(--txt-3)] hover:text-[var(--txt-1)]">
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-lg bg-[var(--txt-1)] px-3 py-2 text-[12px] font-semibold text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // Portalled to <body>: the sidebar that renders these has a transform
  // (md:translate-x-0), which would otherwise become the containing block and
  // squeeze the dialog into the sidebar's width instead of centring it.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="overlay-1 w-full max-w-md overflow-hidden rounded-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <span className="label-micro">{title}</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--txt-3)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

const inputCls =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--txt-1)] placeholder-[var(--txt-3)] outline-none transition focus:border-[var(--line-strong)]";
const labelCls = "mb-1 block text-[10px] uppercase text-[var(--txt-3)]";
const labelStyle = { letterSpacing: "0.2em" } as const;

function ChannelModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [members, setMembers] = useState<number[]>([]);
  const [teamIds, setTeamIds] = useState<number[]>([]);

  const create = useMutation({
    mutationFn: () =>
      createChannel({
        name,
        description,
        is_private: isPrivate,
        member_ids: isPrivate ? members : [],
        team_ids: isPrivate ? teamIds : [],
      }),
    onSuccess: () => {
      toast.success(`#${name} created`);
      onCreated();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not create channel"),
  });

  return (
    <Modal title="New channel" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <label className={labelCls} style={labelStyle}>Name</label>
          <input className={inputCls} required value={name} placeholder="marketing" onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Description</label>
          <input className={inputCls} value={description} placeholder="Optional" onChange={(e) => setDescription(e.target.value)} />
        </div>
        <PrivacyFields
          noun="this channel"
          isPrivate={isPrivate}
          onPrivate={setIsPrivate}
          userIds={members}
          onUserIds={setMembers}
          teamIds={teamIds}
          onTeamIds={setTeamIds}
        />
        <button
          type="submit"
          className="w-full bg-[var(--txt-1)] py-2.5 text-[11px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90"
          style={labelStyle}
        >
          Create channel
        </button>
      </form>
    </Modal>
  );
}

function SpaceModal({
  parentId, parentName, onClose, onCreated,
}: {
  parentId: number | null;
  parentName?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7c6cff");
  const [icon, setIcon] = useState(DEFAULT_SPACE_ICON);
  const [isPrivate, setIsPrivate] = useState(false);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [teamIds, setTeamIds] = useState<number[]>([]);

  const create = useMutation({
    mutationFn: () =>
      createSpace({
        name,
        parent_id: parentId,
        color,
        icon,
        is_private: isPrivate,
        member_ids: isPrivate ? memberIds : [],
        team_ids: isPrivate ? teamIds : [],
      }),
    onSuccess: () => {
      toast.success(`${name} created`);
      onCreated();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not create space"),
  });

  return (
    <Modal title={parentId ? `New subspace in ${parentName}` : "New space"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <label className={labelCls} style={labelStyle}>Name</label>
          <input className={inputCls} required value={name} placeholder="Design" onChange={(e) => setName(e.target.value)} />
        </div>
        <SpaceLook
          name={name || "New space"}
          icon={icon}
          color={color}
          onIcon={setIcon}
          onColor={setColor}
        />
        <PrivacyFields
          noun={parentId ? "this subspace" : "this space"}
          isPrivate={isPrivate}
          onPrivate={setIsPrivate}
          userIds={memberIds}
          onUserIds={setMemberIds}
          teamIds={teamIds}
          onTeamIds={setTeamIds}
        />
        <button
          type="submit"
          className="w-full bg-[var(--txt-1)] py-2.5 text-[11px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90"
          style={labelStyle}
        >
          Create
        </button>
      </form>
    </Modal>
  );
}

function ChannelEditModal({
  channel, onClose, onSaved,
}: {
  channel: WsChannel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || "");
  const [color, setColor] = useState(channel.color || "#7c6cff");
  const [icon, setIcon] = useState(channel.icon || DEFAULT_SPACE_ICON);
  const [isPrivate, setIsPrivate] = useState(!!channel.is_private);
  const [memberIds, setMemberIds] = useState<number[]>(channel.member_ids || []);
  const [teamIds, setTeamIds] = useState<number[]>(channel.team_ids || []);

  const save = useMutation({
    mutationFn: () =>
      updateChannel(channel.id, {
        name,
        description,
        color,
        icon,
        is_private: isPrivate,
        member_ids: isPrivate ? memberIds : [],
        team_ids: isPrivate ? teamIds : [],
      }),
    onSuccess: () => {
      toast.success(`#${name} updated`);
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not update channel"),
  });

  return (
    <Modal title="Edit channel" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <label className={labelCls} style={labelStyle}>Name</label>
          <input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Description</label>
          <input
            className={inputCls}
            value={description}
            placeholder="Optional"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <SpaceLook name={`#${name}`} icon={icon} color={color} onIcon={setIcon} onColor={setColor} />
        <PrivacyFields
          noun="this channel"
          isPrivate={isPrivate}
          onPrivate={setIsPrivate}
          userIds={memberIds}
          onUserIds={setMemberIds}
          teamIds={teamIds}
          onTeamIds={setTeamIds}
        />
        <button
          type="submit"
          disabled={save.isPending}
          className="w-full bg-[var(--txt-1)] py-2.5 text-[11px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-50"
          style={labelStyle}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </form>
    </Modal>
  );
}

function SubsidiaryEditModal({
  slug, look, onClose, onSaved,
}: {
  slug: string;
  look?: WsSubsidiary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const sub = SUBSIDIARIES.find((s) => s.slug === slug);
  const [color, setColor] = useState(look?.color || "#7c6cff");
  const [icon, setIcon] = useState(look?.icon || DEFAULT_SPACE_ICON);
  const [isPrivate, setIsPrivate] = useState(!!look?.is_private);
  const [memberIds, setMemberIds] = useState<number[]>(look?.member_ids || []);
  const [teamIds, setTeamIds] = useState<number[]>(look?.team_ids || []);

  const save = useMutation({
    mutationFn: () =>
      saveSubsidiaryLook({
        slug,
        icon,
        color,
        is_private: isPrivate,
        member_ids: isPrivate ? memberIds : [],
        team_ids: isPrivate ? teamIds : [],
      }),
    onSuccess: () => {
      toast.success(`${sub?.name || slug} updated`);
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not update subsidiary"),
  });

  return (
    <Modal title={`Edit ${sub?.name || slug}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <SpaceLook
          name={sub?.name || slug}
          icon={icon}
          color={color}
          onIcon={setIcon}
          onColor={setColor}
        />
        <PrivacyFields
          noun="this subsidiary"
          isPrivate={isPrivate}
          onPrivate={setIsPrivate}
          userIds={memberIds}
          onUserIds={setMemberIds}
          teamIds={teamIds}
          onTeamIds={setTeamIds}
        />
        <button
          type="submit"
          disabled={save.isPending}
          className="w-full bg-[var(--txt-1)] py-2.5 text-[11px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-50"
          style={labelStyle}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </form>
    </Modal>
  );
}

/** Logo + colour, with a preview of the row as it will appear in the sidebar. */
function SpaceLook({
  name, icon, color, onIcon, onColor,
}: {
  name: string;
  icon: string;
  color: string;
  onIcon: (v: string) => void;
  onColor: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className={labelCls} style={labelStyle}>Logo &amp; colour</label>
      <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--input)] px-3 py-2">
        <SpaceIcon name={icon} color={color} className="h-[18px] w-[18px]" />
        <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--txt-1)]">{name}</span>
        <input
          type="color"
          value={color}
          onChange={(e) => onColor(e.target.value)}
          title="Space colour"
          className="h-7 w-10 shrink-0 cursor-pointer rounded border border-[var(--line)] bg-transparent"
        />
      </div>
      <SpaceIconPicker value={icon} color={color} onChange={onIcon} />
    </div>
  );
}

function SpaceEditModal({
  space, onClose, onSaved,
}: {
  space: WsSpace;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(space.name);
  const [color, setColor] = useState(space.color || "#7c6cff");
  const [icon, setIcon] = useState(space.icon || DEFAULT_SPACE_ICON);
  const [isPrivate, setIsPrivate] = useState(!!space.is_private);
  const [memberIds, setMemberIds] = useState<number[]>(space.member_ids || []);
  const [teamIds, setTeamIds] = useState<number[]>(space.team_ids || []);

  const save = useMutation({
    mutationFn: () =>
      updateSpace(space.id, {
        name,
        color,
        icon,
        is_private: isPrivate,
        member_ids: isPrivate ? memberIds : [],
        team_ids: isPrivate ? teamIds : [],
      }),
    onSuccess: () => {
      toast.success("Space updated");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not update space"),
  });

  return (
    <Modal title={space.parent_id ? "Edit subspace" : "Edit space"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <label className={labelCls} style={labelStyle}>Name</label>
          <input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <SpaceLook name={name} icon={icon} color={color} onIcon={setIcon} onColor={setColor} />
        <PrivacyFields
          noun={space.parent_id ? "this subspace" : "this space"}
          isPrivate={isPrivate}
          onPrivate={setIsPrivate}
          userIds={memberIds}
          onUserIds={setMemberIds}
          teamIds={teamIds}
          onTeamIds={setTeamIds}
        />
        <button
          type="submit"
          disabled={save.isPending}
          className="w-full bg-[var(--txt-1)] py-2.5 text-[11px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-50"
          style={labelStyle}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </form>
    </Modal>
  );
}

/* ================= Main pane ================= */


function MainPane({ view, onSelect }: { view: View; onSelect: (v: View) => void }) {
  const { data: channels } = useQuery({ queryKey: ["ws-channels"], queryFn: fetchChannels });
  const { data: users } = useQuery({ queryKey: ["ws-users"], queryFn: fetchWsUsers });
  const { data: spaces } = useQuery({ queryKey: ["ws-spaces"], queryFn: fetchSpaces });
  const dmPresence = usePresenceMap();

  if (view.kind === "channel") {
    const c = channels?.find((x) => x.id === view.id);
    return <Chat title={`# ${c?.name ?? ""}`} subtitle={c?.description || undefined} channelId={view.id} />;
  }
  if (view.kind === "dm") {
    const u = users?.find((x) => x.id === view.id);
    return (
      <Chat
        title={u?.name || u?.email || "Direct message"}
        subtitle={u?.email}
        recipientId={view.id}
        titleDot={<PresenceDot state={dmPresence.get(view.id)} size={8} />}
      />
    );
  }
  if (view.kind === "space") {
    const s = spaces?.find((x) => x.id === view.id);
    const kids = spaceChildren(spaces || [], view.id);
    return (
      <Board
        spaceId={view.id}
        spaceName={s?.name ?? "Space"}
        rollup={kids.length > 0}
        childSpaces={kids}
      />
    );
  }
  if (view.kind === "sub") {
    return <SubPane slug={view.slug} tab={view.tab} />;
  }
  if (view.kind === "mytasks") return <MyTasksPane />;
  return <QuickPane kind={view.kind} onSelect={onSelect} />;
}

function SubPane({ slug, tab }: { slug: string; tab?: string }) {
  const sub = SUBSIDIARIES.find((s) => s.slug === slug);
  if (!sub) return <QuickPane kind="inbox" />;
  const Icon = sub.icon;

  const CustomPanel = extensionPanels[slug];
  if (CustomPanel) return <CustomPanel />;

  return (
    <>
      <PaneHeader title={sub.name} subtitle={sub.description} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="border border-[var(--line)] bg-[var(--s-2)] p-6 backdrop-blur-md">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--line)] text-[var(--txt-2)]">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <h2 className="wordmark text-xl text-[var(--txt-1)]">{sub.name}</h2>
                <p className="mt-2 text-xs leading-relaxed text-[var(--txt-3)]">{sub.detail}</p>
              </div>
            </div>
            <div className="mt-6">
              <span
                className="border border-[var(--line)] px-4 py-2.5 text-[10px] uppercase text-[var(--txt-3)]"
                style={labelStyle}
              >
                <a href={sub.url || "https://example.com"} target="_blank" rel="noopener noreferrer">Open {sub.name} ↗</a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}



function PaneHeader({
  title, subtitle, right, titleDot,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  /** Small indicator rendered before the title, e.g. presence on a DM. */
  titleDot?: React.ReactNode;
}) {
  return (
    <header className="pane-header flex h-12 shrink-0 items-center gap-3 border-b border-[var(--line)] px-5">
      <h1 className="flex shrink-0 items-center gap-2 text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--txt-1)]">
        {titleDot}
        {title}
      </h1>
      {subtitle && (
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--txt-3)]">{subtitle}</span>
      )}
      <div className="ml-auto shrink-0">{right}</div>
    </header>
  );
}

type FeedItem = {
  key: string;
  tone: "mention" | "comment" | "assigned" | "message";
  icon: React.ReactNode;
  title: string;
  meta: string;
  body?: string;
  at: string | null;
  onOpen?: () => void;
};

/** Priority order for sorting. Urgent first, unset last. */
const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0, high: 1, normal: 2, low: 3, none: 4,
};

/** Everything assigned to me, most urgent first, opening straight into the task. */
function MyTasksPane() {
  const me = getUser();
  const qc = useQueryClient();
  const { data: tasks } = useQuery({ queryKey: ["ws-tasks-all"], queryFn: fetchAllTasks });
  const { data: users } = useQuery({ queryKey: ["ws-users"], queryFn: fetchWsUsers });
  const { data: spaces } = useQuery({ queryKey: ["ws-spaces"], queryFn: fetchSpaces });
  const [openId, setOpenId] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);

  const mine = useMemo(() => {
    if (!me) return [];
    return (tasks || [])
      .filter((t) => taskAssigneeIds(t).includes(me.id))
      .filter((t) => (showDone ? true : t.status !== "done"))
      .sort((a, b) => {
        const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (p !== 0) return p;
        // Within a priority, whatever is due soonest comes first; undated work
        // sinks rather than jumping the queue on an empty date.
        const ad = a.due_date || a.end_date || "";
        const bd = b.due_date || b.end_date || "";
        if (ad && bd) return ad.localeCompare(bd);
        if (ad) return -1;
        if (bd) return 1;
        return a.title.localeCompare(b.title);
      });
  }, [tasks, me, showDone]);

  const openTask = (tasks || []).find((t) => t.id === openId) || null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["ws-tasks-all"] });
  const doneCount = (tasks || []).filter(
    (t) => me && taskAssigneeIds(t).includes(me.id) && t.status === "done",
  ).length;

  return (
    <>
      <PaneHeader
        title="My tasks"
        subtitle={`${mine.length} open${doneCount ? ` · ${doneCount} done` : ""}`}
      />
      <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
        {doneCount > 0 && (
          <button
            onClick={() => setShowDone((v) => !v)}
            className="mb-1 text-[11px] text-[var(--txt-3)] transition hover:text-[var(--txt-1)]"
          >
            {showDone ? "Hide" : "Show"} {doneCount} done
          </button>
        )}
        {mine.length === 0 && (
          <p className="pt-10 text-center text-[11px] text-[var(--txt-3)]">
            Nothing assigned to you.
          </p>
        )}
        {mine.map((t) => {
          const no = taskNumber(t, projectNoFor(t, tasks || []));
          return (
            <button
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className="card-1 hover:card-1-hover flex w-full items-start gap-3 rounded-xl px-3.5 py-3 text-left transition"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${statusDot[t.status]}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[11px] leading-tight text-[var(--txt-3)]">
                  {no && <span data-num className="shrink-0">{no}</span>}
                  <span className="truncate">{t.space_name || "Space"}</span>
                </span>
                <span className="block truncate text-[13px] font-medium text-[var(--txt-1)]">
                  {t.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-[var(--txt-3)]">
                  <span className={priorityColor[t.priority]}>
                    {t.priority === "none" ? "no priority" : t.priority}
                  </span>
                  <span>· {TASK_STATUS_LABELS[t.status]}</span>
                  {(t.due_date || t.end_date) && (
                    <span data-num>· due {new Date((t.due_date || t.end_date)!).toLocaleDateString()}</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {openTask && (
        <TaskDetail
          task={openTask}
          users={users || []}
          spaces={spaces || []}
          subtasks={(tasks || []).filter((s) => s.parent_id === openTask.id)}
          onOpenTask={(id) => setOpenId(id)}
          onClose={() => setOpenId(null)}
          onSaved={refresh}
          onDeleted={() => {
            setOpenId(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function QuickPane({ kind, onSelect }: { kind: "inbox" | "replies" | "assigned"; onSelect?: (v: View) => void }) {
  const me = getUser();
  const myHandle = me ? mentionHandle(me) : "";

  const { data: activity } = useQuery({
    queryKey: ["ws-activity"],
    queryFn: fetchActivity,
    refetchInterval: 20000,
  });
  const { data: tasks } = useQuery({ queryKey: ["ws-tasks-all"], queryFn: fetchAllTasks });

  const items = useMemo<FeedItem[]>(() => {
    if (!me) return [];
    const out: FeedItem[] = [];

    // Assigned tasks used to be listed here, which buried the conversation
    // under a standing to-do list. They have their own pane now.

    (activity?.comments || []).forEach((c) => {
      const mine = c.user_id === me.id;
      const mentioned = mentionsUser(c.body, me);
      const onMyTask = c.assignee_ids.includes(me.id);
      const iAlsoCommented = (activity?.comments || []).some(
        (o) => o.task_id === c.task_id && o.user_id === me.id
      );
      // Replies now means exactly that: someone answered something you wrote.
      const repliedToMe = c.reply_to_user_id === me.id;
      const keep =
        kind === "assigned"
          ? mentioned && !mine
          : kind === "replies"
          ? !mine && repliedToMe
          : !mine && (mentioned || onMyTask || iAlsoCommented);
      if (!keep) return;
      out.push({
        key: `comment-${c.id}`,
        tone: mentioned ? "mention" : "comment",
        icon: repliedToMe ? <MessageSquareReply className="h-3.5 w-3.5" strokeWidth={1.8} /> : mentioned ? <AtSign className="h-3.5 w-3.5" strokeWidth={1.8} /> : <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.8} />,
        title: `${c.user_name || c.user_email || "Someone"} ${repliedToMe ? "replied to you on" : mentioned ? "mentioned you in" : "commented on"} ${c.task_title || "a task"}`,
        meta: `Task #${c.task_id}${c.parent_id ? " · subtask" : ""}${c.task_status ? ` · ${TASK_STATUS_LABELS[c.task_status]}` : ""}`,
        body: c.body,
        at: c.created_at,
      });
    });

    (activity?.messages || []).forEach((m) => {
      if (m.sender_id === me.id) return;
      const mentioned = mentionsUser(m.body, me);
      const dmToMe = m.recipient_id === me.id;
      const repliedToMe = m.reply_to_user_id === me.id;
      const keep =
        kind === "assigned" ? mentioned : kind === "replies" ? repliedToMe : mentioned || dmToMe;
      if (!keep) return;
      out.push({
        key: `msg-${m.id}`,
        tone: mentioned ? "mention" : "message",
        icon: repliedToMe ? <MessageSquareReply className="h-3.5 w-3.5" strokeWidth={1.8} /> : m.channel_id ? <Hash className="h-3.5 w-3.5" strokeWidth={1.8} /> : <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.8} />,
        title: `${m.sender_name || m.sender_email || "Someone"} ${repliedToMe ? "replied to you" : mentioned ? "mentioned you" : "messaged you"}${m.channel_name ? ` in #${m.channel_name}` : ""}`,
        meta: m.channel_name ? `Channel · #${m.channel_name}` : "Direct message",
        body: m.body,
        at: m.created_at,
        onOpen: () =>
          onSelect?.(m.channel_id ? { kind: "channel", id: m.channel_id } : { kind: "dm", id: m.sender_id }),
      });
    });

    return out.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  }, [activity, tasks, me, kind, onSelect]);

  /* Viewing the feed clears its balloon. */
  useEffect(() => {
    const latest = items.reduce((a, i) => (i.at && i.at > a ? i.at : a), "");
    markSeen(kind === "inbox" ? "inbox" : kind === "replies" ? "replies" : "mentions", undefined, latest || undefined);
  }, [items, kind]);

  const label = kind === "inbox" ? "Inbox" : kind === "replies" ? "Replies" : "Mentions";

  return (
    <>
      <PaneHeader
        title={label}
        subtitle={items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : undefined}
      />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
            <p className="text-sm text-[var(--txt-2)]">Nothing here yet</p>
            <p className="mt-2 max-w-xs text-[11px] text-[var(--txt-3)]">
              {kind === "inbox"
                ? "Assignments, task chat and @mentions collect here."
                : kind === "replies"
                ? "Replies in threads you take part in show up here."
                : "Write @name in a task comment or channel to mention someone."}
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-2">
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={it.onOpen}
                className="card-1 hover:card-1-hover flex w-full items-start gap-3 rounded-lg px-4 py-3 text-left transition duration-150 hover:-translate-y-px"
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    it.tone === "mention"
                      ? "bg-[var(--tint-strong)] text-[var(--txt-1)]"
                      : it.tone === "assigned"
                        ? "bg-sky-400/15 text-sky-400"
                        : "bg-[var(--tint)] text-[var(--txt-3)]"
                  }`}
                >
                  {it.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[var(--txt-1)]">{it.title}</p>
                  <p className="label-micro mt-1">{it.meta}</p>
                  {it.body && (
                    <div className="mt-1.5">
                      <MessageText body={it.body} myHandle={myHandle} />
                    </div>
                  )}
                </div>
                {it.at && (
                  <span data-num className="shrink-0 text-[10.5px] text-[var(--txt-3)]">
                    {new Date(it.at).toLocaleDateString()}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ================= Chat ================= */

/** The palette offered on hover. Any emoji already on the message can still be
 *  clicked, so this only has to cover the common cases. */
const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🚀", "✅", "😢"];

/** The quoted line above a reply. Click it to jump to what is being answered. */
function QuotedLine({ who, body, onJump }: { who?: string | null; body: string; onJump?: () => void }) {
  return (
    <button
      type="button"
      onClick={onJump}
      disabled={!onJump}
      className="mb-1 flex w-full items-start gap-1.5 rounded-md border-l-2 border-[var(--line-strong)] bg-[var(--tint)] px-2 py-1 text-left transition hover:bg-[var(--tint-strong)] disabled:cursor-default"
    >
      <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-[var(--txt-3)]" strokeWidth={1.8} />
      <span className="min-w-0">
        <span className="block text-[10px] text-[var(--txt-3)]">{who || "Someone"}</span>
        <span className="block truncate text-[11px] text-[var(--txt-2)]">{body}</span>
      </span>
    </button>
  );
}

function MessageRow({
  message: m, mine, avatarUrl, users, myHandle, onChanged, onReply,
}: {
  message: WsMessage;
  mine: boolean;
  avatarUrl?: string | null;
  users: WsUser[];
  myHandle: string;
  onChanged: () => void;
  onReply?: (m: WsMessage) => void;
}) {
  const { can } = useCan();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [confirming, setConfirming] = useState(false);

  const canDelete = mine || can("messages.delete");

  const react = useMutation({
    mutationFn: (emoji: string) => toggleReaction(m.id, emoji),
    onSuccess: () => {
      setPicking(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message || "Could not react"),
  });

  const save = useMutation({
    mutationFn: (body: string) => editMessage(m.id, body),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const remove = useMutation({
    mutationFn: () => deleteMessage(m.id),
    onSuccess: () => {
      setConfirming(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete"),
  });

  const commit = () => {
    const next = draft.trim();
    // An empty edit is a delete in disguise; make the user say so explicitly
    // rather than quietly destroying the message.
    if (!next) {
      toast.error("Message cannot be empty — delete it instead");
      return;
    }
    if (next === m.body) {
      setEditing(false);
      return;
    }
    save.mutate(next);
  };

  /** Who reacted, for the pill's tooltip. */
  const reactorNames = (ids: number[]) =>
    ids
      .map((id) => users.find((u) => u.id === id)?.name || "Someone")
      .join(", ");

  return (
    <div
      id={`msg-${m.id}`}
      className="group relative flex gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-[var(--tint)]"
    >
      {/* Messages carry no avatar of their own, so the picture comes
          from the already-cached user list, keyed on sender_id. */}
      <Avatar size={28} className="mt-0.5" src={avatarUrl} name={m.sender_name} email={m.sender_email} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[var(--txt-3)]">
          {mine ? "You" : m.sender_name || m.sender_email}
          <span className="ml-2 text-[var(--txt-3)]">{new Date(m.created_at).toLocaleString()}</span>
          {m.edited_at && <span className="ml-1.5 italic text-[var(--txt-3)]">(edited)</span>}
        </p>

        {m.reply_to && m.reply_body && !editing && (
          <QuotedLine
            who={m.reply_sender_name}
            body={m.reply_body}
            onJump={() => {
              const el = document.getElementById(`msg-${m.reply_to}`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
              // A flash is enough to find it again; the row keeps no state.
              el?.animate(
                [{ backgroundColor: "var(--tint-strong)" }, { backgroundColor: "transparent" }],
                { duration: 1200 },
              );
            }}
          />
        )}

        {editing ? (
          <div className="mt-1">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDraft(m.body);
                  setEditing(false);
                }
                // Enter saves, Shift+Enter keeps the newline — same contract as
                // the composer, so editing does not feel like a different app.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commit();
                }
              }}
              rows={Math.min(8, draft.split("\n").length + 1)}
              className="w-full resize-none rounded-xl border border-[var(--line-strong)] bg-[var(--input)] px-3 py-2 text-[13px] text-[var(--txt-1)] outline-none focus:border-[var(--txt-3)]"
            />
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <button
                onClick={commit}
                disabled={save.isPending}
                className="rounded-lg bg-[var(--tint-strong)] px-2.5 py-1 text-[var(--txt-1)] transition hover:bg-[var(--sel)] disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setDraft(m.body);
                  setEditing(false);
                }}
                className="rounded-lg px-2.5 py-1 text-[var(--txt-3)] transition hover:text-[var(--txt-1)]"
              >
                Cancel
              </button>
              <span className="text-[var(--txt-3)]">Enter to save, Esc to cancel</span>
            </div>
          </div>
        ) : (
          <MessageText body={m.body} myHandle={myHandle} />
        )}

        {!!m.reactions?.length && !editing && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                title={reactorNames(r.user_ids)}
                onClick={() => react.mutate(r.emoji)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition ${
                  r.mine
                    ? "border-[var(--txt-3)] bg-[var(--sel)] text-[var(--txt-1)]"
                    : "border-[var(--line)] bg-[var(--tint)] text-[var(--txt-2)] hover:border-[var(--line-strong)]"
                }`}
              >
                <span>{r.emoji}</span>
                <span data-num>{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {confirming && (
          <div className="mt-1.5 flex items-center gap-2 text-[11px]">
            <span className="text-[var(--txt-2)]">Delete this message?</span>
            <button
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="rounded-lg bg-red-500/15 px-2.5 py-1 text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg px-2.5 py-1 text-[var(--txt-3)] transition hover:text-[var(--txt-1)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Hover toolbar. Kept out of the flow so adding it did not change the
          rhythm of the message list. */}
      {!editing && !confirming && (
        // pointer-events follow opacity: an invisible toolbar hovering over the
        // message above it would otherwise swallow clicks meant for that one.
        <div className="pointer-events-none absolute right-2 top-0 flex -translate-y-1/2 items-center gap-0.5 rounded-full border border-[var(--line)] p-0.5 opacity-0 shadow-[var(--lift-1)] transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 panel-2">
          <button
            onClick={() => setPicking((v) => !v)}
            title="Add reaction"
            className="rounded-full p-1.5 text-[var(--txt-3)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
          >
            <SmilePlus size={14} />
          </button>
          {onReply && (
            <button
              onClick={() => onReply(m)}
              title="Reply"
              className="rounded-full p-1.5 text-[var(--txt-3)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
            >
              <MessageSquareReply size={14} />
            </button>
          )}
          {mine && (
            <button
              onClick={() => {
                setDraft(m.body);
                setEditing(true);
              }}
              title="Edit message"
              className="rounded-full p-1.5 text-[var(--txt-3)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
            >
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setConfirming(true)}
              title="Delete message"
              className="rounded-full p-1.5 text-[var(--txt-3)] transition hover:bg-red-500/15 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}

      {picking && (
        <>
          {/* Click-away catcher, so the palette closes like a real popover. */}
          <div className="fixed inset-0 z-10" onClick={() => setPicking(false)} />
          <div className="absolute right-2 top-6 z-20 flex gap-0.5 rounded-full border border-[var(--line)] p-1 shadow-[var(--lift-2)] overlay-1">
            {QUICK_REACTIONS.map((e) => {
              const on = m.reactions?.some((r) => r.emoji === e && r.mine);
              return (
                <button
                  key={e}
                  onClick={() => react.mutate(e)}
                  className={`relative rounded-full px-1.5 py-1 text-[15px] leading-none transition hover:bg-[var(--tint-strong)] ${
                    on ? "bg-[var(--sel)]" : ""
                  }`}
                >
                  {e}
                  {on && (
                    <Check size={9} className="absolute right-0 top-0 text-[var(--txt-1)]" strokeWidth={4} />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Chat({
  title, subtitle, channelId, recipientId, titleDot,
}: {
  title: string;
  subtitle?: string;
  channelId?: number;
  recipientId?: number;
  /** Presence indicator shown beside the name in a direct message. */
  titleDot?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const me = getUser();
  const myHandle = me ? mentionHandle(me) : "";
  const key = channelId ? ["ws-msg", "c", channelId] : ["ws-msg", "d", recipientId];
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Pin to the newest message. Moves the pane's own scrollTop so it cannot
   *  drag the page around underneath the iOS keyboard. */
  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  };
  const { data: users } = useQuery({ queryKey: ["ws-users"], queryFn: fetchWsUsers });

  const { data: messages } = useQuery({
    queryKey: key,
    queryFn: () => (channelId ? fetchChannelMessages(channelId) : fetchDirectMessages(recipientId!)),
    refetchInterval: 8000,
  });

  /* Opening (or receiving in) a conversation clears its balloon. */
  useEffect(() => {
    const latest = (messages || []).reduce((a, m) => (m.created_at > a ? m.created_at : a), "");
    if (channelId) markSeen("channel", channelId, latest || undefined);
    else if (recipientId) markSeen("dm", recipientId, latest || undefined);
  }, [messages, channelId, recipientId]);

  /* Land at the newest message when a conversation opens or one arrives —
     unless you have deliberately scrolled up to read history. */
  const stickToBottom = useRef(true);
  const messageCount = messages?.length ?? 0;
  const isNarrow = useIsMobile();

  useEffect(() => {
    if (stickToBottom.current) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCount, channelId, recipientId]);

  /* GIFs and images finish loading after the first scroll and grow the pane,
     which is what leaves the newest message half off-screen. Watch the content
     box instead of trusting a single scroll. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) scrollToBottom();
    });
    Array.from(el.children).forEach((child) => ro.observe(child));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCount]);

  /* The iOS keyboard shrinks the visible viewport; follow it down so the last
     message is not left hidden behind it. */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (stickToBottom.current) requestAnimationFrame(() => scrollToBottom());
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const [replyTo, setReplyTo] = useState<WsMessage | null>(null);

  const send = useMutation({
    mutationFn: (body: string) =>
      sendMessage({ channel_id: channelId, recipient_id: recipientId, body, reply_to: replyTo?.id }),
    onSuccess: () => {
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["ws-activity"] });
      requestAnimationFrame(() => scrollToBottom("smooth"));
    },
    onError: (e: Error) => toast.error(e.message || "Could not send"),
  });

  return (
    <>
      <PaneHeader title={title} subtitle={subtitle} titleDot={titleDot} />
      <div
        ref={scrollRef}
        onScroll={(e) => {
          // Within a line of the bottom counts as "at the bottom".
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4"
      >
        {(messages || []).length === 0 && (
          <p className="pt-10 text-center text-[11px] text-[var(--txt-3)]">No messages yet — say hello.</p>
        )}
        {(messages || []).map((m) => (
          <MessageRow
            key={m.id}
            message={m}
            mine={m.sender_id === me?.id}
            avatarUrl={users?.find((u) => u.id === m.sender_id)?.avatar_url}
            users={users || []}
            myHandle={myHandle}
            onChanged={() => {
              qc.invalidateQueries({ queryKey: key });
              qc.invalidateQueries({ queryKey: ["ws-activity"] });
            }}
            onReply={(target) => setReplyTo(target)}
          />
        ))}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 border-t border-[var(--line)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-[var(--txt-3)] bg-[var(--tint)] px-2.5 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-[var(--txt-3)]">
                Replying to {replyTo.sender_id === me?.id ? "yourself" : replyTo.sender_name || replyTo.sender_email}
              </p>
              <p className="truncate text-[11px] text-[var(--txt-2)]">{replyTo.body}</p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              title="Cancel reply"
              className="shrink-0 rounded-full p-1 text-[var(--txt-3)] transition hover:text-[var(--txt-1)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <ChatComposer
          users={users || []}
          placeholder={
            replyTo ? "Write a reply…" : isNarrow ? `Message ${title}` : `Message ${title} — @ to mention`
          }
          pending={send.isPending}
          onSend={(value) => send.mutate(value)}
        />
      </div>
    </>
  );
}

/* ================= Kanban ================= */

/** Board filters survive a sign-out, so they live in localStorage rather than
 *  with the session. Every read and write is guarded: a private window, or a
 *  browser set to block site data, throws on access rather than returning
 *  nothing, and a board that will not open is worse than one that forgets. */
const BOARD_FILTER_KEY = "ws-board-filter-v1";
type BoardFilter = { users: number[]; hideDone: boolean };
const EMPTY_FILTER: BoardFilter = { users: [], hideDone: false };

function readBoardFilter(spaceId: number): BoardFilter {
  if (typeof window === "undefined") return EMPTY_FILTER;
  try {
    const all = JSON.parse(localStorage.getItem(BOARD_FILTER_KEY) || "{}");
    const f = all?.[String(spaceId)];
    if (!f) return EMPTY_FILTER;
    return {
      // > 0, not just finite: Number(null) is 0, and a filter holding user 0
      // matches nobody, so the board would come up empty with no way to see why.
      users: Array.isArray(f.users)
        ? f.users.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
        : [],
      hideDone: !!f.hideDone,
    };
  } catch {
    return EMPTY_FILTER;
  }
}

function writeBoardFilter(spaceId: number, f: BoardFilter): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(BOARD_FILTER_KEY) || "{}");
    // An empty filter is dropped rather than stored, so the map does not grow
    // a row for every board ever opened.
    if (!f.users.length && !f.hideDone) delete all[String(spaceId)];
    else all[String(spaceId)] = f;
    localStorage.setItem(BOARD_FILTER_KEY, JSON.stringify(all));
  } catch {
    /* nothing to do: the filter just will not be remembered */
  }
}

/** Add, rename, recolour, reorder and hide a space's board columns. */
function ColumnsModal({
  spaceId, spaceName, data, onClose, onSaved,
}: {
  spaceId: number;
  spaceName: string;
  data: SpaceColumns;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cols, setCols] = useState<BoardColumn[]>(data.columns);
  const [hidden, setHidden] = useState<string[]>(data.hidden ?? []);
  const [busy, setBusy] = useState(false);

  const inherited = data.source !== "own";
  const move = (i: number, by: number) =>
    setCols((cs) => {
      const j = i + by;
      if (j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const save = () => {
    setBusy(true);
    saveSpaceColumns(spaceId, { columns: cols, hidden })
      .then(() => { toast.success("Columns saved"); onSaved(); onClose(); })
      .catch((e: Error) => toast.error(readableApiError(e)))
      .finally(() => setBusy(false));
  };

  const revert = () => {
    setBusy(true);
    resetSpaceColumns(spaceId)
      .then((d) => {
        setCols(d.columns);
        toast.success("Back to inherited columns");
        onSaved();
        onClose();
      })
      .catch((e: Error) => toast.error(readableApiError(e)))
      .finally(() => setBusy(false));
  };

  return (
    <Modal title={`Columns · ${spaceName}`} onClose={onClose}>
      <div className="space-y-4 p-4">
        <p className="text-[11px] leading-relaxed text-[var(--txt-3)]">
          {inherited
            ? "This space follows its parent. Saving gives it its own set, and its subspaces follow this one unless they break away too."
            : "This space has its own columns. Its subspaces follow them unless they define their own."}
          {" "}Renaming keeps a column's tasks; only removing one moves them.
        </p>

        <div className="space-y-2">
          {cols.map((c, i) => (
            <div key={c.key} className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${toneDot(c.tone)}`} />
              <input
                value={c.label}
                onChange={(e) =>
                  setCols((cs) => cs.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))
                }
                className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--input)] px-2.5 py-1.5 text-[12px] text-[var(--txt-1)] outline-none focus:border-[var(--txt-3)]"
              />
              <select
                value={c.tone}
                onChange={(e) =>
                  setCols((cs) => cs.map((x, k) => (k === i ? { ...x, tone: e.target.value } : x)))
                }
                className="rounded-lg border border-[var(--line)] bg-[var(--input)] px-1.5 py-1.5 text-[11px] text-[var(--txt-2)] outline-none"
              >
                {COLUMN_TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={() => move(i, -1)} disabled={i === 0} title="Up"
                className="px-1 text-[var(--txt-3)] transition hover:text-[var(--txt-1)] disabled:opacity-25">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === cols.length - 1} title="Down"
                className="px-1 text-[var(--txt-3)] transition hover:text-[var(--txt-1)] disabled:opacity-25">↓</button>
              <button
                onClick={() =>
                  setHidden((h) => (h.includes(c.key) ? h.filter((k) => k !== c.key) : [...h, c.key]))
                }
                title={hidden.includes(c.key) ? "Hidden on this board" : "Hide on this board"}
                className={`px-1 transition ${hidden.includes(c.key) ? "text-amber-400" : "text-[var(--txt-3)] hover:text-[var(--txt-1)]"}`}
              >
                {hidden.includes(c.key) ? "◌" : "●"}
              </button>
              <button
                onClick={() => setCols((cs) => cs.filter((_, k) => k !== i))}
                disabled={cols.length <= 1}
                title="Remove"
                className="px-1 text-[var(--txt-3)] transition hover:text-red-400 disabled:opacity-25"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setCols((cs) => [...cs, { key: "", label: "New column", tone: "slate" }])}
          className="flex items-center gap-1.5 text-[11px] text-[var(--txt-3)] transition hover:text-[var(--txt-1)]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} /> Add column
        </button>

        <p className="text-[10.5px] leading-relaxed text-[var(--txt-3)]">
          A hidden column still holds its tasks; they appear under Unsorted so
          nothing is lost. Removing a column is what actually strands its work.
        </p>

        <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
          {!inherited && (
            <button onClick={revert} disabled={busy}
              className="mr-auto rounded-lg px-3 py-2 text-[11px] text-[var(--txt-3)] transition hover:text-[var(--txt-1)] disabled:opacity-40">
              Follow parent again
            </button>
          )}
          <button onClick={onClose}
            className="rounded-lg px-3 py-2 text-[11px] text-[var(--txt-3)] transition hover:text-[var(--txt-1)]">
            Cancel
          </button>
          <button onClick={save} disabled={busy}
            className="rounded-lg bg-[var(--txt-1)] px-3 py-2 text-[11px] font-semibold text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-40">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const statusDot: Record<TaskStatus, string> = {
  todo: "bg-zinc-500",
  in_progress: "bg-sky-400",
  review: "bg-amber-400",
  done: "bg-emerald-400",
  cancelled: "bg-red-500",
};

/** Dot colour for a custom column, by tone name. */
const TONE_DOT: Record<string, string> = {
  slate: "bg-zinc-500", sky: "bg-sky-400", amber: "bg-amber-400",
  green: "bg-emerald-400", red: "bg-red-500", violet: "bg-violet-400",
  pink: "bg-pink-400", teal: "bg-teal-400",
};
const toneDot = (tone: string) => TONE_DOT[tone] ?? TONE_DOT.slate;

/** A column for work whose status no longer has one, so nothing disappears. */
const ORPHAN_COLUMN: BoardColumn = { key: "__orphan", label: "Unsorted", tone: "slate" };


const priorityColor: Record<TaskPriority, string> = {
  none: "text-[var(--txt-3)]",
  low: "text-sky-400",
  normal: "text-[var(--txt-2)]",
  high: "text-amber-400",
  urgent: "text-red-400",
};

function Board({
  spaceId, spaceName, rollup, childSpaces,
}: {
  spaceId: number;
  spaceName: string;
  rollup: boolean;
  childSpaces: WsSpace[];
}) {
  const qc = useQueryClient();
  const key = ["ws-tasks", spaceId];
  const { data: tasks } = useQuery({ queryKey: key, queryFn: () => fetchTasks(spaceId) });
  const { data: users } = useQuery({ queryKey: ["ws-users"], queryFn: fetchWsUsers });
  const [adding, setAdding] = useState<TaskStatus | null>(null);
  const [draft, setDraft] = useState("");
  const [targetSpace, setTargetSpace] = useState<number>(spaceId);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [confirmTask, setConfirmTask] = useState<WsTask | null>(null);
  const openTask = (tasks || []).find((t) => t.id === openTaskId) || null;



  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const navigate = useNavigate();


  const add = useMutation({
    mutationFn: (status: TaskStatus) =>
      createTask({ space_id: targetSpace, title: draft, status }),
    onSuccess: () => {
      setDraft("");
      setAdding(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not add task"),
  });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) => updateTask(id, { status }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      toast.success("Task deleted");
      setConfirmTask(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete task"),
  });

  const patch = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WsTask> }) => updateTask(id, data),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message || "Could not update task"),
  });

  const [subtaskParent, setSubtaskParent] = useState<WsTask | null>(null);
  const [subDraft, setSubDraft] = useState("");

  const addSub = useMutation({
    mutationFn: (parent: WsTask) =>
      createTask({
        space_id: parent.space_id,
        title: subDraft,
        status: parent.status,
        parent_id: parent.id,
      }),
    onSuccess: () => {
      setSubDraft("");
      setSubtaskParent(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not add subtask"),
  });

  const subtaskCount = (id: number) => (tasks || []).filter((t) => t.parent_id === id).length;

  const { data: colData } = useQuery({
    queryKey: ["ws-space-columns", spaceId],
    queryFn: () => fetchSpaceColumns(spaceId),
  });
  const [editingCols, setEditingCols] = useState(false);

  /* ---- filter ---- */
  const me = getUser();
  const saved = readBoardFilter(spaceId);
  const [filterUsers, setFilterUsers] = useState<number[]>(saved.users);
  const [filterOpen, setFilterOpen] = useState(false);
  const [hideDone, setHideDone] = useState(saved.hideDone);

  // Kept per space: a filter set on one space following you to an unrelated
  // board would look like missing tasks rather than a filter.
  useEffect(() => {
    writeBoardFilter(spaceId, { users: filterUsers, hideDone });
  }, [spaceId, filterUsers, hideDone]);

  // Moving to another board loads that board's own filter.
  useEffect(() => {
    const s = readBoardFilter(spaceId);
    setFilterUsers(s.users);
    setHideDone(s.hideDone);
    setFilterOpen(false);
  }, [spaceId]);

  const visibleTasks = useMemo(() => {
    let list = tasks || [];
    if (filterUsers.length) {
      // A subtask can match while its parent does not. It still shows, because
      // hiding assigned work to keep the tree tidy is the wrong trade.
      list = list.filter((t) => taskAssigneeIds(t).some((id) => filterUsers.includes(id)));
    }
    if (hideDone) list = list.filter((t) => t.status !== "done" && t.status !== "cancelled");
    return list;
  }, [tasks, filterUsers, hideDone]);

  const filterCount = filterUsers.length + (hideDone ? 1 : 0);

  /** A rollup board also shows whatever extra columns its subspaces invented,
   *  or their tasks would have nowhere to land. Hidden ones drop out here. */
  const columns = useMemo(() => {
    const base = colData ? (rollup ? colData.rollup : colData.columns) : null;
    const list = base?.length
      ? base
      : TASK_STATUSES.map((s) => ({ key: s, label: TASK_STATUS_LABELS[s], tone: s === "cancelled" ? "red" : "slate" }));
    const hidden = new Set(colData?.hidden ?? []);
    return list.filter((c) => !hidden.has(c.key));
  }, [colData, rollup]);

  const grouped = useMemo(() => {
    const g: Record<string, WsTask[]> = {};
    for (const c of columns) g[c.key] = [];
    const known = new Set(columns.map((c) => c.key));
    visibleTasks.forEach((t) => {
      // A status with no column still has to be reachable: a renamed key, or a
      // column someone hid, must not make the work vanish off the board.
      const k = known.has(t.status) ? t.status : ORPHAN_COLUMN.key;
      (g[k] ||= []).push(t);
    });
    Object.keys(g).forEach((k) => { g[k] = sortWithSubtasks(g[k]); });
    return g;
  }, [visibleTasks, columns]);

  /** Only shown when something actually landed in it. */
  const shownColumns = useMemo(
    () => (grouped[ORPHAN_COLUMN.key]?.length ? [...columns, ORPHAN_COLUMN] : columns),
    [columns, grouped],
  );


  return (
    <>
      <PaneHeader
        title={spaceName}
        subtitle={
          rollup
            ? `All tasks from ${childSpaces.length} subspaces${filterCount ? ` · ${visibleTasks.length} of ${(tasks || []).length} shown` : ""}`
            : filterCount
              ? `${visibleTasks.length} of ${(tasks || []).length} shown`
              : undefined
        }
        right={
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
            <button
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                filterCount
                  ? "border-[var(--txt-3)] bg-[var(--tint-strong)] text-[var(--txt-1)]"
                  : "border-[var(--line)] text-[var(--txt-3)] hover:text-[var(--txt-1)]"
              }`}
            >
              <ListTree className="h-3.5 w-3.5" strokeWidth={1.8} />
              Filter
              {filterCount > 0 && <span data-num className="text-[10px]">{filterCount}</span>}
            </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              collisionPadding={12}
              aria-label="Filter tasks"
              className="overlay-1 z-50 max-h-[var(--radix-popover-content-available-height)] w-60 max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border border-[var(--line)] p-2 shadow-[var(--lift-2)]"
            >
                  <p className="px-1.5 pb-1.5 text-[9px] uppercase text-[var(--txt-3)]" style={labelStyle}>
                    Assignee
                  </p>
                  {me && (
                    <button
                      onClick={() => setFilterUsers((f) => (f.length === 1 && f[0] === me.id ? [] : [me.id]))}
                      className="mb-1 w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-[var(--txt-2)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
                    >
                      Only mine
                    </button>
                  )}
                  {(users || []).map((u) => {
                    const on = filterUsers.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() =>
                          setFilterUsers((f) => (on ? f.filter((x) => x !== u.id) : [...f, u.id]))
                        }
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition hover:bg-[var(--tint)] ${
                          on ? "text-[var(--txt-1)]" : "text-[var(--txt-3)]"
                        }`}
                      >
                        <Avatar size={18} src={u.avatar_url} name={u.name} email={u.email} />
                        <span className="min-w-0 flex-1 truncate">{u.name || u.email}</span>
                        {on && <Check className="h-3 w-3 shrink-0" strokeWidth={3} />}
                      </button>
                    );
                  })}
                  <div className="mt-1 border-t border-[var(--line)] pt-1">
                    <button
                      onClick={() => setHideDone((v) => !v)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition hover:bg-[var(--tint)] ${
                        hideDone ? "text-[var(--txt-1)]" : "text-[var(--txt-3)]"
                      }`}
                    >
                      <span className="min-w-0 flex-1">Hide complete and cancelled</span>
                      {hideDone && <Check className="h-3 w-3 shrink-0" strokeWidth={3} />}
                    </button>
                    {filterCount > 0 && (
                      <button
                        onClick={() => { setFilterUsers([]); setHideDone(false); }}
                        className="w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-[var(--txt-3)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
            </PopoverContent>
          </Popover>
        }
      />
      <div className="workspace-board flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
        {shownColumns.map((col) => {
          const status = col.key as TaskStatus;
          const isRed = col.tone === "red";
          const isOrphan = col.key === ORPHAN_COLUMN.key;
          return (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = Number(e.dataTransfer.getData("text/plain"));
              // Nothing can be dragged into Unsorted: it is a symptom, not a
              // place to put work.
              if (id && !isOrphan) move.mutate({ id, status });
            }}
            className={`panel-2 flex w-[286px] shrink-0 flex-col overflow-hidden rounded-xl ${
              isRed ? "border border-red-500/40 bg-red-500/[0.04]" : ""
            } ${isOrphan ? "border border-dashed border-[var(--line-strong)]" : ""}`}
          >
            <div className={`flex items-center justify-between border-b px-3.5 py-2.5 ${
              isRed ? "border-red-500/40" : "border-[var(--line)]"
            }`}>
              <span className={`font-brand flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] ${
                isRed ? "text-red-400" : "text-[var(--txt-1)]"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${toneDot(col.tone)}`} />
                {col.label}
              </span>
              <span
                data-num
                className="rounded bg-[var(--tint)] px-1.5 py-0.5 text-[10px] text-[var(--txt-3)]"
              >
                {grouped[col.key]?.length ?? 0}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-auto p-2">
              {(grouped[col.key] || []).map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(t.id))}
                  onClick={() => setOpenTaskId(t.id)}
                  className={`workspace-task-card card-1 hover:card-1-hover group cursor-pointer rounded-lg px-3 py-2.5 transition duration-150 hover:-translate-y-px ${
                    t.parent_id ? "ml-3 border-l-2 border-l-white/25" : ""
                  } ${isRed ? "border-l-2 border-l-red-500/70 opacity-80" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {/* Reference above, name below: the number and its project
                        are what you scan a column for, and keeping them on their
                        own line stops a long title pushing them out of sight. */}
                    <div className="min-w-0 flex-1">
                      {(() => {
                        const no = taskNumber(t, projectNoFor(t, tasks || []));
                        if (!no && !t.parent_title) return null;
                        return (
                          <p className="flex items-center gap-1.5 text-[11px] leading-tight text-[var(--txt-3)]">
                            {t.parent_id && (
                              <CornerDownRight className="h-3 w-3 shrink-0" strokeWidth={1.8} />
                            )}
                            {no && <span data-num className="shrink-0">{no}</span>}
                            {t.parent_title && <span className="truncate">{t.parent_title}</span>}
                          </p>
                        );
                      })()}
                      <p className="text-[13px] font-medium leading-snug text-[var(--txt-1)]">
                        {t.title}
                      </p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-1.5 group-hover:flex">
                      {!t.parent_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubDraft("");
                            setSubtaskParent(t);
                          }}
                          className="text-[var(--txt-3)] hover:text-[var(--txt-1)]"
                          title="Add subtask"
                        >
                          <ListTree className="h-3.5 w-3.5" strokeWidth={1.6} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmTask(t);
                        }}
                        className="text-[var(--txt-3)] hover:text-red-400"
                        title="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                    {rollup && t.space_name && <span className="chip">{t.space_name}</span>}

                    <InlinePicker
                      title="Set priority"
                      trigger={
                        <span className={`chip capitalize ${priorityColor[t.priority]}`}>
                          <Flag className="h-3 w-3" strokeWidth={1.8} />
                          {t.priority}
                        </span>
                      }
                      options={TASK_PRIORITIES.map((p) => ({
                        key: p,
                        label: p,
                        selected: t.priority === p,
                        className: priorityColor[p],
                        onSelect: () => patch.mutate({ id: t.id, data: { priority: p } }),
                      }))}
                    />

                    {(t.start_date || t.end_date) && (
                      <span
                        data-num
                        className="flex items-center gap-1 whitespace-nowrap text-[10.5px] text-[var(--txt-3)]"
                        title={`${t.start_date || "—"} → ${t.end_date || "—"}`}
                      >
                        <CalendarDays className="h-3 w-3 shrink-0" strokeWidth={1.6} />
                        {shortDate(t.start_date)}–{shortDate(t.end_date)}
                      </span>
                    )}

                    {!!subtaskCount(t.id) && (
                      <span
                        data-num
                        className="flex items-center gap-1 text-[10.5px] text-[var(--txt-3)]"
                        title="Subtasks"
                      >
                        <ListTree className="h-3 w-3" strokeWidth={1.6} />
                        {subtaskCount(t.id)}
                      </span>
                    )}

                    {!!t.comment_count && (
                      <span
                        data-num
                        className="flex items-center gap-1 text-[10.5px] text-[var(--txt-3)]"
                        title="Task chat"
                      >
                        <MessageSquare className="h-3 w-3" strokeWidth={1.6} />
                        {t.comment_count}
                      </span>
                    )}

                    <div className="ml-auto">
                      <BubblePopover
                        align="right"
                        title="Assignees"
                        users={users || []}
                        selected={taskAssigneeIds(t)}
                        onToggle={(id) => {
                          const ids = taskAssigneeIds(t);
                          const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
                          patch.mutate({
                            id: t.id,
                            data: { assignee_ids: next, assignee_id: next[0] ?? null },
                          });
                        }}
                        trigger={
                          taskAssigneeNames(t).length ? (
                            <span className="flex items-center -space-x-1">
                              {taskAssigneeNames(t).slice(0, 3).map((n, i) => (
                                <span
                                  key={i}
                                  title={n}
                                  className="flex h-5 w-5 items-center justify-center rounded-full border border-[#0d0d0d] bg-[var(--s-3)] text-[8px] text-[var(--txt-2)]"
                                >
                                  {initials(n)}
                                </span>
                              ))}
                              {taskAssigneeNames(t).length > 3 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#0d0d0d] bg-[var(--s-4)] text-[8px] text-[var(--txt-1)]">
                                  +{taskAssigneeNames(t).length - 3}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-[var(--line)] text-[var(--txt-3)]">
                              <UserCircle2 className="h-3 w-3" strokeWidth={1.6} />
                            </span>
                          )
                        }
                      />
                    </div>
                  </div>


                  {subtaskParent?.id === t.id && (
                    <form
                      onClick={(e) => e.stopPropagation()}
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (subDraft.trim()) addSub.mutate(t);
                      }}
                      className="mt-2 space-y-2 border-t border-[var(--line)] pt-2"
                    >
                      <input
                        autoFocus
                        value={subDraft}
                        onChange={(e) => setSubDraft(e.target.value)}
                        placeholder="Subtask name"
                        className={inputCls}
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-[var(--txt-1)] py-1.5 text-[10px] font-bold uppercase text-[var(--s-1)]" style={labelStyle}>
                          Add subtask
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubtaskParent(null)}
                          className="border border-[var(--line)] px-3 text-[10px] uppercase text-[var(--txt-3)]"
                          style={labelStyle}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ))}




              {adding === status ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draft.trim()) add.mutate(status);
                  }}
                  className="space-y-2"
                >
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Task name"
                    className={inputCls}
                  />
                  {rollup && (
                    <select
                      value={targetSpace}
                      onChange={(e) => setTargetSpace(Number(e.target.value))}
                      className={inputCls}
                    >
                      <option value={spaceId}>{spaceName}</option>
                      {childSpaces.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-[var(--txt-1)] py-1.5 text-[10px] font-bold uppercase text-[var(--s-1)]" style={labelStyle}>
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdding(null)}
                      className="border border-[var(--line)] px-3 text-[10px] uppercase text-[var(--txt-3)]"
                      style={labelStyle}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : isOrphan ? (
                <p className="px-2 py-2 text-[10.5px] leading-relaxed text-[var(--txt-3)]">
                  These carry a status with no column here. Drag them somewhere,
                  or add the column back.
                </p>
              ) : (
                <button
                  onClick={() => {
                    setTargetSpace(spaceId);
                    setAdding(status);
                  }}
                  className="flex w-full items-center gap-1.5 rounded-xl px-2 py-2 text-[11px] text-[var(--txt-3)] transition hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.8} /> Add task
                </button>
              )}
            </div>
          </div>
          );
        })}

        <button
          onClick={() => setEditingCols(true)}
          title="Add, rename or hide columns"
          className="flex w-[160px] shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line)] text-[11px] uppercase text-[var(--txt-3)] transition hover:border-[var(--line-strong)] hover:text-[var(--txt-1)]"
          style={labelStyle}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} /> Columns
        </button>
      </div>

      {editingCols && colData && (
        <ColumnsModal
          spaceId={spaceId}
          spaceName={spaceName}
          data={colData}
          onClose={() => setEditingCols(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["ws-space-columns"] });
            invalidate();
          }}
        />
      )}
      {openTask && (
        <TaskDetail
          key={openTask.id}
          task={openTask}
          users={users || []}
          spaces={[{ id: spaceId, name: spaceName }, ...childSpaces.map((c) => ({ id: c.id, name: c.name }))]}
          subtasks={(tasks || []).filter((t) => t.parent_id === openTask.id)}
          onOpenTask={(id) => setOpenTaskId(id)}
          onClose={() => setOpenTaskId(null)}
          onSaved={invalidate}
          onDeleted={() => {
            setOpenTaskId(null);
            invalidate();
          }}
        />
      )}

      {confirmTask && (
        <ConfirmDelete
          taskTitle={confirmTask.title}
          subtaskCount={subtaskCount(confirmTask.id)}
          pending={remove.isPending}
          onCancel={() => setConfirmTask(null)}
          onConfirm={() => remove.mutate(confirmTask.id)}
        />
      )}

    </>
  );
}

/* ================= Inline picker ================= */

function InlinePicker({
  trigger, options, title, align = "left",
}: {
  trigger: React.ReactNode;
  title: string;
  align?: "left" | "right";
  options: {
    key: string;
    label: string;
    selected?: boolean;
    className?: string;
    keepOpen?: boolean;
    onSelect: () => void;
  }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title={title}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center rounded-[3px] px-1 py-0.5 transition hover:bg-[var(--tint-strong)]"
      >
        {trigger}
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-40 block" onClick={() => setOpen(false)} />
          <span
            className={`absolute z-50 mt-1 block max-h-56 w-44 overflow-auto border border-[var(--line)] bg-[var(--s-2)] py-1 shadow-xl backdrop-blur-md ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            <span className="block px-3 pb-1 pt-0.5 text-[9px] uppercase text-[var(--txt-3)]" style={labelStyle}>
              {title}
            </span>
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  o.onSelect();
                  if (!o.keepOpen) setOpen(false);
                }}
                className={`block w-full truncate px-3 py-1.5 text-left text-[12px] transition hover:bg-[var(--tint-strong)] ${
                  o.className || "text-[var(--txt-2)]"
                } ${o.selected ? "bg-[var(--tint-strong)]" : ""}`}
              >
                {o.selected ? "• " : ""}
                {o.label}
              </button>
            ))}
          </span>
        </>
      )}

    </span>
  );
}

/* ================= Delete confirmation ================= */

function ConfirmDelete({
  taskTitle, subtaskCount = 0, pending, onCancel, onConfirm,
}: {
  taskTitle: string;
  subtaskCount?: number;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--s-2)] shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400" strokeWidth={1.8} />
          <span className="text-[10px] uppercase text-[var(--txt-2)]" style={labelStyle}>
            Delete task
          </span>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm text-[var(--txt-1)]">Are you sure you want to delete this task?</p>
          <p className="mt-2 truncate text-[12px] text-[var(--txt-3)]">“{taskTitle}”</p>
          {subtaskCount > 0 && (
            <p className="mt-3 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              This task has {subtaskCount} subtask{subtaskCount === 1 ? "" : "s"} — they will be deleted too.
            </p>
          )}
          <p className="mt-3 text-[11px] text-[var(--txt-3)]">
            This permanently removes the task, its chat and all data stored on it. This cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] px-5 py-3">
          <button
            onClick={onCancel}
            className="border border-[var(--line)] px-4 py-2.5 text-[10px] uppercase text-[var(--txt-2)] transition hover:border-[var(--line-strong)] hover:text-[var(--txt-1)]"
            style={labelStyle}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="bg-red-500 px-5 py-2.5 text-[10px] font-bold uppercase text-white transition hover:bg-red-400 disabled:opacity-50"
            style={labelStyle}
          >
            {pending ? "Deleting…" : "Delete task"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= Task detail (ClickUp-style) ================= */


function TaskDetail({
  task, users, spaces, subtasks = [], onOpenTask, onClose, onSaved, onDeleted,
}: {
  task: WsTask;
  users: WsUser[];
  spaces: { id: number; name: string }[];
  subtasks?: WsTask[];
  onOpenTask?: (id: number) => void;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const me = getUser();
  const myHandle = me ? mentionHandle(me) : "";
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [assignees, setAssignees] = useState<number[]>(taskAssigneeIds(task));
  
  const [start, setStart] = useState(task.start_date ? task.start_date.slice(0, 10) : "");
  const [end, setEnd] = useState(task.end_date ? task.end_date.slice(0, 10) : "");

  const [spaceId, setSpaceId] = useState<number>(task.space_id);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const firstSave = useRef(true);

  const toggleAssignee = (id: number) =>
    setAssignees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = useMutation({
    mutationFn: () => updateTask(task.id, {
      title: title.trim() || task.title,
      description: description || null,
      status,
      priority,
      assignee_ids: assignees,
      assignee_id: assignees[0] ?? null,
      due_date: null,
      start_date: start || null,
      end_date: end || null,
      space_id: spaceId,
    }),
    onMutate: () => setSaveState("saving"),
    onSuccess: () => { setSaveState("saved"); onSaved(); },
    onError: () => setSaveState("error"),
  });

  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    const timer = window.setTimeout(() => save.mutate(), 550);
    return () => window.clearTimeout(timer);
  }, [title, description, status, priority, assignees, start, end, spaceId]);

  const [confirming, setConfirming] = useState(false);

  const remove = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: () => {
      toast.success("Task deleted");
      setConfirming(false);
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete task"),
  });

  /* ---- subtasks ---- */
  const [subDraft, setSubDraft] = useState("");
  const addSub = useMutation({
    mutationFn: () =>
      createTask({ space_id: task.space_id, title: subDraft, status: "todo", parent_id: task.id }),
    onSuccess: () => {
      setSubDraft("");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Could not add subtask"),
  });

  /* ---- document numbers ---- */
  const { data: numbering } = useQuery({ queryKey: ["ws-numbering"], queryFn: fetchNumbering });
  const projectNo = task.project_no || task.root_project_no || null;
  const docs =
    projectNo && task.item_no !== null && task.item_no !== undefined && numbering
      ? Object.entries(numbering.categories)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([digit, label]) => ({
            digit,
            label,
            number: documentNumber(projectNo, task.item_no!, digit),
          }))
      : [];

  /* ---- internal chat ---- */
  const qc = useQueryClient();
  const chatKey = ["ws-task-comments", task.id];
  const { data: comments } = useQuery({ queryKey: chatKey, queryFn: () => fetchTaskComments(task.id) });
  const chatEnd = useRef<HTMLDivElement>(null);
  const [chatReplyTo, setChatReplyTo] = useState<WsTaskComment | null>(null);
  const sendChat = useMutation({
    mutationFn: (value: string) => createTaskComment(task.id, value, chatReplyTo?.id),
    onSuccess: () => {
      setChatReplyTo(null);
      qc.invalidateQueries({ queryKey: chatKey });
      qc.invalidateQueries({ queryKey: ["ws-activity"] });
      onSaved();
      setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "smooth" }), 60);
    },
    onError: (e: Error) => toast.error(e.message || "Could not send message"),
  });


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      {confirming && (
        <ConfirmDelete
          taskTitle={task.title}
          subtaskCount={subtasks.length}

          pending={remove.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() => remove.mutate()}
        />
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[94vh] w-[96vw] max-w-[1400px] flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--s-2)] shadow-2xl backdrop-blur-xl"
      >

        <header className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <span className="text-[10px] uppercase text-[var(--txt-3)]" style={labelStyle}>
            {task.project_no ? (
              <span data-num className="text-[var(--txt-1)]">{task.project_no}</span>
            ) : (
              <>Task #{task.id}</>
            )}
          </span>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] uppercase ${saveState === "error" ? "text-red-400" : "text-[var(--txt-3)]"}`} style={labelStyle}>
              {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved"}
            </span>
            <TaskTimeControl taskId={task.id} />
            <button
              onClick={() => setConfirming(true)}

              className="text-[var(--txt-3)] transition hover:text-red-400"
              title="Delete task"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.6} />
            </button>
            <button onClick={onClose} className="text-[var(--txt-3)] hover:text-[var(--txt-1)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-xl text-[var(--txt-1)] outline-none"
            placeholder="Task name"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} style={labelStyle}>Status</label>
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Priority</label>
              <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} style={labelStyle}>
                Assignees {assignees.length ? `(${assignees.length})` : ""}
              </label>
              <div className="border border-[var(--line)] bg-[var(--input)] p-2">
                <AssigneeBubbles users={users} selected={assignees} onToggle={toggleAssignee} />
              </div>
            </div>

            <div>
              <label className={labelCls} style={labelStyle}>Start date</label>
              <input
                type="date"
                className={inputCls}
                value={start}
                max={end || undefined}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Finish date</label>
              <input
                type="date"
                className={inputCls}
                value={end}
                min={start || undefined}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            {(start || end) && (
              <div className="sm:col-span-2 flex items-center gap-2 border border-[var(--line)] bg-[var(--s-2)] px-3 py-2 text-[11px] text-[var(--txt-2)]">
                <CalendarDays className="h-3.5 w-3.5 text-[var(--txt-3)]" strokeWidth={1.6} />
                {start ? new Date(start).toLocaleDateString() : "—"} → {end ? new Date(end).toLocaleDateString() : "—"}
                <span className="ml-auto text-[var(--txt-3)]">shows in Planner</span>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className={labelCls} style={labelStyle}>Space</label>
              {/* A project moves with all its subtasks; a subtask always sits
                  in its project's space, so it cannot be moved on its own. */}
              <select
                className={`${inputCls} disabled:opacity-60`}
                value={spaceId}
                disabled={!!task.parent_id}
                title={task.parent_id ? "Follows its project. Move the project to move this." : undefined}
                onChange={(e) => setSpaceId(Number(e.target.value))}
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {task.parent_id ? (
                <p className="mt-1 text-[11px] text-[var(--txt-3)]">Follows its project.</p>
              ) : null}
            </div>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Description</label>
            <textarea
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description…"
              className={`${inputCls} resize-y`}
            />
          </div>

          {/* Document numbers. Only components get these: the leading digit is
              the document type, so one component yields one number per type. */}
          {docs.length > 0 && (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--tint)]">
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
                <ListTree className="h-3.5 w-3.5 text-[var(--txt-3)]" strokeWidth={1.8} />
                <span className="text-[10px] uppercase text-[var(--txt-3)]" style={labelStyle}>
                  Document numbers
                </span>
                <span data-num className="ml-auto text-[10px] text-[var(--txt-3)]">
                  item {String(task.item_no).padStart(2, "0")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 p-3">
                {docs.map((d) => (
                  <button
                    key={d.digit}
                    type="button"
                    title={`Copy ${d.number}`}
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(d.number)
                        .then(() => toast.success(`Copied ${d.number}`))
                        .catch(() => toast.error("Could not copy"));
                    }}
                    className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-left transition hover:border-[var(--line-strong)]"
                  >
                    <span data-num className="block text-[12px] text-[var(--txt-1)]">{d.number}</span>
                    <span className="block text-[10px] text-[var(--txt-3)]">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subtasks */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--tint)]">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
              <ListTree className="h-3.5 w-3.5 text-[var(--txt-3)]" strokeWidth={1.8} />
              <span className="text-[10px] uppercase text-[var(--txt-2)]" style={labelStyle}>
                Subtasks {subtasks.length ? `(${subtasks.length})` : ""}
              </span>
            </div>
            <div className="px-4 py-3">
              {subtasks.length === 0 && (
                <p className="text-[11px] text-[var(--txt-3)]">No subtasks yet. They appear as their own tasks in the board and Planner.</p>
              )}
              {subtasks.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenTask?.(s.id)}
                  className="flex w-full items-center gap-2 border-b border-[var(--line)]/60 py-2 text-left text-[12px] text-[var(--txt-2)] transition last:border-0 hover:text-[var(--txt-1)]"
                >
                  <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-[var(--txt-3)]" strokeWidth={1.8} />
                  <span className="truncate">{s.title}</span>
                  <span className="ml-auto shrink-0 text-[9px] uppercase text-[var(--txt-3)]" style={labelStyle}>
                    {TASK_STATUS_LABELS[s.status]}
                  </span>
                </button>
              ))}
              <div className="mt-3 flex gap-2">
                <input
                  value={subDraft}
                  onChange={(e) => setSubDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && subDraft.trim()) addSub.mutate();
                  }}
                  placeholder="New subtask…"
                  className={inputCls}
                />
                <button
                  onClick={() => subDraft.trim() && addSub.mutate()}
                  disabled={addSub.isPending || !subDraft.trim()}
                  className="shrink-0 border border-[var(--line)] px-3 text-[10px] uppercase text-[var(--txt-2)] transition hover:border-white/50 hover:text-[var(--txt-1)] disabled:opacity-40"
                  style={labelStyle}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Internal chat */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--tint)]">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
              <MessageSquare className="h-3.5 w-3.5 text-[var(--txt-3)]" strokeWidth={1.8} />
              <span className="text-[10px] uppercase text-[var(--txt-2)]" style={labelStyle}>
                Internal chat
              </span>
            </div>
            {/* Scales with the window rather than sitting at a fixed 224px: the
                dialog is already 94vh tall, and quoted replies eat height that
                the old cap did not allow for. */}
            <div className="max-h-[48vh] min-h-[16rem] space-y-3 overflow-auto px-4 py-3">
              {(comments || []).length === 0 && (
                <p className="text-[11px] text-[var(--txt-3)]">No messages yet — start the conversation.</p>
              )}
              {(comments || []).map((c) => {
                const mine = me?.id === c.user_id;
                return (
                  <div key={c.id} className={`group flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    <Avatar
                      size={24}
                      className="mt-0.5"
                      src={users?.find((u) => u.id === c.user_id)?.avatar_url}
                      name={c.user_name}
                      email={c.user_email}
                    />
                    <div className={`max-w-[80%] rounded-2xl border border-[var(--line)] px-3 py-2 ${mine ? "bg-[var(--tint-strong)]" : "bg-[var(--input)]"}`}>
                      <p className="text-[9px] uppercase text-[var(--txt-3)]" style={labelStyle}>
                        {mine ? "You" : c.user_name || c.user_email}
                        {" · "}
                        {new Date(c.created_at).toLocaleString()}
                      </p>
                      {c.reply_to && c.reply_body && (
                        <QuotedLine who={c.reply_user_name} body={c.reply_body} />
                      )}
                      <MessageText body={c.body} myHandle={myHandle} />
                    </div>
                    <button
                      onClick={() => setChatReplyTo(c)}
                      title="Reply"
                      className="mt-1 self-start rounded-full p-1 text-[var(--txt-3)] opacity-0 transition hover:text-[var(--txt-1)] group-hover:opacity-100"
                    >
                      <MessageSquareReply className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>
                  </div>
                );
              })}
              <div ref={chatEnd} />
            </div>
            <div className="border-t border-white/5 px-4 py-3">
              {chatReplyTo && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-[var(--txt-3)] bg-[var(--tint)] px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-[var(--txt-3)]">
                      Replying to {chatReplyTo.user_id === me?.id ? "yourself" : chatReplyTo.user_name || chatReplyTo.user_email}
                    </p>
                    <p className="truncate text-[11px] text-[var(--txt-2)]">{chatReplyTo.body}</p>
                  </div>
                  <button
                    onClick={() => setChatReplyTo(null)}
                    title="Cancel reply"
                    className="shrink-0 rounded-full p-1 text-[var(--txt-3)] transition hover:text-[var(--txt-1)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <ChatComposer
                compact
                users={users}
                placeholder={chatReplyTo ? "Write a reply…" : "Write a message… use @ to mention"}
                pending={sendChat.isPending}
                onSend={(value) => sendChat.mutate(value)}
              />
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}
