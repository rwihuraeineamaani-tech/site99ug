import { useState } from "react";
import FinancePage from "@/components/finance/FinancePage";
import RequestsPanel from "@/components/finance/RequestsPanel";

export default function FinanceRequests() {
  const [, setTick] = useState(0);
  return (
    <FinancePage
      title="Requests."
      lede="Ask for money, and follow it through approval to payment."
      path="/app/finance/requests"
    >
      <RequestsPanel onChanged={() => setTick((t) => t + 1)} />
    </FinancePage>
  );
}
