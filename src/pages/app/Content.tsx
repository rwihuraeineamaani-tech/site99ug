import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Plus, Trash2, Lock } from "lucide-react";

import { useMyRoles } from "@/hooks/useMyRoles";
import { STAGES, STAGE_NOTE, CREW_ROLES, PLATFORMS, METRIC_FIELDS, refCode, type Stage } from "@/lib/contentFlow";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export { STAGES, refCode };
export type { Stage };

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
  resident_id: string | null;
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
  approved_by: string | null;
  approved_at: string | null;
  crew_notes: string | null;
  shoot_at: string | null;
  edit_file_url: string | null;
  edit_remarks: string | null;
  sent_direct: boolean;
  editor_done_at: string | null;
  founder_approved_at: string | null;
  platforms: string[] | null;
  caption_suggestions: string | null;
  posted_links: string[] | null;
  posted_from: string | null;
  posted_to: string | null;
  posted_at: string | null;
  metrics: Record<string, string> | null;
  metrics_due_at: string | null;
  metrics_filled_at: string | null;
};

type CrewRow = { id: string; content_id: string; role: string; user_id: string | null; note: string | null; sort: number };
type ResidentRow = {
  id: string;
  name: string;
  territory: string | null;
  contact_user_id: string | null;
  handler_user_id: string | null;
};
type ProjectRow = { id: string; title: string; client: string };
type Member = { user_id: string; name: string };

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";

/** "Belongs to" is one picker over two record types: r:<id> for a resident, p:<id> for a project. */
const encodeOwner = (residentId: string | null, projectId: string | null) =>
  residentId ? `r:${residentId}` : projectId ? `p:${projectId}` : "";
