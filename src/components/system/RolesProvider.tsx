import { ReactNode } from "react";
import { RolesContextObject, useRolesState } from "@/hooks/useMyRoles";

/** Loads the signed-in person once and shares the answer with the whole app. */
export function RolesProvider({ children }: { children: ReactNode }) {
  const state = useRolesState();
  return <RolesContextObject.Provider value={state}>{children}</RolesContextObject.Provider>;
}

export default RolesProvider;
