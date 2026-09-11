import { useCallback, useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type Edge, type EdgeChange, type Node, type NodeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { Activity, AlertTriangle, GitBranch, History, Plus, Save, Send, ShieldCheck } from "lucide-react";
import Seo from "@/components/Seo";
import AdminShell from "@/components/admin/AdminShell";
import TeamPanel from "@/components/admin/TeamPanel";
import StatCard from "@/components/admin/StatCard";
import { SectionHeading, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, TEAM_ROLES, type AppRole } from "@/hooks/useMyRoles";
import { DEFAULT_TEMPLATES, WORKFLOW_KINDS, loadAdminWorkflows, validateWorkflow, type Responsibility, type Workflow, type WorkflowEdge, type WorkflowNode, type WorkflowNodeKind, type WorkflowVersion } from "@/lib/adminWorkflows";

const tabs = ["people", "responsibilities", "workflows", "versions", "audit"] as const;
type Tab = typeof tabs[number];
type Member = { user_id: string; display_name: string | null; email: string | null; title: string | null };
const field = "field text-sm";
const nodeTone = (kind: WorkflowNodeKind) => WORKFLOW_KINDS.find((x) => x.key === kind)?.tone ?? "hsl(var(--ink-faint))";
const toFlow = (n: WorkflowNode): Node => ({ id: n.id, position: { x: n.x, y: n.y }, data: { label: n.label, kind: n.kind, config: n.config ?? {} }, style: { borderColor: nodeTone(n.kind), borderWidth: 2, borderRadius: 8, background: "hsl(var(--paper-raised))", color: "hsl(var(--ink))", width: 190, padding: 12, fontSize: 12 } });
const fromFlow = (n: Node): WorkflowNode => ({ id: n.id, kind: ((n.data as { kind?: WorkflowNodeKind }).kind ?? "approval"), label: String((n.data as { label?: string }).label ?? "Step"), x: Math.round(n.position.x), y: Math.round(n.position.y), config: (n.data as { config?: WorkflowNode["config"] }).config ?? {} });

export default function SystemAdmin() {
  const [tab, setTab] = useState<Tab>("people");
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof loadAdminWorkflows>>["audit"]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [delegations, setDelegations] = useState<Awaited<ReturnType<typeof loadAdminWorkflows>>["delegations"]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newResponsibility, setNewResponsibility] = useState({ department: "Finance", name: "", description: "", primary_user_id: "", primary_role: "" });

  const load = async () => {
    setLoading(true);
    try {
      const out = await loadAdminWorkflows();
      setWorkflows(out.workflows); setVersions(out.versions); setResponsibilities(out.responsibilities);
      setAudit(out.audit); setTeam(out.team); setDelegations(out.delegations);
      if (!selectedId && out.workflows[0]) setSelectedId(out.workflows[0].id);
    } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const selected = workflows.find((w) => w.id === selectedId) ?? null;
  const selectedVersions = useMemo(() => versions.filter((v) => v.workflow_id === selectedId), [versions, selectedId]);
  const editable = selectedVersions.find((v) => v.state === "draft") ?? selectedVersions[0] ?? null;
  useEffect(() => {
    setNodes((editable?.nodes ?? []).map(toFlow));
    setEdges((editable?.edges ?? []).map((e) => ({ ...e, animated: true })));
    setSelectedNode(null);
  }, [editable?.id]);

  const onNodesChange = useCallback((c: NodeChange[]) => setNodes((n) => applyNodeChanges(c, n)), []);
  const onEdgesChange = useCallback((c: EdgeChange[]) => setEdges((e) => applyEdgeChanges(c, e)), []);
  const onConnect = useCallback((c: Connection) => setEdges((e) => addEdge({ ...c, id: crypto.randomUUID(), animated: true, data: { route: "approved" } }, e)), []);
  const currentNode = nodes.find((n) => n.id === selectedNode);

  const addNode = (kind: WorkflowNodeKind) => {
    const spec = WORKFLOW_KINDS.find((k) => k.key === kind);
    const n: WorkflowNode = { id: crypto.randomUUID(), kind, label: spec?.label ?? "Step", x: 180 + (nodes.length % 3) * 240, y: 80 + Math.floor(nodes.length / 3) * 160, config: { sla_hours: 24, exclude_requester: true } };
    setNodes((cur) => [...cur, toFlow(n)]); setSelectedNode(n.id);
  };
  const patchNode = (patch: Record<string, unknown>) => setNodes((cur) => cur.map((n) => n.id === selectedNode ? { ...n, data: { ...n.data, ...patch } } : n));
  const patchConfig = (patch: Record<string, unknown>) => setNodes((cur) => cur.map((n) => n.id === selectedNode ? { ...n, data: { ...n.data, config: { ...((n.data as { config?: object }).config ?? {}), ...patch } } } : n));
  const payload = () => ({ payloadNodes: nodes.map(fromFlow), payloadEdges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: typeof e.label === "string" ? e.label : undefined, route: String((e.data as { route?: string } | undefined)?.route ?? "approved") })) as WorkflowEdge[] });

  const save = async () => {
    if (!selected) return;
    setBusy(true); const { payloadNodes, payloadEdges } = payload();
    const errors = validateWorkflow(payloadNodes, payloadEdges);
    const row = { workflow_id: selected.id, version: editable?.state === "draft" ? editable.version : Math.max(0, ...selectedVersions.map((v) => v.version)) + 1, state: "draft", nodes: payloadNodes as never, edges: payloadEdges as never, validation: { valid: !errors.length, errors } as never };
    const result = editable?.state === "draft"
      ? await supabase.from("approval_workflow_versions").update(row).eq("id", editable.id)
      : await supabase.from("approval_workflow_versions").insert(row);
    setBusy(false); if (result.error) return toast.error(result.error.message);
    toast.success(errors.length ? "Draft saved with checks to resolve" : "Draft saved and validated"); await load();
  };
  const publish = async () => {
    if (!selected || !editable || editable.state !== "draft") return toast.error("Save a draft first.");
    const errors = validateWorkflow(nodes.map(fromFlow), payload().payloadEdges);
    if (errors.length) return toast.error(errors[0]);
    setBusy(true); const { error } = await supabase.rpc("publish_approval_workflow", { _workflow_id: selected.id, _version_id: editable.id }); setBusy(false);
    if (error) return toast.error(error.message); toast.success("Workflow published. New approvals will use this version."); await load();
  };
  const applyTemplate = () => {
    if (!selected) return;
    const t = DEFAULT_TEMPLATES[selected.department.toLowerCase()] ?? DEFAULT_TEMPLATES.finance;
    setNodes(t.nodes.map(toFlow)); setEdges(t.edges.map((e) => ({ ...e, animated: true }))); toast.success("Starter workflow loaded");
  };
  const addResponsibility = async () => {
    if (!newResponsibility.name.trim()) return toast.error("Name the responsibility.");
    const workKey = `${newResponsibility.department.toLowerCase()}_${newResponsibility.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    const { error } = await supabase.from("responsibility_assignments").insert({ department: newResponsibility.department, work_key: workKey, name: newResponsibility.name.trim(), description: newResponsibility.description.trim() || null, primary_user_id: newResponsibility.primary_user_id || null, primary_role: (newResponsibility.primary_role || null) as never });
    if (error) return toast.error(error.message); setNewResponsibility({ department: "Finance", name: "", description: "", primary_user_id: "", primary_role: "" }); toast.success("Responsibility assigned"); await load();
  };
  const deleteResponsibility = async (id: string) => { if (!confirm("Remove this responsibility assignment?")) return; const { error } = await supabase.from("responsibility_assignments").delete().eq("id", id); if (error) toast.error(error.message); else await load(); };
  const nameOf = (id: string | null) => team.find((m) => m.user_id === id)?.display_name || team.find((m) => m.user_id === id)?.email || "Unassigned";
  const activeCount = workflows.filter((w) => w.current_version_id).length;
  const gaps = responsibilities.filter((r) => !r.primary_user_id && !r.primary_role).length;

  return <AdminShell eyebrow="System administration" title="Control centre." active={tab} nav={[
    { key: "people", label: "People & access", onClick: () => setTab("people") },
    { key: "responsibilities", label: "Responsibilities", badge: gaps, onClick: () => setTab("responsibilities") },
    { key: "workflows", label: "Workflow editor", onClick: () => setTab("workflows") },
    { key: "versions", label: "Versions & publishing", onClick: () => setTab("versions") },
    { key: "audit", label: "Audit & health", onClick: () => setTab("audit") },
  ]}>
    <Seo title="System administration — Site 99" description="People, responsibilities and approval workflow control." path="/app/system-admin" noindex />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-10"><StatCard label="Team members" value={team.length} hint="active staff records" /><StatCard label="Live workflows" value={`${activeCount}/${workflows.length}`} hint="published and controlling work" /><StatCard label="Responsibility gaps" value={gaps} hint={gaps ? "needs ownership" : "all covered"} /><StatCard label="Active cover" value={delegations.filter((d) => d.active && Date.parse(d.ends_at) > Date.now()).length} hint="temporary delegations" /></div>

    {loading ? <p className="text-sm text-ink-soft">Loading control centre…</p> : null}
    {!loading && tab === "people" && <><SectionHeading index="01" title="People & access" hint="System admin controlled" /><TeamPanel /></>}

    {!loading && tab === "responsibilities" && <div className="space-y-8">
      <section><SectionHeading index="01" title="Assign responsibility" hint="Primary owner and authority" /><div className="grid gap-3 md:grid-cols-5 items-end">
        <label className="text-xs text-ink-soft">Department<select className={`${field} mt-2`} value={newResponsibility.department} onChange={(e) => setNewResponsibility({ ...newResponsibility, department: e.target.value })}>{["Finance","Content","Strategy","Legal","Operations"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="text-xs text-ink-soft">Responsibility<input className={`${field} mt-2`} value={newResponsibility.name} onChange={(e) => setNewResponsibility({ ...newResponsibility, name: e.target.value })} /></label>
        <label className="text-xs text-ink-soft">Named owner<select className={`${field} mt-2`} value={newResponsibility.primary_user_id} onChange={(e) => setNewResponsibility({ ...newResponsibility, primary_user_id: e.target.value })}><option value="">None</option>{team.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m.user_id)}</option>)}</select></label>
        <label className="text-xs text-ink-soft">Or owning role<select className={`${field} mt-2`} value={newResponsibility.primary_role} onChange={(e) => setNewResponsibility({ ...newResponsibility, primary_role: e.target.value })}><option value="">None</option>{TEAM_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></label>
        <Button onClick={addResponsibility}><Plus /> Assign</Button>
      </div></section>
      <section><SectionHeading index="02" title="Responsibility matrix" hint={`${responsibilities.length} work areas`} /><div className="overflow-x-auto border-y border-rule"><table className="w-full text-sm"><thead><tr className="text-left eyebrow text-ink-faint"><th className="py-3 pr-4">Department</th><th className="py-3 pr-4">Work</th><th className="py-3 pr-4">Accountable</th><th className="py-3 pr-4">Backup</th><th className="py-3 pr-4">Authority</th><th /></tr></thead><tbody className="divide-y divide-rule">{responsibilities.map((r) => <tr key={r.id}><td className="py-4 pr-4"><StatusChip value={r.department} tone="neutral" /></td><td className="py-4 pr-4"><strong>{r.name}</strong><div className="text-xs text-ink-faint">{r.description}</div></td><td className="py-4 pr-4">{r.primary_user_id ? nameOf(r.primary_user_id) : r.primary_role ? ROLE_LABELS[r.primary_role as keyof typeof ROLE_LABELS] : <span className="text-state-stop">Gap</span>}</td><td className="py-4 pr-4">{r.backup_user_ids.length + r.backup_roles.length || "—"}</td><td className="py-4 pr-4">{r.approval_authority ? "Approver" : "Owner"}</td><td className="text-right"><Button size="sm" variant="ghost" onClick={() => deleteResponsibility(r.id)}>Remove</Button></td></tr>)}</tbody></table></div></section>
    </div>}

    {!loading && tab === "workflows" && <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center"><select className={`${field} max-w-sm`} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>{workflows.map((w) => <option key={w.id} value={w.id}>{w.department} · {w.name}</option>)}</select><StatusChip value={selected?.current_version_id ? "Published" : "Draft only"} tone={selected?.current_version_id ? "lime" : "amber"} /><Button variant="outline" size="sm" onClick={applyTemplate}><GitBranch /> Use starter</Button><Button size="sm" onClick={save} disabled={busy}><Save /> Save draft</Button><Button size="sm" variant="outline" onClick={publish} disabled={busy}><Send /> Publish</Button></div>
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]"><div className="surface overflow-hidden rounded-lg h-[620px]"><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, n) => setSelectedNode(n.id)} fitView proOptions={{ hideAttribution: true }}><Background gap={22} color="hsl(var(--rule))" /><MiniMap className="!bg-[hsl(var(--paper-sunken))] !border !border-rule" nodeColor={(n) => nodeTone(((n.data as { kind?: WorkflowNodeKind }).kind ?? "approval"))} /><Controls /></ReactFlow></div><aside className="border-l border-rule pl-4 space-y-5"><div><div className="eyebrow text-ink-faint mb-3">Add step</div><div className="grid grid-cols-2 gap-2">{WORKFLOW_KINDS.map((k) => <Button key={k.key} size="sm" variant="outline" onClick={() => addNode(k.key)}>{k.label}</Button>)}</div></div>{currentNode ? <div className="space-y-3"><div className="eyebrow text-ink-faint">Selected step</div><input className={field} value={String((currentNode.data as { label?: string }).label ?? "")} onChange={(e) => patchNode({ label: e.target.value })} /><select className={field} value={String((currentNode.data as { config?: { role?: string } }).config?.role ?? "")} onChange={(e) => patchConfig({ role: e.target.value || undefined })}><option value="">Approver role…</option>{TEAM_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select><label className="text-xs text-ink-soft">Deadline hours<input className={`${field} mt-1`} type="number" min="1" value={Number((currentNode.data as { config?: { sla_hours?: number } }).config?.sla_hours ?? 24)} onChange={(e) => patchConfig({ sla_hours: Number(e.target.value) })} /></label><label className="flex gap-2 text-xs"><input type="checkbox" checked={Boolean((currentNode.data as { config?: { exclude_requester?: boolean } }).config?.exclude_requester)} onChange={(e) => patchConfig({ exclude_requester: e.target.checked })} /> Requester cannot approve</label><label className="flex gap-2 text-xs"><input type="checkbox" checked={Boolean((currentNode.data as { config?: { distinct_actor?: boolean } }).config?.distinct_actor)} onChange={(e) => patchConfig({ distinct_actor: e.target.checked })} /> Require a different approver</label><Button variant="destructive" size="sm" onClick={() => { setNodes((x) => x.filter((n) => n.id !== currentNode.id)); setEdges((x) => x.filter((e) => e.source !== currentNode.id && e.target !== currentNode.id)); setSelectedNode(null); }}>Remove step</Button></div> : <p className="text-xs text-ink-soft">Select a step to set its owner and deadline.</p>}</aside></div>
      {(() => { const errors = validateWorkflow(nodes.map(fromFlow), payload().payloadEdges); return <div className="flex flex-wrap gap-2">{errors.length ? errors.map((e) => <span key={e} className="inline-flex items-center gap-1 text-xs text-state-warn"><AlertTriangle className="h-3.5 w-3.5" />{e}</span>) : <span className="inline-flex items-center gap-1 text-xs text-state-active"><ShieldCheck className="h-3.5 w-3.5" />Ready to publish</span>}</div>; })()}
    </div>}

    {!loading && tab === "versions" && <><SectionHeading index="01" title="Versions & publishing" hint="Drafts do not affect live work" /><div className="space-y-6">{workflows.map((w) => <section key={w.id} className="border-y border-rule py-5"><div className="flex items-center gap-3"><strong>{w.name}</strong><span className="text-xs text-ink-faint">{w.department}</span>{w.current_version_id ? <StatusChip value="Live" tone="lime" /> : <StatusChip value="Not published" tone="amber" />}</div><div className="mt-3 flex flex-wrap gap-2">{versions.filter((v) => v.workflow_id === w.id).map((v) => <div key={v.id} className="flex items-center gap-2 border border-rule rounded-md px-3 py-2 text-xs"><History className="h-3.5 w-3.5" /> v{v.version}<StatusChip value={v.state} tone={v.state === "published" ? "lime" : "neutral"} />{v.state === "draft" && <Button size="sm" variant="ghost" onClick={async () => { const errors = validateWorkflow(v.nodes, v.edges); if (errors.length) return toast.error(errors[0]); const { error } = await supabase.rpc("publish_approval_workflow", { _workflow_id: w.id, _version_id: v.id }); if (error) toast.error(error.message); else { toast.success("Published"); await load(); } }}>Publish</Button>}</div>)}</div></section>)}</div></>}

    {!loading && tab === "audit" && <><SectionHeading index="01" title="Audit & health" hint={`${audit.length} recent events`} /><div className="grid gap-3 md:grid-cols-3 mb-8"><StatCard label="Configuration" value={gaps ? "Needs attention" : "Healthy"} hint={`${gaps} ownership gaps`} /><StatCard label="Published" value={activeCount} hint="live workflows" /><StatCard label="Coverage" value={delegations.length} hint="delegation records" /></div><ul className="divide-y divide-rule border-y border-rule">{audit.length ? audit.map((a) => <li key={a.id} className="py-4 flex gap-3"><Activity className="h-4 w-4 text-signal mt-0.5" /><div className="flex-1"><div className="text-sm font-medium">{a.summary}</div><div className="text-xs text-ink-faint">{a.event_type.replace(/_/g, " ")} · {new Date(a.created_at).toLocaleString()}</div></div></li>) : <li className="py-8 text-sm text-ink-soft">The audit trail will appear as workflows are published and used.</li>}</ul></>}
  </AdminShell>;
}
