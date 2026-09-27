export const SOP_DEPARTMENTS = [
  { key: "content", label: "Content Pipeline", paths: ["/app/content"] },
  { key: "shoots", label: "Shoot days", paths: ["/app/shoots"] },
  { key: "residents", label: "Residents", paths: ["/app/residents"] },
  { key: "sales", label: "Sales", paths: ["/app/sales"] },
  { key: "finance", label: "Finance", paths: ["/app/finance"] },
  { key: "legal", label: "Legal", paths: ["/app/legal"] },
  { key: "talent", label: "Talent & Campaigns", paths: ["/app/talent"] },
  { key: "relations", label: "Client Relations", paths: ["/app/relations"] },
  { key: "communications", label: "Communications", paths: ["/app/briefs", "/app/announcements", "/app/chat"] },
  { key: "strategy", label: "Strategy", paths: ["/app/strategy"] },
  { key: "hr", label: "HR & KPIs", paths: ["/app/kpi"] },
  { key: "ops", label: "Operations", paths: ["/app/ops", "/app/equipment", "/app/work", "/app/todo"] },
  { key: "design", label: "Design & Brand", paths: ["/app/site"] },
  { key: "system", label: "System Administration", paths: ["/app/system-admin", "/app/approvals"] },
] as const;

export type SopDept = (typeof SOP_DEPARTMENTS)[number]["key"];

export const deptLabel = (k: string) => SOP_DEPARTMENTS.find((d) => d.key === k)?.label ?? k;

export function deptForPath(pathname: string): SopDept | null {
  for (const d of SOP_DEPARTMENTS) if (d.paths.some((p) => pathname.startsWith(p))) return d.key;
  return null;
}

export type SopStep = { title: string; who?: string; where?: string; output?: string; time?: string; detail?: string };
export type SopSections = {
  purpose?: string;
  scope?: string;
  when?: string;
  prerequisites?: string[];
  steps?: SopStep[];
  approvals?: string[];
  mistakes?: string[];
  escalation?: string;
  templates?: string[];
  related?: string[];
};

export type Sop = {
  id: string;
  department: string;
  title: string;
  summary: string | null;
  owner_role: string | null;
  status: "draft" | "published" | "archived";
  version: number;
  sections: SopSections;
  sort: number;
  updated_at: string;
  published_at: string | null;
};
