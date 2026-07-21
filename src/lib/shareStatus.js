/** Display lifecycle for property shares: Sent → Viewed → Scored. */

export function shareDisplayStatus(item = {}) {
  if (item.display_status) return item.display_status;
  const status = String(item.status || "").trim();
  if (status === "cancelled") return "Cancelled";
  if (status === "returned" || status === "scored" || item.scored_at) return "Scored";
  if (status === "viewed" || item.viewed_at) return "Viewed";
  return "Sent";
}

export function shareStatusBadgeClass(label) {
  switch (label) {
    case "Scored":
      return "bg-[#10b981]/10 text-[#059669]";
    case "Viewed":
      return "bg-sky-50 text-sky-700";
    case "Cancelled":
      return "bg-slate-100 text-slate-500";
    case "Sent":
    default:
      return "bg-amber-50 text-amber-700";
  }
}

export function formatShareWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Recipient can still open Evaluate to score. */
export function shareNeedsScoring(item = {}) {
  const status = String(item.status || "").trim();
  return status === "pending_score" || status === "viewed";
}