const decodeOwner = (v: string) => ({
  resident_id: v.startsWith("r:") ? v.slice(2) : null,
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
  planned_at: "",
  link: "",
  notes: "",
};

const FOUNDER_ROLES = ["admin", "founder", "managing_director", "creative_director"] as const;

export default function ContentPipeline() {
  const { canEditContent, userId, has } = useMyRoles();
  const navigate = useNavigate();
  const isFounder = has(...FOUNDER_ROLES);

  const [items, setItems] = useState<ContentItem[]>([]);
  const [residents, setResidents] = useState<ResidentRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [crewByItem, setCrewByItem] = useState<Record<string, CrewRow[]>>({});
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

  // step state inside the detail dialog
  const [crew, setCrew] = useState<CrewRow[]>([]);
  const [crewNotes, setCrewNotes] = useState("");
  const [shootAt, setShootAt] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [sentDirect, setSentDirect] = useState(false);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [captions, setCaptions] = useState("");
  const [postLinks, setPostLinks] = useState<Record<string, string>>({});
  const [editRemarks, setEditRemarks] = useState("");
  const [postedFrom, setPostedFrom] = useState("");
  const [postedTo, setPostedTo] = useState("");
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [metricNote, setMetricNote] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: rows, error }, { data: cs }, { data: ps }, { data: tm }, { data: allCrew }] = await Promise.all([
      supabase.from("content_items").select("*").order("planned_at", { ascending: true, nullsFirst: false }),
      supabase.rpc("resident_options"),
      supabase.from("projects").select("id, title, client").order("display_order"),
      supabase.from("team_members").select("user_id, display_name, email"),
      supabase.from("content_crew").select("*"),
    ]);
    if (error) toast.error(error.message);
    setItems((rows as unknown as ContentItem[]) ?? []);
    setResidents((cs as unknown as ResidentRow[]) ?? []);
    setProjects((ps as ProjectRow[]) ?? []);
    const map: Record<string, string> = {};
    const list: Member[] = [];
    (tm ?? []).forEach((m: { user_id: string; display_name: string | null; email: string }) => {
      const name = m.display_name?.trim() || m.email.split("@")[0];
      map[m.user_id] = name;
      list.push({ user_id: m.user_id, name });
    });
    const byItem: Record<string, CrewRow[]> = {};
    ((allCrew as CrewRow[]) ?? []).forEach((c) => {
      (byItem[c.content_id] ??= []).push(c);
    });
    setCrewByItem(byItem);
    setAuthors(map);
    setMembers(list.sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const ownerLabel = (i: Pick<ContentItem, "resident_id" | "project_id">) => {
    if (i.resident_id) return residents.find((c) => c.id === i.resident_id)?.name ?? "Resident";
    if (i.project_id) {
      const p = projects.find((x) => x.id === i.project_id);
      return p ? `${p.title} (project)` : "Project";
    }
    return "—";
  };
  const authorName = (id: string | null) => (id ? authors[id] ?? "—" : "—");

  const residentOf = (i: ContentItem | null) =>
    i?.resident_id ? residents.find((r) => r.id === i.resident_id) ?? null : null;

  const ownerOptions = useMemo(
    () => [
      ...residents.map((r) => ({ value: `r:${r.id}`, label: r.name })),
      ...projects.map((p) => ({ value: `p:${p.id}`, label: `${p.title} — ${p.client} (project)` })),
    ],
    [residents, projects]
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
        if (owner !== "all" && encodeOwner(i.resident_id, i.project_id) !== owner) return false;
        if (type !== "all" && i.content_type !== type) return false;
        if (stage !== "all" && i.stage !== stage) return false;
        if (person !== "all" && ![i.lead, i.shooter, i.editor, authorName(i.added_by)].includes(person)) return false;
        return true;
      }),
    [items, q, owner, type, stage, person, residents, projects, authors]
  );

  const unclaimed = useMemo(() => filtered.filter((i) => !i.resident_id && !i.project_id), [filtered]);

  const openEdit = async (row: ContentItem) => {
    setEditing(row);
    setDraft({
      title: row.title,
      owner: encodeOwner(row.resident_id, row.project_id),
      content_type: row.content_type,
      planned_at: row.planned_at ?? "",
      link: row.link ?? "",
      notes: row.notes ?? "",
    });
    setCrewNotes(row.crew_notes ?? "");
    setShootAt(row.shoot_at ?? "");
    setEditUrl(row.edit_file_url ?? "");
    setSentDirect(row.sent_direct ?? false);
    setPlatforms(row.platforms ?? []);
    setCaptions(row.caption_suggestions ?? "");
    setPostLinks((row.posted_links ?? []).join("\n"));
    setPostedFrom(row.posted_from ? row.posted_from.slice(0, 16) : "");
    setPostedTo(row.posted_to ? row.posted_to.slice(0, 16) : "");
    const m = (row.metrics ?? {}) as Record<string, string>;
    setMetrics(m);
    setMetricNote(m.note ?? "");
    setOpen(true);
    const { data } = await supabase.from("content_crew").select("*").eq("content_id", row.id).order("sort");
    setCrew((data as CrewRow[]) ?? []);
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
    const isLocked = !!editing && editing.stage !== "Idea";
    const payload = isLocked
      ? { notes: draft.notes.trim() || null }
      : {
          title: draft.title.trim(),
          ...decodeOwner(draft.owner),
          content_type: draft.content_type,
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

  const patch = async (id: string, values: Record<string, unknown>) => {
    const { error } = await supabase.from("content_items").update(values as never).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await load();
    return true;
  };

  /** Move a stage forward, optionally saving fields at the same time. */
  const advance = async (next: Stage, values: Record<string, unknown> = {}) => {
    if (!editing) return;
    setBusy(true);
    const ok = await patch(editing.id, { ...values, stage: next });
    setBusy(false);
    if (ok) {
      toast.success(`Moved to ${next}.`);
      setOpen(false);
    }
  };

  /* ---------- crew helpers ---------- */
  const addCrewSlot = async (role: string) => {
    if (!editing) return;
    const { data, error } = await supabase
      .from("content_crew")
      .insert({ content_id: editing.id, role, sort: crew.length })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setCrew((c) => [...c, data as CrewRow]);
  };
  const setCrewPerson = async (id: string, user_id: string | null) => {
    setCrew((c) => c.map((r) => (r.id === id ? { ...r, user_id } : r)));
    const { error } = await supabase.from("content_crew").update({ user_id }).eq("id", id);
    if (error) toast.error(error.message);
  };
  const removeCrewSlot = async (id: string) => {
    setCrew((c) => c.filter((r) => r.id !== id));
    await supabase.from("content_crew").delete().eq("id", id);
  };

  const crewComplete = crew.length > 0 && crew.every((c) => c.user_id);

  /** Once an idea is approved its core details are frozen (also enforced in the database). */
  const locked = !!editing && editing.stage !== "Idea";

  const ownerSelect = (value: string, onChange: (v: string) => void, className = field, disabled = false) => (
    <select className={className} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">No one yet — idea archive</option>
      <optgroup label="Residents">
        {residents.map((r) => (
          <option key={r.id} value={`r:${r.id}`}>
            {r.name}
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

  /* ---------- one-press next step, shown on the cards and rows ---------- */
  type Quick = { label: string; run?: () => void | Promise<void>; ghost?: boolean };

  /** Move one item forward without opening it. */
  const move = async (id: string, next: Stage, values: Record<string, unknown> = {}) => {
    setBusy(true);
    const ok = await patch(id, { ...values, stage: next });
    setBusy(false);
    if (ok) toast.success(`Moved to ${next}.`);
  };

  /** The buttons a signed-in person may press on a card at its current stage. */
  const quickFor = (i: ContentItem): Quick[] => {
    const r = i.resident_id ? residents.find((x) => x.id === i.resident_id) : null;
    const contact = !!userId && r?.contact_user_id === userId;
    const handler = !!userId && r?.handler_user_id === userId;
    const rows = crewByItem[i.id] ?? [];
    const itemEditor = !!userId && rows.some((c) => c.user_id === userId && /edit/i.test(c.role));
    const crewFilled = rows.length > 0 && rows.every((c) => c.user_id);
    const openIt: Quick["run"] = undefined;

    switch (i.stage as Stage) {
      case "Idea":
        return isFounder
          ? [
              { label: "Approve", run: () => move(i.id, crewFilled ? "Crewed" : "Approved") },
              { label: "Reject", run: () => move(i.id, "Rejected"), ghost: true },
            ]
          : [];
      case "Approved":
        return isFounder || contact ? [{ label: "Fill the crew", run: openIt }] : [];
      case "Crewed":
      case "Scheduled":
        return canEditContent ? [{ label: "Open shoot day", run: () => navigate("/app/shoots"), ghost: true }] : [];
      case "Shooting":
        return isFounder || contact ? [{ label: "Shoot done", run: () => move(i.id, "Editing") }] : [];
      case "Editing":
        return isFounder || itemEditor ? [{ label: "Add the cut", run: openIt }] : [];
      case "Review":
        return isFounder ? [{ label: "Review it", run: openIt }] : [];
      case "Handover":
        return isFounder || handler ? [{ label: "Add post links", run: openIt }] : [];
      case "Posted":
        return isFounder || handler ? [{ label: "Add the numbers", run: openIt }] : [];
      default:
        return [];
    }
  };

  /** Render the quick buttons for an item; falling back to opening the card. */
  const quickButtons = (i: ContentItem, className = "") => {
    const acts = quickFor(i);
    if (acts.length === 0) return null;
    return (
      <div className={`flex flex-wrap gap-1.5 ${className}`} onClick={(e) => e.stopPropagation()}>
        {acts.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={busy}
            onClick={() => (a.run ? a.run() : openEdit(i))}
            className={`press rounded-full border px-2.5 py-1 text-[11px] font-semibold focus-ring disabled:opacity-50 ${
              a.ghost
                ? "border-rule bg-paper-raised text-ink-soft hover:border-ink"
                : "border-signal bg-signal text-paper hover:opacity-90"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
    );
  };

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
      header: "Shoot / planned",
      align: "right",
      cell: (r) => <span className="num">{r.shoot_at ?? r.planned_at ?? "—"}</span>,
    },
    {
      key: "next",
      header: "Next step",
      align: "right",
      cell: (r) => quickButtons(r, "justify-end") ?? <span className="text-ink-faint">—</span>,
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

  /* ---------- who may act on the open item ---------- */
  const res = residentOf(editing);
  const isContact = !!userId && res?.contact_user_id === userId;
  const isHandler = !!userId && res?.handler_user_id === userId;
  const isItemEditor = !!userId && crew.some((c) => c.user_id === userId && /edit/i.test(c.role));

  const stepPanel = () => {
    if (!editing) return null;
    const s = editing.stage as Stage;
    const box = "rounded-xl border border-rule bg-paper-sunken p-4";

    if (s === "Idea")
      return isFounder ? (
        <div className={box}>
          <div className="eyebrow text-ink-faint">Approve this idea</div>
          <p className="mt-1 text-xs text-ink-soft">
            Choose the roles this shoot needs. You can already name people, or leave slots empty for the contact person
            to fill.
          </p>
          {crewEditor()}
          <label className="mt-3 block text-sm">
            <span className="eyebrow text-ink-faint">Notes for the crew</span>
            <textarea rows={2} className={field} value={crewNotes} onChange={(e) => setCrewNotes(e.target.value)} />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() => advance(crewComplete ? "Crewed" : "Approved", { crew_notes: crewNotes || null })}
            >
              Approve
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => advance("Rejected")}>
              Reject
            </Button>
          </div>
        </div>
      ) : (
        waiting("Waiting on the founders to approve this idea.")
      );

    if (s === "Approved")
      return isFounder || isContact ? (
        <div className={box}>
          <div className="eyebrow text-ink-faint">Fill the production team</div>
          {editing.crew_notes && <p className="mt-1 text-xs text-ink-soft">“{editing.crew_notes}”</p>}
          {crewEditor()}
          <Button className="mt-3" disabled={busy || !crewComplete} onClick={() => advance("Crewed")}>
            {crewComplete ? "Crew is complete" : "Fill every role first"}
          </Button>
        </div>
      ) : (
        waiting("Waiting on the contact person to fill the production team.")
      );

    if (s === "Crewed")
      return (
        <div className={box}>
          <div className="eyebrow text-ink-faint">On a shoot day</div>
          <p className="mt-1 text-xs text-ink-soft">
            This idea is waiting on its client's shoot day. Management sets the date and the gear there — confirming the
            day schedules it.
          </p>
          <Link to="/app/shoots" className="mt-3 inline-block text-xs font-semibold text-signal focus-ring">
            Open shoot days →
          </Link>
        </div>
      );

    if (s === "Scheduled")
      return (
        <div className={box}>
          <div className="eyebrow text-ink-faint">Shoot day</div>
          <p className="mt-1 text-xs text-ink-soft">Shoot set for {editing.shoot_at ?? "—"}.</p>
          <Link to="/app/shoots" className="mt-3 inline-block text-xs font-semibold text-signal focus-ring">
            Open shoot days →
          </Link>
        </div>
      );



    if (s === "Shooting")
      return isFounder || isContact ? (
        <div className={box}>
          <div className="eyebrow text-ink-faint">On the shoot</div>
          <Button className="mt-3" disabled={busy} onClick={() => advance("Editing")}>
            Shoot done — send to post production
          </Button>
        </div>
      ) : (
        waiting("The shoot is under way.")
      );

    if (s === "Editing")
      return isFounder || isItemEditor ? (
        <div className={box}>
          <div className="eyebrow text-ink-faint">Post production</div>
          <label className="mt-2 block text-sm">
            <span className="eyebrow text-ink-faint">Google Drive link to the cut</span>
            <input
              className={field}
              placeholder="https://drive.google.com/…"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
            />
          </label>
          <p className="mt-1 text-xs text-ink-soft">
            Upload the cut to Google Drive, set the link so anyone with it can view, then paste that link here.
          </p>
          <label className="mt-3 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-signal"
              checked={sentDirect}
              onChange={(e) => setSentDirect(e.target.checked)}
            />
            I sent it directly instead
          </label>
          <Button
            className="mt-3 block"
            disabled={busy || (!editUrl && !sentDirect)}
            onClick={() => advance("Review", { edit_file_url: editUrl || null, sent_direct: sentDirect })}
          >
            Forward for approval
          </Button>

        </div>
      ) : (
        waiting("With the editor.")
      );

    if (s === "Review")
      return isFounder ? (
        <div className={box}>
          <div className="eyebrow text-ink-faint">Founder sign-off</div>
          {editing.edit_file_url ? (
            <a href={editing.edit_file_url} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-signal">
              Open the cut →
            </a>
          ) : (
            <p className="mt-1 text-xs text-ink-soft">The editor sent it directly.</p>
          )}
          <div className="mt-3">
            <span className="eyebrow text-ink-faint">Platforms to post on</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const on = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatforms((cur) => (on ? cur.filter((x) => x !== p) : [...cur, p]))}
                    className={`press rounded-full border px-3 py-1 text-xs focus-ring ${
                      on ? "border-signal bg-signal text-paper" : "border-rule bg-paper-raised text-ink-soft"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="mt-3 block text-sm">
            <span className="eyebrow text-ink-faint">Suggested captions</span>
            <textarea rows={3} className={field} value={captions} onChange={(e) => setCaptions(e.target.value)} />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={busy || platforms.length === 0}
              onClick={() => advance("Handover", { platforms, caption_suggestions: captions || null })}
            >
              Approve — hand to the handler
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => advance("Editing")}>
              Send back to editing
            </Button>
          </div>
        </div>
      ) : (
        waiting("Waiting on founder sign-off.")
      );

    if (s === "Handover")
      return isFounder || isHandler ? (
        <div className={box}>
          <div className="eyebrow text-ink-faint">Post it</div>
          <p className="mt-1 text-xs text-ink-soft">Platforms: {(editing.platforms ?? []).join(", ") || "—"}</p>
          {editing.caption_suggestions && (
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-paper-raised p-3 text-xs text-ink-soft">
              {editing.caption_suggestions}
            </p>
          )}
          <label className="mt-3 block text-sm">
            <span className="eyebrow text-ink-faint">Post links — one per line</span>
            <textarea rows={3} className={field} value={postLinks} onChange={(e) => setPostLinks(e.target.value)} />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Posted from</span>
              <input
                type="datetime-local"
                className={field}
                value={postedFrom}
                onChange={(e) => setPostedFrom(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Posted to</span>
              <input type="datetime-local" className={field} value={postedTo} onChange={(e) => setPostedTo(e.target.value)} />
            </label>
          </div>
          <Button
            className="mt-3"
            disabled={busy || !postLinks.trim() || !postedFrom}
            onClick={() =>
              advance("Posted", {
                posted_links: postLinks.split("\n").map((l) => l.trim()).filter(Boolean),
                posted_from: new Date(postedFrom).toISOString(),
                posted_to: postedTo ? new Date(postedTo).toISOString() : null,
              })
            }
          >
            Posted
          </Button>
        </div>
      ) : (
        waiting("With the handler to post.")
      );

    if (s === "Posted") {
      const due = editing.metrics_due_at;
      const ready = !!due && due <= new Date().toISOString().slice(0, 10);
      if (!(isFounder || isHandler)) return waiting(`Live. Numbers due ${due ?? "—"}.`);
      return (
        <div className={box}>
          <div className="eyebrow text-ink-faint">Performance — due {due ?? "—"}</div>
          {!ready && <p className="mt-1 text-xs text-ink-soft">You can fill these in early if you already have them.</p>}
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {METRIC_FIELDS.map((m) => (
              <label key={m.key} className="text-sm">
                <span className="eyebrow text-ink-faint">{m.label}</span>
                <input
                  className={field}
                  value={metrics[m.key] ?? ""}
                  onChange={(e) => setMetrics({ ...metrics, [m.key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <label className="mt-3 block text-sm">
            <span className="eyebrow text-ink-faint">Why did it perform, or not?</span>
            <textarea rows={3} className={field} value={metricNote} onChange={(e) => setMetricNote(e.target.value)} />
          </label>
          <Button
            className="mt-3"
            disabled={busy || !metricNote.trim()}
            onClick={() =>
              advance("Archived", {
                metrics: { ...metrics, note: metricNote },
                metrics_filled_at: new Date().toISOString(),
              })
            }
          >
            Save numbers & archive
          </Button>
        </div>
      );
    }

    if (s === "Rejected")
      return isFounder ? (
        <div className={box}>
          <div className="eyebrow text-ink-faint">Rejected</div>
          <Button className="mt-3" variant="outline" disabled={busy} onClick={() => advance("Idea")}>
            Put it back as an idea
          </Button>
        </div>
      ) : (
        waiting("This idea is not going ahead.")
      );

    return waiting("Everything on this item is recorded.");
  };

  const waiting = (text: string) => (
    <div className="rounded-xl border border-rule bg-paper-sunken p-4 text-xs text-ink-soft flex items-center gap-2">
      <Lock className="h-3.5 w-3.5 shrink-0" />
      {text}
    </div>
  );

  const crewEditor = () => (
    <div className="mt-3 space-y-2">
      {crew.map((c) => (
        <div key={c.id} className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-xs font-semibold">{c.role}</span>
          <select
            className="flex-1 rounded-lg border border-rule bg-paper-raised px-3 py-1.5 text-sm press focus:border-signal focus-ring"
            value={c.user_id ?? ""}
            onChange={(e) => setCrewPerson(c.id, e.target.value || null)}
          >
            <option value="">Not filled yet</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
          {(isFounder || isContact) && (
            <button
              type="button"
              onClick={() => removeCrewSlot(c.id)}
              className="press rounded-full border border-rule px-2 py-1 text-[11px] text-ink-faint hover:border-signal hover:text-signal focus-ring"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {(isFounder || isContact) && (
        <select
          className="mt-1 rounded-full border border-dashed border-rule bg-paper-raised px-3 py-1.5 text-xs press focus:border-signal focus-ring"
          value=""
          onChange={(e) => e.target.value && addCrewSlot(e.target.value)}
        >
          <option value="">+ Add a role</option>
          {CREW_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      )}
    </div>
  );

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
        lede="Every idea from first thought to posted. The stage only moves when the right person takes the next step."
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
            options={[{ value: "all", label: "Everything" }, { value: "", label: "No one yet" }, ...ownerOptions]}
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
            onRowClick={openEdit}
            empty="No ideas waiting for a resident or project."
          />
          <p className="mt-3 text-xs text-ink-faint">
            Ideas with nothing attached yet. Give one a resident or a project and it joins the board straight away.
          </p>
        </>
      ) : view === "list" ? (
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(r) => r.id}
          loading={loading}
          onRowClick={openEdit}
          empty="No content items yet."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((s) => {
            const col = filtered.filter((i) => i.stage === s);
            const tone = toneFor(s);
            return (
              <section key={s} className="rounded-2xl border border-rule bg-paper-raised p-3 min-h-[10rem]">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 eyebrow text-[10px] tracking-[0.16em] ${TONE_SOFT[tone]}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${TONE_SOLID[tone]}`} />
                    {s}
                  </span>
                  <span className={`num text-xs font-semibold ${TONE_TEXT[tone]}`}>{col.length}</span>
                </div>
                <div className="mb-3 text-[10px] text-ink-faint">{STAGE_NOTE[s]}</div>
                <div className="space-y-2">
                  {col.map((i) => (
                    <article
                      key={i.id}
                      onClick={() => openEdit(i)}
                      className={`card-lift relative cursor-pointer overflow-hidden rounded-xl border border-rule bg-paper-raised p-3 pl-4 hover:border-ink`}
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
                        <span className="text-[11px] text-ink-faint truncate">Idea by {authorName(i.added_by)}</span>
                        {(i.shoot_at || i.planned_at) && (
                          <span className="num text-[11px] rounded-full bg-paper-sunken px-2 py-0.5 text-ink-soft">
                            {i.shoot_at ?? i.planned_at}
                          </span>
                        )}
                      </div>
                      {quickButtons(i, "mt-2.5")}
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
              <span className="eyebrow text-ink-faint">Resident or project</span>
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

      {/* Detail + next step */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-paper text-ink border-rule">
          <DialogHeader>
            <DialogTitle className="display text-xl">{editing?.title}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-paper-sunken px-3 py-2 text-[11px] text-ink-soft">
              <span className="num font-semibold text-ink">{refCode(editing.ref_no)}</span>
              <StatusChip value={editing.stage} />
              <span>
                Added by <span className="font-semibold text-ink">{authorName(editing.added_by)}</span>
              </span>
              <span className="num">{editing.added_on}</span>
              <span className="ml-auto">
                Contact: <span className="text-ink">{authorName(res?.contact_user_id ?? null)}</span> · Handler:{" "}
                <span className="text-ink">{authorName(res?.handler_user_id ?? null)}</span>
              </span>
            </div>
          )}

          {stepPanel()}

          {editing && crew.length > 0 && editing.stage !== "Idea" && editing.stage !== "Approved" && (
            <div className="rounded-xl border border-rule p-3 text-xs text-ink-soft">
              <span className="eyebrow text-ink-faint">Production team</span>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {crew.map((c) => (
                  <span key={c.id}>
                    {c.role}: <span className="font-semibold text-ink">{authorName(c.user_id)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {editing && (editing.posted_links ?? []).length > 0 && (
            <div className="rounded-xl border border-rule p-3 text-xs">
              <span className="eyebrow text-ink-faint">Posted</span>
              <ul className="mt-1.5 space-y-1">
                {(editing.posted_links ?? []).map((l) => (
                  <li key={l}>
                    <a href={l} target="_blank" rel="noreferrer" className="text-signal break-all">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="eyebrow text-ink-faint">Title</span>
              <input
                className={`${field} ${locked ? "opacity-60" : ""}`}
                value={draft.title}
                disabled={locked}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Resident or project</span>
              {ownerSelect(draft.owner, (v) => setDraft({ ...draft, owner: v }), `${field} ${locked ? "opacity-60" : ""}`, locked)}
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Type</span>
              <select
                className={`${field} ${locked ? "opacity-60" : ""}`}
                value={draft.content_type}
                disabled={locked}
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
              <span className="eyebrow text-ink-faint">Reference link</span>
              <input
                className={`${field} ${locked ? "opacity-60" : ""}`}
                value={draft.link}
                disabled={locked}
                onChange={(e) => setDraft({ ...draft, link: e.target.value })}
              />
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

          <p className="text-xs text-ink-faint">The stage is set by the steps above — it can never be typed in by hand.</p>
          {locked && (
            <p className="text-xs text-ink-faint">
              Title, resident or project, type and reference link were locked when this idea was approved. The date comes from
              its shoot day.
            </p>
          )}

          <DialogFooter className="mt-2 flex items-center gap-2">
            {isFounder && (
              <Button variant="ghost" className="mr-auto text-signal hover:bg-[hsl(0_100%_96%)]" onClick={remove} disabled={busy}>
                <Trash2 />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Close
            </Button>
            {canEditContent && (
              <Button onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save details"}
              </Button>
            )}
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
