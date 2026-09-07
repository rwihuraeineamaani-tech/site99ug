import { useState } from "react";
import FinancePage from "@/components/finance/FinancePage";
import LoansPanel from "@/components/finance/LoansPanel";

export default function FinanceLoans() {
  const [, setTick] = useState(0);
  return (
    <FinancePage
      title="Loans."
      lede="Money borrowed and money lent, with every repayment."
      path="/app/finance/loans"
    >
      <LoansPanel onChanged={() => setTick((t) => t + 1)} />
    </FinancePage>
  );
}
