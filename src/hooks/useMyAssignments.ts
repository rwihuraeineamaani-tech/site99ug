import { useMyRoles } from "@/hooks/useMyRoles";

export type MyAssignment = { resident_id: string; kind: "contact" | "handler" };

/** Clients this person is on — read from the one session load, never refetched per page. */
export function useMyAssignments() {
  const { assignments, loading } = useMyRoles();

  const isContact = (residentId: string | null | undefined) =>
    !!residentId && assignments.some((r) => r.resident_id === residentId && r.kind === "contact");
  const isHandler = (residentId: string | null | undefined) =>
    !!residentId && assignments.some((r) => r.resident_id === residentId && r.kind === "handler");

  return { assignments, loading, isContact, isHandler };
}

export default useMyAssignments;
