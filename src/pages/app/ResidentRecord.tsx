import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip } from "@/components/system";
import AccountsPanel from "@/components/system/AccountsPanel";
import ClientPayPanel from "@/components/system/ClientPayPanel";
import { Button } from "@/components/ui/button";
import { useMyRoles } from "@/hooks/useMyRoles";
import { refCode, STAGE_NOTE, type Stage } from "@/lib/contentFlow";
import { ArrowLeft, FileText, Target, Upload } from "lucide-react";
import type { ResidentRecord } from "./Residents";

type Member = { user_id: string; display_name: string | null; email: string; title: string | null };
type Item = {
  id: string;
  ref_no: number;
  title: string;
  content_type: string;
  stage: string;
  created_at: string;
  posted_at: string | null;
  posted_links: string[] | null;
  shoot_at: string | null;
};
type Day = { id: string; status: string; shoot_date: string | null; location: string | null; call_time: string | null };
type Contract = {
  id: string;
  resident_id: string;
  title: string;
  file_path: string | null;
  starts_on: string | null;
  ends_on: string | null;
  value_ugx: number | null;
  status: string;
  notes: string | null;
  created_at: string;
};

const LIVE_STAGES = ["Idea", "Approved", "Crewed", "Scheduled", "Shooting", "Editing", "Review", "Handover"];
const field = "field text-sm";
const ugx = (n: number | null) => (n === null ? "—" : `UGX ${n.toLocaleString()}`);
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

const emptyContract = { title: "", starts_on: "", ends_on: "", value_ugx: "", notes: "" };

