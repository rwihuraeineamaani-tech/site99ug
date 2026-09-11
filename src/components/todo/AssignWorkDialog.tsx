import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TASK_PRIORITIES, TASK_TYPES, type StaffPerson } from "@/lib/leadershipTasks";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const field = "field min-h-11 text-sm";
export default function AssignWorkDialog({ people, residents, onCreated }: { people: StaffPerson[]; residents: { id: string; name: string }[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [search, setSearch] = useState("");
  const [title, setTitle] = useState(""); const [instruction, setInstruction] = useState(""); const [type, setType] = useState("general");
  const [priority, setPriority] = useState("normal"); const [due, setDue] = useState(""); const [notes, setNotes] = useState("");
  const [resident, setResident] = useState(""); const [path, setPath] = useState(""); const [assignees, setAssignees] = useState<string[]>([]);
  const [written, setWritten] = useState(true); const [file, setFile] = useState(false); const [signoff, setSignoff] = useState(true);
  useEffect(() => { if (!open) setSearch(""); }, [open]);
  const visible = people.filter((p) => `${p.display_name} ${p.email} ${p.title}`.toLowerCase().includes(search.toLowerCase()));
  const submit = async () => {
    if (!title.trim() || !instruction.trim() || !assignees.length) return toast.error("Add a title, instruction, and at least one assignee.");
    setBusy(true);
    const { error } = await supabase.rpc("create_leadership_task", { _title: title, _instruction: instruction, _task_type: type, _priority: priority, _due_at: due ? new Date(due).toISOString() : null, _private_notes: notes, _assignee_ids: assignees, _resident_id: resident || null, _entity_type: null, _entity_id: null, _work_path: path || null, _require_written_update: written, _require_file_or_link: file, _require_signoff: signoff });
    setBusy(false); if (error) return toast.error(error.message);
    toast.success("Work assigned and the team notified."); setOpen(false); setTitle(""); setInstruction(""); setAssignees([]); setDue(""); setNotes(""); setPath(""); onCreated();
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="h-4 w-4" />Assign work</Button></DialogTrigger><DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto bg-paper-raised text-ink"><DialogHeader><DialogTitle>Assign work</DialogTitle><DialogDescription>Private to the assignees, assigning leader, and System Admin.</DialogDescription></DialogHeader>
    <div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2 text-xs text-ink-soft">Task title<input className={field} value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Call the client and give me a report" /></label><label className="sm:col-span-2 text-xs text-ink-soft">What needs to be done<textarea className={`${field} min-h-28`} value={instruction} onChange={(e)=>setInstruction(e.target.value)} placeholder="Give the person enough context to complete this properly." /></label>
      <label className="text-xs text-ink-soft">Type<select className={field} value={type} onChange={(e)=>setType(e.target.value)}>{TASK_TYPES.map((v)=><option key={v} value={v}>{v.split("_").join(" ")}</option>)}</select></label><label className="text-xs text-ink-soft">Priority<select className={field} value={priority} onChange={(e)=>setPriority(e.target.value)}>{TASK_PRIORITIES.map((v)=><option key={v} value={v}>{v}</option>)}</select></label>
      <label className="text-xs text-ink-soft">Due date and time<input className={field} type="datetime-local" value={due} onChange={(e)=>setDue(e.target.value)} /></label><label className="text-xs text-ink-soft">Resident / client<select className={field} value={resident} onChange={(e)=>setResident(e.target.value)}><option value="">None</option>{residents.map((r)=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label className="sm:col-span-2 text-xs text-ink-soft">Link to existing work<input className={field} value={path} onChange={(e)=>setPath(e.target.value)} placeholder="/app/legal/contracts or /app/sales?..." /></label><label className="sm:col-span-2 text-xs text-ink-soft">Private leadership notes<textarea className={`${field} min-h-20`} value={notes} onChange={(e)=>setNotes(e.target.value)} /></label>
      <div className="sm:col-span-2"><div className="mb-2 text-xs text-ink-soft">Assign to</div><div className="relative mb-2"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-faint"/><input className={`${field} pl-9`} value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Find a team member" /></div><div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border border-rule p-2 sm:grid-cols-2">{visible.map((p)=><label key={p.user_id} className="flex min-h-11 items-center gap-3 rounded px-2 text-sm hover:bg-paper-sunken"><Checkbox checked={assignees.includes(p.user_id)} onCheckedChange={(checked)=>setAssignees((cur)=>checked?[...cur,p.user_id]:cur.filter((id)=>id!==p.user_id))}/><span><span className="block font-medium">{p.display_name||p.email}</span><span className="block text-xs text-ink-faint">{p.title||"Team member"}</span></span></label>)}</div></div>
      <div className="sm:col-span-2 grid gap-2 rounded-md border border-rule p-3"><div className="text-xs font-semibold">Required before completion</div>{[[written,setWritten,"Written update"],[file,setFile,"File or link"],[signoff,setSignoff,"Leadership sign-off"]].map(([checked,setter,label])=><label key={String(label)} className="flex items-center gap-3 text-sm"><Checkbox checked={checked as boolean} onCheckedChange={(v)=>(setter as (v:boolean)=>void)(Boolean(v))}/>{String(label)}</label>)}</div>
    </div><DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={submit}>{busy?"Assigning…":"Assign and notify"}</Button></DialogFooter></DialogContent></Dialog>;
}