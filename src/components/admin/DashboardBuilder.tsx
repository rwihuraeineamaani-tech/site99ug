import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, RotateCcw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionHeading, StatusChip } from "@/components/system";
import { ROLE_LABELS, TEAM_ROLES, type AppRole } from "@/hooks/useMyRoles";
import { PANELS, defaultLayoutFor, type PanelItem, type PanelKey } from "@/lib/dashboardPanels";

type Member = { user_id: string; display_name: string | null; email: string | null };

/** System admin tool: choose what each role, or one person, sees on their dashboard. */
export default function DashboardBuilder() {
  const [members, setMembers] = useState<Member[]>([]);
  const [scope, setScope] = useState<"role" | "user">("role");
  const [role, setRole] = useState<AppRole>(TEAM_ROLES[0] as AppRole);
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<PanelItem[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("team_members")
      .select("user_id, display_name, email")
      .order("display_name")
      .then(({ data }) => setMembers((data as Member[]) ?? []));
  }, []);

  const load = useCallback(async () => {
    const query = supabase.from("dashboard_layouts").select("panels").eq("scope", scope);
    const { data } = scope === "role" ? await query.eq("role", role).maybeSingle() : await query.eq("user_id", userId || "00000000-0000-0000-0000-000000000000").maybeSingle();
    const panels = Array.isArray(data?.panels) ? (data?.panels as PanelItem[]) : null;
    setSaved(Boolean(panels?.length));
    setItems(panels?.length ? panels : defaultLayoutFor(scope === "role" ? [role] : []));
  }, [scope, role, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (key: PanelKey) => {
    setItems((prev) => {
      if (prev.some((p) => p.key === key)) return prev.filter((p) => p.key !== key);
      const spec = PANELS.find((p) => p.key === key);
      return [...prev, { key, width: spec?.width ?? "full" }];
    });
  };

  const move = (index: number, by: number) => {
    setItems((prev) => {
      const next = [...prev];
      const to = index + by;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  const setWidth = (index: number, width: PanelItem["width"]) =>
    setItems((prev) => prev.map((p, i) => (i === index ? { ...p, width } : p)));

  const save = async () => {
    if (scope === "user" && !userId) return toast.error("Pick a person first.");
    if (!items.length) return toast.error("Choose at least one block.");
    setBusy(true);
    const row = {
      scope,
      role: scope === "role" ? role : null,
      user_id: scope === "user" ? userId : null,
      panels: items as unknown as object,
    };
    const target = supabase.from("dashboard_layouts").select("id").eq("scope", scope);
    const { data: existing } = scope === "role" ? await target.eq("role", role).maybeSingle() : await target.eq("user_id", userId).maybeSingle();
    const { error } = existing?.id
      ? await supabase.from("dashboard_layouts").update(row).eq("id", existing.id)
      : await supabase.from("dashboard_layouts").insert(row);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Dashboard saved.");
    load();
  };

  const reset = async () => {
    setBusy(true);
    const del = supabase.from("dashboard_layouts").delete().eq("scope", scope);
    const { error } = scope === "role" ? await del.eq("role", role) : await del.eq("user_id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Back to the built-in dashboard.");
    load();
  };

  const chosen = new Set(items.map((i) => i.key));

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading index="01" title="Whose dashboard" hint="A person's own setup wins over their role's" />
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            <span className="eyebrow text-ink-faint">Set up for</span>
            <select className="field text-sm mt-1 w-full" value={scope} onChange={(e) => setScope(e.target.value as "role" | "user")}>
              <option value="role">A role</option>
              <option value="user">One person</option>
            </select>
          </label>
          {scope === "role" ? (
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Role</span>
              <select className="field text-sm mt-1 w-full" value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
                {TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Person</span>
              <select className="field text-sm mt-1 w-full" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Choose someone…</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name || m.email || m.user_id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex items-end gap-2">
            <StatusChip value={saved ? "Custom setup" : "Built-in setup"} tone={saved ? "lime" : "neutral"} />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Blocks only ever show what the person is already allowed to see. Adding a block never opens up new access.
        </p>
      </section>

      <section>
        <SectionHeading index="02" title="Blocks to show" hint={`${items.length} chosen`} />
        <div className="grid gap-2 md:grid-cols-2">
          {PANELS.map((spec) => (
            <label key={spec.key} className="flex items-start gap-3 border border-rule rounded-md px-3 py-2.5 text-sm">
              <input type="checkbox" className="mt-1" checked={chosen.has(spec.key)} onChange={() => toggle(spec.key)} />
              <span>
                <strong>{spec.title}</strong>
                <span className="block text-xs text-ink-faint">{spec.hint}</span>
                {spec.roles.length > 0 && (
                  <span className="block text-[11px] text-ink-faint mt-1">
                    Only for: {spec.roles.map((r) => ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r).join(", ")}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading index="03" title="Order and size" hint="Top of the list shows first" />
        <ul className="divide-y divide-rule border-y border-rule">
          {items.map((item, i) => {
            const spec = PANELS.find((p) => p.key === item.key);
            return (
              <li key={item.key} className="py-3 flex flex-wrap items-center gap-3">
                <span className="num text-xs text-ink-faint w-6">{i + 1}</span>
                <strong className="text-sm">{spec?.title ?? item.key}</strong>
                <select
                  className="field text-xs"
                  value={item.width}
                  onChange={(e) => setWidth(i, e.target.value as PanelItem["width"])}
                >
                  <option value="column">Narrow column</option>
                  <option value="full">Full width</option>
                </select>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => move(i, -1)} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => move(i, 1)} aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
          {items.length === 0 && <li className="py-6 text-sm text-ink-soft">No blocks chosen yet.</li>}
        </ul>
        <div className="mt-4 flex gap-2">
          <Button onClick={save} disabled={busy}>
            <Save className="h-4 w-4 mr-2" /> Save dashboard
          </Button>
          <Button variant="ghost" onClick={reset} disabled={busy || !saved}>
            <RotateCcw className="h-4 w-4 mr-2" /> Use the built-in one
          </Button>
        </div>
      </section>
    </div>
  );
}
