import DepartmentSoon from "./DepartmentSoon";

export function ClientRelations() {
  return (
    <DepartmentSoon
      eyebrow="Client relations"
      title="Client relations."
      lede="Every client record, contact and conversation in one place."
      path="/app/clients"
      coming={[
        "Client records: name, contact person, category and status",
        "Contact history and next follow-up",
        "Which contracts and content belong to each client",
        "Invited client logins into their own portal",
      ]}
      link={{ to: "/app/team", label: "Add clients and client logins for now" }}
    />
  );
}

export function Sales() {
  return (
    <DepartmentSoon
      eyebrow="Sales"
      title="Sales."
      lede="Pipeline from first conversation to signed deal."
      path="/app/sales"
      coming={[
        "Leads and prospects with owner and stage",
        "Proposals sent, value and expected close",
        "Won / lost with the reason recorded",
        "Monthly pipeline totals",
      ]}
    />
  );
}

export function LegalContracts() {
  return (
    <DepartmentSoon
      eyebrow="Legal, partnerships & contracts"
      title="Legal & contracts."
      lede="Contracts, partnership terms and the documents behind them."
      path="/app/legal"
      coming={[
        "Contract records: client, period, value and status",
        "Handler and contact splits, with Site 99's share calculated",
        "Signed document uploads kept private",
        "Renewal and expiry reminders",
      ]}
    />
  );
}

export function ManagementOps() {
  return (
    <DepartmentSoon
      eyebrow="Management & operations"
      title="Management & ops."
      lede="The whole business at a glance: people, workload and delivery."
      path="/app/ops"
      coming={[
        "Live view of clients and contracts by status",
        "Team roster and who is on what",
        "Delivery deadlines and days remaining",
        "Weekly operating report",
      ]}
      link={{ to: "/app/team", label: "Team & access" }}
    />
  );
}
