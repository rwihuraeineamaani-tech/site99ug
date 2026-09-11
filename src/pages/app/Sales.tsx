import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarPlus, Check, ChevronRight, Download, FileText, Plus, Printer, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AdminShell from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Money, SectionHeading, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import { SALES_STAGES, STAGE_LABEL, csvDownload, isFollowupLate, moveOpportunity, onboardOpportunity, weightedValue, type Opportunity, type SalesActivity, type SalesAssignment, type SalesFollowup, type SalesOffer, type SalesPackage, type SalesStage } from "@/lib/sales";

type Tab = "overview" | "pipeline" | "opportunities" | "offers" | "partnerships" | "reports";
type Resident = { id: string; name: string };
type Person = { user_id: string; display_name: string | null; email: string };
const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" }, { key: "pipeline", label: "Pipeline" },
  { key: "opportunities", label: "Opportunities" }, { key: "offers", label: "Offers" },
  { key: "partnerships", label: "Partnerships" }, { key: "reports", label: "Forecast & reports" },
];
const field = "field text-sm";
const blank = { journey: "new_client", organisation_name: "", contact_name: "", contact_email: "", contact_phone: "", source: "", service: "", resident_id: "", value_ugx: "", probability: "10", expected_close: "", next_action: "", next_action_at: "" };

