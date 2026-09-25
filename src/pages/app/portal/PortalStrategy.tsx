import { useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Controls, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage, { PortalCard, PortalEmpty } from "@/components/portal/PortalPage";
import { NODE_TONE, metricLabel, type Goal, type MapEdge, type MapNode } from "@/lib/strategy";

type Map = { title: string; notes: string | null; nodes: MapNode[]; edges: MapEdge[]; approved_at: string | null };

export default function PortalStrategy() {
  const { client, clientId, loading } = usePortalClient();
  const [map, setMap] = useState<Map | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const [m, g] = await Promise.all([
        supabase.from("strategy_maps").select("title, notes, nodes, edges, approved_at").eq("resident_id", clientId).eq("review_state", "approved").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("client_goals").select("*").eq("resident_id", clientId).order("sort"),
      ]);
      const raw = m.data as unknown as (Omit<Map, "nodes" | "edges"> & { nodes: unknown; edges: unknown }) | null;
      setMap(raw ? { ...raw, nodes: (Array.isArray(raw.nodes) ? raw.nodes : []) as MapNode[], edges: (Array.isArray(raw.edges) ? raw.edges : []) as MapEdge[] } : null);
      setGoals((g.data as unknown as Goal[]) ?? []);
      setReady(true);
    })();
  }, [clientId]);

  const nodes: Node[] = useMemo(() => (map?.nodes ?? []).map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: { label: n.detail ? `${n.label}\n${n.detail}` : n.label },
    draggable: false,
    selectable: false,
    connectable: false,
    style: { borderColor: NODE_TONE[n.kind], borderWidth: 2, borderRadius: 12, background: "hsl(var(--paper-raised, var(--paper)))", color: "hsl(var(--ink))", fontSize: 12, whiteSpace: "pre-line" },
  })), [map]);
  const edges: Edge[] = useMemo(() => (map?.edges ?? []).map((e) => ({ ...e, selectable: false })), [map]);

  return (
    <PortalPage title="Your strategy" lede="The plan we agreed for your content. You can view it here; talk to us in Chat to change anything." client={client} loading={loading}>
      <PortalCard title={map?.title ?? "Strategy map"} hint={map?.approved_at ? `Approved ${new Date(map.approved_at).toLocaleDateString("en-GB")}` : undefined}>
        {!ready ? <PortalEmpty>Loading…</PortalEmpty> : !map || map.nodes.length === 0 ? (
          <PortalEmpty>Your strategy is being prepared.</PortalEmpty>
        ) : (
          <>
            <div className="h-[420px] overflow-hidden rounded-xl border border-hairline md:h-[520px]">
              <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} edgesFocusable={false} nodesFocusable={false} deleteKeyCode={null} proOptions={{ hideAttribution: true }}>
                <Background />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
            {map.notes && <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{map.notes}</p>}
          </>
        )}
      </PortalCard>
      <div className="mt-6">
        <PortalCard title="Goals" hint={`${goals.length}`}>
          {goals.length === 0 ? <PortalEmpty>No goals set yet.</PortalEmpty> : (
            <ul className="space-y-2">
              {goals.map((g) => (
                <li key={g.id} className="rounded-xl border border-hairline px-3 py-2">
                  <div className="text-sm">{g.title}</div>
                  <div className="mt-1 text-xs text-ink-faint">
                    {metricLabel(g.metric)}{g.target_value != null ? ` · target ${g.target_value.toLocaleString()} ${g.unit ?? ""}` : ""}{g.due_on ? ` · by ${new Date(g.due_on).toLocaleDateString("en-GB")}` : ""} · {g.status}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>
    </PortalPage>
  );
}
