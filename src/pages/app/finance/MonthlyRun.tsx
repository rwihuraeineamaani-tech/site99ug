import { useState } from "react";
import FinancePage from "@/components/finance/FinancePage";
import MonthlyRunPanel from "@/components/finance/MonthlyRunPanel";

export default function FinanceMonthly() {
  const [, setTick] = useState(0);
  return (
    <FinancePage
      title="This month."
      lede="Salaries, retainers and repeat payments built into one run."
      path="/app/finance/monthly"
    >
      <MonthlyRunPanel onChanged={() => setTick((t) => t + 1)} />
    </FinancePage>
  );
}