export default function SalesPage() {
  const [params, setParams] = useSearchParams();
  const { userId } = useMyRoles();
  const tab = (params.get("tab") as Tab) || "overview";
  const selectedId = params.get("opportunity");
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [offers, setOffers] = useState<SalesOffer[]>([]);
  const [followups, setFollowups] = useState<SalesFollowup[]>([]);
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [assignments, setAssignments] = useState<SalesAssignment[]>([]);
  const [packages, setPackages] = useState<SalesPackage[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"board" | "list">(() => localStorage.getItem("site99:sales-view") === "list" ? "list" : "board");

  const load = useCallback(async () => {
    const [op, of, fu, ac, as, pa, rs, tm] = await Promise.all([
      supabase.from("sales_opportunities").select("*").order("updated_at", { ascending: false }),
      supabase.from("sales_offers").select("*").order("created_at", { ascending: false }),
      supabase.from("sales_followups").select("*").order("due_at"),
      supabase.from("sales_activities").select("*").order("occurred_at", { ascending: false }),
      supabase.from("sales_assignments").select("*"),
      supabase.from("sales_packages").select("*").order("name"),
      supabase.from("residents").select("id,name").order("name"),
      supabase.from("team_members").select("user_id,display_name,email").order("display_name"),
    ]);
    setRows((op.data as Opportunity[]) ?? []); setOffers((of.data as SalesOffer[]) ?? []);
    setFollowups((fu.data as SalesFollowup[]) ?? []); setActivities((ac.data as SalesActivity[]) ?? []);
    setAssignments((as.data as SalesAssignment[]) ?? []); setPackages((pa.data as SalesPackage[]) ?? []);
    setResidents((rs.data as Resident[]) ?? []); setPeople((tm.data as Person[]) ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { localStorage.setItem("site99:sales-view", view); }, [view]);

  const selected = rows.find((o) => o.id === selectedId) ?? null;
  const open = rows.filter((o) => o.status === "open");
  const pipeline = open.reduce((n, o) => n + o.value_ugx, 0);
  const weighted = open.reduce((n, o) => n + weightedValue(o), 0);
  const won = rows.filter((o) => o.status === "won");
  const closed = rows.filter((o) => o.status !== "open");
  const late = followups.filter((f) => f.status === "open" && isFollowupLate(f.due_at));
  const ownerName = (id: string) => people.find((p) => p.user_id === id)?.display_name || people.find((p) => p.user_id === id)?.email || "Unassigned";

  const createOpportunity = async () => {
    if (!draft.organisation_name.trim() || !draft.next_action.trim() || !draft.next_action_at) return toast.error("Organisation, next action and its time are required.");
    setBusy(true);
    const { data, error } = await supabase.from("sales_opportunities").insert({
      ...draft, resident_id: draft.resident_id || null, value_ugx: Number(draft.value_ugx || 0), probability: Number(draft.probability),
      expected_close: draft.expected_close || null, owner_user_id: userId,
    }).select("id").single();
    setBusy(false); if (error || !data) return toast.error(error?.message ?? "Could not create opportunity.");
    setDraft(blank); setShowNew(false); toast.success("Opportunity added to the pipeline."); await load(); setParams({ tab: "opportunities", opportunity: data.id });
  };

  const changeStage = async (id: string, stage: SalesStage) => {
    let reason: string | undefined;
    if (stage === "lost") { reason = window.prompt("Why was this opportunity lost?") ?? undefined; if (!reason) return; }
    const { error } = await moveOpportunity(id, stage, reason); if (error) return toast.error(error.message); toast.success(`Moved to ${STAGE_LABEL[stage]}.`); load();
  };

  const addFollowup = async (op: Opportunity) => {
    const title = window.prompt("What is the next follow-up?", op.next_action); if (!title) return;
    const when = window.prompt("When? Use YYYY-MM-DD HH:MM", op.next_action_at.slice(0, 16).replace("T", " ")); if (!when) return;
    const due = new Date(when.replace(" ", "T") + ":00+03:00"); if (Number.isNaN(due.getTime())) return toast.error("Use a valid date and time.");
    const { error } = await supabase.from("sales_followups").insert({ opportunity_id: op.id, assigned_user_id: op.owner_user_id, title, due_at: due.toISOString(), created_by: userId });
    if (error) return toast.error(error.message); toast.success("Follow-up added."); load();
  };

  const addToCalendar = async (f: SalesFollowup) => {
    const start = new Date(f.due_at); const end = new Date(start.getTime() + 30 * 60_000);
    const { data, error } = await supabase.from("calendar_items").insert({ owner_user_id: f.assigned_user_id, title: f.title, all_day: false, start_date: start.toLocaleDateString("en-CA", { timeZone: "Africa/Kampala" }), end_date: start.toLocaleDateString("en-CA", { timeZone: "Africa/Kampala" }), start_time: start.toLocaleTimeString("en-GB", { timeZone: "Africa/Kampala", hour: "2-digit", minute: "2-digit" }), end_time: end.toLocaleTimeString("en-GB", { timeZone: "Africa/Kampala", hour: "2-digit", minute: "2-digit" }), visibility: "private", strictness: "warn", reminder_minutes: 30, work_kind: "sales", work_id: f.opportunity_id, work_label: "Sales follow-up", work_path: `/app/sales?tab=opportunities&opportunity=${f.opportunity_id}` }).select("id").single();
    if (error || !data) return toast.error(error?.message ?? "Could not add to Calendar.");
    await supabase.from("sales_followups").update({ calendar_item_id: data.id }).eq("id", f.id); toast.success("Added to your Calendar."); load();
  };

  const createOffer = async (op: Opportunity) => {
    const title = window.prompt("Offer title", `${op.organisation_name} proposal`); if (!title) return;
    const kind = window.prompt("Type: quote, estimate, proposal, or rate_card", "proposal"); if (!kind || !["quote", "estimate", "proposal", "rate_card"].includes(kind)) return toast.error("Choose a valid offer type.");
    const subtotal = op.value_ugx; const vat = Math.round(subtotal * .18);
    const { error } = await supabase.from("sales_offers").insert({ opportunity_id: op.id, kind, title, subtotal_ugx: subtotal, vat_rate: .18, vat_ugx: vat, total_ugx: subtotal + vat, valid_until: op.expected_close, created_by: userId });
    if (error) return toast.error(error.message); toast.success("Offer draft created."); load(); setParams({ tab: "offers" });
  };

  const submitOffer = async (id: string) => { const { error } = await supabase.rpc("sales_submit_offer", { _offer_id: id }); if (error) return toast.error(error.message); toast.success("Sent for Founder approval."); load(); };
  const onboard = async (id: string) => { const { data, error } = await onboardOpportunity(id); if (error) return toast.error(error.message); toast.success("Resident onboarding started."); window.location.assign(`/app/residents/${data}`); };
  const setTab = (key: string) => setParams({ tab: key });

  const card = (o: Opportunity) => <button key={o.id} onClick={() => setParams({ tab: "opportunities", opportunity: o.id })} className="w-full text-left surface rounded-lg p-4 press focus-ring hover:bg-paper-raised">
    <div className="flex gap-2 items-start"><div className="font-semibold flex-1">{o.organisation_name}</div>{o.resident_id && <StatusChip value="Resident" tone="violet" />}</div>
    <div className="mt-2 text-xs text-ink-soft">{o.service || o.journey.replace("_", " ")}</div>
    <div className="mt-4 flex items-end gap-3"><Money value={o.value_ugx} /><span className="ml-auto num text-xs text-ink-faint">{o.probability}%</span></div>
    <div className={`mt-3 text-xs ${new Date(o.next_action_at).getTime() < Date.now() ? "text-signal" : "text-ink-soft"}`}>{o.next_action} · {new Date(o.next_action_at).toLocaleDateString()}</div>
  </button>;

  return <AdminShell title="Sales." eyebrow="Commercial" nav={tabs.map((t) => ({ ...t, onClick: () => setTab(t.key) }))} active={tab} actions={<Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> New opportunity</Button>}>
    {showNew && <div className="surface rounded-lg p-5 mb-8"><div className="flex items-center"><h2 className="display text-xl">Capture an opportunity</h2><Button variant="ghost" size="icon" className="ml-auto" onClick={() => setShowNew(false)}><X className="h-4 w-4" /></Button></div><div className="grid gap-4 md:grid-cols-3 mt-5">
      <label className="text-xs">Journey<select className={field} value={draft.journey} onChange={(e) => setDraft({ ...draft, journey: e.target.value })}><option value="new_client">New client</option><option value="existing_growth">Existing Resident growth</option><option value="partnership">Partnership</option></select></label>
      <label className="text-xs md:col-span-2">Organisation<input className={field} value={draft.organisation_name} onChange={(e) => setDraft({ ...draft, organisation_name: e.target.value })} /></label>
      <label className="text-xs">Existing Resident<select className={field} value={draft.resident_id} onChange={(e) => setDraft({ ...draft, resident_id: e.target.value })}><option value="">New prospect</option>{residents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label className="text-xs">Contact name<input className={field} value={draft.contact_name} onChange={(e) => setDraft({ ...draft, contact_name: e.target.value })} /></label><label className="text-xs">Email<input className={field} type="email" value={draft.contact_email} onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })} /></label>
      <label className="text-xs">Service<input className={field} value={draft.service} onChange={(e) => setDraft({ ...draft, service: e.target.value })} /></label><label className="text-xs">Value (UGX)<input className={field} type="number" value={draft.value_ugx} onChange={(e) => setDraft({ ...draft, value_ugx: e.target.value })} /></label><label className="text-xs">Probability<input className={field} type="number" min="0" max="100" value={draft.probability} onChange={(e) => setDraft({ ...draft, probability: e.target.value })} /></label>
      <label className="text-xs md:col-span-2">Next action<input className={field} value={draft.next_action} onChange={(e) => setDraft({ ...draft, next_action: e.target.value })} /></label><label className="text-xs">Due<input className={field} type="datetime-local" value={draft.next_action_at} onChange={(e) => setDraft({ ...draft, next_action_at: e.target.value })} /></label>
    </div><Button className="mt-5" disabled={busy} onClick={createOpportunity}>Add to pipeline</Button></div>}
    {loading ? <p className="text-sm text-ink-soft">Loading…</p> : tab === "overview" ? <><div className="grid gap-4 md:grid-cols-4"><Metric label="Open pipeline" value={pipeline} money /><Metric label="Weighted forecast" value={weighted} money /><Metric label="Win rate" value={closed.length ? Math.round(won.length / closed.length * 100) : 0} suffix="%" /><Metric label="Late follow-ups" value={late.length} alert={late.length > 0} /></div><div className="grid gap-8 lg:grid-cols-2 mt-12"><section><SectionHeading index="01" title="Needs attention" hint={`${late.length} overdue`} />{late.length ? <div className="grid gap-3">{late.map((f) => { const o=rows.find((x)=>x.id===f.opportunity_id); return o ? <button key={f.id} onClick={()=>setParams({tab:"opportunities",opportunity:o.id})} className="surface rounded-lg p-4 text-left"><div className="text-sm font-semibold">{f.title}</div><div className="text-xs text-signal mt-1">{o.organisation_name} · {new Date(f.due_at).toLocaleString()}</div></button>:null; })}</div>:<p className="text-sm text-ink-soft">Nothing overdue.</p>}</section><section><SectionHeading index="02" title="Closest to closing" hint="weighted by probability" /><div className="grid gap-3">{open.sort((a,b)=>weightedValue(b)-weightedValue(a)).slice(0,5).map(card)}</div></section></div></> : tab === "pipeline" ? <><div className="flex justify-end mb-4 gap-2"><Button size="sm" variant={view==="board"?"default":"outline"} onClick={()=>setView("board")}>Board</Button><Button size="sm" variant={view==="list"?"default":"outline"} onClick={()=>setView("list")}>List</Button></div>{view==="board"?<div className="grid gap-4 xl:grid-cols-4">{SALES_STAGES.filter((s)=>!['won','lost'].includes(s)).map((stage)=><section key={stage} className="min-w-0"><div className="eyebrow mb-3">{STAGE_LABEL[stage]} · {rows.filter((o)=>o.stage===stage).length}</div><div className="grid gap-3">{rows.filter((o)=>o.stage===stage).map(card)}</div></section>)}</div>:<OpportunityList rows={rows} open={(id)=>setParams({tab:"opportunities",opportunity:id})} />}</> : tab === "opportunities" ? selected ? <OpportunityDetail opportunity={selected} offers={offers.filter((o)=>o.opportunity_id===selected.id)} followups={followups.filter((f)=>f.opportunity_id===selected.id)} activities={activities.filter((a)=>a.opportunity_id===selected.id)} assignments={assignments.filter((a)=>a.opportunity_id===selected.id)} residents={residents} people={people} ownerName={ownerName} changeStage={changeStage} addFollowup={addFollowup} addToCalendar={addToCalendar} createOffer={createOffer} onboard={onboard} reload={load} back={()=>setParams({tab:"opportunities"})} /> : <OpportunityList rows={rows} open={(id)=>setParams({tab:"opportunities",opportunity:id})} /> : tab === "offers" ? <Offers offers={offers} rows={rows} submit={submitOffer} /> : tab === "partnerships" ? <OpportunityList rows={rows.filter((o)=>o.journey==="partnership")} open={(id)=>setParams({tab:"opportunities",opportunity:id})} /> : <Reports rows={rows} packages={packages} exportCsv={()=>csvDownload(rows)} />}
  </AdminShell>;
}

function Metric({label,value,money,suffix,alert}:{label:string;value:number;money?:boolean;suffix?:string;alert?:boolean}) { return <div className="surface rounded-lg p-5"><div className="eyebrow text-ink-faint">{label}</div><div className={`display text-2xl mt-3 ${alert?"text-signal":""}`}>{money?<Money value={value}/>:<>{value.toLocaleString()}{suffix}</>}</div></div>; }
function OpportunityList({rows,open}:{rows:Opportunity[];open:(id:string)=>void}) { return <div className="surface rounded-lg overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b border-rule text-ink-faint"><th className="p-4">Opportunity</th><th className="p-4">Stage</th><th className="p-4">Value</th><th className="p-4">Next action</th><th></th></tr></thead><tbody>{rows.map((o)=><tr key={o.id} className="border-b border-rule last:border-0"><td className="p-4 font-semibold">{o.organisation_name}<div className="text-xs font-normal text-ink-faint">{o.service||o.journey.replace('_',' ')}</div></td><td className="p-4"><StatusChip value={STAGE_LABEL[o.stage]} /></td><td className="p-4"><Money value={o.value_ugx}/></td><td className="p-4 text-xs">{o.next_action}<div className="text-ink-faint">{new Date(o.next_action_at).toLocaleString()}</div></td><td className="p-4"><Button size="icon" variant="ghost" onClick={()=>open(o.id)}><ChevronRight className="h-4 w-4"/></Button></td></tr>)}</tbody></table>{!rows.length&&<p className="p-8 text-sm text-ink-soft">No opportunities here yet.</p>}</div>; }
function OpportunityDetail({opportunity:o,offers,followups,activities,assignments,residents,people,ownerName,changeStage,addFollowup,addToCalendar,createOffer,onboard,reload,back}:{opportunity:Opportunity;offers:SalesOffer[];followups:SalesFollowup[];activities:SalesActivity[];assignments:SalesAssignment[];residents:Resident[];people:Person[];ownerName:(id:string)=>string;changeStage:(id:string,s:SalesStage)=>void;addFollowup:(o:Opportunity)=>void;addToCalendar:(f:SalesFollowup)=>void;createOffer:(o:Opportunity)=>void;onboard:(id:string)=>void;reload:()=>void;back:()=>void}) { const assign=async(uid:string)=>{if(!uid)return;const{error}=await supabase.from("sales_assignments").upsert({opportunity_id:o.id,user_id:uid,assigned_by:o.owner_user_id},{onConflict:"opportunity_id,user_id"});if(error)return toast.error(error.message);toast.success("Collaborator assigned.");reload();}; return <><Button variant="ghost" size="sm" onClick={back}>← All opportunities</Button><div className="flex flex-wrap items-start gap-4 mt-5"><div><div className="eyebrow">{o.journey.replace('_',' ')}</div><h2 className="display text-3xl">{o.organisation_name}</h2><p className="text-sm text-ink-soft mt-2">{o.contact_name||"No contact"} · {o.contact_email||"No email"}</p></div><div className="ml-auto text-right"><Money value={o.value_ugx}/><div className="text-xs text-ink-faint">{o.probability}% probability · <Money value={weightedValue(o)}/> weighted</div></div></div><div className="mt-6 flex flex-wrap gap-2">{SALES_STAGES.map((s)=><Button key={s} size="sm" variant={o.stage===s?"default":"outline"} onClick={()=>changeStage(o.id,s)}>{STAGE_LABEL[s]}</Button>)}</div><div className="grid gap-8 lg:grid-cols-3 mt-10"><section><SectionHeading index="01" title="Commercial brief" /><div className="surface rounded-lg p-5 text-sm grid gap-4"><Fact label="Owner" value={ownerName(o.owner_user_id)}/><Fact label="Service" value={o.service}/><Fact label="Source" value={o.source}/><Fact label="Expected close" value={o.expected_close}/><Fact label="Next action" value={`${o.next_action} · ${new Date(o.next_action_at).toLocaleString()}`}/><Fact label="Resident" value={residents.find((r)=>r.id===o.resident_id)?.name}/></div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={()=>addFollowup(o)}><CalendarPlus className="h-4 w-4"/> Follow-up</Button><Button size="sm" variant="outline" onClick={()=>createOffer(o)}><FileText className="h-4 w-4"/> Draft offer</Button>{o.status==="won"&&!o.converted_resident_id&&<Button size="sm" onClick={()=>onboard(o.id)}><UserPlus className="h-4 w-4"/> Onboard Resident</Button>}{o.converted_resident_id&&<Link to={`/app/residents/${o.converted_resident_id}`}><Button size="sm">Open Resident</Button></Link>}</div></section><section><SectionHeading index="02" title="Follow-ups" /><div className="grid gap-3">{followups.map((f)=><div key={f.id} className="surface rounded-lg p-4"><div className="text-sm font-semibold">{f.title}</div><div className={`text-xs mt-1 ${isFollowupLate(f.due_at)&&f.status==='open'?"text-signal":"text-ink-faint"}`}>{new Date(f.due_at).toLocaleString()} · {f.status}</div>{f.status==='open'&&<div className="flex gap-2 mt-3"><Button size="sm" variant="outline" onClick={()=>addToCalendar(f)}><CalendarPlus className="h-3.5 w-3.5"/> Calendar</Button><Button size="sm" variant="outline" onClick={async()=>{await supabase.from('sales_followups').update({status:'done',completed_at:new Date().toISOString()}).eq('id',f.id);reload();}}><Check className="h-3.5 w-3.5"/> Done</Button></div>}</div>)}{!followups.length&&<p className="text-sm text-ink-soft">No follow-ups yet.</p>}</div><div className="mt-6"><label className="text-xs">Assign collaborator<select className={field} defaultValue="" onChange={(e)=>assign(e.target.value)}><option value="">Choose a person…</option>{people.filter((p)=>!assignments.some((a)=>a.user_id===p.user_id)).map((p)=><option key={p.user_id} value={p.user_id}>{p.display_name||p.email}</option>)}</select></label><div className="mt-2 text-xs text-ink-soft">{assignments.map((a)=>ownerName(a.user_id)).join(', ')||'No collaborators'}</div></div></section><section><SectionHeading index="03" title="Timeline" /><div className="border-l border-rule pl-5 grid gap-5">{activities.map((a)=><div key={a.id}><div className="text-sm font-semibold">{a.summary}</div><div className="text-xs text-ink-faint mt-1">{new Date(a.occurred_at).toLocaleString()}</div>{a.detail&&<p className="text-xs text-ink-soft mt-1">{a.detail}</p>}</div>)}{!activities.length&&<p className="text-sm text-ink-soft">Activity appears here as the opportunity moves.</p>}</div></section></div></>; }
function Fact({label,value}:{label:string;value:string|null|undefined}) { return <div><div className="eyebrow text-[10px] text-ink-faint">{label}</div><div className="mt-1">{value||"—"}</div></div>; }
function Offers({offers,rows,submit}:{offers:SalesOffer[];rows:Opportunity[];submit:(id:string)=>void}) { return <><SectionHeading index="01" title="Commercial documents" hint={`${offers.length} versions`} /><div className="grid gap-4 md:grid-cols-2">{offers.map((f)=><div key={f.id} className="surface rounded-lg p-5"><div className="flex items-start gap-2"><div><div className="eyebrow text-ink-faint">{f.kind.replace('_',' ')} · v{f.version}</div><div className="display text-lg mt-1">{f.title}</div><div className="text-xs text-ink-soft mt-1">{rows.find((o)=>o.id===f.opportunity_id)?.organisation_name}</div></div><StatusChip value={f.status} tone={f.status==='approved'||f.status==='accepted'?'teal':f.status==='changes_requested'||f.status==='declined'?'stop':'pending'} /></div><div className="mt-5 flex items-end"><Money value={f.total_ugx}/><span className="ml-auto text-xs text-ink-faint">VAT {Math.round(f.vat_rate*100)}%</span></div><div className="flex gap-2 mt-4">{['draft','changes_requested'].includes(f.status)&&<Button size="sm" onClick={()=>submit(f.id)}>Send for approval</Button>}<Button size="sm" variant="outline" onClick={()=>window.print()}><Printer className="h-4 w-4"/> PDF</Button></div></div>)}{!offers.length&&<p className="text-sm text-ink-soft">Create an offer from an opportunity.</p>}</div></>; }
function Reports({rows,packages,exportCsv}:{rows:Opportunity[];packages:SalesPackage[];exportCsv:()=>void}) { const byStage=SALES_STAGES.map((s)=>({stage:s,count:rows.filter((o)=>o.stage===s).length,value:rows.filter((o)=>o.stage===s).reduce((n,o)=>n+o.value_ugx,0)}));return <><div className="flex justify-end gap-2 print:hidden"><Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4"/> CSV</Button><Button size="sm" variant="outline" onClick={()=>window.print()}><Printer className="h-4 w-4"/> PDF</Button></div><SectionHeading index="01" title="Pipeline by stage" /><div className="surface rounded-lg divide-y divide-rule">{byStage.map((s)=><div key={s.stage} className="grid grid-cols-[1fr_auto_auto] gap-5 p-4 text-sm"><span>{STAGE_LABEL[s.stage]}</span><span className="num text-ink-soft">{s.count}</span><Money value={s.value}/></div>)}</div><div className="mt-12"><SectionHeading index="02" title="Rate cards & packages" hint={`${packages.filter((p)=>p.active).length} active`} />{packages.length?<div className="grid gap-4 md:grid-cols-3">{packages.map((p)=><div key={p.id} className="surface rounded-lg p-5"><div className="font-semibold">{p.name}</div><p className="text-xs text-ink-soft mt-2">{p.description||p.service}</p><div className="mt-5"><Money value={p.price_ugx}/></div></div>)}</div>:<p className="text-sm text-ink-soft">No packages have been added yet.</p>}</div></>; }