export default function ResidentRecordPage() {
  const { id = "" } = useParams();
  const { isLeadership, canSeeFinance, has } = useMyRoles();
  const canManageContracts = isLeadership || canSeeFinance || has("legal");

  const [loading, setLoading] = useState(true);
  const [resident, setResident] = useState<ResidentRecord | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [form, setForm] = useState(emptyContract);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [{ data: res }, { data: team }, { data: content }, { data: sd }, { data: cts }] = await Promise.all([
      supabase.rpc("resident_records"),
      supabase.from("team_members").select("user_id, display_name, email, title"),
      supabase
        .from("content_items")
        .select("id, ref_no, title, content_type, stage, created_at, posted_at, posted_links, shoot_at")
        .eq("resident_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("shoot_days")
        .select("id, status, shoot_date, location, call_time")
        .eq("resident_id", id)
        .order("shoot_date", { ascending: false }),
      supabase.from("resident_contracts").select("*").eq("resident_id", id).order("created_at", { ascending: false }),
    ]);
    const r = ((res as unknown as ResidentRecord[]) ?? []).find((x) => x.id === id) ?? null;
    setResident(r);
    setNotes(r?.notes ?? "");
    setMembers((team as unknown as Member[]) ?? []);
    setItems((content as unknown as Item[]) ?? []);
    setDays((sd as unknown as Day[]) ?? []);
    setContracts((cts as unknown as Contract[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const nameOf = (uid: string | null) => {
    if (!uid) return "Nobody yet";
    const m = members.find((x) => x.user_id === uid);
    return m?.display_name || m?.email || "Unknown";
  };

  const live = useMemo(() => items.filter((i) => LIVE_STAGES.includes(i.stage)), [items]);
  const archive = useMemo(() => items.filter((i) => !LIVE_STAGES.includes(i.stage)), [items]);
  const active = contracts.filter((c) => c.status === "active");
  const past = contracts.filter((c) => c.status !== "active");

  const saveNotes = async () => {
    setSavingNotes(true);
    const { error } = await supabase.rpc("set_resident_notes", { _resident_id: id, _notes: notes });
    setSavingNotes(false);
    if (error) return toast.error(error.message);
    toast.success("Notes saved");
  };

  const uploadLogo = async (f: File) => {
    setBusy(true);
    const clean = f.name.replace(/[^\w.\-]+/g, "-");
    const path = `${id}/${crypto.randomUUID()}-${clean}`;
    const { error: upErr } = await supabase.storage.from("client-logos").upload(path, f);
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const { error } = await supabase.rpc("set_resident_logo", { _resident_id: id, _path: path });
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (error) return toast.error(error.message);
    toast.success("Logo updated.");
    load();
  };

  const openFile = async (c: Contract) => {
    if (!c.file_path) return toast.error("No file was attached to this one.");
    const { data, error } = await supabase.storage.from("resident-contracts").createSignedUrl(c.file_path, 120);
    if (error || !data) return toast.error(error?.message ?? "Could not open that file.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const contractRow = (c: Contract) => (
    <li key={c.id} className="px-5 py-4 flex items-center gap-3 flex-wrap">
      <FileText className="h-4 w-4 text-ink-faint" />
      <span className="text-sm font-semibold">{c.title}</span>
      <StatusChip value={c.status} tone={c.status === "active" ? "teal" : "neutral"} />
      <span className="text-[11px] text-ink-faint num">
        {day(c.starts_on)} → {c.ends_on ? day(c.ends_on) : "open"}
      </span>
      <span className="num text-sm ml-auto">{ugx(c.value_ugx)}</span>
      {canManageContracts && c.file_path && (
        <Button size="sm" variant="outline" onClick={() => openFile(c)}>
          Open
        </Button>
      )}
    </li>
  );


  return (
    <AppShell eyebrow="Residents">
      <Seo
        title={`${resident?.name ?? "Resident"} — Site 99`}
        description="Everything on one resident."
        path={`/app/residents/${id}`}
        noindex
      />
      <Link to="/app/residents" className="press inline-flex items-center gap-2 text-xs text-ink-soft focus-ring mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> All residents
      </Link>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : !resident ? (
        <p className="text-sm text-ink-soft">That resident isn't here.</p>
      ) : (
        <>
          <PageHeader
            eyebrow={resident.territory ?? "Resident"}
            title={`${resident.name}.`}
            lede={`With us since ${resident.since ?? "—"} · ${items.length} pieces of content · ${
              active.length ? "contract active" : "no active contract"
            }`}
          />

          <div className="flex flex-wrap items-center gap-4 mb-8">
            <span className="h-16 w-16 rounded-2xl surface-sunken overflow-hidden flex items-center justify-center shrink-0">
              {logo ? (
                <img src={logo} alt={`${resident.name} logo`} className="h-full w-full object-contain" />
              ) : (
                <span className="display text-base text-ink-soft">{initials(resident.name)}</span>
              )}
            </span>
            {isAdmin && (
              <label className="text-xs text-ink-soft">
                <span className="eyebrow text-[10px] text-ink-faint block">
                  {logo ? "Replace the logo" : "Add a logo"}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  disabled={busy}
                  className="text-xs mt-1 block"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadLogo(f);
                  }}
                />
              </label>
            )}
            <Link to={`/app/residents/${id}/strategy`} className="focus-ring rounded-full">
              <Button size="sm" className="gap-2">
                <Target className="h-4 w-4" /> Strategy, goals & targets
              </Button>
            </Link>
            <span className="text-[11px] text-ink-faint">Set what we're aiming for and map how the work flows.</span>
          </div>


          <SectionHeading index="00" title="Overview" />
          <div className="surface rounded-2xl p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <div className="eyebrow text-[10px] text-ink-faint">Status</div>
              <div className="mt-1">
                <StatusChip value={resident.status ?? "—"} tone={resident.status === "active" ? "teal" : "neutral"} />
              </div>
            </div>
            <div>
              <div className="eyebrow text-[10px] text-ink-faint">Contact person</div>
              <div className="mt-1">{nameOf(resident.contact_user_id)}</div>
            </div>
            <div>
              <div className="eyebrow text-[10px] text-ink-faint">Handler</div>
              <div className="mt-1">{nameOf(resident.handler_user_id)}</div>
            </div>
            <div>
              <div className="eyebrow text-[10px] text-ink-faint">Portal</div>
              <div className="mt-1 truncate">{resident.email ?? "no email yet"}</div>
              <div className="text-[11px] text-ink-faint">{resident.user_id ? "signed up" : "not signed up yet"}</div>
            </div>
          </div>

          <div className="mt-14">
            <AccountsPanel residentId={id} showPending showNames={false} index="01" />
          </div>

          <div className="mt-14">
            <SectionHeading index="02" title="Content in motion" hint={`${live.length} moving`} />
            {live.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing in the pipeline right now.</p>
            ) : (
              <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
                {live.map((i) => (
                  <li key={i.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                    <span className="num text-[11px] text-ink-faint">{refCode(i.ref_no)}</span>
                    <span className="text-sm">{i.title}</span>
                    <span className="text-[11px] text-ink-faint">{i.content_type}</span>
                    <StatusChip value={i.stage} />
                    <span className="text-[11px] text-ink-faint hidden md:inline">
                      {STAGE_NOTE[i.stage as Stage] ?? ""}
                    </span>
                    <Link
                      to={`/app/content?ref=${i.ref_no}`}
                      className="press ml-auto text-xs underline underline-offset-4 focus-ring"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-14">
            <SectionHeading index="03" title="Archive" hint={`${archive.length} done`} />
            {archive.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing posted yet.</p>
            ) : (
              <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
                {archive.map((i) => (
                  <li key={i.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                    <span className="num text-[11px] text-ink-faint">{refCode(i.ref_no)}</span>
                    <span className="text-sm">{i.title}</span>
                    <span className="text-[11px] text-ink-faint">{i.content_type}</span>
                    <StatusChip value={i.stage} />
                    <span className="num text-[11px] text-ink-faint">{day(i.posted_at)}</span>
                    <span className="ml-auto flex items-center gap-3">
                      {(i.posted_links ?? []).slice(0, 3).map((l, n) => {
                        const url = l.split(": ").slice(1).join(": ") || l;
                        return (
                          <a
                            key={n}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] underline underline-offset-4"
                          >
                            {l.split(":")[0]}
                          </a>
                        );
                      })}
                      <Link to={`/app/content?ref=${i.ref_no}`} className="press text-xs underline underline-offset-4 focus-ring">
                        Open
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-14">
            <SectionHeading index="04" title="Shoot days" hint={`${days.length} in total`} />
            {days.length === 0 ? (
              <p className="text-sm text-ink-soft">No shoot days for this resident yet.</p>
            ) : (
              <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
                {days.map((d) => (
                  <li key={d.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                    <span className="num text-sm">{day(d.shoot_date)}</span>
                    <StatusChip value={d.status} />
                    {d.call_time && <span className="text-[11px] text-ink-faint num">call {d.call_time}</span>}
                    <span className="text-xs text-ink-soft truncate">{d.location ?? "—"}</span>
                    <Link to="/app/shoots" className="press ml-auto text-xs underline underline-offset-4 focus-ring">
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-14">
            <SectionHeading index="05" title="Contracts" hint={active.length ? "one active" : "none active"} />
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
              {active.map(contractRow)}
              {active.length === 0 && <li className="px-5 py-4 text-sm text-ink-soft">No active contract on file.</li>}
            </ul>

            {past.length > 0 && (
              <div className="mt-6">
                <div className="eyebrow text-[10px] text-ink-faint mb-2">Archived</div>
                <ul className="surface-sunken rounded-2xl overflow-hidden divide-y divide-rule">{past.map(contractRow)}</ul>
              </div>
            )}

            {canManageContracts && (
              <div className="surface rounded-2xl p-5 mt-6 space-y-4">
                <div className="eyebrow text-[10px] text-ink-faint">Add a contract</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="eyebrow text-[10px] text-ink-faint">What it is</label>
                    <input
                      className={`${field} mt-1`}
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Retainer 2026"
                    />
                  </div>
                  <div>
                    <label className="eyebrow text-[10px] text-ink-faint">Starts</label>
                    <input
                      type="date"
                      className={`${field} mt-1`}
                      value={form.starts_on}
                      onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="eyebrow text-[10px] text-ink-faint">Ends</label>
                    <input
                      type="date"
                      className={`${field} mt-1`}
                      value={form.ends_on}
                      onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="eyebrow text-[10px] text-ink-faint">Value (UGX)</label>
                    <input
                      className={`${field} mt-1 num`}
                      inputMode="numeric"
                      value={form.value_ugx}
                      onChange={(e) => setForm({ ...form, value_ugx: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="eyebrow text-[10px] text-ink-faint">Notes</label>
                    <input
                      className={`${field} mt-1`}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={fileRef}
                    type="file"
                    className="text-xs"
                    accept=".pdf,.doc,.docx,image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <Button onClick={addContract} disabled={busy}>
                    <Upload className="h-4 w-4" /> {busy ? "Saving…" : "Save contract"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {(canSeeFinance || isLeadership) && (
            <div className="mt-14">
              <ClientPayPanel residentId={id} index="06" />
            </div>
          )}

          <div className="mt-14">
            <SectionHeading index="07" title="Notes" hint="Internal only" />
            <div className="surface rounded-2xl p-5 space-y-3">
              <textarea
                rows={4}
                className={field}
                value={notes}
                disabled={!isLeadership}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the team should know about this resident."
              />
              {isLeadership && (
                <Button onClick={saveNotes} disabled={savingNotes}>
                  {savingNotes ? "Saving…" : "Save notes"}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
