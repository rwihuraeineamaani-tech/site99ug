import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMyRoles, type Department } from "@/hooks/useMyRoles";
import logo from "@/assets/site99-logo.png";

type Gate = "staff" | "client" | "resident" | "talent_portal" | "admin" | "leadership" | "finance" | Department;

/**
 * Route guard. Access is also enforced in the database — this only decides what to render.
 */
export function RequireRole({ gate, children }: { gate: Gate; children: ReactNode }) {
  const { loading, userId, isStaff, isClient, isLeadership, canSeeFinance, departments, landingPath, has, talentId } = useMyRoles();
  const location = useLocation();

  if (loading) {
    return (
      <div className="deck min-h-screen bg-paper text-ink grid place-items-center" role="status" aria-label="Opening Site 99">
        <img
          src={logo}
          alt="Site 99"
          className="access-logo-float h-20 w-20 object-contain sm:h-24 sm:w-24"
        />
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
        : gate === "talent_portal"
        ? !!talentId
      : gate === "resident"
          ? has("resident")
        : gate === "admin"
          ? has("admin")
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
