import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useMyRoles } from "@/hooks/useMyRoles";
import { todayISO } from "@/lib/deck";
import {
  GOAL_STATUSES,
  HEALTH_TONE,
  METRICS,
  NODE_KINDS,
  NODE_TONE,
  goalHealth,
  goalProgress,
  loadClientActuals,
  loadStrategy,
  metricLabel,
  metricUnit,
  monthLabel,
  monthOf,
  nodeKindLabel,
  type Goal,
  type MapEdge,
  type MapNode,
  type NodeKind,
  type StrategyMap,
  type Target,
  REVIEW_LABEL,
  REVIEW_TONE,
  ensurePlan,
  reviewState,
  setReview,
  type ClientPlan,
} from "@/lib/strategy";
import { ArrowLeft, Plus, Printer, Save, Trash2 } from "lucide-react";

const field = "field text-sm";
const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString());

const emptyGoal = { title: "", metric: "posted", start_value: "", target_value: "", due_on: "", notes: "" };

type Member = { user_id: string; display_name: string | null; email: string };

/** Small horizontal progress bar. */
function Bar({ value, tone = "signal" }: { value: number | null; tone?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-paper-sunken overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${Math.round((value ?? 0) * 100)}%`,
          backgroundColor: tone === "signal" ? "hsl(var(--signal))" : `hsl(var(--acc-${tone}))`,
        }}
      />
    </div>
  );
}

export default function ResidentStrategyPage() {
  const { id = "" } = useParams();
  const { isLeadership, assignments, userId, isStrategyTeam, canApproveStrategy } = useMyRoles();
  const [plan, setPlan] = useState<ClientPlan | null>(null);
  const canManage = isLeadership || assignments.some((a) => a.resident_id === id);

  const today = todayISO();
  const [month, setMonth] = useState(() => monthOf(today));
  const [loading, setLoading] = useState(true);
  const [residentName, setResidentName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [actuals, setActuals] = useState<Record<string, number>>({});
  const [map, setMap] = useState<StrategyMap | null>(null);
  const [busy, setBusy] = useState(false);

  const [gForm, setGForm] = useState(emptyGoal);
  const [tForm, setTForm] = useState({ metric: "posted", target_value: "" });

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [mapDirty, setMapDirty] = useState(false);
  const [mapNotes, setMapNotes] = useState("");

  const toFlow = (n: MapNode): Node => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: { label: n.detail ? `${n.label}\n${n.detail}` : n.label, kind: n.kind },
    style: {
      borderColor: NODE_TONE[n.kind],
      borderWidth: 2,
      borderRadius: 12,
      background: "hsl(var(--paper-raised, var(--paper)))",
      color: "hsl(var(--ink))",
      fontSize: 12,
      padding: 10,
      width: 180,
      whiteSpace: "pre-wrap",
    },
  });

  const load = async () => {
    const [{ data: res }, { data: team }, s, a] = await Promise.all([
      supabase.from("residents").select("id, name").eq("id", id).maybeSingle(),
      supabase.from("team_members").select("user_id, display_name, email"),
      loadStrategy(id),
      loadClientActuals(id, monthOf(today)),
    ]);
    setResidentName((res as { name?: string } | null)?.name ?? "Client");
    setMembers((team as unknown as Member[]) ?? []);
    setGoals(s.goals);
    setTargets(s.targets);
    setActuals(a);
    setMap(s.map);
    setPlan(await loadPlan(id));
    setMapNotes(s.map?.notes ?? "");
    setNodes((s.map?.nodes ?? []).map(toFlow));
    setEdges(
      (s.map?.edges ?? []).map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label, animated: true }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadClientActuals(id, month).then(setActuals);
  }, [id, month]);

  const nameOf = (uid: string | null) => {
    if (!uid) return "Unassigned";
    const m = members.find((x) => x.user_id === uid);
    return m?.display_name || m?.email || "Unknown";
  };

  /* ---------------- goals ---------------- */

  const addGoal = async () => {
    if (!gForm.title.trim()) return toast.error("Give the goal a name.");
    setBusy(true);
    const { error } = await supabase.from("client_goals").insert({
      resident_id: id,
      title: gForm.title.trim(),
      metric: gForm.metric,
      start_value: gForm.start_value ? Number(gForm.start_value) : null,
      target_value: gForm.target_value ? Number(gForm.target_value) : null,
      unit: metricUnit(gForm.metric) || null,
      due_on: gForm.due_on || null,
      owner_user_id: userId,
      notes: gForm.notes || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setGForm(emptyGoal);
    toast.success("Goal added");
    load();
  };

  const setGoalStatus = async (g: Goal, status: string) => {
    const { error } = await supabase.from("client_goals").update({ status }).eq("id", g.id);
    if (error) return toast.error(error.message);
    setGoals((rows) => rows.map((r) => (r.id === g.id ? { ...r, status } : r)));
  };

  const removeGoal = async (g: Goal) => {
    if (!window.confirm(`Remove "${g.title}"?`)) return;
    const { error } = await supabase.from("client_goals").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    setGoals((rows) => rows.filter((r) => r.id !== g.id));
  };

  /* ---------------- targets ---------------- */

  const monthTargets = useMemo(() => targets.filter((t) => t.month.slice(0, 7) === month.slice(0, 7)), [targets, month]);

  const saveTarget = async () => {
    const value = Number(tForm.target_value);
    if (!value) return toast.error("Put in a number to aim for.");
    setBusy(true);
    const existing = monthTargets.find((t) => t.metric === tForm.metric);
    const { error } = existing
      ? await supabase.from("client_targets").update({ target_value: value }).eq("id", existing.id)
      : await supabase.from("client_targets").insert({ resident_id: id, month, metric: tForm.metric, target_value: value });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTForm({ metric: "posted", target_value: "" });
    const s = await loadStrategy(id);
    setTargets(s.targets);
  };

  const removeTarget = async (t: Target) => {
    const { error } = await supabase.from("client_targets").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    setTargets((rows) => rows.filter((r) => r.id !== t.id));
  };

  /* ---------------- map ---------------- */

  const onNodesChange = useCallback((c: NodeChange[]) => {
    setNodes((n) => applyNodeChanges(c, n));
    setMapDirty(true);
  }, []);
  const onEdgesChange = useCallback((c: EdgeChange[]) => {
    setEdges((e) => applyEdgeChanges(c, e));
    setMapDirty(true);
  }, []);
  const onConnect = useCallback((c: Connection) => {
    setEdges((e) => addEdge({ ...c, id: crypto.randomUUID(), animated: true }, e));
    setMapDirty(true);
  }, []);

  const addNode = (kind: NodeKind) => {
    const label = window.prompt(`${nodeKindLabel(kind)} — what is it?`);
    if (!label) return;
    const n: MapNode = {
      id: crypto.randomUUID(),
      label,
      kind,
      x: 80 + Math.random() * 320,
      y: 60 + Math.random() * 240,
    };
    setNodes((cur) => [...cur, toFlow(n)]);
    setMapDirty(true);
  };

  const renameNode = (node: Node) => {
    const next = window.prompt("Change the wording", String((node.data as { label?: string }).label ?? ""));
    if (next === null) return;
    setNodes((cur) => cur.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, label: next } } : n)));
    setMapDirty(true);
  };

  const saveMap = async () => {
    setBusy(true);
    const payloadNodes: MapNode[] = nodes.map((n) => {
      const raw = String((n.data as { label?: string }).label ?? "");
      const [label, ...rest] = raw.split("\n");
      return {
        id: n.id,
        label,
        detail: rest.join("\n") || undefined,
        kind: ((n.data as { kind?: NodeKind }).kind ?? "pillar") as NodeKind,
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
      };
    });
    const payloadEdges: MapEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" ? e.label : undefined,
    }));

    const row = {
      resident_id: id,
      title: map?.title ?? "Strategy map",
      nodes: payloadNodes as unknown as never,
      edges: payloadEdges as unknown as never,
      notes: mapNotes || null,
      version: (map?.version ?? 0) + 1,
    };
    const { data, error } = map
      ? await supabase.from("strategy_maps").update(row).eq("id", map.id).select("id, version").maybeSingle()
      : await supabase.from("strategy_maps").insert(row).select("id, version").maybeSingle();
    setBusy(false);
    if (error) return toast.error(error.message);
    const saved = data as { id: string; version: number } | null;
    if (saved) setMap((m) => ({ ...(m ?? ({} as StrategyMap)), ...row, id: saved.id, version: saved.version } as StrategyMap));
    setMapDirty(false);
    toast.success("Map saved");
  };

  /* ---------------- render ---------------- */

  const scoreGoal = (g: Goal) => {
    const actual = g.metric === "custom" ? null : (actuals[g.metric] ?? null);
    const p = goalProgress(g, actual);
    return { actual, p, health: goalHealth(g, p, today) };
  };

  const activeGoals = goals.filter((g) => g.status === "active");
  const otherGoals = goals.filter((g) => g.status !== "active");

  return (
    <AppShell eyebrow="Residents">
      <Seo title={`${residentName} strategy — Site 99`} description="Goals, targets and the workflow map." path={`/app/residents/${id}/strategy`} noindex />

      <Link to={`/app/residents/${id}`} className="press inline-flex items-center gap-2 text-xs text-ink-soft focus-ring mb-4 no-print">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {residentName || "the client"}
      </Link>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <div id="strategy-print">
          <PageHeader
            eyebrow="Strategy"
            title={`${residentName}.`}
            lede={`${activeGoals.length} live goal${activeGoals.length === 1 ? "" : "s"} · ${monthTargets.length} target${
              monthTargets.length === 1 ? "" : "s"
            } for ${monthLabel(month)}`}
          />

          {/* ---------------- goals ---------------- */}
          <SectionHeading index="01" title="Goals" hint={`${goals.length} in total`} />
          {activeGoals.length === 0 && otherGoals.length === 0 ? (
            <p className="text-sm text-ink-soft">No goals set for this client yet.</p>
          ) : (
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
              {[...activeGoals, ...otherGoals].map((g) => {
                const { actual, p, health } = scoreGoal(g);
                return (
                  <li key={g.id} className="px-5 py-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-semibold">{g.title}</span>
                      <StatusChip value={g.status} tone={g.status === "hit" ? "lime" : g.status === "active" ? "teal" : "neutral"} />
                      {g.status === "active" && health !== "no date" && (
                        <StatusChip value={health} tone={HEALTH_TONE[health]} />
                      )}
                      <span className="text-[11px] text-ink-faint">{metricLabel(g.metric)}</span>
                      {g.due_on && <span className="num text-[11px] text-ink-faint">due {g.due_on}</span>}
                      <span className="num text-sm ml-auto">
                        {num(actual)} / {num(g.target_value)} {g.unit ?? ""}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Bar value={p} tone={health === "behind" ? "signal" : "lime"} />
                      <span className="num text-[11px] text-ink-faint w-10 text-right">
                        {p === null ? "—" : `${Math.round(p * 100)}%`}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-ink-faint">
                      <span>Owner: {nameOf(g.owner_user_id)}</span>
                      {g.notes && <span className="truncate">· {g.notes}</span>}
                      {canManage && (
                        <span className="ml-auto flex items-center gap-2 no-print">
                          <select
                            className={`${field} py-1 text-[11px]`}
                            value={g.status}
                            onChange={(e) => setGoalStatus(g, e.target.value)}
                          >
                            {GOAL_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <button onClick={() => removeGoal(g)} className="press focus-ring text-ink-faint hover:text-signal" aria-label="Remove goal">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {canManage && (
            <div className="surface rounded-2xl p-5 mt-4 grid gap-3 sm:grid-cols-6 no-print">
              <input
                className={`${field} sm:col-span-2`}
                placeholder="What are we going for?"
                value={gForm.title}
                onChange={(e) => setGForm({ ...gForm, title: e.target.value })}
              />
              <select className={field} value={gForm.metric} onChange={(e) => setGForm({ ...gForm, metric: e.target.value })}>
                {METRICS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                className={field}
                inputMode="numeric"
                placeholder="Starting at"
                value={gForm.start_value}
                onChange={(e) => setGForm({ ...gForm, start_value: e.target.value })}
              />
              <input
                className={field}
                inputMode="numeric"
                placeholder="Target"
                value={gForm.target_value}
                onChange={(e) => setGForm({ ...gForm, target_value: e.target.value })}
              />
              <input className={field} type="date" value={gForm.due_on} onChange={(e) => setGForm({ ...gForm, due_on: e.target.value })} />
              <input
                className={`${field} sm:col-span-5`}
                placeholder="Anything worth noting"
                value={gForm.notes}
                onChange={(e) => setGForm({ ...gForm, notes: e.target.value })}
              />
              <Button onClick={addGoal} disabled={busy} className="gap-2">
                <Plus className="h-4 w-4" /> Add goal
              </Button>
            </div>
          )}

          {/* ---------------- targets ---------------- */}
          <div className="mt-14">
            <SectionHeading index="02" title="Monthly targets" hint={monthLabel(month)} />
            <div className="flex items-center gap-3 mb-4 no-print">
              <input
                className={`${field} w-44`}
                type="month"
                value={month.slice(0, 7)}
                onChange={(e) => setMonth(`${e.target.value}-01`)}
              />
              <span className="text-[11px] text-ink-faint">Actuals are this client's real numbers for the month shown.</span>
            </div>

            {monthTargets.length === 0 ? (
              <p className="text-sm text-ink-soft">No targets set for {monthLabel(month)}.</p>
            ) : (
              <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
                {monthTargets.map((t) => {
                  const actual = actuals[t.metric] ?? 0;
                  const p = t.target_value ? Math.min(1, actual / t.target_value) : null;
                  return (
                    <li key={t.id} className="px-5 py-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold">{metricLabel(t.metric)}</span>
                        <span className="num text-sm ml-auto">
                          {num(actual)} / {num(t.target_value)}
                        </span>
                        {canManage && (
                          <button onClick={() => removeTarget(t)} className="press focus-ring text-ink-faint hover:text-signal no-print" aria-label="Remove target">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <Bar value={p} tone={p !== null && p >= 1 ? "lime" : "signal"} />
                        <span className="num text-[11px] text-ink-faint w-10 text-right">
                          {p === null ? "—" : `${Math.round(p * 100)}%`}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {canManage && (
              <div className="surface rounded-2xl p-5 mt-4 grid gap-3 sm:grid-cols-4 no-print">
                <select className={field} value={tForm.metric} onChange={(e) => setTForm({ ...tForm, metric: e.target.value })}>
                  {METRICS.filter((m) => m.key !== "custom").map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  className={field}
                  inputMode="numeric"
                  placeholder={`Target for ${monthLabel(month)}`}
                  value={tForm.target_value}
                  onChange={(e) => setTForm({ ...tForm, target_value: e.target.value })}
                />
                <Button onClick={saveTarget} disabled={busy} className="gap-2">
                  <Plus className="h-4 w-4" /> Set target
                </Button>
              </div>
            )}
          </div>

          {/* ---------------- map ---------------- */}
          <div className="mt-14">
            <SectionHeading index="03" title="Workflow map" hint={map ? `version ${map.version}` : "not started"} />
            {canManage && (
              <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
                {NODE_KINDS.map((k) => (
                  <Button key={k.key} size="sm" variant="soft" onClick={() => addNode(k.key)} className="gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NODE_TONE[k.key] }} />
                    {k.label}
                  </Button>
                ))}
                <Button size="sm" onClick={saveMap} disabled={busy || !mapDirty} className="gap-1.5 ml-auto">
                  <Save className="h-4 w-4" /> {mapDirty ? "Save map" : "Saved"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
                  <Printer className="h-4 w-4" /> Print / PDF
                </Button>
              </div>
            )}

            <div className="surface rounded-2xl overflow-hidden" style={{ height: 520 }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={canManage ? onNodesChange : undefined}
                onEdgesChange={canManage ? onEdgesChange : undefined}
                onConnect={canManage ? onConnect : undefined}
                onNodeDoubleClick={canManage ? (_, n) => renameNode(n) : undefined}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={22} color="hsl(var(--rule))" />
                <MiniMap
                  pannable
                  zoomable
                  className="no-print !bg-[hsl(var(--paper-sunken))] !border !border-rule !rounded-lg"
                  maskColor="hsl(var(--paper) / 0.7)"
                  nodeColor={(n) => NODE_TONE[((n.data as { kind?: NodeKind }).kind ?? "pillar") as NodeKind]}
                />
                <Controls className="no-print" />
              </ReactFlow>
            </div>

            {nodes.length === 0 && (
              <p className="mt-3 text-sm text-ink-soft">
                Empty for now. Add a content pillar, then a format and a posting rhythm, and drag from one box to the next to
                show how the work flows.
              </p>
            )}

            <textarea
              className={`${field} mt-4 w-full min-h-24`}
              placeholder="The thinking behind this map"
              value={mapNotes}
              readOnly={!canManage}
              onChange={(e) => {
                setMapNotes(e.target.value);
                setMapDirty(true);
              }}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
