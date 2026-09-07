import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import {
  PageHeader,
  SectionHeading,
  StatusChip,
  DataTable,
  FilterBar,
  SearchInput,
  SelectFilter,
  Segmented,
  type Column,
} from "@/components/system";
import { toneFor, TONE_SOFT, TONE_SOLID, TONE_TEXT } from "@/components/system/StatusChip";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

import { useMyRoles } from "@/hooks/useMyRoles";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const STAGES = ["Idea", "Approved", "Scheduled", "Editing", "Posted", "Archived", "Rejected"] as const;
export type Stage = (typeof STAGES)[number];

const TYPES = [
  "Vertical short-form video",
  "Long-form video",
  "Carousel",
  "Poster",
  "Photo set",
  "Campaign",
  "Strategy",
];

export type ContentItem = {
  id: string;
  ref_no: number;
  added_by: string | null;
  added_on: string;
  client_id: string | null;
  project_id: string | null;
  title: string;
  content_type: string;
  stage: string;
  lead: string | null;
  shooter: string | null;
  editor: string | null;
  planned_at: string | null;
  link: string | null;
  notes: string | null;
  created_at: string;
};

type ClientRow = { id: string; name: string };
type ProjectRow = { id: string; title: string; client: string };

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";

export const refCode = (n: number) => `IDEA-${String(n).padStart(4, "0")}`;

/** "Belongs to" is one picker over two record types: c:<id> for a client, p:<id> for a project. */
const encodeOwner = (clientId: string | null, projectId: string | null) =>
  clientId ? `c:${clientId}` : projectId ? `p:${projectId}` : "";
const decodeOwner = (v: string) => ({
  client_id: v.startsWith("c:") ? v.slice(2) : null,
  project_id: v.startsWith("p:") ? v.slice(2) : null,
});

const emptyNew = {
  title: "",
  owner: "",
  content_type: TYPES[0],
  link: "",
  notes: "",
};

const emptyDraft = {
  title: "",
  owner: "",
  content_type: TYPES[0],
  stage: "Idea" as string,
  lead: "",
  shooter: "",
  editor: "",
  planned_at: "",
  link: "",
  notes: "",
};

