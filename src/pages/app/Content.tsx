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

const TYPES = ["Post", "Reel", "TikTok", "Photo set", "Video", "Campaign", "Strategy"];

export type ContentItem = {
  id: string;
  client_id: string | null;
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

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";


const emptyDraft = {
  title: "",
  client_id: "",
  content_type: "Post",
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
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [client, setClient] = useState("all");
  const [type, setType] = useState("all");
  const [person, setPerson] = useState("all");
  const [stage, setStage] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: rows, error }, { data: cs }] = await Promise.all([
      supabase.from("content_items").select("*").order("planned_at", { ascending: true, nullsFirst: false }),
      supabase.from("clients").select("id, name").order("name"),
    ]);
    if (error) toast.error(error.message);
    setItems((rows as ContentItem[]) ?? []);
    setClients((cs as ClientRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";

  const people = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => [i.lead, i.shooter, i.editor].forEach((p) => p && set.add(p)));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (q && !`${i.title} ${i.notes ?? ""} ${clientName(i.client_id)}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        if (client !== "all" && i.client_id !== client) return false;
        if (type !== "all" && i.content_type !== type) return false;
        if (stage !== "all" && i.stage !== stage) return false;
        if (person !== "all" && ![i.lead, i.shooter, i.editor].includes(person)) return false;
        return true;
      }),
    [items, q, client, type, stage, person, clients]
  );

  const openNew = (preset?: string) => {
    setEditing(null);
    setDraft({ ...emptyDraft, stage: preset ?? "Idea" });
    setOpen(true);
  };

  const openEdit = (row: ContentItem) => {
    setEditing(row);
    setDraft({
      title: row.title,
      client_id: row.client_id ?? "",
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

  const save = async () => {
    if (!draft.title.trim()) return toast.error("Give it a title first.");
    setBusy(true);
    const payload = {
      title: draft.title.trim(),
      client_id: draft.client_id || null,
      content_type: draft.content_type,
      stage: draft.stage,
      lead: draft.lead.trim() || null,
      shooter: draft.shooter.trim() || null,
      editor: draft.editor.trim() || null,
      planned_at: draft.planned_at || null,
      link: draft.link.trim() || null,
      notes: draft.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("content_items").update(payload).eq("id", editing.id)
      : await supabase.from("content_items").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Updated." : "Added to the pipeline.");
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

  const moveTo = async (id: string, next: string) => {
    const prev = items;
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, stage: next } : i)));
    const { error } = await supabase.from("content_items").update({ stage: next }).eq("id", id);
    if (error) {
      setItems(prev);
      toast.error(error.message);
    }
  };

  const columns: Column<ContentItem>[] = [
    { key: "title", header: "Item", cell: (r) => <span className="font-medium">{r.title}</span> },
    { key: "client", header: "Client", hideOnMobile: true, cell: (r) => clientName(r.client_id) },
    { key: "type", header: "Type", hideOnMobile: true, cell: (r) => r.content_type },
    { key: "stage", header: "Stage", cell: (r) => <StatusChip value={r.stage} /> },
    {
      key: "team",
      header: "Team",
      hideOnMobile: true,
      cell: (r) => [r.lead, r.shooter, r.editor].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "planned",
      header: "Planned",
      align: "right",
      cell: (r) => <span className="num">{r.planned_at ?? "—"}</span>,
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
        lede="Every idea from first thought to posted, per client, with the people on it."
        actions={
          canEditContent ? (
            <button className={btnSolid} onClick={() => openNew()}>
              New item
            </button>
          ) : undefined
        }
      />

      <FilterBar>
        <Segmented<"board" | "list">
          value={view}
          onChange={(v) => setView(v)}

          options={[
            { value: "board", label: "Board" },
            { value: "list", label: "List" },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search items…" />
        <SelectFilter
          label="Client"
          value={client}
          onChange={setClient}
          options={[{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
        />
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
        <span className="eyebrow text-ink-faint ml-auto">{filtered.length} items</span>
      </FilterBar>

      {view === "list" ? (
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
            return (
              <section
                key={s}
                onDragOver={(e) => canEditContent && e.preventDefault()}
                onDrop={(e) => {
                  if (!canEditContent) return;
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) moveTo(id, s);
                }}
                className="surface rounded-sm p-3 min-h-[10rem]"
              >
                <div className="rule-b pb-2 mb-3 flex items-baseline justify-between">
                  <span className="eyebrow">{s}</span>
                  <span className="eyebrow text-ink-faint num">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((i) => (
                    <article
                      key={i.id}
                      draggable={canEditContent}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}
                      onClick={() => canEditContent && openEdit(i)}
                      className={`rounded-sm border border-rule bg-paper-raised p-3 ${
                        canEditContent ? "cursor-pointer hover:border-signal" : ""
                      } transition-colors`}
                    >
                      <div className="text-sm font-medium leading-snug">{i.title}</div>
                      <div className="mt-1.5 text-[11px] text-ink-soft">
                        {clientName(i.client_id)} · {i.content_type}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-ink-faint truncate">
                          {[i.lead, i.shooter, i.editor].filter(Boolean).join(" · ") || "Unassigned"}
                        </span>
                        {i.planned_at && <span className="num text-[11px] text-ink-faint">{i.planned_at}</span>}
                      </div>
                    </article>
                  ))}
                  {canEditContent && (
                    <button className="eyebrow text-ink-faint hover:text-signal w-full text-left px-1 py-2 focus-ring" onClick={() => openNew(s)}>
                      + Add
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-paper text-ink border-rule">
          <DialogHeader>
            <DialogTitle className="display text-xl">{editing ? "Edit item" : "New item"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="eyebrow text-ink-faint">Title</span>
              <input className={field} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Client</span>
              <select
                className={field}
                value={draft.client_id}
                onChange={(e) => setDraft({ ...draft, client_id: e.target.value })}
              >
                <option value="">No client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Type</span>
              <select
                className={field}
                value={draft.content_type}
                onChange={(e) => setDraft({ ...draft, content_type: e.target.value })}
              >
                {TYPES.map((t) => (
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
            {editing && (
              <button className={`${btn} mr-auto text-state-stop`} onClick={remove} disabled={busy}>
                Delete
              </button>
            )}
            <button className={btn} onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button className={btnSolid} onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
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
