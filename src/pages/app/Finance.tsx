import { useState } from "react";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import RequestsPanel from "@/components/finance/RequestsPanel";
import MonthlyRunPanel from "@/components/finance/MonthlyRunPanel";
import PaymentBoardPanel from "@/components/finance/PaymentBoardPanel";
import LoansPanel from "@/components/finance/LoansPanel";
import LookupPanel from "@/components/finance/LookupPanel";

type Tab = "requests" | "monthly" | "pay" | "loans" | "lookup";

export default function Finance() {
  const { canSeeFinance, isLeadership } = useMyRoles();
  const money = canSeeFinance || isLeadership;
  const [tab, setTab] = useState<Tab>("requests");
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "requests", label: "Requests", show: true },
    { id: "monthly", label: "This month", show: money },
    { id: "pay", label: "Payments", show: canSeeFinance },
    { id: "loans", label: "Loans", show: money },
    { id: "lookup", label: "Look up", show: money },
  ];

  return (
    <AppShell>
      <Seo
        title="Finance — Site 99"
        description="Cash requests, monthly payments, loans and every payment recorded."
        path="/app/finance"
        noindex
      />
      <PageHeader
        eyebrow="Finance"
        title="Finance."
        lede="Ask for money, approve it, pay it and find it again later — every step is recorded."
      />

      <div className="flex flex-wrap gap-2 mb-8">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`press rounded-full border px-4 py-2 text-xs font-semibold focus-ring ${
                tab === t.id ? "border-signal bg-signal text-paper" : "border-rule bg-paper-raised text-ink-soft"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "requests" && <RequestsPanel onChanged={refresh} />}
      {tab === "monthly" && <MonthlyRunPanel onChanged={refresh} />}
      {tab === "pay" && <PaymentBoardPanel onChanged={refresh} />}
      {tab === "loans" && <LoansPanel onChanged={refresh} />}
      {tab === "lookup" && <LookupPanel />}
    </AppShell>
  );
}