export default function ContentPipeline() {
  const { canEditContent } = useMyRoles();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "list" | "archive">("board");
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("all");
  const [type, setType] = useState("all");
  const [person, setPerson] = useState("all");
  const [stage, setStage] = useState("all");
  const [open, setOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [fresh, setFresh] = useState(emptyNew);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: rows, error }, { data: cs }, { data: ps }, { data: tm }] = await Promise.all([
      supabase.from("content_items").select("*").order("planned_at", { ascending: true, nullsFirst: false }),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("projects").select("id, title, client").order("display_order"),
      supabase.from("team_members").select("user_id, display_name, email"),
    ]);
    if (error) toast.error(error.message);
    setItems((rows as ContentItem[]) ?? []);
    setClients((cs as ClientRow[]) ?? []);
    setProjects((ps as ProjectRow[]) ?? []);
    const map: Record<string, string> = {};
    (tm ?? []).forEach((m: { user_id: string; display_name: string | null; email: string }) => {
      map[m.user_id] = m.display_name?.trim() || m.email.split("@")[0];
    });
    setAuthors(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const ownerLabel = (i: Pick<ContentItem, "client_id" | "project_id">) => {
    if (i.client_id) return clients.find((c) => c.id === i.client_id)?.name ?? "Client";
    if (i.project_id) {
      const p = projects.find((x) => x.id === i.project_id);
      return p ? `${p.title} (project)` : "Project";
    }
    return "—";
  };
  const authorName = (id: string | null) => (id ? authors[id] ?? "—" : "—");

  const ownerOptions = useMemo(
    () => [
      ...clients.map((c) => ({ value: `c:${c.id}`, label: c.name })),
      ...projects.map((p) => ({ value: `p:${p.id}`, label: `${p.title} — ${p.client} (project)` })),
    ],
    [clients, projects]
  );

  const people = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      [i.lead, i.shooter, i.editor].forEach((p) => p && set.add(p));
      const a = authorName(i.added_by);
      if (a !== "—") set.add(a);
    });
    return Array.from(set).sort();
  }, [items, authors]);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const hay = `${refCode(i.ref_no)} ${i.title} ${i.notes ?? ""} ${ownerLabel(i)}`.toLowerCase();
        if (q && !hay.includes(q.toLowerCase())) return false;
        if (owner !== "all" && encodeOwner(i.client_id, i.project_id) !== owner) return false;
        if (type !== "all" && i.content_type !== type) return false;
        if (stage !== "all" && i.stage !== stage) return false;
        if (person !== "all" && ![i.lead, i.shooter, i.editor, authorName(i.added_by)].includes(person)) return false;
        return true;
      }),
    [items, q, owner, type, stage, person, clients, projects, authors]
  );

  const unclaimed = useMemo(() => filtered.filter((i) => !i.client_id && !i.project_id), [filtered]);

  const openEdit = (row: ContentItem) => {
    setEditing(row);
    setDraft({
      title: row.title,
      owner: encodeOwner(row.client_id, row.project_id),
      content_type: row.content_type,
      stage: row.stage,
      lead: row.lead ?? "",
      shooter: row.shooter ?? "",
      editor: row.editor ?? "",
      planned_at: row.planned_at ?? "",
      link: row.link ?? "",
      notes: row.notes ?? "",
    });
    setOpen(true);
  };

  const saveNew = async () => {
    if (!fresh.title.trim()) return toast.error("Give it a name first.");
    setBusy(true);
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase.from("content_items").insert({
      title: fresh.title.trim(),
      ...decodeOwner(fresh.owner),
      content_type: fresh.content_type,
      stage: "Idea",
      link: fresh.link.trim() || null,
      notes: fresh.notes.trim() || null,
      added_by: me.user?.id ?? null,
      created_by: me.user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Idea logged.");
    setNewOpen(false);
    setFresh(emptyNew);
    load();
  };

  const save = async () => {
    if (!draft.title.trim()) return toast.error("Give it a title first.");
    setBusy(true);
    const payload = {
      title: draft.title.trim(),
      ...decodeOwner(draft.owner),
      content_type: draft.content_type,
      stage: draft.stage,
      lead: draft.lead.trim() || null,
      shooter: draft.shooter.trim() || null,
      editor: draft.editor.trim() || null,
      planned_at: draft.planned_at || null,
      link: draft.link.trim() || null,
      notes: draft.notes.trim() || null,
    };
    const { error } = await supabase.from("content_items").update(payload).eq("id", editing!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Updated.");
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!editing) return;
    setBusy(true);
    const { error } = await supabase.from("content_items").delete().eq("id", editing.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Removed.");
    setOpen(false);
    load();
  };

  const patch = async (id: string, values: Partial<ContentItem>) => {
    const prev = items;
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...values } : i)));
    const { error } = await supabase.from("content_items").update(values).eq("id", id);
    if (error) {
      setItems(prev);
      toast.error(error.message);
    }
  };

  const moveTo = (id: string, next: string) => patch(id, { stage: next });

  const ownerSelect = (value: string, onChange: (v: string) => void, className = field) => (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">No client yet — idea archive</option>
      <optgroup label="Clients">
        {clients.map((c) => (
          <option key={c.id} value={`c:${c.id}`}>
            {c.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Projects">
        {projects.map((p) => (
          <option key={p.id} value={`p:${p.id}`}>
            {p.title} — {p.client}
          </option>
        ))}
      </optgroup>
    </select>
  );

  const columns: Column<ContentItem>[] = [
    {
      key: "ref",
      header: "Code",
      hideOnMobile: true,
      cell: (r) => <span className="num text-xs text-ink-faint">{refCode(r.ref_no)}</span>,
    },
    { key: "title", header: "Item", cell: (r) => <span className="font-medium">{r.title}</span> },
    { key: "owner", header: "Belongs to", hideOnMobile: true, cell: (r) => ownerLabel(r) },
    { key: "type", header: "Type", hideOnMobile: true, cell: (r) => r.content_type },
    { key: "stage", header: "Stage", cell: (r) => <StatusChip value={r.stage} /> },
    {
      key: "author",
      header: "Added by",
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-ink-soft">
          {authorName(r.added_by)}
          <span className="num ml-2 text-[11px] text-ink-faint">{r.added_on}</span>
        </span>
      ),
    },
    {
      key: "planned",
      header: "Planned",
      align: "right",
      cell: (r) => <span className="num">{r.planned_at ?? "—"}</span>,
    },
  ];

  const archiveColumns: Column<ContentItem>[] = [
    {
      key: "ref",
      header: "Code",
      cell: (r) => <span className="num text-xs text-ink-faint">{refCode(r.ref_no)}</span>,
    },
    { key: "title", header: "Idea", cell: (r) => <span className="font-medium">{r.title}</span> },
    { key: "type", header: "Type", hideOnMobile: true, cell: (r) => r.content_type },
    {
      key: "author",
      header: "Added by",
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-ink-soft">
          {authorName(r.added_by)}
          <span className="num ml-2 text-[11px] text-ink-faint">{r.added_on}</span>
        </span>
      ),
    },
    {
      key: "assign",
      header: "Attach to",
      align: "right",
      cell: (r) =>
        canEditContent ? (
          <div onClick={(e) => e.stopPropagation()}>
            {ownerSelect(
              "",
              (v) => v && patch(r.id, decodeOwner(v)),
              "rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs press focus:border-signal focus-ring"
            )}
          </div>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

  return (
    <AppShell eyebrow="Content & strategy">
      <Seo
        title="Content & strategy — Site 99"
        description="Content pipeline from idea to posted."
        path="/app/content"
        noindex
      />
      <PageHeader
        eyebrow="Content & strategy"
        title="Pipeline."
        lede="Every idea from first thought to posted, per client or project, with the people on it."
        actions={
          canEditContent ? (
            <Button onClick={() => { setFresh(emptyNew); setNewOpen(true); }}>
              <Plus />
              New idea
            </Button>
          ) : undefined
        }
      />

      <FilterBar>
        <Segmented<"board" | "list" | "archive">
          value={view}
          onChange={(v) => setView(v)}
          options={[
            { value: "board", label: "Board" },
            { value: "list", label: "List" },
            { value: "archive", label: "Idea archive" },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search items…" />
        {view !== "archive" && (
          <SelectFilter
            label="Belongs to"
            value={owner}
            onChange={setOwner}
            options={[{ value: "all", label: "Everything" }, { value: "", label: "No client yet" }, ...ownerOptions]}
          />
        )}
        <SelectFilter
          label="Type"
          value={type}
          onChange={setType}
          options={[{ value: "all", label: "All types" }, ...TYPES.map((t) => ({ value: t, label: t }))]}
        />
        <SelectFilter
          label="Person"
          value={person}
          onChange={setPerson}
          options={[{ value: "all", label: "Anyone" }, ...people.map((p) => ({ value: p, label: p }))]}
        />
        {view === "list" && (
          <SelectFilter
            label="Stage"
            value={stage}
            onChange={setStage}
            options={[{ value: "all", label: "All stages" }, ...STAGES.map((s) => ({ value: s, label: s }))]}
          />
        )}
        <span className="eyebrow text-ink-faint ml-auto">
          {view === "archive" ? `${unclaimed.length} unclaimed` : `${filtered.length} items`}
        </span>
      </FilterBar>

      {view === "archive" ? (
        <>
          <DataTable
            rows={unclaimed}
            columns={archiveColumns}
            rowKey={(r) => r.id}
            loading={loading}
            onRowClick={canEditContent ? openEdit : undefined}
            empty="No ideas waiting for a client or project."
          />
          <p className="mt-3 text-xs text-ink-faint">
            Ideas with nothing attached yet. Give one a client or a project and it joins the board straight away.
          </p>
        </>
      ) : view === "list" ? (
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(r) => r.id}
          loading={loading}
          onRowClick={canEditContent ? openEdit : undefined}
          empty="No content items yet."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((s) => {
            const col = filtered.filter((i) => i.stage === s);
            const tone = toneFor(s);
            const over = dragOver === s;
            return (
              <section
                key={s}
                onDragOver={(e) => {
                  if (!canEditContent) return;
                  e.preventDefault();
                  if (dragOver !== s) setDragOver(s);
                }}
                onDragLeave={() => setDragOver((cur) => (cur === s ? null : cur))}
                onDrop={(e) => {
                  setDragOver(null);
                  if (!canEditContent) return;
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) moveTo(id, s);
                }}
                className={`rounded-2xl border p-3 min-h-[12rem] transition-colors ${
                  over
                    ? "border-signal bg-acc-violet-soft/60 border-dashed"
                    : "border-rule bg-paper-raised"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 eyebrow text-[10px] tracking-[0.16em] ${TONE_SOFT[tone]}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${TONE_SOLID[tone]}`} />
                    {s}
                  </span>
                  <span className={`num text-xs font-semibold ${TONE_TEXT[tone]}`}>{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((i) => (
                    <article
                      key={i.id}
                      draggable={canEditContent}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", i.id);
                        setDragging(i.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setDragOver(null);
                      }}
                      onClick={() => canEditContent && openEdit(i)}
                      className={`card-lift relative overflow-hidden rounded-xl border border-rule bg-paper-raised p-3 pl-4 ${
                        canEditContent ? "cursor-grab active:cursor-grabbing hover:border-ink" : ""
                      } ${dragging === i.id ? "opacity-50 rotate-1" : ""}`}
                    >
                      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${TONE_SOLID[tone]}`} />
                      <div className="num text-[10px] tracking-wider text-ink-faint">{refCode(i.ref_no)}</div>
                      <div className="text-sm font-semibold leading-snug">{i.title}</div>
                      <div className="mt-1.5 text-[11px] text-ink-soft">
                        {ownerLabel(i)}
                        {" · "}
                        <span className="font-semibold text-ink">{i.content_type}</span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-ink-faint truncate">
                          {[i.lead, i.shooter, i.editor].filter(Boolean).join(" · ") ||
                            `Idea by ${authorName(i.added_by)}`}
                        </span>
                        {i.planned_at && (
                          <span className="num text-[11px] rounded-full bg-paper-sunken px-2 py-0.5 text-ink-soft">
                            {i.planned_at}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                  {canEditContent && s === "Idea" && (
                    <button
                      className="press w-full rounded-xl border border-dashed border-rule px-3 py-2.5 text-left text-xs font-semibold text-ink-faint hover:border-signal hover:text-signal hover:bg-paper-sunken focus-ring"
                      onClick={() => { setFresh(emptyNew); setNewOpen(true); }}
                    >
                      + Add idea
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* New idea — lean form */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg bg-paper text-ink border-rule">
          <DialogHeader>
            <DialogTitle className="display text-xl">New idea</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="eyebrow text-ink-faint">Name of the idea</span>
              <input
                autoFocus
                className={field}
                value={fresh.title}
                onChange={(e) => setFresh({ ...fresh, title: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Client or project</span>
              {ownerSelect(fresh.owner, (v) => setFresh({ ...fresh, owner: v }))}
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Type</span>
              <select
                className={field}
                value={fresh.content_type}
                onChange={(e) => setFresh({ ...fresh, content_type: e.target.value })}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="eyebrow text-ink-faint">Reference link</span>
              <input
                className={field}
                placeholder="https://…"
                value={fresh.link}
                onChange={(e) => setFresh({ ...fresh, link: e.target.value })}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="eyebrow text-ink-faint">Notes</span>
              <textarea
                rows={3}
                className={field}
                value={fresh.notes}
                onChange={(e) => setFresh({ ...fresh, notes: e.target.value })}
              />
            </label>
          </div>

          <p className="text-xs text-ink-faint">
            Saved as a new Idea, dated today, with its own code and your name on it — none of which can be changed later.
          </p>

          <DialogFooter className="mt-2 flex items-center gap-2">
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={saveNew} disabled={busy}>
              {busy ? "Saving…" : "Log the idea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-paper text-ink border-rule">
          <DialogHeader>
            <DialogTitle className="display text-xl">Edit item</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-paper-sunken px-3 py-2 text-[11px] text-ink-soft">
              <span className="num font-semibold text-ink">{refCode(editing.ref_no)}</span>
              <span>
                Added by <span className="font-semibold text-ink">{authorName(editing.added_by)}</span>
              </span>
              <span className="num">{editing.added_on}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="eyebrow text-ink-faint">Title</span>
              <input className={field} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Client or project</span>
              {ownerSelect(draft.owner, (v) => setDraft({ ...draft, owner: v }))}
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Type</span>
              <select
                className={field}
                value={draft.content_type}
                onChange={(e) => setDraft({ ...draft, content_type: e.target.value })}
              >
                {[...new Set([...TYPES, draft.content_type])].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Stage</span>
              <select className={field} value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value })}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Planned date</span>
              <input
                type="date"
                className={field}
                value={draft.planned_at}
                onChange={(e) => setDraft({ ...draft, planned_at: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Lead</span>
              <input className={field} value={draft.lead} onChange={(e) => setDraft({ ...draft, lead: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Shooter</span>
              <input className={field} value={draft.shooter} onChange={(e) => setDraft({ ...draft, shooter: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Editor</span>
              <input className={field} value={draft.editor} onChange={(e) => setDraft({ ...draft, editor: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Link</span>
              <input className={field} value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="eyebrow text-ink-faint">Notes</span>
              <textarea
                rows={3}
                className={field}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
          </div>

          <DialogFooter className="mt-2 flex items-center gap-2">
            <Button variant="ghost" className="mr-auto text-signal hover:bg-[hsl(0_100%_96%)]" onClick={remove} disabled={busy}>
              <Trash2 />
              Delete
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!canEditContent && (
        <div className="mt-8">
          <SectionHeading index="—" title="Read only" hint="Your access" />
          <p className="text-sm text-ink-soft">You can follow the pipeline here, but changes are made by the creative team.</p>
        </div>
      )}
    </AppShell>
  );
}
