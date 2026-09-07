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
