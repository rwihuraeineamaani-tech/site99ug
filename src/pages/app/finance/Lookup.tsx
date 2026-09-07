import FinancePage from "@/components/finance/FinancePage";
import LookupPanel from "@/components/finance/LookupPanel";

export default function FinanceLookup() {
  return (
    <FinancePage
      title="Look up."
      lede="Find any payment by reference, name, invoice or transaction id."
      path="/app/finance/lookup"
    >
      <LookupPanel />
    </FinancePage>
  );
}
