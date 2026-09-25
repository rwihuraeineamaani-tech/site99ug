import { useMyRoles } from "@/hooks/useMyRoles";

export type MyAssignment = { resident_id: string; kind: "contact" | "handler" };

/**
 * Clients this person is on. Each client has ONE Handler who is also the contact person,
 * so "contact" and "handler" checks are the same thing.
 */
export function useMyAssignments() {
  const { assignments, loading } = useMyRoles();

  const isHandler = (residentId: string | null | undefined) =>
    !!residentId && assignments.some((r) => r.resident_id === residentId);

  return { assignments, loading, isContact: isHandler, isHandler };
}

export default useMyAssignments;
