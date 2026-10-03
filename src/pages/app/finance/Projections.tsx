import FinancePage from "@/components/finance/FinancePage";
import FinanceProjections from "@/components/finance/FinanceProjections";

export default function FinanceProjectionsPage() {
  return (
    <FinancePage title="Projections." lede="Cash, income and risk for the months ahead. Move the renewal slider to test what if." path="/app/finance/projections" gate={false}>
      <FinanceProjections />
    </FinancePage>
  );
}
