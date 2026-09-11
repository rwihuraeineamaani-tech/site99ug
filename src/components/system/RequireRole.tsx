import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMyRoles, type Department } from "@/hooks/useMyRoles";

type Gate = "staff" | "client" | "resident" | "leadership" | "finance" | Department;

/**
 * Route guard. Access is also enforced in the database — this only decides what to render.
 */
export function RequireRole({ gate, children }: { gate: Gate; children: ReactNode }) {
  const { loading, userId, isStaff, isClient, isLeadership, canSeeFinance, departments, landingPath, has } = useMyRoles();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper text-ink grid place-items-center">
        <div className="eyebrow text-ink-faint">Checking access…</div>
      </div>
    );
  }

  if (!userId) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const allowed =
    gate === "staff"
      ? isStaff
      : gate === "client"
        ? isClient
        : gate === "resident"
          ? has("resident")
        : gate === "leadership"
          ? isLeadership
          : gate === "finance"
            ? canSeeFinance
            : departments[gate];

  if (!allowed) {
    return <Navigate to={landingPath === location.pathname ? "/" : landingPath} replace />;
  }

  return <>{children}</>;
}

export default RequireRole;
