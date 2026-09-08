import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import StrategyPage from "@/components/strategy/StrategyPage";
import { SectionHeading, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useMyRoles } from "@/hooks/useMyRoles";
import {
  NODE_KINDS,
  NODE_TONE,
  REVIEW_LABEL,
  REVIEW_TONE,
  TEMPLATES,
  listMapVersions,
  loadStrategy,
  nodeKindLabel,
  reviewState,
  saveMapVersion,
  setReview,
  type MapEdge,
  type MapNode,
  type MapVersion,
  type NodeKind,
  type StrategyMap,
} from "@/lib/strategy";
import { History, Printer, Save, Send, Sparkles } from "lucide-react";

const field = "field text-sm";

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

export default function StrategyMapBuilder() {
  const { isStrategyTeam } = useMyRoles();
  const [params, setParams] = useSearchParams();
  const client = params.get("client") ?? "";

  const [residents, setResidents] = useState<{ id: string; name: string }[]>([]);
  const [map, setMap] = useState<StrategyMap | null>(null);
  const [versions, setVersions] = useState<MapVersion[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    supabase
      .from("residents")
      .select("id, name")
      .order("name")
      .then(({ data }) => setResidents((data as { id: string; name: string }[]) ?? []));
  }, []);

  const applyMap = (m: StrategyMap | null) => {
    setMap(m);
    setNotes(m?.notes ?? "");
    setNodes((m?.nodes ?? []).map(toFlow));
    setEdges((m?.edges ?? []).map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label, animated: true })));
    setDirty(false);
  };

  useEffect(() => {
    if (!client) {
      applyMap(null);
      setVersions([]);
      return;
    }
    (async () => {
      const [s, v] = await Promise.all([loadStrategy(client), listMapVersions(client)]);
      applyMap(s.map);
      setVersions(v);
    })();
  }, [client]);

  const onNodesChange = useCallback((c: NodeChange[]) => {
    setNodes((n) => applyNodeChanges(c, n));
    setDirty(true);
  }, []);
  const onEdgesChange = useCallback((c: EdgeChange[]) => {
    setEdges((e) => applyEdgeChanges(c, e));
    setDirty(true);
  }, []);
  const onConnect = useCallback((c: Connection) => {
    setEdges((e) => addEdge({ ...c, id: crypto.randomUUID(), animated: true }, e));
    setDirty(true);
  }, []);

  const addNode = (kind: NodeKind) => {
    const label = window.prompt(`${nodeKindLabel(kind)} — what is it?`);
    if (!label) return;
    setNodes((cur) => [
      ...cur,
      toFlow({ id: crypto.randomUUID(), label, kind, x: 80 + Math.random() * 320, y: 60 + Math.random() * 240 }),
    ]);
    setDirty(true);
  };

  const renameNode = (node: Node) => {
    const next = window.prompt("Change the wording", String((node.data as { label?: string }).label ?? ""));
    if (next === null) return;
    setNodes((cur) => cur.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, label: next } } : n)));
    setDirty(true);
  };

  const useTemplate = (key: string) => {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    if (nodes.length && !window.confirm("Replace what is on the canvas with this starter map?")) return;
    setNodes(t.nodes.map(toFlow));
    setEdges(t.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label, animated: true })));
    setDirty(true);
  };

  const currentPayload = () => {
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
    return { payloadNodes, payloadEdges };
  };

  const save = async (submit: boolean) => {
    if (!client) return toast.error("Pick a client first.");
    setBusy(true);
    const { payloadNodes, payloadEdges } = currentPayload();
    const row = {
      resident_id: client,
      title: map?.title ?? "Strategy map",
      nodes: payloadNodes as unknown as never,
      edges: payloadEdges as unknown as never,
      notes: notes || null,
      version: (map?.version ?? 0) + 1,
      review_state: submit ? "submitted" : "draft",
    };
    const { data, error } = map
      ? await supabase.from("strategy_maps").update(row).eq("id", map.id).select("*").maybeSingle()
      : await supabase.from("strategy_maps").insert(row).select("*").maybeSingle();
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    const saved = data as unknown as StrategyMap | null;
    try {
      await saveMapVersion(
        client,
        { id: saved?.id, title: row.title, nodes: payloadNodes, edges: payloadEdges, notes },
        submit
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
    if (saved) applyMap({ ...saved, nodes: payloadNodes, edges: payloadEdges });
    setVersions(await listMapVersions(client));
    toast.success(submit ? "Sent to the founders" : "Map saved");
  };

  const restore = (v: MapVersion) => {
    if (!window.confirm(`Bring version ${v.version} back onto the canvas?`)) return;
    setNodes(v.nodes.map(toFlow));
    setEdges(v.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label, animated: true })));
    setNotes(v.notes ?? "");
    setDirty(true);
    toast.success(`Version ${v.version} loaded — save it to keep it.`);
  };

  const state = reviewState(map?.review_state);
  const canEdit = isStrategyTeam;

  return (
    <StrategyPage
      title="Map builder."
      lede="Build the plan visually: pillars, formats, rhythm, who does it and what it should produce."
      path="/app/strategy/map"
      actions={
        <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-4 w-4" /> Print / PDF
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-3 mb-6 no-print">
        <select
          className={`${field} w-64`}
          value={client}
          onChange={(e) => setParams(e.target.value ? { client: e.target.value } : {})}
        >
          <option value="">Pick a client…</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {map && <StatusChip value={REVIEW_LABEL[state]} tone={REVIEW_TONE[state]} />}
        {map?.review_note && state === "changes_requested" && (
          <span className="text-[11px] text-ink-soft">“{map.review_note}”</span>
        )}
        {client && (
          <Button size="sm" variant="soft" onClick={() => setShowHistory((s) => !s)} className="gap-1.5 ml-auto">
            <History className="h-4 w-4" /> {versions.length} saved version{versions.length === 1 ? "" : "s"}
          </Button>
        )}
      </div>

      {!client ? (
        <p className="text-sm text-ink-soft">Choose a client above to open their map.</p>
      ) : (
        <>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
              {NODE_KINDS.map((k) => (
                <Button key={k.key} size="sm" variant="soft" onClick={() => addNode(k.key)} className="gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NODE_TONE[k.key] }} />
                  {k.label}
                </Button>
              ))}
              <Button size="sm" onClick={() => save(false)} disabled={busy || !dirty} className="gap-1.5 ml-auto">
                <Save className="h-4 w-4" /> {dirty ? "Save" : "Saved"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => save(true)} disabled={busy} className="gap-1.5">
                <Send className="h-4 w-4" /> Send for sign-off
              </Button>
            </div>
          )}

          <div className="surface rounded-2xl overflow-hidden" style={{ height: 620 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={canEdit ? onNodesChange : undefined}
              onEdgesChange={canEdit ? onEdgesChange : undefined}
              onConnect={canEdit ? onConnect : undefined}
              onNodeDoubleClick={canEdit ? (_, n) => renameNode(n) : undefined}
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

          {canEdit && nodes.length === 0 && (
            <div className="mt-4 no-print">
              <SectionHeading index="01" title="Start from a template" />
              <div className="grid gap-3 sm:grid-cols-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => useTemplate(t.key)}
                    className="press focus-ring surface rounded-2xl p-4 text-left"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="h-4 w-4 text-signal" /> {t.label}
                    </div>
                    <p className="mt-1 text-[11px] text-ink-soft">{t.blurb}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            className={`${field} mt-4 w-full min-h-24`}
            placeholder="The thinking behind this map"
            value={notes}
            readOnly={!canEdit}
            onChange={(e) => {
              setNotes(e.target.value);
              setDirty(true);
            }}
          />

          {showHistory && (
            <div className="mt-10 no-print">
              <SectionHeading index="02" title="Version history" hint="Newest first" />
              {versions.length === 0 ? (
                <p className="text-sm text-ink-soft">Nothing saved yet.</p>
              ) : (
                <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
                  {versions.map((v) => {
                    const vs = reviewState(v.review_state);
                    return (
                      <li key={v.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                        <span className="num text-sm">Version {v.version}</span>
                        <StatusChip value={REVIEW_LABEL[vs]} tone={REVIEW_TONE[vs]} />
                        <span className="text-[11px] text-ink-faint">{v.created_at.slice(0, 10)}</span>
                        <span className="text-[11px] text-ink-faint">
                          {v.nodes.length} boxes · {v.edges.length} links
                        </span>
                        {canEdit && (
                          <Button size="sm" variant="soft" className="ml-auto" onClick={() => restore(v)}>
                            Restore
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </StrategyPage>
  );
}
