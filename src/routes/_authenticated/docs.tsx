import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Eye,
  FileText,
  Receipt,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { DocText } from "@/components/workspace/DocText";
import { toMs } from "@/lib/unread";
import {
  createDoc,
  deleteDoc,
  fetchDoc,
  fetchDocs,
  fetchSpaces,
  updateDoc,
  type WsDoc,
  type WsSpace,
} from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/docs")({
  head: () => ({
    meta: [
      { title: "Docs — IITEG Workspace" },
      { name: "description", content: "Internal iiteg documents and notes." },
      { property: "og:title", content: "Docs — IITEG Workspace" },
      { property: "og:description", content: "Internal iiteg documents and notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocsPage,
});

const inputCls =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--txt-1)] placeholder-[var(--txt-3)] outline-none transition focus:border-[var(--line-strong)]";
const labelCls = "mb-1 block text-[10px] uppercase text-[var(--txt-3)]";
const labelStyle = { letterSpacing: "0.2em" } as const;

/** Docs with no space are company-wide; they group under this pseudo-space. */
const GENERAL = 0;

/** Excerpts come back as raw Markdown — strip the syntax so the list reads as prose. */
const plainExcerpt = (v?: string | null) =>
  (v || "")
    .replace(/```[\s\S]*?(?:```|$)/g, " ")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const updatedLabel = (v?: string | null) => {
  const ms = toMs(v);
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(
    undefined,
    { hour: "2-digit", minute: "2-digit" },
  )}`;
};

function DocsPage() {
  const qc = useQueryClient();
  const [navOpen, setNavOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const {
    data: docs,
    isLoading,
    error,
  } = useQuery({ queryKey: ["ws-docs"], queryFn: () => fetchDocs() });
  const { data: spaces } = useQuery({ queryKey: ["ws-spaces"], queryFn: fetchSpaces });

  // Land on something readable instead of an empty pane on first paint.
  useEffect(() => {
    if (selectedId === null && docs?.length) setSelectedId(docs[0].id);
  }, [docs, selectedId]);

  const refreshList = () => qc.invalidateQueries({ queryKey: ["ws-docs"] });


  return (
    <WorkspaceShell onMenu={() => setNavOpen(true)}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
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
          <DocsList
            docs={docs}
            spaces={spaces}
            loading={isLoading}
            error={error as Error | null}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setNavOpen(false);
            }}
            onNew={() => setCreating(true)}
            onClose={() => setNavOpen(false)}
          />
        </div>

        <main className="flex min-w-0 flex-1 flex-col bg-transparent">
          {selectedId === null ? (
            <EmptyPane hasDocs={!!docs?.length} onNew={() => setCreating(true)} />
          ) : (
            <DocPane
              key={selectedId}
              id={selectedId}
              spaces={spaces || []}
              onChanged={refreshList}
              onDeleted={() => {
                setSelectedId(null);
                refreshList();
              }}
            />
          )}
        </main>
        </div>
      </div>

      {creating && (
        <NewDocModal
          spaces={spaces || []}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setSelectedId(id);
            refreshList();
          }}
        />
      )}
    </WorkspaceShell>
  );
}

/* ================= Sidebar list ================= */

function DocsList({
  docs,
  spaces,
  loading,
  error,
  selectedId,
  onSelect,
  onNew,
  onClose,
}: {
  docs?: WsDoc[];
  spaces?: WsSpace[];
  loading: boolean;
  error: Error | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onClose?: () => void;
}) {
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (d: WsDoc) =>
      !q ||
      d.title.toLowerCase().includes(q) ||
      plainExcerpt(d.excerpt).toLowerCase().includes(q);

    const bySpace = new Map<number, WsDoc[]>();
    (docs || []).filter(matches).forEach((d) => {
      const key = d.space_id ?? GENERAL;
      const list = bySpace.get(key);
      if (list) list.push(d);
      else bySpace.set(key, [d]);
    });

    // General first, then spaces in the same order the workspace sidebar uses.
    const ordered: { id: number; name: string; docs: WsDoc[] }[] = [];
    const general = bySpace.get(GENERAL);
    if (general) ordered.push({ id: GENERAL, name: "General", docs: general });
    (spaces || []).forEach((s) => {
      const list = bySpace.get(s.id);
      if (list) ordered.push({ id: s.id, name: s.name, docs: list });
    });
    // A doc whose space was deleted still deserves a home.
    bySpace.forEach((list, id) => {
      if (id !== GENERAL && !ordered.some((g) => g.id === id)) {
        ordered.push({ id, name: list[0].space_name || "Unknown space", docs: list });
      }
    });
    return ordered;
  }, [docs, spaces, search]);

  const total = groups.reduce((n, g) => n + g.docs.length, 0);

  return (
    <aside className="flex h-full w-full shrink-0 flex-col overflow-hidden border-r border-[var(--line)] bg-[var(--s-2)] backdrop-blur-xl md:w-[268px] md:bg-[var(--tint)]">
      {onClose && (
        <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2 md:hidden">
          <span className="text-[9px] uppercase text-[var(--txt-3)]" style={{ letterSpacing: "0.25em" }}>
            Docs
          </span>
          <button onClick={onClose} className="text-[var(--txt-3)] hover:text-[var(--txt-1)]">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="shrink-0 space-y-2 px-3 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--input)] px-2.5 py-2 transition focus-within:border-[var(--line-strong)]">
          <Search className="h-[13px] w-[13px] shrink-0 text-[var(--txt-3)]" strokeWidth={1.8} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search docs"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--txt-1)] placeholder-[var(--txt-3)] outline-none"
          />
        </div>
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] py-2 text-[10px] uppercase text-[var(--txt-2)] transition hover:border-[var(--line-strong)] hover:text-[var(--txt-1)]"
          style={labelStyle}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
          New doc
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {loading && <p className="px-4 py-3 text-[12px] text-[var(--txt-3)]">Loading…</p>}
        {error && (
          <p className="mx-3 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
            {error.message || "Could not load docs"}
          </p>
        )}
        {!loading && !error && total === 0 && (
          <p className="px-4 py-3 text-[12px] text-[var(--txt-3)]">
            {search ? "Nothing matches that search." : "No docs yet."}
          </p>
        )}

        {groups.map((g) => (
          <div key={g.id} className="border-t border-[var(--line)] px-2 py-3 first:border-t-0">
            <span
              className="block px-2 pb-1.5 text-[9px] uppercase text-[var(--txt-3)]"
              style={{ letterSpacing: "0.25em" }}
            >
              {g.name}
            </span>
            <div className="space-y-0.5">
              {g.docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => onSelect(d.id)}
                  className={`flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition ${
                    selectedId === d.id
                      ? "bg-[var(--tint)] text-[var(--txt-1)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                      : "text-[var(--txt-2)] hover:bg-[var(--tint)] hover:text-[var(--txt-1)]"
                  }`}
                >
                  <span className="mt-0.5 shrink-0 text-[var(--txt-3)]">
                    {d.is_pinned ? (
                      <Pin className="h-[13px] w-[13px]" strokeWidth={1.6} />
                    ) : (
                      <FileText className="h-[13px] w-[13px]" strokeWidth={1.6} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{d.title}</span>
                    {plainExcerpt(d.excerpt) && (
                      <span className="mt-0.5 block truncate text-[11px] text-[var(--txt-3)]">
                        {plainExcerpt(d.excerpt)}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ================= Empty state ================= */

function EmptyPane({ hasDocs, onNew }: { hasDocs: boolean; onNew: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <FileText className="h-7 w-7 text-[var(--txt-3)]" strokeWidth={1.4} />
      <h1 className="wordmark mt-4 text-2xl text-[var(--txt-1)]">Docs</h1>
      <p className="mt-3 max-w-sm text-xs leading-relaxed text-[var(--txt-3)]">
        {hasDocs
          ? "Pick a document from the list to read or edit it."
          : "Shared documents and notes, filed under the space they belong to."}
      </p>
      <button
        onClick={onNew}
        className="mt-6 bg-[var(--txt-1)] px-5 py-2.5 text-[10px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90"
        style={labelStyle}
      >
        New doc
      </button>
    </div>
  );
}

/* ================= Reader / editor ================= */

function DocPane({
  id,
  spaces,
  onChanged,
  onDeleted,
}: {
  id: number;
  spaces: WsSpace[];
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const {
    data: doc,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ws-doc", id],
    queryFn: () => fetchDoc(id),
  });

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Re-seed the draft whenever the saved document changes underneath it.
  useEffect(() => {
    if (!doc) return;
    setTitle(doc.title);
    setBody(doc.body || "");
  }, [doc]);

  const dirty = !!doc && (title !== doc.title || body !== (doc.body || ""));

  const save = useMutation({
    mutationFn: () => updateDoc(id, { title: title.trim(), body }),
    onSuccess: () => {
      toast.success("Doc saved");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["ws-doc", id] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save doc"),
  });

  const pin = useMutation({
    mutationFn: () => updateDoc(id, { is_pinned: doc?.is_pinned ? 0 : 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ws-doc", id] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message || "Could not update doc"),
  });

  const moveSpace = useMutation({
    mutationFn: (spaceId: number | null) => updateDoc(id, { space_id: spaceId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ws-doc", id] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message || "Could not move doc"),
  });

  const remove = useMutation({
    mutationFn: () => deleteDoc(id),
    onSuccess: () => {
      toast.success("Doc deleted");
      setConfirming(false);
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete doc"),
  });

  const canSave = dirty && title.trim() !== "" && !save.isPending;

  // Ctrl/Cmd+S is what anyone typing into a document reaches for.
  const saveMutate = save.mutate;
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canSave) saveMutate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, canSave, saveMutate]);

  if (isLoading) {
    return <p className="px-5 py-4 text-[12px] text-[var(--txt-3)]">Loading…</p>;
  }
  if (error || !doc) {
    return (
      <p className="m-5 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
        {(error as Error)?.message || "Could not load this doc"}
      </p>
    );
  }

  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-md text-[var(--txt-3)] transition hover:bg-[var(--tint-strong)] hover:text-[var(--txt-1)]";

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--line)] px-5">
        {/* The title keeps its width; the meta line is what gives way when space runs out. */}
        <h1 className="max-w-[45%] shrink-0 truncate text-sm text-[var(--txt-1)]">{doc.title}</h1>
        <span className="hidden min-w-0 flex-1 truncate text-[11px] text-[var(--txt-3)] sm:block">
          {doc.space_name || "General"} · updated {updatedLabel(doc.updated_at)}
          {doc.updated_by_name ? ` by ${doc.updated_by_name}` : ""}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {editing && (
            <button
              onClick={() => save.mutate()}
              disabled={!canSave}
              className="mr-1 bg-[var(--txt-1)] px-3 py-1.5 text-[10px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-40"
              style={labelStyle}
            >
              {save.isPending ? "Saving…" : dirty ? "Save" : "Saved"}
            </button>
          )}
          <button
            onClick={() => pin.mutate()}
            title={doc.is_pinned ? "Unpin" : "Pin to top"}
            className={iconBtn}
          >
            {doc.is_pinned ? (
              <PinOff className="h-4 w-4" strokeWidth={1.6} />
            ) : (
              <Pin className="h-4 w-4" strokeWidth={1.6} />
            )}
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            title={editing ? "Preview" : "Edit"}
            className={iconBtn}
          >
            {editing ? (
              <Eye className="h-4 w-4" strokeWidth={1.6} />
            ) : (
              <Pencil className="h-4 w-4" strokeWidth={1.6} />
            )}
          </button>
          <button onClick={() => setConfirming(true)} title="Delete doc" className={iconBtn}>
            <Trash2 className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-6">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className={labelCls} style={labelStyle}>
                  Title
                </label>
                <input
                  className={inputCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>
                  Space
                </label>
                <select
                  className={inputCls}
                  value={doc.space_id ?? ""}
                  onChange={(e) => moveSpace.mutate(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">General (no space)</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>
                  Body — Markdown
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  spellCheck
                  placeholder={"# Heading\n\nNotes go here.\n\n- point one\n- point two"}
                  className={`${inputCls} min-h-[55vh] resize-y font-mono text-[13px] leading-relaxed`}
                />
                <p className="mt-1.5 text-[11px] text-[var(--txt-3)]">
                  Headings, lists, quotes, links, `code` and fenced blocks render in preview. Ctrl+S
                  saves.
                </p>
              </div>
            </div>
          ) : doc.body?.trim() ? (
            <DocText body={doc.body} />
          ) : (
            <p className="text-[13px] text-[var(--txt-3)]">
              This doc is empty. Hit the pencil to start writing.
            </p>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmDeleteDoc
          title={doc.title}
          pending={remove.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() => remove.mutate()}
        />
      )}
    </>
  );
}

/* ================= Modals ================= */

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--s-2)] shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <span className="text-[10px] uppercase text-[var(--txt-2)]" style={{ letterSpacing: "0.25em" }}>
            {title}
          </span>
          <button onClick={onClose} className="text-[var(--txt-3)] hover:text-[var(--txt-1)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function NewDocModal({
  spaces,
  onClose,
  onCreated,
}: {
  spaces: WsSpace[];
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [spaceId, setSpaceId] = useState<string>("");

  const create = useMutation({
    mutationFn: () =>
      createDoc({ title: title.trim(), space_id: spaceId ? Number(spaceId) : null, body: "" }),
    onSuccess: (r) => {
      toast.success(`${title.trim()} created`);
      onCreated(r.id);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Could not create doc"),
  });

  return (
    <Modal title="New doc" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <label className={labelCls} style={labelStyle}>
            Title
          </label>
          <input
            className={inputCls}
            required
            autoFocus
            value={title}
            placeholder="Assembly notes"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>
            Space
          </label>
          <select className={inputCls} value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
            <option value="">General (no space)</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={create.isPending || title.trim() === ""}
          className="w-full bg-[var(--txt-1)] py-2.5 text-[11px] font-bold uppercase text-[var(--s-1)] transition hover:opacity-90 disabled:opacity-50"
          style={labelStyle}
        >
          {create.isPending ? "Creating…" : "Create doc"}
        </button>
      </form>
    </Modal>
  );
}

function ConfirmDeleteDoc({
  title,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--s-2)] shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400" strokeWidth={1.8} />
          <span className="text-[10px] uppercase text-[var(--txt-2)]" style={labelStyle}>
            Delete doc
          </span>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm text-[var(--txt-1)]">Are you sure you want to delete this doc?</p>
          <p className="mt-2 truncate text-[12px] text-[var(--txt-3)]">“{title}”</p>
          <p className="mt-3 text-[11px] text-[var(--txt-3)]">
            This permanently removes the document and everything written in it. This cannot be
            undone.
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
            {pending ? "Deleting…" : "Delete doc"}
          </button>
        </div>
      </div>
    </div>
  );
}

