import { useState } from "react";
import FinancePage from "@/components/finance/FinancePage";
import PaymentBoardPanel from "@/components/finance/PaymentBoardPanel";

export default function FinancePayments() {
  const [, setTick] = useState(0);
  return (
    <FinancePage
      title="Payments."
      lede="What's approved and waiting to be paid, and what has already gone out."
      path="/app/finance/payments"
    >
      <PaymentBoardPanel onChanged={() => setTick((t) => t + 1)} />
    </FinancePage>
  );
}
