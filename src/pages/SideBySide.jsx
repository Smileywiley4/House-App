import { Navigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * Legacy /SideBySide — redirects to canonical /Compare.
 * Browse compare handoff uses the same sessionStorage keys; Compare loads them on mount.
 */
export default function SideBySide() {
  return <Navigate to={createPageUrl("Compare")} replace />;
}
